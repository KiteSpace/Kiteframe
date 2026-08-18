// Real-browser proof for the overlay, menu and surface components.
//
// The shared design-time approach these ten components implement makes exactly
// one promise that only a real browser can verify: *every overlay owns its own
// bounds*. Unit tests can prove the names are in all eight registries and that
// the source never calls createPortal — they cannot prove the drawn panel is
// actually inside its artboard, because jsdom has no layout.
//
// The failure this guards against is specific to this canvas: the pan/zoom
// transform makes a transformed ancestor the containing block for `position:
// fixed`, so a portalled or fixed panel is positioned against the canvas layer
// instead of the artboard. At 100% zoom it can look fine and still be wrong,
// which is why every geometry check here is repeated after zooming.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-overlays-and-menus.mjs
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

const USER_ID = "e2e-overlays-user";
const EMAIL = "e2e-overlays@example.com";
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

// One artboard holding all ten. Two popovers, opening in opposite directions,
// so placement can be proven relative to the same anchor geometry. The Overlay
// container carries a child, because "is it really a container" is the one
// thing that distinguishes it from the other nine.
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
    props: { label: "Overlays", width: 520, height: 3600, x: 40, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["popDown", "popUp", "tip", "hov", "dd", "ctx", "more", "alert", "toast", "light", "ovl",
            "longRight", "longLeft", "longTip", "longHov", "longCtx", "longMore"],
    linkedNodes: {},
  },
  popDown: leaf("ab1", "AstryxPopover", {
    anchorLabel: "POPDOWN_ANCHOR", title: "POPDOWN_TITLE", description: "POPDOWN_DESC",
    confirmLabel: "POPDOWN_CONFIRM", cancelLabel: "", placement: "bottom", align: "start", open: true,
  }),
  popUp: leaf("ab1", "AstryxPopover", {
    anchorLabel: "POPUP_ANCHOR", title: "POPUP_TITLE", description: "",
    confirmLabel: "", cancelLabel: "", placement: "top", align: "start", open: true,
  }),
  tip: leaf("ab1", "AstryxTooltip", {
    anchorLabel: "TIP_ANCHOR", text: "TIP_TEXT", placement: "top", align: "center", open: true,
  }),
  hov: leaf("ab1", "AstryxHoverCard", {
    anchorLabel: "HOV_ANCHOR", name: "HOV_NAME", handle: "HOV_HANDLE", bio: "HOV_BIO",
    meta: "", placement: "bottom", align: "start", open: true,
  }),
  dd: leaf("ab1", "AstryxDropdownMenu", {
    label: "DD_TRIGGER", items: "DD_ITEM_A:DD_SHORTCUT,DD_ITEM_B,---,!DD_ITEM_DANGER",
    selected: "", placement: "bottom", align: "start", open: true,
  }),
  ctx: leaf("ab1", "AstryxContextMenu", {
    surfaceLabel: "CTX_SURFACE", items: "CTX_ITEM_A,CTX_ITEM_B",
    selected: "", placement: "bottom", align: "start", open: true,
  }),
  more: leaf("ab1", "AstryxMoreMenu", {
    glyph: "⋯", items: "MORE_ITEM_A,MORE_ITEM_B", selected: "",
    placement: "bottom", align: "end", open: true,
  }),
  alert: leaf("ab1", "AstryxAlertDialog", {
    title: "ALERT_TITLE", description: "ALERT_DESC", confirmLabel: "ALERT_CONFIRM",
    cancelLabel: "ALERT_CANCEL", tone: "danger", scrim: "dark", showStage: true,
  }),
  toast: leaf("ab1", "AstryxToast", {
    title: "TOAST_TITLE", description: "TOAST_DESC", actionLabel: "TOAST_ACTION",
    variant: "success", position: "bottom-right", showStage: true, showClose: true,
  }),
  light: leaf("ab1", "AstryxLightbox", {
    caption: "LIGHT_CAPTION", counter: "LIGHT_COUNTER", showControls: true, showClose: true,
  }),
  ovl: {
    type: { resolvedName: "AstryxOverlay" },
    displayName: "AstryxOverlay",
    props: { scrim: "dark", align: "center", padding: 16, minHeight: 120 },
    custom: {}, hidden: false, parent: "ab1", isCanvas: true,
    nodes: ["ovlChild"], linkedNodes: {},
  },
  ovlChild: leaf("ovl", "AstryxText", { children: "OVERLAY_CHILD_MARKER" }),

  // Bounds under hostile input. Every string on these components is supplied by
  // a user or by the AI, and a long unbroken value is the one input that can
  // push a panel or an anchor past the artboard edge — the side placements are
  // the worst case, because anchor and panel compete for the same row.
  longRight: leaf("ab1", "AstryxPopover", {
    anchorLabel: "LONGANCHOR_" + "x".repeat(90),
    title: "LONGTITLE_" + "y".repeat(90),
    description: "", confirmLabel: "", cancelLabel: "",
    placement: "right", align: "start", width: 260, open: true,
  }),
  longTip: leaf("ab1", "AstryxTooltip", {
    anchorLabel: "LONGTIP_" + "x".repeat(90),
    text: "hint", placement: "right", align: "start", width: 200, open: true, showArrow: true,
  }),
  longHov: leaf("ab1", "AstryxHoverCard", {
    anchorLabel: "LONGHOVER_" + "x".repeat(90),
    name: "Ada Lovelace", handle: "", bio: "", meta: "",
    placement: "left", align: "start", width: 240, open: true, showArrow: true,
  }),
  longCtx: leaf("ab1", "AstryxContextMenu", {
    surfaceLabel: "LONGCTX_" + "x".repeat(90),
    items: "Copy", selected: "", placement: "right", align: "start", width: 200, open: true,
  }),
  longMore: leaf("ab1", "AstryxMoreMenu", {
    glyph: "LONGGLYPH_" + "x".repeat(90),
    items: "Rename", selected: "", placement: "left", align: "start", width: 180, open: true,
  }),
  longLeft: leaf("ab1", "AstryxDropdownMenu", {
    label: "LONGTRIGGER_" + "z".repeat(60),
    items: "LONGITEM_" + "w".repeat(90),
    selected: "", placement: "left", align: "start", width: 220, open: true,
  }),
};

const seeded = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'workflow-bridge', $2, $3) RETURNING id`,
  [USER_ID, JSON.stringify(state), "E2E Overlays & Menus"],
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

// ── Every overlay resolves and draws ─────────────────────────────────────────
// A component missing from any registry becomes the AstryxUnknown placeholder,
// so its own content never appears.
const componentMarkers = [
  ["Popover", "POPDOWN_TITLE"],
  ["Tooltip", "TIP_TEXT"],
  ["HoverCard", "HOV_BIO"],
  ["DropdownMenu", "DD_ITEM_A"],
  ["ContextMenu", "CTX_ITEM_A"],
  ["MoreMenu", "MORE_ITEM_A"],
  ["AlertDialog", "ALERT_TITLE"],
  ["Toast", "TOAST_TITLE"],
  ["Lightbox", "LIGHT_CAPTION"],
  ["Overlay", "OVERLAY_CHILD_MARKER"],
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
  "No overlay fell back to the unknown-component placeholder",
  !/\[Astryx/.test(bodyText),
  (bodyText.match(/\[Astryx\w+\]/g) ?? []).join(", ") || "(no placeholders)",
);

// ── Content props reach the drawn overlay ────────────────────────────────────
check("Popover draws its anchor, body and action", ["POPDOWN_ANCHOR", "POPDOWN_DESC", "POPDOWN_CONFIRM"]
  .every((m) => bodyText.includes(m)));
check("HoverCard draws name, handle and bio", ["HOV_NAME", "HOV_HANDLE", "HOV_BIO"]
  .every((m) => bodyText.includes(m)));
check("AlertDialog draws both of its buttons", ["ALERT_CONFIRM", "ALERT_CANCEL"]
  .every((m) => bodyText.includes(m)));
check("Toast draws its description and action", ["TOAST_DESC", "TOAST_ACTION"]
  .every((m) => bodyText.includes(m)));
check("Lightbox draws its counter", bodyText.includes("LIGHT_COUNTER"));

// ── The menu item mini-syntax is honoured on the canvas ──────────────────────
check("A menu renders every item in its items string", ["DD_ITEM_A", "DD_ITEM_B", "DD_ITEM_DANGER"]
  .every((m) => bodyText.includes(m)));
check(
  'A "Label:Shortcut" item renders the shortcut but not the raw colon syntax',
  bodyText.includes("DD_SHORTCUT") && !bodyText.includes("DD_ITEM_A:DD_SHORTCUT"),
);
check(
  'A "---" entry becomes a divider rather than a literal item',
  !bodyText.includes("---"),
);

const dangerIsRed = await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find(
    (e) => e.textContent.includes("DD_ITEM_DANGER") &&
      ![...e.children].some((c) => c.textContent.includes("DD_ITEM_DANGER")),
  );
  if (!el) return null;
  const rgb = getComputedStyle(el).color.match(/\d+/g)?.map(Number) ?? [];
  return rgb.length >= 3 ? rgb[0] > rgb[1] + 40 && rgb[0] > rgb[2] + 40 : null;
});
check('A "!" item is drawn in the destructive colour', dangerIsRed === true, `red-dominant: ${dangerIsRed}`);

// ── Geometry: every overlay owns its bounds ──────────────────────────────────
/**
 * Measures each marker's deepest element against the artboard it lives in, and
 * reports any fixed-position ancestor. A portalled or fixed panel fails both.
 * The artboard is the nearest common ancestor of two markers that sit at
 * opposite ends of the artboard's child list.
 */
const measure = async (markers) => page.evaluate((ms) => {
  // Deepest element carrying the text — some markers sit alongside a "×" child,
  // so "no element children" is too strict a definition of a leaf here.
  const leafWith = (t) => [...document.querySelectorAll("*")].find(
    (e) => e.textContent.includes(t) && ![...e.children].some((c) => c.textContent.includes(t)),
  );

  const first = leafWith("POPDOWN_TITLE");
  const last = leafWith("OVERLAY_CHILD_MARKER");
  if (!first || !last) return { ok: false, reason: "anchor markers for the artboard not found" };
  let artboard = first;
  while (artboard && !artboard.contains(last)) artboard = artboard.parentElement;
  if (!artboard) return { ok: false, reason: "no common artboard ancestor" };
  const a = artboard.getBoundingClientRect();

  const out = {};
  for (const m of ms) {
    const el = leafWith(m);
    if (!el) { out[m] = { found: false }; continue; }
    let fixedAncestor = null;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (getComputedStyle(e).position === "fixed") { fixedAncestor = e.className || e.tagName; break; }
    }
    const r = el.getBoundingClientRect();
    // The element box is not the whole story: text with `overflow: visible`
    // paints outside its own box, so a box that shrank politely can still have
    // a long unbroken label sticking out of the artboard. A Range over the
    // element's contents reports where the glyphs actually landed.
    const range = document.createRange();
    range.selectNodeContents(el);
    let t = range.getBoundingClientRect();
    range.detach?.();
    // Range rects ignore clipping, so intersect with every scroll/clip ancestor:
    // text a panel already clips away is not text the user can see escape.
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const o = getComputedStyle(e);
      if (o.overflowX === "visible" && o.overflowY === "visible") continue;
      const c = e.getBoundingClientRect();
      const l = Math.max(t.left, c.left), rr = Math.min(t.right, c.right);
      const tp = Math.max(t.top, c.top), b = Math.min(t.bottom, c.bottom);
      t = { left: l, right: Math.max(l, rr), top: tp, bottom: Math.max(tp, b),
            width: Math.max(0, rr - l), height: Math.max(0, b - tp) };
    }
    const within = (x) => x.width === 0 && x.height === 0
      ? true
      : x.left >= a.left - 1 && x.right <= a.right + 1 && x.top >= a.top - 1 && x.bottom <= a.bottom + 1;
    out[m] = {
      found: true,
      fixedAncestor,
      inside: within(r),
      textInside: within(t),
      rect: { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) },
      textRect: { l: Math.round(t.left), t: Math.round(t.top), r: Math.round(t.right), b: Math.round(t.bottom) },
    };
  }
  return { ok: true, artboard: { l: Math.round(a.left), t: Math.round(a.top), r: Math.round(a.right), b: Math.round(a.bottom) }, out };
}, markers);

const panelMarkers = componentMarkers.map(([, m]) => m);
// Long unbroken values, and the two side placements, are measured alongside the
// ordinary ones — the guarantee is about bounds, not about tidy content.
const boundsMarkers = [...panelMarkers,
  "LONGANCHOR_", "LONGTITLE_", "LONGTRIGGER_", "LONGITEM_",
  "LONGTIP_", "LONGHOVER_", "LONGCTX_", "LONGGLYPH_"];
const geo = await measure(boundsMarkers);
check("The artboard could be located for geometry checks", geo.ok, geo.reason ?? "");

if (geo.ok) {
  const escaped = boundsMarkers.filter((m) => geo.out[m].found && !geo.out[m].inside);
  check(
    "Every overlay is drawn inside the artboard it belongs to",
    escaped.length === 0,
    escaped.map((m) => `${m} ${JSON.stringify(geo.out[m].rect)}`).join("; ") ||
      `artboard ${JSON.stringify(geo.artboard)}`,
  );
  const spilled = boundsMarkers.filter((m) => geo.out[m].found && !geo.out[m].textInside);
  check(
    "No overlay's rendered text paints outside the artboard",
    spilled.length === 0,
    spilled.map((m) => `${m} text ${JSON.stringify(geo.out[m].textRect)}`).join("; ") ||
      `artboard ${JSON.stringify(geo.artboard)}`,
  );
  const missing = boundsMarkers.filter((m) => !geo.out[m].found);
  check("Every measured overlay was found in the DOM", missing.length === 0, missing.join(", ") || "all found");
  const fixed = boundsMarkers.filter((m) => geo.out[m].fixedAncestor);
  check(
    "No overlay has a fixed-position ancestor",
    fixed.length === 0,
    fixed.map((m) => `${m} → ${geo.out[m].fixedAncestor}`).join("; ") || "none",
  );
}

// ── Placement puts the panel where the prop says ─────────────────────────────
const placement = await measure(["POPDOWN_ANCHOR", "POPDOWN_TITLE", "POPUP_ANCHOR", "POPUP_TITLE", "TIP_ANCHOR", "TIP_TEXT"]);
if (placement.ok) {
  const p = placement.out;
  check(
    'placement="bottom" draws the panel below its anchor',
    p.POPDOWN_TITLE.found && p.POPDOWN_ANCHOR.found && p.POPDOWN_TITLE.rect.t >= p.POPDOWN_ANCHOR.rect.b - 2,
    `anchor bottom ${p.POPDOWN_ANCHOR?.rect?.b} vs panel top ${p.POPDOWN_TITLE?.rect?.t}`,
  );
  check(
    'placement="top" draws the panel above its anchor',
    p.POPUP_TITLE.found && p.POPUP_ANCHOR.found && p.POPUP_TITLE.rect.b <= p.POPUP_ANCHOR.rect.t + 2,
    `panel bottom ${p.POPUP_TITLE?.rect?.b} vs anchor top ${p.POPUP_ANCHOR?.rect?.t}`,
  );
  check(
    'A tooltip with placement="top" also opens upward',
    p.TIP_TEXT.found && p.TIP_ANCHOR.found && p.TIP_TEXT.rect.b <= p.TIP_ANCHOR.rect.t + 2,
    `tip bottom ${p.TIP_TEXT?.rect?.b} vs anchor top ${p.TIP_ANCHOR?.rect?.t}`,
  );
}

// ── Zoom is what actually exposes a fixed or portalled panel ─────────────────
// The transform reparents it, so it stops tracking the artboard entirely.
try {
  const zoomIn = page.locator('button[title="Zoom in"]').first();
  await zoomIn.click({ timeout: 5000 });
  await zoomIn.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const zoomed = await measure(boundsMarkers);
  const escaped = zoomed.ok
    ? boundsMarkers.filter((m) => zoomed.out[m].found && !(zoomed.out[m].inside && zoomed.out[m].textInside))
    : ["<no artboard>"];
  check(
    "Every overlay stays inside its artboard after zooming",
    zoomed.ok && escaped.length === 0,
    escaped.map((m) => `${m} ${JSON.stringify(zoomed.out?.[m]?.rect)}`).join("; ") || "all inside",
  );
} catch (e) {
  check("Every overlay stays inside its artboard after zooming", false, `zoom control unavailable: ${e.message}`);
}

// ── ...and panning: the overlays must travel with the frame ──────────────────
// The canvas pans on space+drag (the wheel is bound to cursor-anchored zoom).
const beforePan = await measure(["TOAST_TITLE"]);
// Drop focus first: the zoom button clicked above is still focused, and Space
// would re-activate it, zooming instead of panning.
await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
// Grab a point on the empty canvas to the right of the artboard — far enough
// from the left rail and the right inspector that it is really the canvas.
await page.mouse.move(1060, 750);
await page.keyboard.down("Space");
await page.mouse.down();
await page.mouse.move(940, 640, { steps: 12 });
await page.mouse.up();
await page.keyboard.up("Space");
await page.waitForTimeout(1200);
const afterPan = await measure(["TOAST_TITLE"]);
if (beforePan.ok && afterPan.ok) {
  const moved = beforePan.artboard.l !== afterPan.artboard.l || beforePan.artboard.t !== afterPan.artboard.t;
  check("The canvas actually panned", moved,
    `artboard ${JSON.stringify(beforePan.artboard)} → ${JSON.stringify(afterPan.artboard)}`);
  const dx = afterPan.out.TOAST_TITLE.rect.l - beforePan.out.TOAST_TITLE.rect.l;
  const dy = afterPan.out.TOAST_TITLE.rect.t - beforePan.out.TOAST_TITLE.rect.t;
  const adx = afterPan.artboard.l - beforePan.artboard.l;
  const ady = afterPan.artboard.t - beforePan.artboard.t;
  check(
    "An overlay travels with its artboard when the canvas pans",
    afterPan.out.TOAST_TITLE.inside && Math.abs(dx - adx) <= 2 && Math.abs(dy - ady) <= 2,
    moved ? `overlay moved (${dx},${dy}), artboard moved (${adx},${ady})` : "canvas did not pan; overlay still inside",
  );
}

// ── Clicking an overlay selects it rather than triggering anything ───────────
await page.locator('text="DD_ITEM_DANGER"').first().click();
await page.waitForTimeout(1200);

const placementSelect = page.locator('xpath=//label[text()="Opens toward"]/following-sibling::select').first();
let selected = false;
try {
  await placementSelect.waitFor({ state: "visible", timeout: 8000 });
  selected = true;
} catch (e) {
  check("Clicking a menu item selects the menu node instead of triggering it", false, e.message);
}
if (selected) {
  check("Clicking a menu item selects the menu node instead of triggering it", true);
  check(
    "The menu stays open and intact after being clicked",
    (await page.locator('text="DD_ITEM_DANGER"').count()) >= 1 &&
      (await page.locator('text="DD_TRIGGER"').count()) >= 1,
  );

  // ── Placement is inspector-driven ──────────────────────────────────────────
  const before = await measure(["DD_TRIGGER", "DD_ITEM_A"]);
  await placementSelect.selectOption("top");
  await page.waitForTimeout(1500);
  const after = await measure(["DD_TRIGGER", "DD_ITEM_A"]);
  check(
    'Switching "Opens toward" to top moves the menu above its trigger',
    before.ok && after.ok &&
      before.out.DD_ITEM_A.rect.t > before.out.DD_TRIGGER.rect.t &&
      after.out.DD_ITEM_A.rect.b <= after.out.DD_TRIGGER.rect.t + 2,
    `was below (${before.out?.DD_ITEM_A?.rect?.t} > ${before.out?.DD_TRIGGER?.rect?.t}), now ${after.out?.DD_ITEM_A?.rect?.b} vs ${after.out?.DD_TRIGGER?.rect?.t}`,
  );
  check(
    "The repositioned menu is still inside the artboard",
    after.ok && after.out.DD_ITEM_A.inside,
    JSON.stringify(after.out?.DD_ITEM_A?.rect),
  );

  // ── Menu items are editable from the inspector ─────────────────────────────
  const itemsInput = page.locator('xpath=//label[starts-with(text(),"Items")]/following-sibling::input').first();
  try {
    await itemsInput.fill("EDITED_ITEM_A,---,!EDITED_ITEM_B");
    await page.waitForTimeout(1500);
    const edited = await page.locator("body").innerText();
    check(
      "Editing the items string from the inspector rewrites the menu",
      edited.includes("EDITED_ITEM_A") && edited.includes("EDITED_ITEM_B") && !edited.includes("DD_ITEM_A"),
    );
  } catch (e) {
    check("Editing the items string from the inspector rewrites the menu", false, e.message);
  }
}

// ── The Overlay container really accepts children ────────────────────────────
const childInside = await page.evaluate(() => {
  const leafWith = (t) => [...document.querySelectorAll("*")].find(
    (e) => e.textContent.includes(t) && ![...e.children].some((c) => c.textContent.includes(t)),
  );
  const child = leafWith("OVERLAY_CHILD_MARKER");
  if (!child) return null;
  // Walk up to the scrim box: the nearest ancestor with a background colour.
  let box = child.parentElement;
  while (box && !/rgba?\([^)]*\)/.test(getComputedStyle(box).backgroundColor.replace("rgba(0, 0, 0, 0)", ""))) {
    box = box.parentElement;
  }
  if (!box) return null;
  const c = child.getBoundingClientRect(), b = box.getBoundingClientRect();
  return c.left >= b.left - 1 && c.right <= b.right + 1 && c.top >= b.top - 1 && c.bottom <= b.bottom + 1;
});
check("A child dropped into AstryxOverlay is drawn inside the overlay's own box", childInside === true);

// ── Everything survives the round-trip to the server ─────────────────────────
// Autosave is debounced; give it room, then read the row the server stored
// rather than trusting the in-memory canvas.
await page.waitForTimeout(6000);
const stored = await client.query(`SELECT craft_state FROM designs WHERE id = $1`, [designId]);
const storedState = stored.rows[0].craft_state ?? {};
const storedTypes = Object.values(storedState).map((n) => n?.type?.resolvedName);
check(
  "The stored design keeps every overlay under its real name",
  componentMarkers.every(([name]) => storedTypes.includes(`Astryx${name}`)),
  `missing: ${componentMarkers.map(([n]) => `Astryx${n}`).filter((n) => !storedTypes.includes(n)).join(", ") || "none"}`,
);
check(
  "The server kept AstryxOverlay a container with its child",
  storedState.ovl?.isCanvas === true && (storedState.ovl?.nodes ?? []).length === 1,
  `isCanvas=${storedState.ovl?.isCanvas} nodes=${JSON.stringify(storedState.ovl?.nodes)}`,
);
check(
  "The inspector edits were persisted",
  storedState.dd?.props?.placement === "top" && storedState.dd?.props?.items === "EDITED_ITEM_A,---,!EDITED_ITEM_B",
  `placement=${JSON.stringify(storedState.dd?.props?.placement)} items=${JSON.stringify(storedState.dd?.props?.items)}`,
);

await openDesign();
const reloadedText = await page.locator("body").innerText();
const stillMissing = componentMarkers
  .filter(([, m]) => !reloadedText.includes(m) && m !== "DD_ITEM_A")
  .map(([n]) => n);
check(
  "Every overlay still renders after a reload",
  stillMissing.length === 0 && reloadedText.includes("EDITED_ITEM_A"),
  stillMissing.join(", ") || "all present",
);
check(
  "No overlay degraded to a placeholder after a reload",
  !/\[Astryx/.test(reloadedText),
  (reloadedText.match(/\[Astryx\w+\]/g) ?? []).join(", ") || "(no placeholders)",
);
const reloadedGeo = await measure(panelMarkers.filter((m) => m !== "DD_ITEM_A"));
if (reloadedGeo.ok) {
  const escaped = panelMarkers.filter((m) => reloadedGeo.out[m]?.found && !reloadedGeo.out[m].inside);
  check("Every overlay is still inside its artboard after a reload", escaped.length === 0, escaped.join(", ") || "all inside");
}

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
