// Real-browser proof that Interface (design) sharing works end to end.
//
// Covers the whole contract, including the parts that are easy to get wrong:
//   - the owner can generate a view-only link
//   - a logged-out visitor can open that link and see the design
//   - the visitor gets NO edit affordance and NO "Save to my account" button
//     (the public payload omits claimedByUserId, which a naive viewer would
//      read as "unclaimed" and offer to claim someone else's Interface)
//   - a logged-out visitor CANNOT open the design by its own id
//   - revoking the link kills it immediately
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-design-sharing.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-design-share-user";
const EMAIL = "e2e-design-share@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const HEADING = "Quarterly Revenue Dashboard";
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
    props: { label: "Shared Screen", width: 390, height: 600, x: 64, y: 64 },
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
const design = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'native', $2, 'E2E Shared Interface') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)],
);
const designId = design.rows[0].id;

// A second, unrelated signed-in user: "logged out" is the easy case, but the
// interesting one is a *legitimate* account that simply doesn't own this design.
const OTHER_ID = "e2e-design-share-other";
const OTHER_EMAIL = "e2e-design-share-other@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [OTHER_ID, OTHER_EMAIL],
);

const mintSession = async (userId, email) => {
  const sid = crypto.randomBytes(16).toString("hex");
  await client.query(
    `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
     ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
    [sid, JSON.stringify({
      cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      passport: { user: { id: userId, email } },
    }), new Date(Date.now() + 86400000)],
  );
  return "s:" + sid + "." + crypto.createHmac("sha256", process.env.SESSION_SECRET)
    .update(sid).digest("base64").replace(/=+$/, "");
};

const cookieValue = await mintSession(USER_ID, EMAIL);
const otherCookieValue = await mintSession(OTHER_ID, OTHER_EMAIL);
await client.end();
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

// ── Owner: generate the share link ───────────────────────────────────────────
const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ownerCtx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true }]);
const owner = await ownerCtx.newPage();

await owner.goto(`https://${domain}/designs/${designId}`, { waitUntil: "networkidle", timeout: 90000 });
await dismissBanner(owner);
await owner.waitForTimeout(2500);

check("Owner sees their Interface", (await owner.locator(`text="${HEADING}"`).count()) >= 1);
const shareBtn = owner.locator('[data-testid="button-share-design"]');
check("Owner sees a Share button", (await shareBtn.count()) === 1);

await shareBtn.click();
await owner.waitForTimeout(800);
await owner.locator('[data-testid="button-generate-design-share-link"]').click();
await owner.waitForTimeout(2500);

const shareUrl = await owner.locator('[data-testid="input-design-share-url"]').inputValue().catch(() => "");
check("A share link is produced", /\/design-view\/[0-9a-f-]{36}$/.test(shareUrl), shareUrl);
if (!shareUrl) {
  console.log("No share link produced — aborting the remaining checks.");
  await browser.close();
  process.exit(1);
}

// ── Visitor: open the link logged out ────────────────────────────────────────
const guestCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const guest = await guestCtx.newPage();

await guest.goto(shareUrl, { waitUntil: "networkidle", timeout: 90000 });
await dismissBanner(guest);
await guest.waitForTimeout(3000);

check("Logged-out visitor can see the shared Interface", (await guest.locator(`text="${HEADING}"`).count()) >= 1);
check("Visitor is told it is view only", (await guest.locator('text="View only"').count()) >= 1);
check(
  "Visitor is NOT offered a claim on someone else's Interface",
  (await guest.locator('text="Save to my account"').count()) === 0,
);
check(
  "Visitor gets no Share button",
  (await guest.locator('[data-testid="button-share-design"]').count()) === 0,
);

// Endpoint level, not just UI level: the public JSON must not carry ownership
// or provenance, whatever the viewer happens to render today.
const shareUuid = shareUrl.split("/").pop();
const publicKeys = await guest.evaluate(async (uuid) => {
  const r = await fetch(`/api/design-view/${uuid}`);
  return Object.keys(await r.json());
}, shareUuid);
const leaked = ["claimedByUserId", "apiKeyId", "sourceWorkflowId", "shareUuid"].filter((k) => publicKeys.includes(k));
check("Public payload leaks no ownership or provenance fields", leaked.length === 0, leaked.join(", "));

// ── A signed-in account that simply isn't the owner ──────────────────────────
const otherCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await otherCtx.addCookies([{ name: "connect.sid", value: otherCookieValue, domain, path: "/", httpOnly: true, secure: true }]);
const other = await otherCtx.newPage();
await other.goto(`https://${domain}/`, { waitUntil: "domcontentloaded", timeout: 90000 });

const statusesForNonOwner = await other.evaluate(async (id) => {
  const call = async (method, path, body) => {
    const r = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.status;
  };
  return {
    get: await call("GET", `/api/designs/${id}`),
    patch: await call("PATCH", `/api/designs/${id}`, { title: "hijacked" }),
    share: await call("POST", `/api/designs/${id}/share`, {}),
    revoke: await call("DELETE", `/api/designs/${id}/share`),
  };
}, designId);

check("Non-owner cannot read the design by id", statusesForNonOwner.get === 403, String(statusesForNonOwner.get));
check("Non-owner cannot edit the design", statusesForNonOwner.patch === 403, String(statusesForNonOwner.patch));
check("Non-owner cannot share the design", statusesForNonOwner.share === 403, String(statusesForNonOwner.share));
check("Non-owner cannot revoke the owner's link", statusesForNonOwner.revoke >= 400, String(statusesForNonOwner.revoke));

// ── Visitor: the raw id must stay private ────────────────────────────────────
await guest.goto(`https://${domain}/designs/${designId}`, { waitUntil: "networkidle", timeout: 90000 });
await guest.waitForTimeout(3000);
check(
  "Logged-out visitor CANNOT open the Interface by its id",
  (await guest.locator(`text="${HEADING}"`).count()) === 0,
);

// ── Owner: revoke ────────────────────────────────────────────────────────────
await owner.locator('[data-testid="button-revoke-design-share-link"]').click();
await owner.waitForTimeout(2500);

await guest.goto(shareUrl, { waitUntil: "networkidle", timeout: 90000 });
await guest.waitForTimeout(2500);
check("Revoked link no longer shows the Interface", (await guest.locator(`text="${HEADING}"`).count()) === 0);
check("Revoked link explains itself", (await guest.locator(`text="This link isn't active"`).count()) >= 1);

await browser.close();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log("Failed: " + results.filter((r) => !r.ok).map((r) => r.name).join(", "));
  process.exit(1);
}
