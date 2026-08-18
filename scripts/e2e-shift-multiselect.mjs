// Real-browser verification for task 530: Shift+click is the multi-select
// gesture; Cmd/Ctrl+click no longer multi-selects.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-shift-multiselect.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

// ── Seed ─────────────────────────────────────────────────────────────────────
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task530-user";
const EMAIL = "e2e-task530@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" }, isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40, align: "start", justify: "start" },
    displayName: "AstryxSection", custom: {}, parent: null, hidden: false,
    nodes: ["artboard-1"], linkedNodes: {},
  },
  "artboard-1": {
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true,
    props: { label: "Screen 1", width: 500, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", custom: {}, parent: "ROOT", hidden: false,
    nodes: ["hstack-1"], linkedNodes: {},
  },
  "hstack-1": {
    type: { resolvedName: "AstryxHStack" }, isCanvas: true,
    props: { gap: 12 },
    displayName: "AstryxHStack", custom: {}, parent: "artboard-1", hidden: false,
    nodes: ["btn-a", "btn-b"], linkedNodes: {},
  },
  "btn-a": {
    type: { resolvedName: "AstryxButton" }, isCanvas: false,
    props: { children: "Alpha", variant: "primary", width: 80 },
    displayName: "AstryxButton", custom: {}, parent: "hstack-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
  "btn-b": {
    type: { resolvedName: "AstryxButton" }, isCanvas: false,
    props: { children: "Beta wider button", variant: "secondary", width: 240 },
    displayName: "AstryxButton", custom: {}, parent: "hstack-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 530', 'native') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)],
);
const designId = res.rows[0].id;

const sid = crypto.randomBytes(16).toString("hex");
const expire = new Date(Date.now() + 24 * 3600 * 1000);
const sess = {
  cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  passport: { user: { id: USER_ID, email: EMAIL } },
};
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify(sess), expire],
);
const secret = process.env.SESSION_SECRET;
const cookieValue = "s:" + sid + "." + crypto.createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
await client.end();
console.log("Seeded design", designId);

// ── Browser ──────────────────────────────────────────────────────────────────
const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}

// Count elements carrying the craft selection ring (#3b82f6 2px outline).
const SEL = "rgb(59, 130, 246)";
const ringCount = () => page.evaluate((c) => {
  return [...document.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return s.outlineStyle === "solid" && s.outlineWidth === "2px" && s.outlineColor === c;
  }).length;
}, SEL);

const alphaBtn = page.locator('button:text-is("Alpha")');
const betaBtn = page.locator('button:text-is("Beta wider button")');

// ── 1. Shift+click builds a two-element selection ────────────────────────────
await alphaBtn.click();
await page.waitForTimeout(400);
const afterFirst = await ringCount();
check("single click selects one element", afterFirst === 1, `rings=${afterFirst}`);

await betaBtn.click({ modifiers: ["Shift"] });
await page.waitForTimeout(500);
const afterShift = await ringCount();
check("Shift+click adds second element to selection", afterShift === 2, `rings=${afterShift}`);
await page.screenshot({ path: "/tmp/e2e-530-1-shift-multiselect.png" });

// ── 2. Inspector switches to multi-select mode ───────────────────────────────
const multiHeader = await page.locator('text="2 selected"').count();
check("inspector shows '2 selected'", multiHeader >= 1, `count=${multiHeader}`);
// The redesigned inspector is tabbed; equal-width actions live in Layout.
await page
  .locator('[role="tablist"][aria-label="Inspector sections"] [role="tab"]:has-text("Layout")')
  .click();
await page.waitForTimeout(300);
const eq = page.locator('button[aria-label="Make selected elements equal widths"]');
const eqEnabled = (await eq.count()) === 1 && !(await eq.isDisabled());
check("Equal widths enabled for Shift-click selection", eqEnabled);

// ── 3. Shift+click on a selected element removes it ──────────────────────────
await betaBtn.click({ modifiers: ["Shift"] });
await page.waitForTimeout(500);
const afterToggle = await ringCount();
check("Shift+click toggles element back out", afterToggle === 1, `rings=${afterToggle}`);

// ── 4. Cmd/Ctrl+click does NOT multi-select ──────────────────────────────────
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 2000 }); } catch {}
await alphaBtn.click();
await page.waitForTimeout(400);
await betaBtn.click({ modifiers: ["Meta"] });
await page.waitForTimeout(500);
const afterMeta = await ringCount();
check("Cmd+click does not multi-select (selection replaced)", afterMeta === 1, `rings=${afterMeta}`);
await page.screenshot({ path: "/tmp/e2e-530-2-meta-no-multiselect.png" });

// ── 5. Equal widths still applies on a Shift-click selection ────────────────
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 2000 }); } catch {}
await alphaBtn.click();
await page.waitForTimeout(400);
await betaBtn.click({ modifiers: ["Shift"] });
await page.waitForTimeout(500);
await page
  .locator('[role="tablist"][aria-label="Inspector sections"] [role="tab"]:has-text("Layout")')
  .click();
await page.waitForTimeout(300);
const eq2 = page.locator('button[aria-label="Make selected elements equal widths"]');
if ((await eq2.count()) === 1 && !(await eq2.isDisabled())) {
  await eq2.click();
  await page.waitForTimeout(600);
  const rects = await page.evaluate(() => {
    const find = (t) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === t)?.getBoundingClientRect();
    const a = find("Alpha"), b = find("Beta wider button");
    return { a: a?.width, b: b?.width };
  });
  check("Equal widths applies via Shift-click selection", rects.a && rects.b && Math.abs(rects.a - rects.b) <= 2, JSON.stringify(rects));
} else {
  check("Equal widths applies via Shift-click selection", false, "button missing or disabled");
}
await page.screenshot({ path: "/tmp/e2e-530-3-equalized.png" });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
