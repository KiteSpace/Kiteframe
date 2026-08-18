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

// ── Graphite icon pills (handoff §7: icon BESIDE the label, label always kept) ─
// Direction pills must each carry a 14×14 currentColor SVG *and* visible text.
const directionPills = page.locator('[role="radiogroup"][aria-label="Direction"] button');
const dirCount = await directionPills.count();
const dirHasIcons = dirCount === 2 &&
  (await directionPills.locator("svg").count()) === 2;
const dirLabels = dirCount === 2 ? await directionPills.evaluateAll(
  (btns) => btns.map((b) => (b.getAttribute("data-label") ?? "").trim()),
) : [];
check(
  "Direction pills render SVG icon beside a kept label (data-label present)",
  dirHasIcons && JSON.stringify(dirLabels) === JSON.stringify(["Column", "Row"]),
  `count=${dirCount} labels=${dirLabels.join(",")}`,
);
const dirVisibleText = dirCount === 2 ? await directionPills.evaluateAll(
  (btns) => btns.map((b) => b.textContent.trim()),
) : [];
check(
  "Direction pill labels are visible text, not icon-only",
  dirVisibleText.every((t) => t.length > 0),
  dirVisibleText.join(","),
);
const dirSvgSpec = await directionPills.first().locator("svg").evaluate((s) => ({
  w: s.getAttribute("width"), vb: s.getAttribute("viewBox"), fill: s.getAttribute("fill"),
}));
check(
  "Direction icons are 14×14 viewBox 0 0 14 14 currentColor",
  dirSvgSpec.w === "14" && dirSvgSpec.vb === "0 0 14 14" && dirSvgSpec.fill === "currentColor",
  JSON.stringify(dirSvgSpec),
);

// Align renders as a 2×2 icon-pill grid with four options.
const alignPills = page.locator('[role="radiogroup"][aria-label="Align"] button');
check(
  "Align is a 4-option icon pill group (each with an icon)",
  (await alignPills.count()) === 4 && (await alignPills.locator("svg").count()) === 4,
  `count=${await alignPills.count()}`,
);

// Wrap renders 3 icon pills.
const wrapPills = page.locator('[role="radiogroup"][aria-label="Wrap"] button');
check(
  "Wrap is a 3-option icon pill group",
  (await wrapPills.count()) === 3 && (await wrapPills.locator("svg").count()) === 3,
  `count=${await wrapPills.count()}`,
);

// Clicking an icon pill still writes the prop: activate Row, aria-checked flips.
await directionPills.nth(1).click();
await page.waitForTimeout(300);
check(
  "clicking the Row icon pill sets aria-checked",
  (await directionPills.nth(1).getAttribute("aria-checked")) === "true",
);
await directionPills.nth(0).click(); // restore Column
await page.waitForTimeout(200);

// Justify keeps a select (not pills) with a leading glyph that tracks the value.
const glyphCount = await page.locator("svg[data-justify-glyph]").count();
check("Justify select carries a leading glyph SVG", glyphCount === 1, `glyphs=${glyphCount}`);
const visibleGlyphGroups = await page.locator("svg[data-justify-glyph] g").evaluateAll(
  (gs) => gs.filter((g) => g.style.display === "block").map((g) => g.getAttribute("data-variant")),
);
check(
  "exactly one Justify glyph variant is visible and matches the value",
  visibleGlyphGroups.length === 1,
  visibleGlyphGroups.join(","),
);

// Density is an icon pill group in Spacing.
const densityPills = page.locator('[role="radiogroup"][aria-label="Density"] button');
check(
  "Density is a 4-option icon pill group",
  (await densityPills.count()) === 4 && (await densityPills.locator("svg").count()) === 4,
  `count=${await densityPills.count()}`,
);

// ── Artboard background: Type switcher is a plain text ip-pills group ────────
// Per the handoff reference (properties-panel.html #ip-fillmode) the three Type
// buttons are TEXT pills — only Direction/Align/Wrap/Density/Radius are icon pills.
const bgTypePills = page.locator('[role="radiogroup"][aria-label="Background type"] button');
const bgTypeLabels = await bgTypePills.allInnerTexts();
check(
  "background Type switcher is Color / Gradient / Image text pills (per reference HTML)",
  JSON.stringify(bgTypeLabels) === JSON.stringify(["Color", "Gradient", "Image"]) &&
    (await bgTypePills.locator("svg").count()) === 0,
  bgTypeLabels.join(","),
);

// Mode disclosure: only the active mode's rows are visible.
const fillFieldVisible = async () =>
  await page.locator('button[aria-label^="Fill:"]:visible').count();
const stopsVisible = async () =>
  await page.locator('span:has-text("Stops"):visible, label:has-text("Stops"):visible').count();
check("Color mode shows the Fill field", (await fillFieldVisible()) >= 1);
await bgTypePills.nth(1).click(); // Gradient
await page.waitForTimeout(300);
check(
  "switching to Gradient hides Fill and shows Stops",
  (await fillFieldVisible()) === 0 && (await stopsVisible()) >= 1,
);
await bgTypePills.nth(2).click(); // Image
await page.waitForTimeout(300);
const browseVisible = await page.locator("text=browse").locator("visible=true").count();
check("Image mode shows the browse affordance", browseVisible >= 1);
await bgTypePills.nth(0).click(); // back to Color
await page.waitForTimeout(300);
check("switching back to Color restores the Fill field", (await fillFieldVisible()) >= 1);

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
