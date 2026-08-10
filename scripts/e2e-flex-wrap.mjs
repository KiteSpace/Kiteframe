// Real-browser verification for task 532: the Wrap control in the inspector
// applies flex-wrap to containers immediately and persists through save/reload.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-flex-wrap.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

// ── Seed ─────────────────────────────────────────────────────────────────────
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task532-user";
const EMAIL = "e2e-task532@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

// HStack with three wide buttons inside a narrow artboard — they overflow
// unless wrapping kicks in.
const btn = (id, label) => ({
  [id]: {
    type: { resolvedName: "AstryxButton" }, isCanvas: false,
    props: { children: label, variant: "primary", width: 160 },
    displayName: "AstryxButton", custom: {}, parent: "hstack-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
});
const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" }, isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40 },
    displayName: "AstryxSection", custom: {}, parent: null, hidden: false,
    nodes: ["artboard-1"], linkedNodes: {},
  },
  "artboard-1": {
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true,
    props: { label: "Screen 1", width: 400, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", custom: {}, parent: "ROOT", hidden: false,
    nodes: ["hstack-1"], linkedNodes: {},
  },
  "hstack-1": {
    type: { resolvedName: "AstryxHStack" }, isCanvas: true,
    props: { gap: 12 },
    displayName: "AstryxHStack", custom: {}, parent: "artboard-1", hidden: false,
    nodes: ["b1", "b2", "b3"], linkedNodes: {},
  },
  ...btn("b1", "First"),
  ...btn("b2", "Second"),
  ...btn("b3", "Third"),
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 532', 'native') RETURNING id`,
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

const hstackWrap = () => page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "First");
  let el = b?.parentElement;
  while (el) {
    if (el.style.display === "flex" && el.style.flexDirection === "row" && el.style.flexWrap) return el.style.flexWrap;
    el = el.parentElement;
  }
  return null;
});
const buttonRows = () => page.evaluate(() => {
  const tops = ["First", "Second", "Third"].map((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
    return Math.round(b?.getBoundingClientRect().top ?? -1);
  });
  return new Set(tops).size;
});

// ── 1. Select the HStack and find the Wrap control ──────────────────────────
await page.locator('button:text-is("First")').click();
await page.waitForTimeout(400);
// Select the parent HStack via double-click escape or breadcrumb — simplest:
// click directly on the hstack area between buttons. Instead use keyboard-free
// approach: click one button then use the layers/structure. Simplest reliable
// path: click the gap area of the hstack.
const gapPoint = await page.evaluate(() => {
  const b1 = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "First").getBoundingClientRect();
  const b2 = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Second").getBoundingClientRect();
  return { x: (b1.right + b2.left) / 2, y: b1.top + b1.height / 2 };
});
await page.mouse.click(gapPoint.x, gapPoint.y);
await page.waitForTimeout(500);

const wrapBtn = page.locator('button[aria-label="Wrap"]');
const noWrapBtn = page.locator('button[aria-label="No wrap"]');
check("Wrap control rendered for HStack", (await wrapBtn.count()) === 1 && (await noWrapBtn.count()) === 1);
check("No wrap is the default active option", (await noWrapBtn.getAttribute("aria-pressed")) === "true");
check("initial flexWrap is nowrap", (await hstackWrap()) === "nowrap", `wrap=${await hstackWrap()}`);
const rowsBefore = await buttonRows();
check("buttons on one row before wrapping", rowsBefore === 1, `rows=${rowsBefore}`);

// ── 2. Click Wrap → immediate canvas effect ─────────────────────────────────
await wrapBtn.click();
await page.waitForTimeout(600);
check("flexWrap becomes wrap after clicking", (await hstackWrap()) === "wrap", `wrap=${await hstackWrap()}`);
const rowsAfter = await buttonRows();
check("buttons flow onto multiple rows", rowsAfter > 1, `rows=${rowsAfter}`);
await page.screenshot({ path: "/tmp/e2e-532-1-wrapped.png" });

// ── 3. Wrap reverse ──────────────────────────────────────────────────────────
await page.locator('button[aria-label="Wrap reverse"]').click();
await page.waitForTimeout(600);
check("flexWrap becomes wrap-reverse", (await hstackWrap()) === "wrap-reverse", `wrap=${await hstackWrap()}`);

// ── 4. Persists through save/reload ─────────────────────────────────────────
await page.locator('button[aria-label="Wrap"]').click();
await page.waitForTimeout(2500); // allow autosave
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const wrapAfterReload = await hstackWrap();
check("wrap persists through reload", wrapAfterReload === "wrap", `wrap=${wrapAfterReload}`);

// Confirm it reached the database too.
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const saved = await db.query(`SELECT craft_state FROM designs WHERE id = $1`, [designId]);
await db.end();
const savedState = saved.rows[0].craft_state;
const savedWrap = (typeof savedState === "string" ? JSON.parse(savedState) : savedState)["hstack-1"]?.props?.wrap;
check("wrap persisted to database", savedWrap === "wrap", `saved wrap=${savedWrap}`);

await page.screenshot({ path: "/tmp/e2e-532-2-after-reload.png" });
await browser.close();
await client.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
