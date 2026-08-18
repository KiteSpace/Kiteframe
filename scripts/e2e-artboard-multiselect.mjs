// Real-browser verification for task 544: multi-select actions on artboards —
// Shift+click selection, align panel, align left, group drag via label,
// copy/paste, and multi-delete.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-artboard-multiselect.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

// ── Seed ─────────────────────────────────────────────────────────────────────
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task544-user";
const EMAIL = "e2e-task544@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

// Three artboards at staggered positions. A and B are empty (empty ⇒ clicking
// the frame selects the artboard itself, not a child). C carries a button so
// we can build a mixed artboard/component selection.
const mkArtboard = (id, label, x, y, children = [], w = 300, h = 300) => ({
  [id]: {
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true,
    props: { label, x, y, width: w, height: h, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", custom: {}, parent: "ROOT", hidden: false,
    nodes: children, linkedNodes: {},
  },
});

const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" }, isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40, align: "start", justify: "start" },
    displayName: "AstryxSection", custom: {}, parent: null, hidden: false,
    nodes: ["ab-1", "ab-2", "ab-3"], linkedNodes: {},
  },
  ...mkArtboard("ab-1", "Screen A", 80, 120),
  ...mkArtboard("ab-2", "Screen B", 480, 180),
  ...mkArtboard("ab-3", "Screen C", 880, 240, ["btn-c"]),
  "btn-c": {
    type: { resolvedName: "AstryxButton" }, isCanvas: false,
    props: { children: "Mixed target", variant: "primary" },
    displayName: "AstryxButton", custom: {}, parent: "ab-3", hidden: false,
    nodes: [], linkedNodes: {},
  },
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 544', 'native') RETURNING id`,
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
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}

/** Locators for an artboard's label and its frame (sibling div after label). */
const frameOf = (label) => page.locator(`div:text-is("${label}") >> xpath=following-sibling::div[1]`).first();
const labelOf = (label) => page.locator(`div:text-is("${label}")`).first();

/** Raw-coordinate click on an artboard frame center. Empty artboards render an
 *  inner overlay that fails Playwright's actionability check, but real clicks
 *  bubble to craft's connected element fine — so drive the mouse directly. */
async function clickFrame(label, { shift = false } = {}) {
  const box = await frameOf(label).boundingBox();
  if (!box) throw new Error(`frame not found: ${label}`);
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  if (shift) await page.keyboard.up("Shift");
}

// ── 1. Shift+click builds a two-artboard selection ───────────────────────────
await clickFrame("Screen A");
await page.waitForTimeout(400);
await clickFrame("Screen B", { shift: true });
await page.waitForTimeout(500);
const twoSel = await page.locator('text="2 selected"').count();
check("Shift+click selects two artboards ('2 selected')", twoSel >= 1, `count=${twoSel}`);

// The redesigned inspector is tabbed; align/distribute live in the Layout tab.
await page
  .locator('[role="tablist"][aria-label="Inspector sections"] [role="tab"]:has-text("Layout")')
  .click();
await page.waitForTimeout(300);

// ── 2. Align-artboards panel appears ─────────────────────────────────────────
const alignPanel = await page.locator('[data-testid="artboard-align-panel"]').count();
check("Align artboards panel visible", alignPanel === 1, `count=${alignPanel}`);
await page.screenshot({ path: "/tmp/e2e-544-1-two-selected.png" });

// ── 3. Align top works (y becomes equal) ─────────────────────────────────────
await page.locator('[data-testid="artboard-align-top"]').click();
await page.waitForTimeout(600);
const tops = await page.evaluate(() => {
  const find = (t) => [...document.querySelectorAll("div")].find((d) => d.childNodes.length === 1 && d.textContent.trim() === t);
  const a = find("Screen A")?.parentElement?.getBoundingClientRect();
  const b = find("Screen B")?.parentElement?.getBoundingClientRect();
  return { a: a?.top, b: b?.top };
});
check("Align top equalizes y", tops.a != null && tops.b != null && Math.abs(tops.a - tops.b) <= 2, JSON.stringify(tops));

// ── 3b. Selection survives align: panel still visible, second align works ────
const panelAfterAlign = await page.locator('[data-testid="artboard-align-panel"]').count();
check("Selection retained after align (panel still visible)", panelAfterAlign === 1, `count=${panelAfterAlign}`);
await page.locator('[data-testid="artboard-align-left"]').click();
await page.waitForTimeout(600);
const lefts = await page.evaluate(() => {
  const find = (t) => [...document.querySelectorAll("div")].find((d) => d.childNodes.length === 1 && d.textContent.trim() === t);
  const a = find("Screen A")?.parentElement?.getBoundingClientRect();
  const b = find("Screen B")?.parentElement?.getBoundingClientRect();
  return { a: a?.left, b: b?.left };
});
check("Second align (left) works on retained selection", lefts.a != null && lefts.b != null && Math.abs(lefts.a - lefts.b) <= 2, JSON.stringify(lefts));
// Undo the left-align so the two screens don't overlap for the drag test.
await page.keyboard.press("ControlOrMeta+z");
await page.waitForTimeout(600);
// Re-select after undo (undo may clear selection).
await clickFrame("Screen A");
await page.waitForTimeout(300);
await clickFrame("Screen B", { shift: true });
await page.waitForTimeout(400);

// ── 4. Group drag via label moves both, preserving relative offset ───────────
const beforeDrag = await page.evaluate(() => {
  const find = (t) => [...document.querySelectorAll("div")].find((d) => d.childNodes.length === 1 && d.textContent.trim() === t);
  const a = find("Screen A")?.parentElement?.getBoundingClientRect();
  const b = find("Screen B")?.parentElement?.getBoundingClientRect();
  return { ax: a?.left, ay: a?.top, bx: b?.left, by: b?.top };
});
const labelBox = await labelOf("Screen A").boundingBox();
await page.mouse.move(labelBox.x + 10, labelBox.y + 5);
await page.mouse.down();
await page.mouse.move(labelBox.x + 90, labelBox.y + 65, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(600);
const afterDrag = await page.evaluate(() => {
  const find = (t) => [...document.querySelectorAll("div")].find((d) => d.childNodes.length === 1 && d.textContent.trim() === t);
  const a = find("Screen A")?.parentElement?.getBoundingClientRect();
  const b = find("Screen B")?.parentElement?.getBoundingClientRect();
  return { ax: a?.left, ay: a?.top, bx: b?.left, by: b?.top };
});
const aMoved = Math.abs(afterDrag.ax - beforeDrag.ax) > 40;
const bMoved = Math.abs(afterDrag.bx - beforeDrag.bx) > 40;
const relKept = Math.abs((afterDrag.bx - afterDrag.ax) - (beforeDrag.bx - beforeDrag.ax)) <= 2
             && Math.abs((afterDrag.by - afterDrag.ay) - (beforeDrag.by - beforeDrag.ay)) <= 2;
check("Group drag moves both artboards", aMoved && bMoved, JSON.stringify({ beforeDrag, afterDrag }));
check("Group drag preserves relative offset", relKept);
await page.screenshot({ path: "/tmp/e2e-544-2-group-drag.png" });

// ── 4b. Mixed selection (artboard + component) does NOT group-drag ───────────
// Select Screen B (artboard) + the button inside Screen C (component), then
// drag Screen B's label. Only Screen B may move; Screen C must stay put.
await clickFrame("Screen B");
await page.waitForTimeout(300);
await page.locator('button:text-is("Mixed target")').click({ modifiers: ["Shift"] });
await page.waitForTimeout(400);
const mixedBefore = await page.evaluate(() => {
  const find = (t) => [...document.querySelectorAll("div")].find((d) => d.childNodes.length === 1 && d.textContent.trim() === t);
  const b = find("Screen B")?.parentElement?.getBoundingClientRect();
  const c = find("Screen C")?.parentElement?.getBoundingClientRect();
  return { bx: b?.left, by: b?.top, cx: c?.left, cy: c?.top };
});
const labelB = await labelOf("Screen B").boundingBox();
await page.mouse.move(labelB.x + 10, labelB.y + 5);
await page.mouse.down();
await page.mouse.move(labelB.x + 70, labelB.y + 45, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(600);
const mixedAfter = await page.evaluate(() => {
  const find = (t) => [...document.querySelectorAll("div")].find((d) => d.childNodes.length === 1 && d.textContent.trim() === t);
  const b = find("Screen B")?.parentElement?.getBoundingClientRect();
  const c = find("Screen C")?.parentElement?.getBoundingClientRect();
  return { bx: b?.left, by: b?.top, cx: c?.left, cy: c?.top };
});
const cStayed = Math.abs(mixedAfter.cx - mixedBefore.cx) <= 2 && Math.abs(mixedAfter.cy - mixedBefore.cy) <= 2;
const bDragged = Math.abs(mixedAfter.bx - mixedBefore.bx) > 30;
check("Mixed selection: dragged artboard moves alone, others stay", bDragged && cStayed, JSON.stringify({ mixedBefore, mixedAfter }));
await page.screenshot({ path: "/tmp/e2e-544-2b-mixed-drag.png" });

// ── 5. Copy + paste duplicates both artboards ────────────────────────────────
const countArtboards = () => page.evaluate(() =>
  [...document.querySelectorAll("div")].filter((d) => d.childNodes.length === 1 && /^Screen [ABC]$/.test(d.textContent.trim())).length,
);
// Reselect the two artboards (drag may have altered selection)
await clickFrame("Screen A");
await page.waitForTimeout(300);
await clickFrame("Screen B", { shift: true });
await page.waitForTimeout(400);
const beforePaste = await countArtboards();
await page.keyboard.press("ControlOrMeta+c");
await page.waitForTimeout(300);
await page.keyboard.press("ControlOrMeta+v");
await page.waitForTimeout(800);
const afterPaste = await countArtboards();
check("Copy/paste adds two artboard copies", afterPaste === beforePaste + 2, `before=${beforePaste} after=${afterPaste}`);
await page.screenshot({ path: "/tmp/e2e-544-3-pasted.png" });

// ── 6. Multi-delete removes selected artboards (and their subtrees) ─────────
// The pasted copies are NOT selected (paste doesn't select) — reselect two originals.
await clickFrame("Screen C");
await page.waitForTimeout(300);
await clickFrame("Screen B", { shift: true });
await page.waitForTimeout(400);
const beforeDel = await countArtboards();
await page.keyboard.press("Delete");
await page.waitForTimeout(800);
const afterDel = await countArtboards();
check("Delete removes both selected artboards", afterDel === beforeDel - 2, `before=${beforeDel} after=${afterDel}`);
await page.screenshot({ path: "/tmp/e2e-544-4-deleted.png" });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
