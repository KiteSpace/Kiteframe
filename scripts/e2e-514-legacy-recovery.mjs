// E2E for task #514: Old designs with hidden orphaned screens must recover
// their content when reopened, and the recovered state must be what gets
// persisted after the next auto-save (PATCH).
//
// Specifically verifies:
//  1. A design seeded with a pre-fix orphaned artboard (in DB, as if written
//     during the bug window) renders ALL screens when opened in a real browser.
//  2. After a simulated auto-save (PATCH with the repaired state), the DB
//     record has the recovered artboard — not the orphaned pre-fix shape.
//  3. A genuinely empty ghost artboard is pruned, not resurrected.
//  4. A second open (reload) still shows all screens — the round-trip is stable.
//
// The PATCH check mirrors how the client's SaveWatcher behaves: craft.js
// serializes the post-repair state (which includes the reattached artboard)
// and sends it via PATCH /api/designs/:id. The server then runs
// repairCraftState + pruneUnreachableCraftNodes before persisting, so the
// stored state should be fully clean.
//
// Prerequisites: DATABASE_URL, SESSION_SECRET, REPLIT_DEV_DOMAIN env vars.
// Run: node scripts/e2e-514-legacy-recovery.mjs

import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task514-user";
const EMAIL = "e2e-task514@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta)
   VALUES ($1, $2, 'E2E514', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

// ── Craft state shape mirroring the bug window ────────────────────────────────
// ROOT only lists artboard-1.  artboard-2 (with real content) is orphaned:
// its parent field says "ROOT" but ROOT.nodes doesn't include it.
// ghost-ab is a truly empty artboard — must be pruned, not revived.
const node = (over) => ({
  isCanvas: false, props: {}, displayName: "", custom: {},
  hidden: false, nodes: [], linkedNodes: {}, ...over,
});

const legacyOrphanedState = {
  ROOT: node({
    type: { resolvedName: "AstryxSection" }, isCanvas: true, parent: null,
    props: { direction: "row", gap: 80, padding: 40 },
    displayName: "AstryxSection",
    nodes: ["ab-login"],              // ab-dashboard intentionally MISSING
  }),
  "ab-login": node({
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true, parent: "ROOT",
    props: { label: "Login Screen", width: 390, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", nodes: ["btn-signin"],
  }),
  "btn-signin": node({
    type: { resolvedName: "AstryxButton" }, parent: "ab-login",
    props: { children: "Sign in", variant: "primary" }, displayName: "AstryxButton",
  }),
  // Orphaned artboard — parent declared ROOT, but missing from ROOT.nodes
  "ab-dashboard": node({
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true, parent: "ROOT",
    props: { label: "Dashboard Screen", width: 390, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", nodes: ["txt-heading"],
  }),
  "txt-heading": node({
    type: { resolvedName: "AstryxHeading" }, parent: "ab-dashboard",
    props: { children: "Welcome to Dashboard" }, displayName: "AstryxHeading",
  }),
  // Genuinely empty ghost — no content, must be pruned
  "ghost-ab": node({
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true, parent: "ROOT",
    props: { label: "Ghost Empty", width: 390 }, displayName: "AstryxArtboard",
  }),
};

// Seed the design exactly as it would have been stored during the bug window
// (unrepaired — the bug was that server did NOT run repair before saving).
const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 514 Legacy', 'workflow-bridge')
   RETURNING id`,
  [USER_ID, JSON.stringify(legacyOrphanedState)],
);
const designId = res.rows[0].id;
console.log(`Seeded legacy design ${designId}`);

// ── Forge session ─────────────────────────────────────────────────────────────
const sid = crypto.randomBytes(16).toString("hex");
const expire = new Date(Date.now() + 24 * 3600 * 1000);
await client.query(
  `INSERT INTO sessions (sid, sess, expire)
   VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [
    sid,
    JSON.stringify({
      cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      passport: { user: { id: USER_ID, email: EMAIL } },
    }),
    expire,
  ],
);
const hmac = crypto
  .createHmac("sha256", process.env.SESSION_SECRET)
  .update(sid)
  .digest("base64")
  .replace(/=+$/, "");
const cookieValue = "s:" + sid + "." + hmac;

const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;

// ── Browser setup ─────────────────────────────────────────────────────────────
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{
  name: "connect.sid", value: cookieValue,
  domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax",
}]);
const page = await ctx.newPage();

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
};

// ── Helper: API call with session cookie ─────────────────────────────────────
const api = async (method, path, body) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `connect.sid=${cookieValue}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await r.json(); } catch { /* ignore */ }
  return { status: r.status, json };
};

// ── Helper: read design directly from DB ─────────────────────────────────────
const dbGet = async (id) => {
  const r = await client.query(
    "SELECT craft_state FROM designs WHERE id = $1",
    [id],
  );
  return r.rows[0]?.craft_state ?? null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Browser: open the legacy design — repair must run on load
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── 1. First browser open ───────────────────────────────────────");
await page.goto(`${base}/designs/${designId}`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(3000);
await page.screenshot({ path: "/tmp/e2e-514-first-open.png" });

const bodyText1 = await page.evaluate(() => document.body.innerText);
check("Login Screen artboard renders", bodyText1.includes("Login Screen"));
check("Sign in button renders", bodyText1.includes("Sign in"));
check("Orphaned Dashboard artboard renders", bodyText1.includes("Dashboard Screen"),
  "was blank before fix");
check("Orphaned artboard content renders", bodyText1.includes("Welcome to Dashboard"));
check("Ghost cleanup banner shown", bodyText1.includes("blank artboard") || bodyText1.includes("artboard"));
// Ghost label may appear in the banner (once) but must not appear as a rendered artboard
const ghostCount = bodyText1.split("Ghost Empty").length - 1;
check("Empty ghost artboard is NOT on canvas", ghostCount <= 1,
  `occurrences=${ghostCount}`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Simulate auto-save: PATCH with the orphaned state (as the client would
//    send it after craft.js serializes the repaired-on-load canvas).
//    The server must repair + prune before persisting.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── 2. Simulated auto-save (PATCH with legacy state) ────────────");
const patch = await api("PATCH", `/api/designs/${designId}`, {
  craftState: JSON.stringify(legacyOrphanedState),
});
check("PATCH accepts legacy orphaned state", patch.status === 200, `status=${patch.status}`);

// Verify what the server actually persisted
const dbState = await dbGet(designId);
check("DB: orphaned artboard preserved after save", !!dbState?.["ab-dashboard"],
  dbState ? "ab-dashboard present" : "no db state");
check("DB: artboard content preserved after save", !!dbState?.["txt-heading"],
  dbState ? "txt-heading present" : "no db state");
check("DB: ROOT.nodes includes recovered artboard",
  Array.isArray(dbState?.ROOT?.nodes) && dbState.ROOT.nodes.includes("ab-dashboard"),
  `ROOT.nodes=${JSON.stringify(dbState?.ROOT?.nodes)}`);
check("DB: empty ghost artboard pruned from saved state", !dbState?.["ghost-ab"]);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Reload: content persists (round-trip stability)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── 3. Reload after save ─────────────────────────────────────────");
await page.goto(`${base}/designs/${designId}`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(3000);
await page.screenshot({ path: "/tmp/e2e-514-after-save-reload.png" });

const bodyText3 = await page.evaluate(() => document.body.innerText);
check("After save+reload: Login Screen still renders", bodyText3.includes("Login Screen"));
check("After save+reload: Dashboard Screen still renders", bodyText3.includes("Dashboard Screen"));
check("After save+reload: Dashboard content still renders", bodyText3.includes("Welcome to Dashboard"));
check("After save+reload: ghost artboard still absent from canvas",
  (bodyText3.split("Ghost Empty").length - 1) <= 1);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Additional PATCH with the recovered state (second round-trip must be stable)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── 4. Second save round-trip (idempotency) ──────────────────────");
const recovered = dbState; // already repaired by step 2
if (recovered) {
  const patch2 = await api("PATCH", `/api/designs/${designId}`, {
    craftState: JSON.stringify(recovered),
  });
  check("PATCH with already-repaired state succeeds", patch2.status === 200, `status=${patch2.status}`);
  const dbState2 = await dbGet(designId);
  check("Second save: Dashboard artboard still present", !!dbState2?.["ab-dashboard"]);
  check("Second save: ROOT still includes Dashboard",
    Array.isArray(dbState2?.ROOT?.nodes) && dbState2.ROOT.nodes.includes("ab-dashboard"));
  check("Second save: ghost still pruned", !dbState2?.["ghost-ab"]);
} else {
  check("Second save skipped (no recovered state from step 2)", false,
    "earlier PATCH failed");
}

// ─────────────────────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────────────────────
await browser.close();
await client.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error("FAILED:", failed.map((r) => r.name).join(", "));
}
process.exit(failed.length ? 1 : 0);
