// Real-browser proof for the navigation, display and selectable-card components.
//
// Unit tests can prove these eleven names reach all eight registries. What they
// cannot prove is the two things that only exist once there is layout and a
// live craft editor:
//
//   1. The two cards are *really* containers — a node dropped into one nests
//      inside it and is drawn inside its box. A card whose isCanvas is declared
//      on only one side of the client/prompt boundary still renders, and still
//      looks like a card; it just silently refuses children.
//   2. Nothing in the family overhangs its own box. The nav badge, the
//      selection mark and the avatar overflow chip are the three places where
//      an absolutely-positioned decoration would be the obvious implementation
//      and would escape the artboard under the canvas transform.
//
// Plus the round trip: inspector edit → autosave → server → reload.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-nav-display-palette.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  console.error("Refusing to run destructive E2E setup against a production environment.");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-navdisplay-user";
const EMAIL = "e2e-navdisplay@example.com";
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
const container = (parent, resolvedName, props, nodes) => ({
  type: { resolvedName },
  displayName: resolvedName,
  props,
  custom: {}, hidden: false, parent, isCanvas: true,
  nodes, linkedNodes: {},
});

// One tall artboard holding all eleven, each with unique text markers so a
// component that degraded to the unknown placeholder is impossible to miss.
// The long-value variants at the end are the bounds torture test: every string
// here is user- or AI-supplied, and an unbroken 90-character label is the input
// that pushes a badge or a chip past the artboard edge.
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
    props: { label: "Nav & Display", width: 520, height: 2600, x: 40, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["navmenu", "mobilenav", "navicon", "pager", "link",
            "stamp", "stampRaw", "ind", "thumb", "avatars",
            "clickCard", "selCard",
            "longNav", "longIcon", "longLink", "longAvatars"],
    linkedNodes: {},
  },

  navmenu: leaf("ab1", "AstryxNavMenu", {
    items: "NAV_OVERVIEW,NAV_PROJECTS:12,---,NAV_SETTINGS",
    active: "NAV_OVERVIEW", orientation: "horizontal", showIcons: false,
  }),
  mobilenav: leaf("ab1", "AstryxMobileNav", {
    items: "MOB_HOME:home,MOB_SEARCH:search,MOB_PROFILE:user",
    active: "MOB_HOME", position: "bottom", showLabels: true,
  }),
  navicon: leaf("ab1", "AstryxNavIcon", {
    glyph: "bell", label: "ICON_LABEL", badge: "ICON_BADGE", active: true, showLabel: true,
  }),
  pager: leaf("ab1", "AstryxPagination", {
    pageCount: 12, currentPage: 6, showArrows: true, align: "start",
  }),
  link: leaf("ab1", "AstryxLink", {
    label: "LINK_LABEL", href: "/docs", underline: "always", external: true, size: "md",
  }),

  // A parseable date must render relatively; anything else must survive verbatim.
  stamp: leaf("ab1", "AstryxTimestamp", {
    value: new Date(Date.now() - 2 * 3600_000).toISOString(),
    prefix: "STAMP_PREFIX", showIcon: true, size: "sm", muted: true,
  }),
  stampRaw: leaf("ab1", "AstryxTimestamp", {
    value: "STAMP_VERBATIM_TEXT", prefix: "", showIcon: false, size: "sm", muted: false,
  }),
  ind: leaf("ab1", "AstryxIndicator", {
    variant: "count", tone: "danger", count: 7, label: "IND_LABEL",
  }),
  thumb: leaf("ab1", "AstryxThumbnail", {
    src: "", label: "THUMB_LABEL", size: 72, radius: "md", showLabel: true,
  }),
  avatars: leaf("ab1", "AstryxAvatarGroup", {
    names: "Ada Lovelace,Grace Hopper,Alan Turing,Katherine Johnson,Barbara Liskov",
    max: 3, overflowCount: 0, size: "md",
  }),

  // The two containers, each seeded with a child. "Does a child really nest
  // inside" is the whole point of these two components.
  clickCard: container("ab1", "AstryxClickableCard", {
    variant: "elevated", interactive: true, hovered: true, padding: 16, gap: 12,
  }, ["clickChild"]),
  clickChild: leaf("clickCard", "AstryxText", { children: "CLICKCARD_CHILD_MARKER" }),
  selCard: container("ab1", "AstryxSelectableCard", {
    variant: "outlined", selected: true, indicator: "check", padding: 16, disabled: false, gap: 12,
  }, ["selChild"]),
  selChild: leaf("selCard", "AstryxText", { children: "SELCARD_CHILD_MARKER" }),

  longNav: leaf("ab1", "AstryxNavMenu", {
    items: "LONGNAVITEM_" + "x".repeat(90) + ":9999",
    active: "", orientation: "horizontal", showIcons: true,
  }),
  longIcon: leaf("ab1", "AstryxNavIcon", {
    glyph: "home", label: "LONGICONLABEL_" + "y".repeat(90),
    badge: "LONGBADGE_" + "z".repeat(40), active: false, showLabel: true,
  }),
  longLink: leaf("ab1", "AstryxLink", {
    label: "LONGLINK_" + "w".repeat(90), href: "#", underline: "always", external: true, size: "md",
  }),
  // An explicit overflow count with one very long name: avatars render initials,
  // so the chip is the only text here — and the chip is the thing that would
  // overhang if it were positioned absolutely.
  longAvatars: leaf("ab1", "AstryxAvatarGroup", {
    names: "LONGAVATARNAME_" + "v".repeat(60), max: 1, overflowCount: 999, size: "lg",
  }),
};

const seeded = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'workflow-bridge', $2, $3) RETURNING id`,
  [USER_ID, JSON.stringify(state), "E2E Nav & Display"],
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

// ── Every component resolves and draws ───────────────────────────────────────
const componentMarkers = [
  ["NavMenu", "NAV_PROJECTS"],
  ["MobileNav", "MOB_SEARCH"],
  ["NavIcon", "ICON_LABEL"],
  ["Pagination", "12"],
  ["Link", "LINK_LABEL"],
  ["Timestamp", "STAMP_PREFIX"],
  ["Indicator", "IND_LABEL"],
  ["Thumbnail", "THUMB_LABEL"],
  ["AvatarGroup", "AL"],
  ["ClickableCard", "CLICKCARD_CHILD_MARKER"],
  ["SelectableCard", "SELCARD_CHILD_MARKER"],
];
for (const [name, marker] of componentMarkers) {
  check(`${name} renders on the canvas`, (await page.locator(`text="${marker}"`).count()) >= 1, marker);
}

const bodyText = await page.locator("body").innerText();
check(
  "Nothing fell back to the unknown-component placeholder",
  !/\[Astryx/.test(bodyText),
  (bodyText.match(/\[Astryx\w+\]/g) ?? []).join(", ") || "(no placeholders)",
);

// ── Props reach the drawn component ──────────────────────────────────────────
check("NavMenu draws every item in its list", ["NAV_OVERVIEW", "NAV_PROJECTS", "NAV_SETTINGS"]
  .every((m) => bodyText.includes(m)));
check('NavMenu turns "Label:12" into a badge, not literal colon syntax',
  bodyText.includes("12") && !bodyText.includes("NAV_PROJECTS:12"));
check('NavMenu turns "---" into a divider rather than a literal item', !bodyText.includes("---"));
check("MobileNav draws every tab label", ["MOB_HOME", "MOB_SEARCH", "MOB_PROFILE"]
  .every((m) => bodyText.includes(m)));
check('MobileNav does not print the raw ":iconName" suffix', !bodyText.includes("MOB_HOME:home"));
check("NavIcon draws its badge", bodyText.includes("ICON_BADGE"));
check("Timestamp renders a real date relatively", /2 hours ago/.test(bodyText), "expected '2 hours ago'");
check("Timestamp passes non-date text through verbatim", bodyText.includes("STAMP_VERBATIM_TEXT"));
check("Indicator draws its count and label", bodyText.includes("IND_LABEL") && /\b7\b/.test(bodyText));
check("AvatarGroup derives its overflow chip from the names that did not fit",
  bodyText.includes("+2"), "5 names, max 3 → +2");
check("An explicit overflow count overrides the derived one",
  bodyText.includes("+999"), "overflowCount=999");

// Pagination's window: first and last page always shown, middle elided.
const pagerText = await page.evaluate(() => {
  // The pagination row is the smallest element that contains both the elision
  // and a page-number child whose entire text is "12".
  const candidates = [...document.querySelectorAll("*")].filter((e) => {
    if (!e.textContent.includes("…")) return false;
    const kids = [...e.querySelectorAll("*")];
    return kids.some((k) => k.textContent.trim() === "12") && kids.some((k) => k.textContent.trim() === "1");
  });
  if (!candidates.length) return null;
  const el = candidates[candidates.length - 1];
  return el.textContent.replace(/\s+/g, " ").trim();
});
check("Pagination shows the first page, the last page and an elision",
  pagerText !== null && pagerText.includes("1") && pagerText.includes("12") && pagerText.includes("…"),
  pagerText ?? "(pagination row not found)");

// ── Geometry: nothing overhangs its own box ──────────────────────────────────
const measure = async (markers) => page.evaluate((ms) => {
  const leafWith = (t) => [...document.querySelectorAll("*")].find(
    (e) => e.textContent.includes(t) && ![...e.children].some((c) => c.textContent.includes(t)),
  );
  const first = leafWith("NAV_OVERVIEW");
  const last = leafWith("SELCARD_CHILD_MARKER");
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
    // Text with overflow:visible paints outside its own box, so measure the
    // glyphs too, clipped by every scroll/clip ancestor.
    const range = document.createRange();
    range.selectNodeContents(el);
    let t = range.getBoundingClientRect();
    range.detach?.();
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
      found: true, fixedAncestor, inside: within(r), textInside: within(t),
      rect: { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) },
      textRect: { l: Math.round(t.left), t: Math.round(t.top), r: Math.round(t.right), b: Math.round(t.bottom) },
    };
  }
  return { ok: true, artboard: { l: Math.round(a.left), t: Math.round(a.top), r: Math.round(a.right), b: Math.round(a.bottom) }, out };
}, markers);

const panelMarkers = componentMarkers.map(([, m]) => m).filter((m) => m !== "12" && m !== "AL");
const boundsMarkers = [...panelMarkers, "ICON_BADGE", "STAMP_VERBATIM_TEXT",
  "LONGNAVITEM_", "LONGICONLABEL_", "LONGBADGE_", "LONGLINK_", "+999"];
const geo = await measure(boundsMarkers);
check("The artboard could be located for geometry checks", geo.ok, geo.reason ?? "");

if (geo.ok) {
  const escaped = boundsMarkers.filter((m) => geo.out[m].found && !geo.out[m].inside);
  check("Every component is drawn inside the artboard it belongs to", escaped.length === 0,
    escaped.map((m) => `${m} ${JSON.stringify(geo.out[m].rect)}`).join("; ") || `artboard ${JSON.stringify(geo.artboard)}`);
  const spilled = boundsMarkers.filter((m) => geo.out[m].found && !geo.out[m].textInside);
  check("No rendered text paints outside the artboard, even at 90 characters unbroken",
    spilled.length === 0,
    spilled.map((m) => `${m} text ${JSON.stringify(geo.out[m].textRect)}`).join("; ") || "none spilled");
  const missing = boundsMarkers.filter((m) => !geo.out[m].found);
  check("Every measured component was found in the DOM", missing.length === 0, missing.join(", ") || "all found");
  const fixed = boundsMarkers.filter((m) => geo.out[m].fixedAncestor);
  check("Nothing in the family has a fixed-position ancestor", fixed.length === 0,
    fixed.map((m) => `${m} → ${geo.out[m].fixedAncestor}`).join("; ") || "none");
}

// ── The cards really are containers ──────────────────────────────────────────
const childInside = await page.evaluate(() => {
  const leafWith = (t) => [...document.querySelectorAll("*")].find(
    (e) => e.textContent.includes(t) && ![...e.children].some((c) => c.textContent.includes(t)),
  );
  const measureCard = (marker) => {
    const child = leafWith(marker);
    if (!child) return null;
    // Walk up to the card box: the nearest ancestor with a visible border.
    let box = child.parentElement;
    while (box && getComputedStyle(box).borderTopWidth === "0px" &&
           getComputedStyle(box).boxShadow === "none") box = box.parentElement;
    if (!box) return null;
    const c = child.getBoundingClientRect(), b = box.getBoundingClientRect();
    return {
      inside: c.left >= b.left - 1 && c.right <= b.right + 1 && c.top >= b.top - 1 && c.bottom <= b.bottom + 1,
      // The child must be painted *within* the card's padding, not merely overlapping it.
      padded: c.left > b.left && c.top > b.top,
    };
  };
  return { click: measureCard("CLICKCARD_CHILD_MARKER"), sel: measureCard("SELCARD_CHILD_MARKER") };
});
check("A child of AstryxClickableCard is drawn inside the card's own box",
  childInside.click?.inside === true && childInside.click?.padded === true, JSON.stringify(childInside.click));
check("A child of AstryxSelectableCard is drawn inside the card's own box",
  childInside.sel?.inside === true && childInside.sel?.padded === true, JSON.stringify(childInside.sel));

// ── Zoom: the transform is what exposes a fixed or portalled decoration ──────
try {
  const zoomIn = page.locator('button[title="Zoom in"]').first();
  await zoomIn.click({ timeout: 5000 });
  await zoomIn.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const zoomed = await measure(boundsMarkers);
  const escaped = zoomed.ok
    ? boundsMarkers.filter((m) => zoomed.out[m].found && !(zoomed.out[m].inside && zoomed.out[m].textInside))
    : ["<no artboard>"];
  check("Everything stays inside its artboard after zooming", zoomed.ok && escaped.length === 0,
    escaped.map((m) => `${m} ${JSON.stringify(zoomed.out?.[m]?.rect)}`).join("; ") || "all inside");
} catch (e) {
  check("Everything stays inside its artboard after zooming", false, `zoom control unavailable: ${e.message}`);
}

// ── Clicking selects the node instead of "using" the control ─────────────────
await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
await page.locator('text="NAV_SETTINGS"').first().click();
await page.waitForTimeout(1200);

const orientationSelect = page.locator('xpath=//label[text()="Orientation"]/following-sibling::select').first();
let navSelected = false;
try {
  await orientationSelect.waitFor({ state: "visible", timeout: 8000 });
  navSelected = true;
} catch (e) {
  check("Clicking a nav item selects the NavMenu node instead of navigating", false, e.message);
}
if (navSelected) {
  check("Clicking a nav item selects the NavMenu node instead of navigating", true);
  check("The nav menu is intact after being clicked",
    (await page.locator('text="NAV_SETTINGS"').count()) >= 1);

  // Orientation is inspector-driven, and the layout must actually change.
  const beforeOrientation = await measure(["NAV_OVERVIEW", "NAV_SETTINGS"]);
  await orientationSelect.selectOption("vertical");
  await page.waitForTimeout(1500);
  const afterOrientation = await measure(["NAV_OVERVIEW", "NAV_SETTINGS"]);
  check('Switching orientation to "vertical" stacks the items',
    beforeOrientation.ok && afterOrientation.ok &&
      beforeOrientation.out.NAV_SETTINGS.rect.l > beforeOrientation.out.NAV_OVERVIEW.rect.l &&
      afterOrientation.out.NAV_SETTINGS.rect.t > afterOrientation.out.NAV_OVERVIEW.rect.t,
    `row: ${beforeOrientation.out?.NAV_SETTINGS?.rect?.l} > ${beforeOrientation.out?.NAV_OVERVIEW?.rect?.l}; ` +
    `column: ${afterOrientation.out?.NAV_SETTINGS?.rect?.t} > ${afterOrientation.out?.NAV_OVERVIEW?.rect?.t}`);

  const itemsInput = page.locator('xpath=//label[starts-with(text(),"Items")]/following-sibling::input').first();
  try {
    await itemsInput.fill("EDITED_NAV_A,EDITED_NAV_B:3");
    await page.waitForTimeout(1500);
    const edited = await page.locator("body").innerText();
    check("Editing the items string from the inspector rewrites the nav menu",
      edited.includes("EDITED_NAV_A") && edited.includes("EDITED_NAV_B") && !edited.includes("NAV_OVERVIEW"));
  } catch (e) {
    check("Editing the items string from the inspector rewrites the nav menu", false, e.message);
  }
}

// ── The card's selected state is inspector-settable ──────────────────────────
// Click the card's own padding, not its child: clicking the child selects the
// child node and the inspector would then show the text's props instead.
const selCardBox = await page.evaluate(() => {
  const child = [...document.querySelectorAll("*")].find(
    (e) => e.textContent.includes("SELCARD_CHILD_MARKER") &&
      ![...e.children].some((c) => c.textContent.includes("SELCARD_CHILD_MARKER")),
  );
  if (!child) return null;
  let box = child.parentElement;
  while (box && getComputedStyle(box).borderTopWidth === "0px" &&
         getComputedStyle(box).boxShadow === "none") box = box.parentElement;
  if (!box) return null;
  const r = box.getBoundingClientRect();
  return { x: r.left + 4, y: r.top + 4 };
});
if (selCardBox) await page.mouse.click(selCardBox.x, selCardBox.y);
await page.waitForTimeout(1200);
// The boolean control is a styled button, not a checkbox: its state reads off
// the "Yes"/"No" text beside it.
const selectedRow = page.locator('xpath=//label[text()="Selected"]/following-sibling::div').first();
try {
  await selectedRow.waitFor({ state: "visible", timeout: 8000 });
  const before = (await selectedRow.innerText()).trim();
  await selectedRow.locator("button").first().click();
  await page.waitForTimeout(1500);
  const after = (await selectedRow.innerText()).trim();
  check("The card's Selected state can be toggled from the inspector",
    before === "Yes" && after === "No", `${before} → ${after}`);
  check("The card keeps its child after the state change",
    (await page.locator('text="SELCARD_CHILD_MARKER"').count()) >= 1);
} catch (e) {
  check("The card's Selected state can be toggled from the inspector", false, e.message);
}

// ── Everything survives the round trip to the server ─────────────────────────
await page.waitForTimeout(6000);
const stored = await client.query(`SELECT craft_state FROM designs WHERE id = $1`, [designId]);
const storedState = stored.rows[0].craft_state ?? {};
const storedTypes = Object.values(storedState).map((n) => n?.type?.resolvedName);
check("The stored design keeps every component under its real name",
  componentMarkers.every(([name]) => storedTypes.includes(`Astryx${name}`)),
  `missing: ${componentMarkers.map(([n]) => `Astryx${n}`).filter((n) => !storedTypes.includes(n)).join(", ") || "none"}`);
check("The server kept both cards as containers holding their child",
  storedState.clickCard?.isCanvas === true && (storedState.clickCard?.nodes ?? []).length === 1 &&
  storedState.selCard?.isCanvas === true && (storedState.selCard?.nodes ?? []).length === 1,
  `click isCanvas=${storedState.clickCard?.isCanvas} nodes=${JSON.stringify(storedState.clickCard?.nodes)}; ` +
  `sel isCanvas=${storedState.selCard?.isCanvas} nodes=${JSON.stringify(storedState.selCard?.nodes)}`);
check("The inspector edits were persisted",
  storedState.navmenu?.props?.orientation === "vertical" &&
  storedState.navmenu?.props?.items === "EDITED_NAV_A,EDITED_NAV_B:3" &&
  storedState.selCard?.props?.selected === false,
  `orientation=${JSON.stringify(storedState.navmenu?.props?.orientation)} ` +
  `items=${JSON.stringify(storedState.navmenu?.props?.items)} ` +
  `selected=${JSON.stringify(storedState.selCard?.props?.selected)}`);

await openDesign();
const reloadedText = await page.locator("body").innerText();
const stillMissing = componentMarkers
  .filter(([, m]) => !reloadedText.includes(m) && m !== "NAV_PROJECTS")
  .map(([n]) => n);
check("Every component still renders after a reload",
  stillMissing.length === 0 && reloadedText.includes("EDITED_NAV_A"),
  stillMissing.join(", ") || "all present");
check("Nothing degraded to a placeholder after a reload", !/\[Astryx/.test(reloadedText),
  (reloadedText.match(/\[Astryx\w+\]/g) ?? []).join(", ") || "(no placeholders)");
const reloadedChild = await page.locator('text="SELCARD_CHILD_MARKER"').count();
check("A card's child survives the reload inside the card", reloadedChild >= 1);

await browser.close();

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
