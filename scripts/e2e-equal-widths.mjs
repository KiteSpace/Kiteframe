// Real-browser verification for task 529: Equal widths button enables for
// valid multi-selections and clicking it equalizes widths.
//
// Usage: seeds its own design + session, then drives the editor.
//   CHROME_BIN=$(which chromium) node scripts/e2e-equal-widths.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

// ── Seed ─────────────────────────────────────────────────────────────────────
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task529-user";
const EMAIL = "e2e-task529@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

// Artboard → HStack with two buttons of clearly different widths.
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
    props: { children: "Small", variant: "primary", width: 80 },
    displayName: "AstryxButton", custom: {}, parent: "hstack-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
  "btn-b": {
    type: { resolvedName: "AstryxButton" }, isCanvas: false,
    props: { children: "Much wider button", variant: "secondary", width: 240 },
    displayName: "AstryxButton", custom: {}, parent: "hstack-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 529', 'native') RETURNING id`,
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

const btnRect = (label) => page.evaluate((lbl) => {
  const el = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === lbl);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, label);

// ── 1. Multi-select the two buttons (click + shift-click) ───────────────────
const a = await btnRect("Small");
const b = await btnRect("Much wider button");
check("both buttons rendered", !!a && !!b, JSON.stringify({ a, b }));
if (!a || !b) { await browser.close(); process.exit(1); }

check("widths initially different", Math.abs(a.w - b.w) > 50, `a=${a.w} b=${b.w}`);

// Click the first button, then Shift+click the second. Re-measure after the
// first click — selecting a node swaps the left rail to the inspector, which
// can shift the canvas. Use locator clicks with the Shift modifier so the
// mousedown carries shiftKey=true.
const smallBtn = page.locator('button:text-is("Small")');
const wideBtn = page.locator('button:text-is("Much wider button")');
await smallBtn.click();
await page.waitForTimeout(400);
await wideBtn.click({ modifiers: ["Shift"] });
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/e2e-529-1-multiselected.png" });

// ── 2. Equal widths button present and ENABLED ──────────────────────────────
const eq = page.locator('button[aria-label="Make selected elements equal widths"]');
const eqCount = await eq.count();
check("Equal widths button rendered", eqCount === 1, `count=${eqCount}`);
const isDisabled = eqCount ? await eq.isDisabled() : true;
check("Equal widths button ENABLED", !isDisabled);

// ── 3. Click it → widths equalize ────────────────────────────────────────────
if (!isDisabled) {
  await eq.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/tmp/e2e-529-2-equalized.png" });
  const a2 = await btnRect("Small");
  const b2 = await btnRect("Much wider button");
  const equal = a2 && b2 && Math.abs(a2.w - b2.w) <= 2;
  check("widths equal after click", !!equal, `a=${a2?.w} b=${b2?.w}`);
  check("widths grew to fill container", !!a2 && a2.w > 100, `a=${a2?.w}`);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
