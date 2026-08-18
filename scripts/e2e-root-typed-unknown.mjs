// Real-browser proof for the blank-canvas regression: a design whose top-level
// node arrives with an unrecognised type must still render its screens.
//
// The production failure looked like a success everywhere except the screen —
// 50 nodes, 5 artboards, no disconnected nodes, and a completely empty canvas.
// The only clue was one console line demoting ROOT to AstryxUnknown, a leaf
// placeholder that draws a small dashed box and none of its children.
//
// Unit tests cover the repair functions. What they cannot show is that craft.js
// actually draws the result, which is the only thing the user cares about.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-root-typed-unknown.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

// This script writes and deletes rows and mints a session. Refuse to run
// anywhere but a disposable development database.
if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  console.error("Refusing to run destructive E2E setup against a production environment.");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-root-unknown-user";
const EMAIL = "e2e-root-unknown@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);

/**
 * Mirrors the shape the generator actually produced: two screens with content,
 * hanging off a ROOT typed with `rootType`.
 */
const brokenState = (rootType) => ({
  ROOT: {
    type: rootType,
    displayName: typeof rootType === "object" ? rootType.resolvedName : "Root",
    isCanvas: true,
    props: { direction: "row", gap: 80 },
    custom: {}, hidden: false, parent: null,
    nodes: ["artboard-fleet", "artboard-checkout"],
    linkedNodes: {},
  },
  "artboard-fleet": {
    type: { resolvedName: "AstryxArtboard" },
    displayName: "AstryxArtboard",
    props: { label: "Fleet Management", width: 390, height: 600, x: 40, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["h-fleet"], linkedNodes: {},
  },
  "artboard-checkout": {
    type: { resolvedName: "AstryxArtboard" },
    displayName: "AstryxArtboard",
    props: { label: "Immediate Checkout", width: 390, height: 600, x: 500, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["h-checkout"], linkedNodes: {},
  },
  "h-fleet": {
    type: { resolvedName: "AstryxHeading" },
    displayName: "AstryxHeading",
    props: { children: "FLEET_SCREEN_MARKER" },
    custom: {}, hidden: false, parent: "artboard-fleet", isCanvas: false,
    nodes: [], linkedNodes: {},
  },
  "h-checkout": {
    type: { resolvedName: "AstryxHeading" },
    displayName: "AstryxHeading",
    props: { children: "CHECKOUT_SCREEN_MARKER" },
    custom: {}, hidden: false, parent: "artboard-checkout", isCanvas: false,
    nodes: [], linkedNodes: {},
  },
});

const seedDesign = async (title, state) => {
  const r = await client.query(
    `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
     VALUES ($1, 'workflow-bridge', $2, $3) RETURNING id`,
    [USER_ID, JSON.stringify(state), title],
  );
  return r.rows[0].id;
};

// The exact production case: craft.js's own literal "Root".
const literalRootId = await seedDesign("E2E Literal Root", brokenState({ resolvedName: "Root" }));
// A hallucinated name — the same class of failure from a different direction.
const hallucinatedId = await seedDesign(
  "E2E Hallucinated Root",
  brokenState({ resolvedName: "MyCustomDashboardRoot" }),
);
// Already demoted to the placeholder — designs saved while the bug was live.
const demotedId = await seedDesign("E2E Demoted Root", brokenState({ resolvedName: "AstryxUnknown" }));

// A healthy ROOT with one genuinely unknown CHILD: that child must still show
// the dashed placeholder. Fixing ROOT must not blanket-rescue every bad name.
const unknownChildState = brokenState({ resolvedName: "AstryxSection" });
unknownChildState["h-checkout"].type = { resolvedName: "AstryxTotallyMadeUp" };
unknownChildState["h-checkout"].displayName = "AstryxTotallyMadeUp";
const unknownChildId = await seedDesign("E2E Unknown Child", unknownChildState);

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
// The only top-level component types that can render children.
const CONTAINERS = ["AstryxSection", "AstryxStack", "AstryxHStack"];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true }]);
const page = await ctx.newPage();

const openDesign = async (id) => {
  await page.goto(`https://${domain}/designs/${id}`, { waitUntil: "networkidle", timeout: 90000 });
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(4000);
};

// ── The three broken-ROOT variants must all render their screens ─────────────
for (const [label, id] of [
  ["typed as the literal 'Root'", literalRootId],
  ["typed with a hallucinated name", hallucinatedId],
  ["already demoted to the placeholder", demotedId],
]) {
  await openDesign(id);
  const fleet = await page.locator('text="FLEET_SCREEN_MARKER"').count();
  const checkout = await page.locator('text="CHECKOUT_SCREEN_MARKER"').count();
  check(`A design whose top-level node is ${label} renders both screens`, fleet >= 1 && checkout >= 1,
    `fleet=${fleet} checkout=${checkout}`);
  check(
    `A design ${label} shows no placeholder box where the canvas should be`,
    (await page.locator('text="[Root]"').count()) === 0 &&
      (await page.locator('text="[MyCustomDashboardRoot]"').count()) === 0,
  );
}

// ── Unknown child components must still degrade to a placeholder ─────────────
await openDesign(unknownChildId);
check(
  "A healthy design still renders its normal content",
  (await page.locator('text="FLEET_SCREEN_MARKER"').count()) >= 1,
);
check(
  "A genuinely unknown CHILD component still shows a dashed placeholder",
  (await page.locator('text="[AstryxTotallyMadeUp]"').count()) >= 1,
);

// ── Self-healing on the next save ────────────────────────────────────────────
// Opening a broken design fixes what is drawn; the stored row is corrected the
// next time anything saves it. Drive that through the real PATCH endpoint
// rather than waiting on an autosave debounce that only fires after an edit.
// Send the *broken* state at the server deliberately: an older client, a
// stale tab, or any non-browser caller could still submit one, and the server
// must not persist a state that renders blank.
await openDesign(literalRootId);
const patchStatus = await page.evaluate(async ({ id, state }) => {
  const r = await fetch(`/api/designs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ craftState: JSON.stringify(state) }),
  });
  return r.status;
}, { id: literalRootId, state: brokenState({ resolvedName: "Root" }) });
check("A broken design can still be saved", patchStatus === 200, String(patchStatus));

const storedRoot = await client.query(`SELECT craft_state FROM designs WHERE id = $1`, [literalRootId]);
const rootAfter = storedRoot.rows[0].craft_state?.ROOT;
// Assert the positive invariant, not just the absence of the two names seen in
// this bug: any leaf type, or a container with isCanvas falsy, blanks the
// canvas just as effectively.
check(
  "The stored top-level node is a real container that can draw children",
  CONTAINERS.includes(rootAfter?.type?.resolvedName) && rootAfter?.isCanvas === true,
  `stored ROOT type = ${rootAfter?.type?.resolvedName}, isCanvas = ${rootAfter?.isCanvas}`,
);
check(
  "The healed top-level node keeps both screens attached",
  Array.isArray(rootAfter?.nodes) && rootAfter.nodes.length === 2,
  JSON.stringify(rootAfter?.nodes),
);

// ── The persistence path corrects generator output on the way in ─────────────
// This is the generation route's own repair pass, without burning AI credits on
// a nondeterministic model call that may not even reproduce the bad ROOT.
const created = await page.evaluate(async (state) => {
  const r = await fetch("/api/designs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ craftState: JSON.stringify(state), source: "workflow", title: "E2E Generated" }),
  });
  return { status: r.status, body: await r.json() };
}, brokenState({ resolvedName: "Root" }));

check("Saving a freshly generated design succeeds", created.status === 200 || created.status === 201,
  String(created.status));

if (created.body?.id) {
  const row = await client.query(`SELECT craft_state FROM designs WHERE id = $1`, [created.body.id]);
  const savedRoot = row.rows[0].craft_state?.ROOT;
  check(
    "A generated design is stored with a real container as its top-level node",
    ["AstryxSection", "AstryxStack", "AstryxHStack"].includes(savedRoot?.type?.resolvedName),
    `stored ROOT type = ${savedRoot?.type?.resolvedName}`,
  );
  check(
    "The stored top-level node is marked as a container",
    savedRoot?.isCanvas === true,
    `isCanvas = ${savedRoot?.isCanvas}`,
  );
  check(
    "No screens were lost while correcting the generated design",
    Array.isArray(savedRoot?.nodes) && savedRoot.nodes.length === 2,
    JSON.stringify(savedRoot?.nodes),
  );

  await openDesign(created.body.id);
  check(
    "The freshly generated design visibly renders its screens",
    (await page.locator('text="FLEET_SCREEN_MARKER"').count()) >= 1 &&
      (await page.locator('text="CHECKOUT_SCREEN_MARKER"').count()) >= 1,
  );
}

await browser.close();

// Leave the database as it was found.
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);
await client.query(`DELETE FROM sessions WHERE sid = $1`, [sid]);
await client.query(`DELETE FROM users WHERE id = $1`, [USER_ID]);
await client.end();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log("Failed: " + results.filter((r) => !r.ok).map((r) => r.name).join(", "));
  process.exit(1);
}
