// Real-browser proof of how a generated interface is presented in chat.
//
// Three things are asserted, all previously wrong:
//   1. Neither chat card carries a preview graphic. The graphic could only show
//      a cropped band of the first screen, and it used to escape its card
//      entirely and paint an artboard across the conversation.
//   2. The card still summarises the design — title, screen count, screens.
//   3. Opening the design from the card opens a tab inside the app rather than
//      navigating to the standalone design page and dropping the tab bar.
//
// The home-screen tile keeps its own checks: it is the remaining user of the
// preview component, and its containment contract is what the escaping bug
// violated, so it is measured rather than merely looked for.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-chat-design-card.mjs
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
const DESIGN_TITLE = "Preview Containment Interface";
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

// Multi-screen, and the first artboard carries real content so the home-screen
// tile renders an actual artboard rather than the empty-state icon — the empty
// state is small enough that it would hide the overflow this test measures.
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

// Sourced the way the real thing is: this whole flow only happens for designs
// generated from a workflow, and the inline view keys its header off that.
const designRow = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'workflow-bridge', $2, $3) RETURNING id`,
  [USER_ID, JSON.stringify(craftState), DESIGN_TITLE],
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
  page.evaluate(async ({ target, id, designId, workflowName, title }) => {
    const mod = await import("/src/lib/kiteaiTranscript.ts");
    const exchange = mod.buildGenerationExchange({
      origin: "workflow",
      prompt: "Generate an interface from this workflow.",
      workflowName,
      designId,
      title,
      screenLabels: ["Mission Specs", "Fleet Management", "Rig Checkout"],
      // The workflow thread never receives the closing offer in production.
      includeEditOffer: target === "design",
    });
    if (target === "design") mod.appendDesignChat(id, exchange);
    else mod.appendTranscript(id, exchange);
  }, { target, id, designId: DESIGN_ID, workflowName: WORKFLOW_NAME, title: DESIGN_TITLE });

/**
 * What does the card actually contain? The absence of a graphic is only
 * meaningful alongside the presence of the summary, so both are reported: a
 * card that failed to render would otherwise read as a pass.
 */
const inspectCard = (cardSel, title) =>
  page.evaluate(({ sel, title }) => {
    const card = document.querySelector(sel);
    if (!card) return { card: false };
    const text = card.textContent ?? "";
    const box = card.getBoundingClientRect();
    return {
      card: true,
      // The preview component labels itself, whichever state it renders in.
      hasGraphic: !!card.querySelector('[aria-label$="design preview"], [data-preview-state]'),
      hasTitle: text.includes(title),
      hasScreenCount: /3 screens/.test(text),
      screensNamed: ["Mission Specs", "Fleet Management", "Rig Checkout"].filter((s) => text.includes(s)).length,
      height: Math.round(box.height),
    };
  }, { sel: cardSel, title });

/**
 * Names of the open tabs in the editor's tab bar. Panels use `tab-…` test ids
 * of their own, so tabs are identified by the name element they contain, and
 * the name is read from its tooltip — the visible label is truncated at ten
 * characters, which is short enough to make two different designs look alike.
 */
const tabNames = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="tab-"]'))
      .map((el) => el.querySelector('[data-testid="text-workflow-name"]'))
      .filter(Boolean)
      .map((el) => (el.getAttribute("title") ?? el.textContent ?? "").replace(/ - Double-click to rename$/, "").trim()),
  );

try {
  // ── The Interface chat panel ───────────────────────────────────────────────
  await page.goto(`https://${domain}/designs/${DESIGN_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  await seedExchange("design", DESIGN_ID);
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(5000);

  const design = await inspectCard(`[data-testid="design-chat-preview-${DESIGN_ID}"]`, DESIGN_TITLE);
  check("The Interface chat shows a card for the generated design", design.card, JSON.stringify(design));
  if (design.card) {
    check("The Interface card shows no preview graphic", !design.hasGraphic, JSON.stringify(design));
    check("The Interface card still summarises the design",
      design.hasTitle && design.hasScreenCount && design.screensNamed === 3, JSON.stringify(design));
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

  const workflow = await inspectCard(`[data-testid="design-preview-${DESIGN_ID}"]`, DESIGN_TITLE);
  check("The workflow chat shows a card for the generated design", workflow.card, JSON.stringify(workflow));
  if (workflow.card) {
    check("The workflow card shows no preview graphic", !workflow.hasGraphic, JSON.stringify(workflow));
    check("The workflow card still summarises the design",
      workflow.hasTitle && workflow.hasScreenCount && workflow.screensNamed === 3, JSON.stringify(workflow));
  }

  // The offer to keep editing belongs to the design's own chat only.
  const workflowPanelText = await page.evaluate(() => document.body.innerText ?? "");
  check("The workflow chat does not offer to edit the design",
    !/tell me what to change/i.test(workflowPanelText));

  // ── Opening the design from the card ───────────────────────────────────────
  const tabsBefore = await tabNames();
  const openBtn = page.locator(`[data-testid="design-preview-open-${DESIGN_ID}"]`).first();
  const haveOpen = (await openBtn.count()) > 0;
  check("The workflow card offers a way to open the design", haveOpen);
  if (haveOpen) {
    await openBtn.click();
    await page.waitForTimeout(4000);

    const url = new URL(page.url());
    // Leaving for /designs/:id is exactly the bug: that page has no tab bar.
    check("Opening the design keeps the user on the editor's own URL",
      !url.pathname.startsWith("/designs/"), `path=${url.pathname}`);
    const shellIntact = await page.locator('[data-testid="tab-home"]').count();
    check("The app shell and its tab bar survive opening the design", shellIntact > 0);

    const tabsAfter = await tabNames();
    check("A tab for the design is added to the editor",
      tabsAfter.length === tabsBefore.length + 1 && tabsAfter.some((n) => n.includes(DESIGN_TITLE)),
      `before=${JSON.stringify(tabsBefore)} after=${JSON.stringify(tabsAfter)}`);

    // Not just a tab entry: the design itself has to be what is now on screen.
    // This control belongs to the inline design view's own header, so its
    // presence means the design mounted inside the editor — not merely that a
    // tab label appeared.
    const designMounted = await page.locator('[data-testid="button-share-design-inline"]').count();
    check("The design's editor is what the new tab shows", designMounted > 0);

    // Going back and asking again must focus that tab, not stack up duplicates.
    const workflowTab = page
      .locator(`[data-testid^="tab-"]:has([data-testid="text-workflow-name"][title^="${WORKFLOW_NAME}"])`)
      .first();
    if ((await workflowTab.count()) > 0) {
      await workflowTab.click();
      await page.waitForTimeout(2500);
      const reopen = page.locator(`[data-testid="design-preview-open-${DESIGN_ID}"]`).first();
      if ((await reopen.count()) > 0) {
        await reopen.click();
        await page.waitForTimeout(3000);
        const tabsAgain = await tabNames();
        check("Opening it a second time switches to the existing tab",
          tabsAgain.length === tabsAfter.length,
          `after=${JSON.stringify(tabsAfter)} again=${JSON.stringify(tabsAgain)}`);
      } else {
        check("Opening it a second time switches to the existing tab", false,
          "the card was not reachable after switching back to the workflow tab");
      }
    } else {
      check("Opening it a second time switches to the existing tab", false,
        `workflow tab not found among ${JSON.stringify(tabsAfter)}`);
    }
  }

  // ── The home screen, which still renders previews and must keep working ────
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
