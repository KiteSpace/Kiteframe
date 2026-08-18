// Real-browser verification for the single-pane properties panel (task #626):
// five collapsible sections (Layout / Stack / Spacing / Style / Content) with
// section index chips, collapse memory in localStorage, live collapsed
// summaries, breadcrumb header, and progressive disclosure of X/Y.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-inspect-panel-redesign.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task626-user";
const EMAIL = "e2e-task626@example.com";

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
    nodes: ["stack-1"], linkedNodes: {},
  },
  "stack-1": {
    type: { resolvedName: "AstryxStack" }, isCanvas: true,
    props: { gap: 8, align: "stretch" },
    displayName: "AstryxStack", custom: {}, parent: "artboard-1", hidden: false,
    nodes: ["btn-a"], linkedNodes: {},
  },
  "btn-a": {
    type: { resolvedName: "AstryxButton" }, isCanvas: false,
    props: { children: "Target", variant: "primary", width: 120 },
    displayName: "AstryxButton", custom: {}, parent: "stack-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 626', 'native') RETURNING id`,
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

// Select the button so the inspector opens.
await page.locator('button:text-is("Target")').click();
await page.waitForTimeout(600);

// ── No tab bar; section chips instead ────────────────────────────────────────
const tablist = page.locator('[role="tablist"][aria-label="Inspector sections"]');
check("no tab bar remains", (await tablist.count()) === 0);

const nav = page.locator('[role="navigation"][aria-label="Inspector sections"]');
check("section chip nav rendered", (await nav.count()) === 1);
const chipNames = await nav.locator("button").allInnerTexts();
// Button is not a flex container → Layout, Style, Content chips only.
check(
  "component chips are Layout / Style / Content (no Stack/Spacing)",
  JSON.stringify(chipNames) === JSON.stringify(["Layout", "Style", "Content"]),
  chipNames.join(","),
);

// ── All sections visible at once (single pane) ───────────────────────────────
const visibleHeadings = await page.locator("[data-section] > button[aria-expanded]").allInnerTexts();
check(
  "Layout, Style and Content sections all present simultaneously",
  ["LAYOUT", "STYLE", "CONTENT"].every((h) => visibleHeadings.some((t) => t.toUpperCase().includes(h))),
  visibleHeadings.join(","),
);

// ── Layout section: W/H fields, no X/Y until Absolute ────────────────────────
const hasW = await page.locator("input").evaluateAll((els) =>
  els.some((e) => e.parentElement?.textContent?.startsWith("W")));
check("W field visible in Layout section", hasW);
const xVisibleBefore = await page.getByText("Offset", { exact: true }).count();
check("X/Y hidden while position is In flow", xVisibleBefore === 0);

const positionSelect = page.locator("select").filter({ has: page.locator('option:has-text("Absolute")') }).first();
if (await positionSelect.count()) {
  await positionSelect.selectOption({ label: "Absolute" });
  await page.waitForTimeout(300);
  const xVisibleAfter = await page.getByText("Offset", { exact: true }).count();
  check("X/Y appears once position is Absolute", xVisibleAfter === 1);
}

// ── Style section: Fill + Radius pills, no tab switch needed ─────────────────
const fillLabel = await page.getByText("Fill", { exact: true }).count();
check("Style section shows Fill row (no tab switch)", fillLabel >= 1);
const radiusPills = await page.locator('[role="radiogroup"][aria-label="Radius"] [role="radio"]').count();
check("Radius pill group has five options", radiusPills === 5, `count=${radiusPills}`);

// ── Collapse: toggle Style closed → summary appears; persists in localStorage ─
const styleToggle = page.locator('[data-section="style"] > button[aria-expanded]');
await styleToggle.click();
await page.waitForTimeout(300);
check("Style section collapses", (await styleToggle.getAttribute("aria-expanded")) === "false");
const summary = await page.locator('[data-testid="section-summary-style"]').count();
check("collapsed Style shows a live summary", summary === 1);
const stored = await page.evaluate(() => localStorage.getItem("kiteframe.inspect.collapse"));
check("collapse state persisted to kiteframe.inspect.collapse", !!stored && stored.includes("style"), stored ?? "null");

// ── Chip click on collapsed section re-expands + scrolls ─────────────────────
await page.locator('[data-testid="section-chip-style"]').click();
await page.waitForTimeout(600);
check("chip click re-expands the collapsed Style section", (await styleToggle.getAttribute("aria-expanded")) === "true");

await page.screenshot({ path: "/tmp/e2e-626-inspect-sections.png" });

// ── Shadow + opacity actually render on the canvas ───────────────────────────
const shadowSelect = page.locator("select").filter({ has: page.locator('option:has-text("Raised")') }).first();
await shadowSelect.selectOption({ label: "Raised" });
await page.waitForTimeout(400);
const btnShadow = await page.evaluate(() => {
  let el = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Target");
  for (let i = 0; el && i < 4; i++) {
    const s = getComputedStyle(el).boxShadow;
    if (s && s !== "none") return s;
    el = el.parentElement;
  }
  return "none";
});
check("Shadow=Raised produces a real box-shadow", btnShadow !== "none" && btnShadow.length > 0, btnShadow);

const opacityInput = page.locator('input[aria-label="Opacity"]');
await opacityInput.click();
await opacityInput.press("Control+a");
await opacityInput.pressSequentially("40", { delay: 60 });
await page.waitForTimeout(400);
const btnOpacity = await page.evaluate(() => {
  let el = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Target");
  for (let i = 0; el && i < 4; i++) {
    const o = getComputedStyle(el).opacity;
    if (o !== "1") return o;
    el = el.parentElement;
  }
  return "1";
});
check("Opacity=40 renders at 0.4", Math.abs(Number(btnOpacity) - 0.4) < 0.01, `opacity=${btnOpacity}`);

// ── Collapse memory is per node kind ─────────────────────────────────────────
// Collapse the component's Layout section, then select the artboard: its
// Layout section (kind=artboard) must stay expanded.
const layoutToggle = page.locator('[data-section="layout"] > button[aria-expanded]');
await layoutToggle.click();
await page.waitForTimeout(300);
check("component Layout collapses", (await layoutToggle.getAttribute("aria-expanded")) === "false");

// ── Artboard selection: no Content chip, Stack/Spacing present, rename ───────
await page.locator("text=Screen 1").first().click();
await page.waitForTimeout(600);
const artboardChips = await nav.locator("button").allInnerTexts();
check(
  "artboard chips are Layout / Stack / Spacing / Style (no Content)",
  JSON.stringify(artboardChips) === JSON.stringify(["Layout", "Stack", "Spacing", "Style"]),
  artboardChips.join(","),
);
check(
  "artboard Layout stays expanded (collapse memory is per kind)",
  (await page.locator('[data-section="layout"] > button[aria-expanded]').getAttribute("aria-expanded")) === "true",
);

// Rename via the Style section's Name field (artboards have no Content section).
const nameInput = page.locator("#ip-artboard-name");
check("artboard Name field present in Style section", (await nameInput.count()) === 1);
await nameInput.click();
await nameInput.press("Control+a");
await nameInput.pressSequentially("Login screen", { delay: 40 });
await page.waitForTimeout(400);
const renamed = await page.locator("text=Login screen").count();
check("artboard label on canvas follows the Name field", renamed >= 1, `count=${renamed}`);

await page.screenshot({ path: "/tmp/e2e-626-inspect-artboard.png" });

// ── Reload: collapse memory survives ─────────────────────────────────────────
await page.reload({ waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
await page.locator('button:text-is("Target")').click();
await page.waitForTimeout(600);
check(
  "component Layout still collapsed after reload",
  (await page.locator('[data-section="layout"] > button[aria-expanded]').getAttribute("aria-expanded")) === "false",
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
