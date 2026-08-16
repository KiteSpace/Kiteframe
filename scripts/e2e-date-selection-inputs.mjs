// Real-browser proof for the date, time and advanced selection inputs.
//
// Unit tests can show that the ten new names appear in every registry. What
// they cannot show is the two things that actually break in this codebase:
//
//   1. A component missing from one of the ~8 registries degrades silently to
//      the AstryxUnknown placeholder instead of erroring, so the only reliable
//      proof it is wired up is seeing it drawn on a real canvas.
//   2. The canvas applies a pan/zoom transform, which makes a transformed
//      ancestor the containing block for `position: fixed`. Any dropdown or
//      calendar panel that is portalled or fixed escapes its artboard — under
//      zoom it lands somewhere else entirely. These panels must stay inline.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-date-selection-inputs.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

// This script writes and deletes rows and mints a session. Refuse to run
// anywhere but a disposable development database.
if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  console.error("Refusing to run destructive E2E setup against a production environment.");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-date-selection-user";
const EMAIL = "e2e-date-selection@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);

const leaf = (parent, resolvedName, props) => ({
  type: { resolvedName },
  displayName: resolvedName,
  props,
  custom: {}, hidden: false, parent, isCanvas: false,
  nodes: [], linkedNodes: {},
});

// One artboard holding every new component. The DateInput sits inside an
// AstryxField, because these controls have to compose with the form containers
// rather than only working standalone.
const state = {
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    displayName: "AstryxSection",
    isCanvas: true,
    props: { direction: "row", gap: 80 },
    custom: {}, hidden: false, parent: null,
    nodes: ["ab1"], linkedNodes: {},
  },
  ab1: {
    type: { resolvedName: "AstryxArtboard" },
    displayName: "AstryxArtboard",
    props: { label: "Inputs", width: 460, height: 1600, x: 40, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["fld", "timeN", "dtN", "rngN", "fileN", "tyaN", "mulN", "cpxN", "powN", "tokN"],
    linkedNodes: {},
  },
  fld: {
    type: { resolvedName: "AstryxField" },
    displayName: "AstryxField",
    props: { label: "FIELD_LABEL_MARKER", helpText: "" },
    custom: {}, hidden: false, parent: "ab1", isCanvas: true,
    nodes: ["dateN"], linkedNodes: {},
  },
  dateN: leaf("fld", "AstryxDateInput", {
    value: "DATE_VALUE_MARKER", open: true, month: "PANELMONTH_MARKER", selectedDay: 16,
  }),
  timeN: leaf("ab1", "AstryxTimeInput", {
    label: "TIME_LABEL_MARKER", value: "09:45", times: "09:45,10:15", open: true,
  }),
  dtN: leaf("ab1", "AstryxDateTimeInput", {
    label: "DATETIME_LABEL_MARKER", value: "DATETIME_VALUE_MARKER",
  }),
  rngN: leaf("ab1", "AstryxDateRangeInput", {
    label: "RANGE_LABEL_MARKER", startValue: "RANGE_START_MARKER", endValue: "RANGE_END_MARKER",
  }),
  fileN: leaf("ab1", "AstryxFileInput", { label: "FILE_LABEL_MARKER", fileName: "" }),
  tyaN: leaf("ab1", "AstryxTypeahead", {
    label: "TYPEAHEAD_LABEL_MARKER", query: "TYPEAHEAD_QUERY_MARKER",
  }),
  mulN: leaf("ab1", "AstryxMultiSelector", {
    label: "MULTI_LABEL_MARKER", options: "MULTI_A_MARKER,MULTI_B_MARKER", selected: "MULTI_A_MARKER,MULTI_B_MARKER",
  }),
  cpxN: leaf("ab1", "AstryxComplexSelector", {
    label: "COMPLEX_LABEL_MARKER",
    options: "COMPLEX_TITLE_MARKER:COMPLEX_DESC_MARKER",
    selected: "COMPLEX_TITLE_MARKER",
  }),
  powN: leaf("ab1", "AstryxPowerSearch", {
    query: "POWER_QUERY_MARKER", filters: "status:POWER_FILTER_MARKER", resultCount: "POWER_COUNT_MARKER",
  }),
  tokN: leaf("ab1", "AstryxTokenizer", {
    label: "TOKEN_LABEL_MARKER", tokens: "TOKEN_A_MARKER,TOKEN_B_MARKER",
  }),
};

const seeded = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'workflow-bridge', $2, $3) RETURNING id`,
  [USER_ID, JSON.stringify(state), "E2E Date & Selection Inputs"],
);
const designId = seeded.rows[0].id;

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
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true }]);
const page = await ctx.newPage();

const openDesign = async () => {
  await page.goto(`https://${domain}/designs/${designId}`, { waitUntil: "networkidle", timeout: 90000 });
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(4000);
};

await openDesign();

// ── Every new component resolves and draws ───────────────────────────────────
// A component missing from any registry becomes the AstryxUnknown placeholder,
// so its own content never appears.
const componentMarkers = [
  ["DateInput", "DATE_VALUE_MARKER"],
  ["TimeInput", "TIME_LABEL_MARKER"],
  ["DateTimeInput", "DATETIME_VALUE_MARKER"],
  ["DateRangeInput", "RANGE_START_MARKER"],
  ["FileInput", "FILE_LABEL_MARKER"],
  ["Typeahead", "TYPEAHEAD_QUERY_MARKER"],
  ["MultiSelector", "MULTI_A_MARKER"],
  ["ComplexSelector", "COMPLEX_DESC_MARKER"],
  ["PowerSearch", "POWER_QUERY_MARKER"],
  ["Tokenizer", "TOKEN_A_MARKER"],
];
for (const [name, marker] of componentMarkers) {
  check(
    `${name} renders on the canvas`,
    (await page.locator(`text="${marker}"`).count()) >= 1,
    marker,
  );
}

const bodyText = await page.locator("body").innerText();
check(
  "None of the new components fell back to the unknown-component placeholder",
  !/\[Astryx/.test(bodyText),
  (bodyText.match(/\[Astryx\w+\]/g) ?? []).join(", ") || "(no placeholders)",
);

// ── The populated states are the ones the props asked for ────────────────────
check(
  "DateRangeInput shows both ends of the range",
  (await page.locator('text="RANGE_START_MARKER"').count()) >= 1 &&
    (await page.locator('text="RANGE_END_MARKER"').count()) >= 1,
);
check(
  "MultiSelector shows every selected value as a chip",
  (await page.locator('text="MULTI_A_MARKER"').count()) >= 1 &&
    (await page.locator('text="MULTI_B_MARKER"').count()) >= 1,
);
check(
  "Tokenizer shows every token as a chip",
  (await page.locator('text="TOKEN_A_MARKER"').count()) >= 1 &&
    (await page.locator('text="TOKEN_B_MARKER"').count()) >= 1,
);
check(
  "PowerSearch shows its filter chip and result count",
  (await page.locator('text="POWER_FILTER_MARKER"').count()) >= 1 &&
    (await page.locator('text="POWER_COUNT_MARKER"').count()) >= 1,
);
check(
  "FileInput starts in its empty dropzone state",
  bodyText.includes("Drop a file here, or browse"),
);

// ── The open panels render, and render INSIDE the artboard ───────────────────
check(
  "An open DateInput draws its calendar panel",
  (await page.locator('text="PANELMONTH_MARKER"').count()) >= 1,
);
check(
  "An open TimeInput draws its list of times",
  (await page.locator('text="10:15"').count()) >= 1,
);

/**
 * The panel must sit inside the artboard subtree and inside its box, with no
 * fixed-position ancestor. A portalled or fixed panel passes none of these.
 */
const panelGeometry = async () => page.evaluate(() => {
  // Deepest element carrying the text — some markers sit alongside a "×" child,
  // so "no element children" is too strict a definition of a leaf here.
  const leafWith = (t) => [...document.querySelectorAll("*")].find(
    (e) => e.textContent.includes(t) && ![...e.children].some((c) => c.textContent.includes(t)),
  );
  const panel = leafWith("PANELMONTH_MARKER");
  const sibling = leafWith("TOKEN_A_MARKER"); // another node in the same artboard
  if (!panel || !sibling) return { found: false, panelFound: !!panel, siblingFound: !!sibling };

  // Nearest ancestor containing both is the artboard subtree.
  let artboard = panel;
  while (artboard && !artboard.contains(sibling)) artboard = artboard.parentElement;
  if (!artboard) return { found: false };

  let fixedAncestor = null;
  for (let el = panel; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).position === "fixed") { fixedAncestor = el.className || el.tagName; break; }
  }

  const a = artboard.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  return {
    found: true,
    inside: p.left >= a.left - 1 && p.right <= a.right + 1 && p.top >= a.top - 1 && p.bottom <= a.bottom + 1,
    fixedAncestor,
    panel: { l: Math.round(p.left), t: Math.round(p.top), r: Math.round(p.right), b: Math.round(p.bottom) },
    artboard: { l: Math.round(a.left), t: Math.round(a.top), r: Math.round(a.right), b: Math.round(a.bottom) },
  };
});

const geo = await panelGeometry();
check("The calendar panel is inside the artboard it belongs to", geo.found && geo.inside,
  geo.found ? `panel ${JSON.stringify(geo.panel)} vs artboard ${JSON.stringify(geo.artboard)}` : "markers not found");
check("The calendar panel has no fixed-position ancestor", geo.found && !geo.fixedAncestor,
  geo.fixedAncestor ?? "none");

// Zooming is what actually exposes a fixed/portalled panel: the transform
// reparents it, so it stops tracking the field it belongs to.
try {
  const zoomIn = page.locator('button[title="Zoom in"]').first();
  await zoomIn.click({ timeout: 5000 });
  await zoomIn.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const zoomed = await panelGeometry();
  check("The calendar panel stays inside its artboard after zooming", zoomed.found && zoomed.inside,
    zoomed.found ? `panel ${JSON.stringify(zoomed.panel)} vs artboard ${JSON.stringify(zoomed.artboard)}` : "markers not found");
} catch (e) {
  check("The calendar panel stays inside its artboard after zooming", false, `zoom control unavailable: ${e.message}`);
}

// ── They compose with the form containers from the previous batch ────────────
const inField = await page.evaluate(() => {
  const leafWith = (t) => [...document.querySelectorAll("*")].find(
    (e) => e.textContent.includes(t) && ![...e.children].some((c) => c.textContent.includes(t)),
  );
  const label = leafWith("FIELD_LABEL_MARKER");
  const value = leafWith("DATE_VALUE_MARKER");
  if (!label || !value) return false;
  // The Field wrapper is the label's parent; the input must live in it too.
  return !!label.parentElement && label.parentElement.contains(value);
});
check("A DateInput placed inside an AstryxField renders within that field", inField);

// ── Populated state is reachable from the inspector ──────────────────────────
await page.locator('text="FILE_LABEL_MARKER"').first().click();
await page.waitForTimeout(1200);

const fileNameInput = page.locator('xpath=//label[text()="File name"]/following-sibling::input').first();
let inspectorReached = false;
try {
  await fileNameInput.waitFor({ state: "visible", timeout: 8000 });
  await fileNameInput.fill("INSPECTOR_FILE_MARKER.pdf");
  await page.waitForTimeout(1500);
  inspectorReached = true;
} catch (e) {
  check("The FileInput exposes a File name row in the inspector", false, e.message);
}
if (inspectorReached) {
  check("The FileInput exposes a File name row in the inspector", true);
  check(
    "Setting the file name from the inspector switches the control to its populated state",
    (await page.locator('text="INSPECTOR_FILE_MARKER.pdf"').count()) >= 1 &&
      !(await page.locator("body").innerText()).includes("Drop a file here, or browse"),
  );
}

// ── ...and survives a reload ─────────────────────────────────────────────────
// Autosave is debounced; give it room, then read the row the server stored
// rather than trusting the in-memory canvas.
await page.waitForTimeout(6000);
const stored = await client.query(`SELECT craft_state FROM designs WHERE id = $1`, [designId]);
const storedState = stored.rows[0].craft_state ?? {};
const storedTypes = Object.values(storedState).map((n) => n?.type?.resolvedName);
check(
  "The stored design keeps every new component under its real name",
  componentMarkers.every(([name]) => storedTypes.includes(`Astryx${name}`)),
  `missing: ${componentMarkers.map(([n]) => `Astryx${n}`).filter((n) => !storedTypes.includes(n)).join(", ") || "none"}`,
);
check(
  "The inspector edit was persisted",
  storedState.fileN?.props?.fileName === "INSPECTOR_FILE_MARKER.pdf",
  `stored fileName = ${JSON.stringify(storedState.fileN?.props?.fileName)}`,
);

await openDesign();
const reloadedText = await page.locator("body").innerText();
check(
  "Every new component still renders after a reload",
  componentMarkers.every(([, marker]) => reloadedText.includes(marker)) &&
    reloadedText.includes("INSPECTOR_FILE_MARKER.pdf"),
  componentMarkers.filter(([, m]) => !reloadedText.includes(m)).map(([n]) => n).join(", ") || "all present",
);
check(
  "No component degraded to a placeholder after a reload",
  !/\[Astryx/.test(reloadedText),
  (reloadedText.match(/\[Astryx\w+\]/g) ?? []).join(", ") || "(no placeholders)",
);

await browser.close();

// Leave the database as it was found.
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);
await client.query(`DELETE FROM sessions WHERE sid = $1`, [sid]);
await client.query(`DELETE FROM users WHERE id = $1`, [USER_ID]);
await client.end();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log("Failed: " + results.filter((r) => !r.ok).map((r) => r.name).join(", "));
  process.exit(1);
}
