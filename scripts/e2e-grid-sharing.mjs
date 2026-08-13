// Real-browser proof that share / copy / revoke work from the project tiles on
// the Home grid, for BOTH project types and BOTH grid views.
//
// The bugs this pins down:
//   - "Share" was greyed out with a "cloud only" hint for every project open as
//     a tab, because the tile list hardcoded every tab as browser-local. The
//     interesting case is therefore a project that has been *opened* (so it is
//     tab-backed) and is nonetheless saved in the cloud.
//   - Interfaces were invisible in the grid unless already open as a tab.
//   - Interface tiles read share state from the parent workflow project, so a
//     workflow's shared link made an unshared Interface look shared. This test
//     seeds exactly that trap: a shared workflow plus an unshared Interface.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-grid-sharing.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-grid-share-user";
const EMAIL = "e2e-grid-share@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const HEADING = "Grid Share Interface";
const DESIGN_TITLE = "E2E Grid Interface";
const WORKFLOW_NAME = "E2E Grid Workflow";

const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    nodes: ["artboard1"],
    props: { gap: 16, padding: 16, direction: "column" },
    custom: {}, hidden: false, parent: null, isCanvas: true,
    displayName: "AstryxSection", linkedNodes: {},
  },
  artboard1: {
    type: { resolvedName: "AstryxArtboard" },
    nodes: ["text1"],
    props: { label: "Grid Screen", width: 390, height: 600, x: 64, y: 64 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    displayName: "AstryxArtboard", linkedNodes: {},
  },
  text1: {
    type: { resolvedName: "AstryxText" },
    nodes: [],
    props: { children: HEADING },
    custom: {}, hidden: false, parent: "artboard1", isCanvas: false,
    displayName: "AstryxText", linkedNodes: {},
  },
};

// Re-runnable: drop what a previous run left behind.
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);
await client.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);

const designRow = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'native', $2, $3) RETURNING id`,
  [USER_ID, JSON.stringify(craftState), DESIGN_TITLE],
);
const designId = designRow.rows[0].id;

// The workflow is seeded ALREADY SHARED. If Interface tiles were still reading
// workflow share state, the unshared Interface would wrongly render as shared.
const workflowShareUuid = crypto.randomUUID();
const projectRow = await client.query(
  `INSERT INTO saved_projects (user_id, name, workflow_data, share_uuid, is_share_enabled, last_shared_at)
   VALUES ($1, $2, $3, $4, true, now()) RETURNING id`,
  [
    USER_ID,
    WORKFLOW_NAME,
    JSON.stringify({
      nodes: [{ id: "n1", type: "default", position: { x: 40, y: 40 }, data: { label: "Step one" } }],
      edges: [],
    }),
    workflowShareUuid,
  ],
);
const projectId = projectRow.rows[0].id;

// A second account with its own Interface — the list endpoint must never
// mention it.
const OTHER_ID = "e2e-grid-share-other";
const OTHER_TITLE = "E2E Someone Elses Interface";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [OTHER_ID, "e2e-grid-share-other@example.com"],
);
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [OTHER_ID]);
const otherDesign = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title, share_uuid, is_share_enabled)
   VALUES ($1, 'native', $2, $3, $4, true) RETURNING id`,
  [OTHER_ID, JSON.stringify(craftState), OTHER_TITLE, crypto.randomUUID()],
);
const otherDesignId = otherDesign.rows[0].id;

// An Interface of our own whose sharing was revoked: the dead uuid it still
// carries in the database must not be handed back to the client.
const revokedUuid = crypto.randomUUID();
const revokedDesign = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title, share_uuid, is_share_enabled)
   VALUES ($1, 'native', $2, 'E2E Previously Shared Interface', $3, false) RETURNING id`,
  [USER_ID, JSON.stringify(craftState), revokedUuid],
);
const revokedDesignId = revokedDesign.rows[0].id;

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
await client.end();

console.log("Seeded design", designId, "workflow", projectId);

const domain = process.env.REPLIT_DEV_DOMAIN;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  // The Share action copies to the clipboard; without this it throws.
  permissions: ["clipboard-read", "clipboard-write"],
});
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true }]);
const page = await ctx.newPage();

const dismissBanner = async (p) => {
  try { await p.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
};

const gotoHome = async () => {
  await page.goto(`https://${domain}/`, { waitUntil: "networkidle", timeout: 90000 });
  await dismissBanner(page);
  await page.waitForTimeout(3000);
};

/** Finds the tile for a project by its visible name and returns its card id. */
const cardIdFor = async (name) => {
  const card = page.locator('[data-testid^="card-project-"]').filter({ hasText: name }).first();
  if ((await card.count()) === 0) return null;
  return (await card.getAttribute("data-testid")).replace("card-project-", "");
};

const openMenu = async (cardId) => {
  await page.locator(`[data-testid="button-project-menu-${cardId}"]`).click({ force: true });
  await page.waitForTimeout(600);
};

const closeMenu = async () => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
};

const readClipboard = () => page.evaluate(() => navigator.clipboard.readText());

// ── Both project types are listed without being opened first ─────────────────
await gotoHome();

const designCardId = await cardIdFor(DESIGN_TITLE);
const workflowCardId = await cardIdFor(WORKFLOW_NAME);
check(
  "Another user's Interface is not shown in the grid",
  (await page.locator('[data-testid^="card-project-"]').filter({ hasText: OTHER_TITLE }).count()) === 0,
);
check("An Interface that was never opened still appears in the grid", designCardId !== null);
check("The workflow project appears in the grid", workflowCardId !== null);
if (!designCardId || !workflowCardId) {
  console.log("Tiles missing — aborting the remaining checks.");
  await browser.close();
  process.exit(1);
}

check(
  "The unshared Interface does NOT inherit the workflow's Shared badge",
  (await page.locator(`[data-testid="badge-shared-${designCardId}"]`).count()) === 0,
);

// ── The list endpoint itself, not just what the grid renders ─────────────────
const listPayload = await page.evaluate(async () => {
  const r = await fetch("/api/designs", { credentials: "include" });
  return { status: r.status, body: await r.json() };
});
const listed = listPayload.body.designs ?? [];
check("The Interfaces list responds to its owner", listPayload.status === 200);
check(
  "The list contains no other user's Interface",
  !listed.some((d) => d.id === otherDesignId),
);
check(
  "The list exposes no owner id and no canvas state",
  listed.every((d) => !("claimedByUserId" in d) && !("craftState" in d)),
);
check(
  "A revoked Interface's dead link is withheld",
  listed.find((d) => d.id === revokedDesignId)?.shareUuid === null,
);
// Belt and braces: the revoked uuid must not resolve either.
const revokedStatus = await page.evaluate(
  async (uuid) => (await fetch(`/api/design-view/${uuid}`)).status,
  revokedUuid,
);
check("A revoked Interface link 404s at the endpoint", revokedStatus === 404, String(revokedStatus));
check(
  "The shared workflow does show a Shared badge",
  (await page.locator(`[data-testid="badge-shared-${workflowCardId}"]`).count()) === 1,
);

// ── Share an Interface straight from its tile ────────────────────────────────
await openMenu(designCardId);
check(
  "Interface tile offers an enabled Share action, not 'cloud only'",
  (await page.locator(`[data-testid="menu-share-${designCardId}"]`).count()) === 1 &&
    (await page.locator(`[data-testid="menu-share-${designCardId}"] >> text=cloud only`).count()) === 0,
);

await page.locator(`[data-testid="menu-share-${designCardId}"]`).click();
await page.waitForTimeout(3000);

const designShareUrl = await readClipboard();
check(
  "Sharing an Interface copies its link in one action",
  /\/design-view\/[0-9a-f-]{36}$/.test(designShareUrl),
  designShareUrl,
);
check(
  "The Interface tile now shows a Shared badge",
  (await page.locator(`[data-testid="badge-shared-${designCardId}"]`).count()) === 1,
);

// ── The shared link really works for a logged-out visitor ────────────────────
const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const guest = await guestCtx.newPage();
await guest.goto(designShareUrl, { waitUntil: "networkidle", timeout: 90000 });
await dismissBanner(guest);
await guest.waitForTimeout(3000);
check(
  "A logged-out visitor can open the Interface link made from the tile",
  (await guest.locator(`text="${HEADING}"`).count()) >= 1,
);

// ── Once shared, the menu switches to Copy + Revoke ──────────────────────────
await openMenu(designCardId);
check(
  "A shared Interface offers 'Copy share link'",
  (await page.locator(`[data-testid="menu-copy-share-link-${designCardId}"]`).count()) === 1,
);
check(
  "A shared Interface offers 'Revoke share link'",
  (await page.locator(`[data-testid="menu-revoke-share-${designCardId}"]`).count()) === 1,
);
check(
  "The plain 'Share' item is gone once shared",
  (await page.locator(`[data-testid="menu-share-${designCardId}"]`).count()) === 0,
);
check(
  "The Shared badge is an indicator, not a hidden revoke button",
  (await page.locator(`[data-testid="badge-shared-${designCardId}"]`).getAttribute("class"))
    ?.includes("cursor-pointer") !== true,
);

// ── Revoke from the tile kills the link ──────────────────────────────────────
await page.locator(`[data-testid="menu-revoke-share-${designCardId}"]`).click();
await page.waitForTimeout(3000);

check(
  "Revoking from the tile clears the Shared badge",
  (await page.locator(`[data-testid="badge-shared-${designCardId}"]`).count()) === 0,
);

await guest.goto(designShareUrl, { waitUntil: "networkidle", timeout: 90000 });
await guest.waitForTimeout(2500);
check(
  "The revoked Interface link no longer shows anything",
  (await guest.locator(`text="${HEADING}"`).count()) === 0,
);

// ── The same flow for a workflow project ─────────────────────────────────────
await openMenu(workflowCardId);
check(
  "A shared workflow offers 'Revoke share link' in its menu",
  (await page.locator(`[data-testid="menu-revoke-share-${workflowCardId}"]`).count()) === 1,
);
await page.locator(`[data-testid="menu-copy-share-link-${workflowCardId}"]`).click();
await page.waitForTimeout(2500);
const workflowShareUrl = await readClipboard();
check(
  "Copying a workflow link yields a workflow view URL",
  workflowShareUrl.includes(`/view/${workflowShareUuid}`),
  workflowShareUrl,
);

await openMenu(workflowCardId);
await page.locator(`[data-testid="menu-revoke-share-${workflowCardId}"]`).click();
await page.waitForTimeout(3000);
check(
  "Revoking a workflow from the tile clears its Shared badge",
  (await page.locator(`[data-testid="badge-shared-${workflowCardId}"]`).count()) === 0,
);

// ── The regression that started all this: an OPEN project is not "local" ─────
// Opening the workflow gives it a tab, which is exactly the state that used to
// disable Share with a "cloud only" hint.
await page.locator(`[data-testid="card-project-${workflowCardId}"]`).click();
await page.waitForTimeout(4000);
await page.locator('[data-testid="tab-home"]').click();
await page.waitForTimeout(2500);

const openWorkflowCardId = await cardIdFor(WORKFLOW_NAME);
check("The opened workflow is still listed once on Home", openWorkflowCardId !== null);
if (openWorkflowCardId) {
  await openMenu(openWorkflowCardId);
  const shareItem = page.locator(`[data-testid="menu-share-${openWorkflowCardId}"]`);
  check(
    "A cloud project open as a tab is NOT marked 'cloud only'",
    (await shareItem.count()) === 1 && (await shareItem.locator("text=cloud only").count()) === 0,
  );
  check(
    "Share on an open cloud project is clickable",
    (await shareItem.getAttribute("data-disabled")) === null,
  );
  await closeMenu();
}

// ── An Interface open as a tab still reads its OWN share state ───────────────
// This is the exact spot the cross-contamination lived: a design tab used to
// take share state from the workflow project behind it. Re-share the workflow,
// then open the (unshared) Interface and come back.
if (openWorkflowCardId) {
  await openMenu(openWorkflowCardId);
  await page.locator(`[data-testid="menu-share-${openWorkflowCardId}"]`).click();
  await page.waitForTimeout(3000);
}

const designTileBeforeOpen = await cardIdFor(DESIGN_TITLE);
if (designTileBeforeOpen) {
  await page.locator(`[data-testid="card-project-${designTileBeforeOpen}"]`).click();
  await page.waitForTimeout(4000);
  await page.locator('[data-testid="tab-home"]').click();
  await page.waitForTimeout(2500);

  const openDesignCardId = await cardIdFor(DESIGN_TITLE);
  check("The opened Interface is still listed once on Home", openDesignCardId !== null);
  if (openDesignCardId) {
    check(
      "An open Interface does not inherit the workflow's share state",
      (await page.locator(`[data-testid="badge-shared-${openDesignCardId}"]`).count()) === 0,
    );
    await openMenu(openDesignCardId);
    check(
      "An open Interface still offers an enabled Share action",
      (await page.locator(`[data-testid="menu-share-${openDesignCardId}"]`).count()) === 1 &&
        (await page.locator(`[data-testid="menu-share-${openDesignCardId}"] >> text=cloud only`).count()) === 0,
    );
    await closeMenu();
  }
}

// ── All Projects view behaves the same as the Recent grid ────────────────────
await page.locator('[data-testid="button-view-all-projects"]').click();
await page.waitForTimeout(2500);

const allViewDesignCardId = await cardIdFor(DESIGN_TITLE);
check("Interfaces are listed in the All Projects view too", allViewDesignCardId !== null);
if (allViewDesignCardId) {
  await openMenu(allViewDesignCardId);
  check(
    "All Projects view offers the same enabled Share action",
    (await page.locator(`[data-testid="menu-share-${allViewDesignCardId}"]`).count()) === 1 &&
      (await page.locator(`[data-testid="menu-share-${allViewDesignCardId}"] >> text=cloud only`).count()) === 0,
  );
  await closeMenu();
}

await browser.close();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log("Failed: " + results.filter((r) => !r.ok).map((r) => r.name).join(", "));
  process.exit(1);
}
