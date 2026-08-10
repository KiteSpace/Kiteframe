// Real-browser verification for task 531: typing multi-digit numbers into the
// W/H size fields keeps digit order (previously "400" became "004" because the
// input flipped between type="number" and type="text" mid-edit).
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-dimension-input.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

// ── Seed ─────────────────────────────────────────────────────────────────────
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task531-user";
const EMAIL = "e2e-task531@example.com";

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
    nodes: ["btn-a"], linkedNodes: {},
  },
  "btn-a": {
    type: { resolvedName: "AstryxButton" }, isCanvas: false,
    props: { children: "Target", variant: "primary", width: 80 },
    displayName: "AstryxButton", custom: {}, parent: "artboard-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 531', 'native') RETURNING id`,
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

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}

// Select the button so the inspector shows W/H.
await page.locator('button:text-is("Target")').click();
await page.waitForTimeout(500);

const wInput = page.locator('input[aria-label="W size"]');
check("W input rendered", (await wInput.count()) === 1);

// ── 1. Type a multi-digit number keystroke-by-keystroke ─────────────────────
await wInput.click();
await wInput.press("Control+a");
await wInput.pressSequentially("400", { delay: 80 });
const typed = await wInput.inputValue();
check('typing "400" keeps digit order', typed === "400", `value="${typed}"`);

// Element actually resized to 400.
await page.waitForTimeout(500);
// offsetWidth = layout px, unaffected by the canvas zoom transform.
const w = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Target");
  return b?.offsetWidth;
});
check("element width follows typed value", w != null && Math.abs(w - 400) <= 3, `width=${w}`);

// ── 2. Continue typing appends at the caret (no jump to front) ──────────────
await wInput.pressSequentially("5", { delay: 80 });
const typed2 = await wInput.inputValue();
check("subsequent digits append at the end", typed2 === "4005", `value="${typed2}"`);

// ── 3. H field behaves the same ──────────────────────────────────────────────
const hInput = page.locator('input[aria-label="H size"]');
await hInput.click();
await hInput.press("Control+a");
await hInput.pressSequentially("120", { delay: 80 });
const hTyped = await hInput.inputValue();
check('H field: typing "120" keeps digit order', hTyped === "120", `value="${hTyped}"`);

// ── 4. Auto button + empty-blur still reset to auto ──────────────────────────
await page.locator('button[aria-label="W auto"]').click();
await page.waitForTimeout(300);
const wAfterAuto = await wInput.inputValue();
const autoPressed = await page.locator('button[aria-label="W auto"]').getAttribute("aria-pressed");
check("Auto button clears W to auto", wAfterAuto === "" && autoPressed === "true", `value="${wAfterAuto}" pressed=${autoPressed}`);

await hInput.click();
await hInput.press("Control+a");
await hInput.press("Backspace");
await hInput.blur();
await page.waitForTimeout(300);
const hPressed = await page.locator('button[aria-label="H auto"]').getAttribute("aria-pressed");
check("blurring an empty H field resets to auto", hPressed === "true", `pressed=${hPressed}`);

await page.screenshot({ path: "/tmp/e2e-531-dimension-input.png" });
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
