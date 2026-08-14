// Real-browser proof that the generated-screen preview stays inside its card.
//
// The preview renders a live editor for the design's first artboard. It used to
// position itself against whichever ancestor happened to be positioned, so in
// the chat panels — which provide none — it escaped its card and painted an
// artboard across the conversation.
//
// Measuring rectangles is the point here. Asserting "the card is present" would
// have passed the whole time the bug existed, so each surface is checked two
// ways: the preview's own box must sit inside its card, and a hit test at the
// centre of a chat message must reach the message rather than the preview.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-design-preview-containment.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  console.error("Refusing to run destructive E2E setup against a production environment.");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-preview-containment-user";
const EMAIL = "e2e-preview-containment@example.com";
const WORKFLOW_NAME = "Preview Containment Flow";
const PROJECT_UUID = "e2e-pc-" + crypto.randomBytes(6).toString("hex");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
};

async function cleanup() {
  try {
    await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);
    await client.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);
  } catch (e) {
    console.error("cleanup warning:", e.message);
  }
}

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await cleanup();

// Multi-screen, and the first artboard carries real content so the preview
// renders an actual artboard rather than the empty-state icon — the empty state
// is small enough that it would hide the overflow this test exists to catch.
const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" }, displayName: "AstryxSection", isCanvas: true,
    props: { direction: "row", gap: 80 }, custom: {}, hidden: false, parent: null,
    nodes: ["ab-specs", "ab-fleet", "ab-checkout"], linkedNodes: {},
  },
  "ab-specs": {
    type: { resolvedName: "AstryxArtboard" }, displayName: "AstryxArtboard",
    props: { label: "Mission Specs", width: 390, height: 600, x: 40, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["specs-heading"], linkedNodes: {},
  },
  "specs-heading": {
    type: { resolvedName: "AstryxText" }, displayName: "AstryxText",
    props: { children: "Mission Specs & HIL Rigs" },
    custom: {}, hidden: false, parent: "ab-specs", isCanvas: false, nodes: [], linkedNodes: {},
  },
  "ab-fleet": {
    type: { resolvedName: "AstryxArtboard" }, displayName: "AstryxArtboard",
    props: { label: "Fleet Management", width: 390, height: 600, x: 500, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true, nodes: [], linkedNodes: {},
  },
  "ab-checkout": {
    type: { resolvedName: "AstryxArtboard" }, displayName: "AstryxArtboard",
    props: { label: "Rig Checkout", width: 390, height: 600, x: 960, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true, nodes: [], linkedNodes: {},
  },
};

const designRow = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'native', $2, 'Preview Containment Interface') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)],
);
const DESIGN_ID = designRow.rows[0].id;

const projectRow = await client.query(
  `INSERT INTO saved_projects (user_id, project_uuid, name, workflow_data)
   VALUES ($1, $2, $3, $4) RETURNING id`,
  [USER_ID, PROJECT_UUID, WORKFLOW_NAME, JSON.stringify({
    nodes: [{ id: "n1", type: "kiteFrameNode", position: { x: 0, y: 0 }, data: { label: "Start" } }],
    edges: [], canvasObjects: [], viewport: { x: 0, y: 0, zoom: 1 },
  })],
);
const CLOUD_PROJECT_ID = projectRow.rows[0].id;

const sid = crypto.randomBytes(16).toString("hex");
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify({
    cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    passport: { user: { id: USER_ID, email: EMAIL } },
  }), new Date(Date.now() + 86400000)],
);
const cookieValue = "s:" + sid + "." + crypto.createHmac("sha256", process.env.SESSION_SECRET)
  .update(sid).digest("base64").replace(/=+$/, "");
const domain = process.env.REPLIT_DEV_DOMAIN;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();

/** Seed a generation exchange onto a thread using the app's own helpers. */
const seedExchange = (target, id) =>
  page.evaluate(async ({ target, id, designId, workflowName }) => {
    const mod = await import("/src/lib/kiteaiTranscript.ts");
    const exchange = mod.buildGenerationExchange({
      origin: "workflow",
      prompt: "Generate an interface from this workflow.",
      workflowName,
      designId,
      title: "Preview Containment Interface",
      screenLabels: ["Mission Specs", "Fleet Management", "Rig Checkout"],
    });
    if (target === "design") mod.appendDesignChat(id, exchange);
    else mod.appendTranscript(id, exchange);
  }, { target, id, designId: DESIGN_ID, workflowName: WORKFLOW_NAME });

/**
 * Does the preview sit inside its card, and can you still reach the message
 * behind it? Rects are compared with a pixel of tolerance for rounding.
 */
const inspect = (cardSel) =>
  page.evaluate((sel) => {
    const card = document.querySelector(sel);
    if (!card) return { card: false };
    const preview = card.querySelector('[aria-label$="design preview"]');
    if (!preview) return { card: true, preview: false };

    const c = card.getBoundingClientRect();
    const p = preview.getBoundingClientRect();
    const contained =
      p.left >= c.left - 1 && p.right <= c.right + 1 &&
      p.top >= c.top - 1 && p.bottom <= c.bottom + 1;

    // Guard against a hollow pass. Containment of an empty placeholder would be
    // trivial, so require the real artboard branch; and since the artboard is
    // deliberately larger than the card, clipping is what keeps it inside —
    // assert that too, or removing `overflow-hidden` would go unnoticed.
    const ready = preview.getAttribute("data-preview-state") === "ready";
    const content = preview.querySelector('[data-preview-content="true"]');
    const cr = content?.getBoundingClientRect();
    const clipped = !!cr && (cr.height > c.height + 1 || cr.width > c.width + 1);
    const overflowHidden = getComputedStyle(preview).overflow === "hidden";

    // Is anything painted over the conversation? Hit test the middle of every
    // other text-bearing block in the scroll container and see whether the
    // preview answers instead of the message.
    const panel = card.closest('[class*="overflow-y"]') ?? card.parentElement;
    let covered = 0;
    let probed = 0;
    for (const el of Array.from(panel?.querySelectorAll("p, span, div") ?? [])) {
      if (card.contains(el)) continue;
      if (!el.textContent?.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 8) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit) continue;
      probed += 1;
      if (hit.closest('[aria-label$="design preview"]')) covered += 1;
    }

    return {
      card: true, preview: true, contained, covered, probed,
      ready, clipped, overflowHidden,
      cardBox: { w: Math.round(c.width), h: Math.round(c.height) },
      previewBox: { w: Math.round(p.width), h: Math.round(p.height) },
      overflow: {
        right: Math.round(p.right - c.right),
        bottom: Math.round(p.bottom - c.bottom),
      },
    };
  }, cardSel);

const describe = (r) =>
  `card=${r.cardBox?.w}x${r.cardBox?.h} preview=${r.previewBox?.w}x${r.previewBox?.h} ` +
  `overflowRight=${r.overflow?.right} overflowBottom=${r.overflow?.bottom} covered=${r.covered}/${r.probed}`;

try {
  // ── The Interface chat panel ───────────────────────────────────────────────
  await page.goto(`https://${domain}/designs/${DESIGN_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  await seedExchange("design", DESIGN_ID);
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);

  const design = await inspect(`[data-testid="design-chat-preview-${DESIGN_ID}"]`);
  check("The Interface chat shows the generated preview card", design.card && design.preview,
    JSON.stringify(design));
  if (design.preview) {
    check("The Interface preview shows a real artboard, not a placeholder", design.ready, describe(design));
    check("The preview stays inside its card in the Interface chat", design.contained, describe(design));
    check("The Interface card is what crops the oversized artboard",
      design.clipped && design.overflowHidden, describe(design));
    check("The Interface preview never intercepts clicks meant for the conversation", design.covered === 0, describe(design));
  }

  // ── The workflow chat panel ────────────────────────────────────────────────
  await page.goto(`https://${domain}/project/${PROJECT_UUID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);
  // Seed before opening the project, so the panel reads the thread as it mounts.
  await seedExchange("workflow", PROJECT_UUID);

  // The deep link lands on the editor's home view with the project listed, so
  // open it the way a user does. The live chat input is the marker that the
  // editor's own KiteAI panel has mounted — the toolbar's create-interface
  // button is not, since it belongs to a flow header that a workflow only
  // renders once its nodes form a flow.
  const chatInputSel = '[data-testid="input-kiteai-message"]';
  if ((await page.locator(chatInputSel).count()) === 0) {
    const card = page.locator(`[data-testid="card-project-${CLOUD_PROJECT_ID}"]`).first();
    await card.waitFor({ state: "visible", timeout: 30000 });
    await card.click();
  }
  let editorOpen = true;
  try {
    await page.locator(chatInputSel).first().waitFor({ state: "visible", timeout: 30000 });
  } catch {
    editorOpen = false;
  }
  check("The workflow opens in the editor with its KiteAI panel", editorOpen);
  await page.waitForTimeout(4000);

  const workflow = await inspect(`[data-testid="design-preview-${DESIGN_ID}"]`);
  check("The workflow chat shows the generated preview card", workflow.card && workflow.preview,
    JSON.stringify(workflow));
  if (workflow.preview) {
    check("The workflow preview shows a real artboard, not a placeholder", workflow.ready, describe(workflow));
    check("The preview stays inside its card in the workflow chat", workflow.contained, describe(workflow));
    check("The workflow card is what crops the oversized artboard",
      workflow.clipped && workflow.overflowHidden, describe(workflow));
    check("The workflow preview never intercepts clicks meant for the conversation", workflow.covered === 0, describe(workflow));
  }

  // ── The home screen, which already worked and must keep working ────────────
  await page.goto(`https://${domain}/`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);

  const tile = await page.evaluate(() => {
    const preview = document.querySelector('[aria-label$="design preview"]');
    if (!preview) return { found: false };
    const holder = preview.closest(".aspect-video") ?? preview.parentElement;
    const h = holder.getBoundingClientRect();
    const p = preview.getBoundingClientRect();
    return {
      found: true,
      // Still filling its tile, not collapsed to nothing.
      fills: Math.abs(p.width - h.width) <= 1 && Math.abs(p.height - h.height) <= 1,
      contained:
        p.left >= h.left - 1 && p.right <= h.right + 1 &&
        p.top >= h.top - 1 && p.bottom <= h.bottom + 1,
      box: `${Math.round(p.width)}x${Math.round(p.height)} in ${Math.round(h.width)}x${Math.round(h.height)}`,
    };
  });
  check("A design tile preview is rendered on the home screen", tile.found, JSON.stringify(tile));
  if (tile.found) {
    check("The home screen tile preview still fills its tile", tile.fills, tile.box);
    check("The home screen tile preview stays within its tile", tile.contained, tile.box);
  }

  // ── The placeholder shown when a preview can't load ────────────────────────
  // It renders through the same frame, so it must be contained on the same
  // terms. Only the single-design fetch is failed; the list still loads.
  await page.route("**/api/designs/*", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);

  const placeholder = await page.evaluate(() => {
    const el = document.querySelector('[data-preview-state="placeholder"]');
    if (!el) return { found: false };
    const holder = el.closest(".aspect-video") ?? el.parentElement;
    const h = holder.getBoundingClientRect();
    const p = el.getBoundingClientRect();
    return {
      found: true,
      contained:
        p.left >= h.left - 1 && p.right <= h.right + 1 &&
        p.top >= h.top - 1 && p.bottom <= h.bottom + 1,
      clips: getComputedStyle(el).overflow === "hidden",
      box: `${Math.round(p.width)}x${Math.round(p.height)} in ${Math.round(h.width)}x${Math.round(h.height)}`,
    };
  });
  check("An unloadable preview falls back to a placeholder", placeholder.found, JSON.stringify(placeholder));
  if (placeholder.found) {
    check("The placeholder is contained and clipped just like a loaded preview",
      placeholder.contained && placeholder.clips, placeholder.box);
  }
} catch (err) {
  check("Unexpected failure", false, err?.message ?? String(err));
  console.error(err);
} finally {
  await cleanup();
  try {
    await client.query(`DELETE FROM sessions WHERE sid = $1`, [sid]);
  } catch { /* best effort */ }
  await client.end();
  await browser.close();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log("Failed: " + results.filter((r) => !r.ok).map((r) => r.name).join(", "));
  process.exit(1);
}
