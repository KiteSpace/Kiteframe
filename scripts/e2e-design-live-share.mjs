// Real-browser proof that a shared Interface updates live for its viewers.
//
// Two sessions at once: the owner edits, a logged-out visitor watches. The
// things this is actually trying to catch:
//   - the viewer re-renders from a pushed update WITHOUT reloading the page
//   - the update is applied in place, so nothing about the viewer's session
//     is torn down and rebuilt
//   - a dropped socket reconnects on its own and the viewer resynchronizes
//   - revoking the link ejects live viewers immediately, rather than leaving
//     them looking at content they should no longer have
//   - the viewer stays read-only, and the pushed payload carries no ownership
//     fields (an absent owner reads as "unclaimed" and would offer a claim
//     button on someone else's Interface)
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-design-live-share.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

if (process.env.REPLIT_DEPLOYMENT) {
  console.error("Refusing to run against a deployment.");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-live-share-user";
const EMAIL = "e2e-live-share@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const HEADING = "Original Shared Heading";
const UPDATED_HEADING = "Edited While You Watched";
const SECOND_HEADING = "Edited After Reconnect";

const craftStateWith = (heading) => ({
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
    props: { label: "Shared Screen", width: 390, height: 600, x: 64, y: 64 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    displayName: "AstryxArtboard", linkedNodes: {},
  },
  text1: {
    type: { resolvedName: "AstryxText" },
    nodes: [],
    props: { children: heading },
    custom: {}, hidden: false, parent: "artboard1", isCanvas: false,
    displayName: "AstryxText", linkedNodes: {},
  },
});

// Re-runnable: drop what a previous run left behind.
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);
const design = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'native', $2, 'E2E Live Shared Interface') RETURNING id`,
  [USER_ID, JSON.stringify(craftStateWith(HEADING))],
);
const designId = design.rows[0].id;

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

console.log("Seeded design", designId);

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

const dismissBanner = async (page) => {
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
};

// Poll for a condition instead of sleeping a fixed amount: live delivery should
// be fast, and a generous ceiling only costs time when something is broken.
const waitFor = async (fn, timeout = 20000, interval = 500) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, interval));
  }
};

let cleanupError = null;
try {
  // ── Owner: share the Interface ─────────────────────────────────────────────
  const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ownerCtx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true }]);
  const owner = await ownerCtx.newPage();

  await owner.goto(`https://${domain}/designs/${designId}`, { waitUntil: "networkidle", timeout: 90000 });
  await dismissBanner(owner);
  await owner.waitForTimeout(2500);

  await owner.locator('[data-testid="button-share-design"]').click();
  await owner.waitForTimeout(800);
  await owner.locator('[data-testid="button-generate-design-share-link"]').click();
  await owner.waitForTimeout(2500);

  const shareUrl = await owner.locator('[data-testid="input-design-share-url"]').inputValue().catch(() => "");
  check("The owner can produce a share link", /\/design-view\/[0-9a-f-]{36}$/.test(shareUrl), shareUrl);
  if (!shareUrl) throw new Error("no share link produced");

  // ── Viewer: open the link logged out ───────────────────────────────────────
  const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const guest = await guestCtx.newPage();

  // Capture every socket the app opens so we can sever one later, and drop a
  // marker on the window so a full page reload is detectable (a reload would
  // wipe both of these).
  await guest.addInitScript(() => {
    window.__sockets = [];
    window.__neverReloaded = true;
    const Original = window.WebSocket;
    const Wrapped = function (...args) {
      const socket = new Original(...args);
      window.__sockets.push(socket);
      return socket;
    };
    Wrapped.prototype = Original.prototype;
    Object.assign(Wrapped, Original);
    window.WebSocket = Wrapped;
  });

  await guest.goto(shareUrl, { waitUntil: "networkidle", timeout: 90000 });
  await dismissBanner(guest);
  await guest.waitForTimeout(3000);

  check("The visitor sees the shared Interface", (await guest.locator(`text="${HEADING}"`).count()) >= 1);
  check("The visitor opened a live connection", (await guest.evaluate(() => window.__sockets.length)) >= 1);

  // ── The owner edits; the viewer should follow without touching anything ────
  const patchStatus = await owner.evaluate(async ({ id, state }) => {
    const r = await fetch(`/api/designs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ craftState: state }),
    });
    return r.status;
  }, { id: designId, state: craftStateWith(UPDATED_HEADING) });
  check("The owner's edit is accepted", patchStatus === 200, String(patchStatus));

  const sawUpdate = await waitFor(async () => (await guest.locator(`text="${UPDATED_HEADING}"`).count()) >= 1);
  check("The viewer shows the owner's edit without refreshing", sawUpdate);
  check("The superseded content is gone", (await guest.locator(`text="${HEADING}"`).count()) === 0);
  check("The viewer was updated in place, not reloaded",
    (await guest.evaluate(() => window.__neverReloaded === true)));
  check("The viewer is still read-only",
    (await guest.locator('[data-testid="button-share-design"]').count()) === 0
    && (await guest.locator('text="Save to my account"').count()) === 0);

  // ── A dropped connection must heal on its own ──────────────────────────────
  const socketsBefore = await guest.evaluate(() => {
    window.__sockets[window.__sockets.length - 1].close();
    return window.__sockets.length;
  });
  const reconnected = await waitFor(async () =>
    (await guest.evaluate(() => window.__sockets.length)) > socketsBefore);
  check("A dropped connection reconnects on its own", reconnected);

  await owner.evaluate(async ({ id, state }) => {
    await fetch(`/api/designs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ craftState: state }),
    });
  }, { id: designId, state: craftStateWith(SECOND_HEADING) });

  const resynced = await waitFor(async () => (await guest.locator(`text="${SECOND_HEADING}"`).count()) >= 1);
  check("The viewer resynchronizes after reconnecting", resynced);
  check("Recovery did not require a reload",
    (await guest.evaluate(() => window.__neverReloaded === true)));

  // The pushed payload travels the same allowlist as the initial fetch.
  const publicKeys = await guest.evaluate(async (uuid) => {
    const r = await fetch(`/api/design-view/${uuid}`);
    return Object.keys(await r.json());
  }, shareUrl.split("/").pop());
  const leaked = ["claimedByUserId", "apiKeyId", "sourceWorkflowId", "shareUuid"].filter((k) => publicKeys.includes(k));
  check("The shared payload carries no ownership or provenance fields", leaked.length === 0, leaked.join(", "));

  // ── Revoking must eject the live viewer immediately ────────────────────────
  await owner.locator('[data-testid="button-revoke-design-share-link"]').click();

  const ejected = await waitFor(async () => (await guest.locator(`text="This link isn't active"`).count()) >= 1);
  check("Revoking ejects the live viewer", ejected);
  check("The content is no longer on screen after revoke",
    (await guest.locator(`text="${SECOND_HEADING}"`).count()) === 0);
  check("The viewer was ejected live, without a reload",
    (await guest.evaluate(() => window.__neverReloaded === true)));
} catch (err) {
  check("Unexpected failure", false, err?.message ?? String(err));
  console.error(err);
} finally {
  try {
    await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);
    await client.query(`DELETE FROM sessions WHERE sid = $1`, [sid]);
    await client.end();
  } catch (err) { cleanupError = err; }
  await browser.close();
}
if (cleanupError) console.error("Cleanup problem:", cleanupError.message);

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log("Failed: " + results.filter((r) => !r.ok).map((r) => r.name).join(", "));
  process.exit(1);
}
