// Real-browser verification for task 589: the 12 new form structure / input
// components render, appear in the palette, drop onto the canvas, accept
// children (the isCanvas contract), and expose inspector props.
//
// Usage: CHROME_BIN=$(which chromium) node scripts/e2e-form-palette.mjs
// Seeds its own design + forged session, then drives the editor.
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const USER_ID = "e2e-task589-user";
const EMAIL = "e2e-task589@example.com";

// ── 1. Seed a design containing every new component ──────────────────────────
const node = (name, props, parent, nodes = []) => ({
  type: { resolvedName: name },
  isCanvas: nodes.length > 0 || undefined,
  props,
  displayName: name,
  custom: {},
  parent,
  hidden: false,
  nodes,
  linkedNodes: {},
});

const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40, align: "start", justify: "start" },
    displayName: "AstryxSection",
    custom: {}, parent: null, hidden: false,
    nodes: ["artboard-1", "artboard-2"], linkedNodes: {},
  },
  "artboard-1": {
    type: { resolvedName: "AstryxArtboard" },
    isCanvas: true,
    props: { label: "Screen 1", width: 480, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard",
    custom: {}, parent: "ROOT", hidden: false,
    nodes: ["form-layout", "grid-1", "toggle-row", "seg-1", "cbl-1", "status-1"],
    linkedNodes: {},
  },
  // FormLayout > Field > TextArea / NumberInput / Switch
  "form-layout": { ...node("AstryxFormLayout", { columns: 1, gap: 16 }, "artboard-1", ["field-1", "field-2", "field-3"]), isCanvas: true },
  "field-1": { ...node("AstryxField", { label: "Bio", helpText: "Max 200 chars" }, "form-layout", ["ta-1"]), isCanvas: true },
  "ta-1": node("AstryxTextArea", { placeholder: "Tell us about yourself", rows: 3 }, "field-1"),
  "field-2": { ...node("AstryxField", { label: "Seats", required: true, error: "Must be at least 1" }, "form-layout", ["ni-1"]), isCanvas: true },
  "ni-1": node("AstryxNumberInput", { value: 3, min: 1, max: 20, step: 1 }, "field-2"),
  "field-3": { ...node("AstryxField", { label: "Notifications" }, "form-layout", ["sw-1"]), isCanvas: true },
  "sw-1": node("AstryxSwitch", { label: "Email me updates", checked: true }, "field-3"),
  // Grid > InputGroup (text input + icon button)
  "grid-1": { ...node("AstryxGrid", { columns: 2, gap: 12 }, "artboard-1", ["ig-1", "ib-1"]), isCanvas: true },
  "ig-1": { ...node("AstryxInputGroup", { gap: 0 }, "grid-1", ["ti-1", "btn-go"]), isCanvas: true },
  "ti-1": node("AstryxTextInput", { placeholder: "Search…" }, "ig-1"),
  "btn-go": node("AstryxButton", { children: "Go", variant: "primary", size: "md" }, "ig-1"),
  "ib-1": node("AstryxIconButton", { name: "search", variant: "outline", size: "md" }, "grid-1"),
  // Leaves
  "toggle-row": { ...node("AstryxHStack", { gap: 8 }, "artboard-1", ["tb-1", "tb-2"]), isCanvas: true },
  "tb-1": node("AstryxToggleButton", { children: "Bold", pressed: true, size: "md" }, "toggle-row"),
  "tb-2": node("AstryxToggleButton", { children: "Italic", pressed: false, size: "md" }, "toggle-row"),
  "seg-1": node("AstryxSegmentedControl", { options: "Day,Week,Month", selected: "Week", size: "md" }, "artboard-1"),
  "cbl-1": node("AstryxCheckboxList", { label: "Channels", options: "Email,SMS,Push", selected: "Email,Push" }, "artboard-1"),
  "status-1": { ...node("AstryxFieldStatus", { status: "success" }, "artboard-1", ["status-text"]), isCanvas: true },
  "status-text": node("AstryxText", { children: "All changes saved", size: "sm" }, "status-1"),
  "artboard-2": {
    type: { resolvedName: "AstryxArtboard" },
    isCanvas: true,
    props: { label: "Screen 2", width: 390, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard",
    custom: {}, parent: "ROOT", hidden: false, nodes: [], linkedNodes: {},
  },
};

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`, [USER_ID, EMAIL]);
const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 589 form palette', 'native') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)]);
const designId = res.rows[0].id;

const sid = crypto.randomBytes(16).toString("hex");
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify({
    cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    passport: { user: { id: USER_ID, email: EMAIL } },
  }), new Date(Date.now() + 24 * 3600 * 1000)]);
const cookieValue = "s:" + sid + "." +
  crypto.createHmac("sha256", process.env.SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "");
await client.end();
console.log("seeded design:", designId);

// ── 2. Drive the editor ──────────────────────────────────────────────────────
const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 220)); });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/e2e589-0-loaded.png", fullPage: false });

const artboardFrame = (label) => page.evaluate((lbl) => {
  const labelEl = [...document.querySelectorAll("div")].find((d) => d.textContent === lbl && d.children.length === 0);
  const frame = labelEl?.nextElementSibling;
  if (!frame) return null;
  const r = frame.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, label);

// ── A. Every seeded component rendered (no AstryxUnknown placeholder) ────────
{
  const body = await page.evaluate(() => document.body.innerText);
  const expectedText = [
    "Bio", "Max 200 chars",
    "Seats", "Must be at least 1",
    "Notifications", "Email me updates",
    "Search", "Go",
    "Bold", "Italic",
    "Day", "Week", "Month",
    "Channels", "Email", "SMS", "Push",
    "All changes saved",
  ];
  const missing = expectedText.filter((t) => !body.includes(t));
  check("all seeded form components render their content", missing.length === 0, `missing: ${missing.join(", ")}`);
  check("no unknown-component placeholder rendered", !/Unknown component/i.test(body));
}

// ── B. Number input / switch / segmented control shapes ──────────────────────
{
  const shapes = await page.evaluate(() => {
    const txt = (sel) => [...document.querySelectorAll(sel)];
    return {
      textareas: txt("textarea").filter((t) => t.placeholder === "Tell us about yourself").length,
      // switch = rounded-full track with a translated knob
      switchTracks: txt("div").filter((d) => {
        const s = getComputedStyle(d);
        return parseFloat(s.borderRadius) >= 999 && d.clientWidth > d.clientHeight * 1.5 && d.clientHeight > 10 && d.clientHeight < 30 && d.children.length === 1;
      }).length,
      // CheckboxList ticks are inline SVG paths, not a "✓" glyph.
      checkedBoxes: txt('svg path[d="M5 13l4 4L19 7"]').length,
    };
  });
  check("TextArea renders a real <textarea> with its placeholder", shapes.textareas >= 1, JSON.stringify(shapes));
  check("Switch renders a pill track with a knob", shapes.switchTracks >= 1, JSON.stringify(shapes));
  check("CheckboxList renders checked marks", shapes.checkedBoxes >= 2, JSON.stringify(shapes));
}

// ── C. Field error replaces help text; required marker shown ─────────────────
{
  const fieldInfo = await page.evaluate(() => {
    const body = document.body.innerText;
    return { hasAsterisk: body.includes("*"), errorShown: body.includes("Must be at least 1") };
  });
  check("Field renders required marker", fieldInfo.hasAsterisk, JSON.stringify(fieldInfo));
  check("Field renders its error message", fieldInfo.errorShown);
}

// ── D. New components are in the palette ─────────────────────────────────────
const paletteTile = async (label) => {
  await page.locator('input[placeholder*="Search"]').first().fill(label);
  await page.waitForTimeout(400);
  return page.evaluate((lbl) => {
    // A tile's textContent starts with its *preview*, which may itself contain
    // text — match the tile's name element exactly instead of a prefix.
    const nameEl = [...document.querySelectorAll('div[draggable="true"] *')]
      .find((el) => el.children.length === 0 && (el.textContent || "").trim() === lbl);
    const t = nameEl?.closest('[draggable="true"]');
    if (!t) return null;
    t.scrollIntoView({ block: "center" });
    const r = t.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, label);
};

{
  const names = ["Field", "FormLayout", "InputGroup", "FieldStatus", "Grid",
                 "TextArea", "Switch", "NumberInput", "ToggleButton",
                 "SegmentedControl", "CheckboxList", "IconButton"];
  const absent = [];
  for (const n of names) if (!(await paletteTile(n))) absent.push(n);
  check("all 12 new components appear in the palette", absent.length === 0, `absent: ${absent.join(", ")}`);
  await page.screenshot({ path: "/tmp/e2e589-1-palette.png" });
}

// ── E. Drag a new container (FormLayout) into the empty artboard ─────────────
const dragTileTo = async (src, target) => page.evaluate(async ({ src, target }) => {
  const at = (p) => document.elementFromPoint(p.x, p.y);
  const srcEl = at({ x: src.x + src.width / 2, y: src.y + src.height / 2 })?.closest('[draggable="true"]');
  if (!srcEl) return { error: "no source el" };
  const dt = new DataTransfer();
  const fire = (el, type, x, y) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
  fire(srcEl, "dragstart", src.x + 10, src.y + 10);
  await new Promise((r) => setTimeout(r, 120));
  let tgt = at(target);
  fire(tgt, "dragenter", target.x, target.y);
  fire(tgt, "dragover", target.x, target.y);
  await new Promise((r) => setTimeout(r, 200));
  tgt = at(target);
  fire(tgt, "drop", target.x, target.y);
  fire(srcEl, "dragend", target.x, target.y);
  return { ok: true };
}, { src, target });

{
  const src = await paletteTile("FormLayout");
  const fr2 = await artboardFrame("Screen 2");
  if (!src || !fr2) check("FormLayout tile + empty artboard found", false, JSON.stringify({ src, fr2 }));
  else {
    await dragTileTo(src, { x: fr2.x + fr2.w / 2, y: fr2.y + fr2.h / 2 });
    await page.waitForTimeout(800);
    const dropped = await page.evaluate(() => {
      const labelEl = [...document.querySelectorAll("div")].find((d) => d.textContent === "Screen 2" && d.children.length === 0);
      const frame = labelEl?.nextElementSibling;
      // FormLayout drops empty; look for a grid child inside the artboard.
      return frame ? [...frame.querySelectorAll("div")].some((d) => getComputedStyle(d).display === "grid") : false;
    });
    check("dragging FormLayout from the palette drops into the artboard", dropped);
    await page.screenshot({ path: "/tmp/e2e589-2-formlayout-dropped.png" });
  }
}

// ── F. Drop a leaf INTO the new container (the isCanvas contract) ────────────
{
  const src = await paletteTile("Switch");
  const dropTarget = await page.evaluate(() => {
    const labelEl = [...document.querySelectorAll("div")].find((d) => d.textContent === "Screen 2" && d.children.length === 0);
    const frame = labelEl?.nextElementSibling;
    const grid = frame && [...frame.querySelectorAll("div")].find((d) => getComputedStyle(d).display === "grid");
    if (!grid) return null;
    const r = grid.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!src || !dropTarget) check("Switch tile + dropped FormLayout found", false, JSON.stringify({ src, dropTarget }));
  else {
    await dragTileTo(src, dropTarget);
    await page.waitForTimeout(900);
    const nested = await page.evaluate(() => {
      const labelEl = [...document.querySelectorAll("div")].find((d) => d.textContent === "Screen 2" && d.children.length === 0);
      const frame = labelEl?.nextElementSibling;
      const grid = frame && [...frame.querySelectorAll("div")].find((d) => getComputedStyle(d).display === "grid");
      return grid ? grid.textContent.includes("Enable notifications") : false;
    });
    check("new container accepts a dropped child (isCanvas works)", nested);
    await page.screenshot({ path: "/tmp/e2e589-3-nested-drop.png" });
  }
}

// ── G. Inspector shows the new prop editors ──────────────────────────────────
{
  // Select the seeded CheckboxList by clicking its "Channels" label, then read
  // the left panel only (the whole body would also match canvas text).
  const leftPanelText = async () => page.evaluate(() => {
    const p = document.querySelector('div[class*="w-[296px]"]');
    return p ? p.innerText : "";
  });
  await page.locator('label:has-text("Channels")').first().click();
  await page.waitForTimeout(700);
  const panel = await leftPanelText();
  check("inspector switches to Inspect for a new component", panel.includes("Inspect"), panel.slice(0, 120).replace(/\n/g, " | "));
  // Panel labels are uppercased by CSS, which innerText reflects — compare case-insensitively.
  const panelLc = panel.toLowerCase();
  check("CheckboxList inspector shows its Label/Options/Selected rows",
    panelLc.includes("label") && panelLc.includes("options") && panelLc.includes("selected"),
    panel.slice(0, 300).replace(/\n/g, " | "));
  check("CheckboxList inspector is not the empty fallback",
    !panel.includes("No editable properties."));
  await page.screenshot({ path: "/tmp/e2e589-4-inspector.png" });
}

// ── H. Reload persistence — nothing dropped out on save/rehydrate ────────────
{
  await page.waitForTimeout(2500); // let autosave flush
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 2000 }); } catch {}
  const body = await page.evaluate(() => document.body.innerText);
  const missing = ["Bio", "Seats", "All changes saved", "Bold", "Italic", "Channels", "Week"]
    .filter((t) => !body.includes(t));
  // The TextArea placeholder is an attribute, not innerText — check it separately.
  const textareaKept = await page.evaluate(() =>
    [...document.querySelectorAll("textarea")].some((t) => t.placeholder === "Tell us about yourself"));
  check("form components survive a reload", missing.length === 0 && textareaKept,
    `missing: ${missing.join(", ")}${textareaKept ? "" : " (+textarea placeholder)"}`);
  check("no unknown placeholder after reload", !/Unknown component/i.test(body));
  await page.screenshot({ path: "/tmp/e2e589-5-after-reload.png" });
}

console.log("\nSummary:", results.every((r) => r.ok) ? "ALL PASS" : "FAILURES PRESENT");
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
