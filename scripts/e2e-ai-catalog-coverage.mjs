/**
 * Live-AI catalog coverage check — Task 601
 *
 * Background: the design system prompt is ~28k characters. A sanitizer bug
 * previously truncated it to 10k, making everything past that point invisible
 * to the model. The newest nav/display components were verified working (see
 * e2e-ai-uses-nav-display.mjs), but most of the previously-added palette was
 * also in the truncated region and was never validated against a live AI call.
 *
 * This script fires targeted prompts — each unambiguously calling for a
 * specific slice of the catalog — then reports which components the AI actually
 * produced and which it consistently refused to emit.
 *
 * The authoritative component list is derived at runtime from the source file
 * (server/lib/designPrompt.ts) so this script stays in sync automatically.
 *
 * Usage:
 *   node scripts/e2e-ai-catalog-coverage.mjs
 *
 * Requires: DATABASE_URL / NEON_DATABASE_URL, SESSION_SECRET, REPLIT_DEV_DOMAIN
 */

import pg from "pg";
import crypto from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Derive the authoritative catalog from designPrompt.ts ─────────────────────
const promptSrc = readFileSync(resolve(__dirname, "../server/lib/designPrompt.ts"), "utf8");
const listMatch = promptSrc.match(/export const ASTRYX_COMPONENT_LIST\s*=\s*\[([\s\S]*?)\]\s*as const/);
if (!listMatch) throw new Error("Could not parse ASTRYX_COMPONENT_LIST from designPrompt.ts");
const FULL_CATALOG = [...listMatch[1].matchAll(/"(Astryx\w+)"/g)].map((m) => m[1]);
console.log(`Loaded ${FULL_CATALOG.length} components from ASTRYX_COMPONENT_LIST in designPrompt.ts`);

const { Client } = pg;
const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DOMAIN = process.env.REPLIT_DEV_DOMAIN;
const BASE = `https://${DOMAIN}`;

if (!DB_URL) throw new Error("DATABASE_URL / NEON_DATABASE_URL not set");
if (!SESSION_SECRET) throw new Error("SESSION_SECRET not set");
if (!DOMAIN) throw new Error("REPLIT_DEV_DOMAIN not set");

const allChecks = [];
function recordPass(name, detail = "") {
  allChecks.push({ name, ok: true });
  console.log(`  PASS — ${name}${detail ? " :: " + detail : ""}`);
}
function recordFail(name, detail = "") {
  allChecks.push({ name, ok: false, detail });
  console.error(`  FAIL — ${name}${detail ? " :: " + detail : ""}`);
}

async function createSession(client, userId, email) {
  const sid = crypto.randomBytes(16).toString("hex");
  const expire = new Date(Date.now() + 24 * 3600 * 1000);
  const sess = {
    cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    passport: { user: { id: userId, email } },
  };
  await client.query(
    `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
     ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
    [sid, JSON.stringify(sess), expire],
  );
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "");
  return "s:" + sid + "." + hmac;
}

async function postDesign(path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `connect.sid=${cookie}` },
    body: JSON.stringify(body),
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

// Collect every resolvedName present in a craft state, whatever nesting.
function componentNames(state) {
  const names = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const rn = v?.type?.resolvedName ?? (typeof v?.type === "string" ? v.type : null);
    if (rn) names.add(rn);
    if (typeof v.displayName === "string") names.add(v.displayName);
    Object.values(v).forEach(walk);
  };
  walk(state);
  return names;
}

function extractState(json) {
  const raw = json?.craftState ?? json?.state ?? json?.data ?? json;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw ?? null;
}

// ── Test cases ─────────────────────────────────────────────────────────────────
// 12 prompts, each targeting a distinct slice of the catalog.
// Every component in FULL_CATALOG (except AstryxArtboard, which appears in
// every response implicitly) is a "must" or "should" in at least one case.
//
// 12 prompts × ~20s each ≈ 240s, comfortably under the 5-minute run budget.

const CASES = [
  // 1 ── Anchored overlays + menus (7 components)
  {
    label: "Anchored overlays & menus",
    prompt: [
      "Design a document editor toolbar screen.",
      "Show a popover anchored to a 'Permissions' button explaining who can edit.",
      "Add a tooltip over a help icon saying 'Changes auto-save every 30 seconds'.",
      "Show a hover card over a user avatar with their name, @handle, and bio.",
      "Add a dropdown menu for export (PDF, PNG, SVG, then a separator, then red Delete).",
      "Add a context menu for right-clicking a file row with Copy, Rename, and Delete options.",
      "Show a more menu (⋯) with Rename, Duplicate, Archive, and Delete.",
    ].join(" "),
    must: ["AstryxPopover", "AstryxTooltip", "AstryxHoverCard",
           "AstryxDropdownMenu", "AstryxContextMenu", "AstryxMoreMenu"],
    should: [],
  },

  // 2 ── Dialog overlays + surfaces (4 components)
  {
    label: "Dialog overlays & surfaces",
    prompt: [
      "Design a media file manager screen.",
      "Show a modal dialog asking users to confirm their email address with Confirm and Cancel buttons.",
      "Show a right-side drawer for detailed help documentation.",
      "Show a bottom sheet for choosing a subscription plan (Free, Pro, Enterprise).",
      "Show a confirmation alert dialog with a danger tone before permanently deleting a file.",
    ].join(" "),
    must: ["AstryxModal", "AstryxDrawer", "AstryxSheet", "AstryxAlertDialog"],
    should: [],
  },

  // 3 ── Toast, Lightbox, Overlay (3 components)
  {
    label: "Toast, Lightbox, Overlay",
    prompt: [
      "Design a photo gallery screen.",
      "Show a success toast notification in the bottom-right corner confirming an upload.",
      "Show a full-bleed lightbox viewer displaying a large photo with a caption and counter.",
      "Show an overlay backdrop with a card centered on top of it.",
    ].join(" "),
    must: ["AstryxToast", "AstryxLightbox", "AstryxOverlay"],
    should: [],
  },

  // 4 ── Form structure + date/time inputs + file (9 components)
  {
    label: "Form structure & date/time/file inputs",
    prompt: [
      "Design an event creation form.",
      "Lay out fields in a two-column form layout grid.",
      "Each input is wrapped in a labelled field.",
      "The form includes: a text input for event name, a textarea for description,",
      "a date picker for the start date, a time picker for the start time,",
      "a combined date-and-time field for the end, a date range picker for a recurring window,",
      "and a file upload dropzone for attaching a document.",
      "Join the Submit and Cancel buttons together in an attached input-group row.",
      "Show a success field status message below the form after submission.",
    ].join(" "),
    must: ["AstryxFormLayout", "AstryxField", "AstryxInputGroup", "AstryxFieldStatus",
           "AstryxTextArea", "AstryxDateInput", "AstryxTimeInput",
           "AstryxDateTimeInput", "AstryxDateRangeInput", "AstryxFileInput"],
    should: [],
  },

  // 5 ── Extended form inputs (6 components)
  {
    label: "Switch, NumberInput, ToggleButton, SegmentedControl, CheckboxList, IconButton",
    prompt: [
      "Design a notification preferences screen.",
      "Include a toggle switch for enabling email notifications and another for push notifications.",
      "Add a number input for frequency (min 1, max 10 times per day).",
      "Add a segmented control for timing: Immediately, Daily, or Weekly.",
      "Add a checkbox list for notification types: Comments, Mentions, and Replies.",
      "Show bold and italic toggle buttons for inline text formatting.",
      "Include small icon buttons for edit (pencil) and delete (trash) actions.",
    ].join(" "),
    must: ["AstryxSwitch", "AstryxNumberInput", "AstryxSegmentedControl",
           "AstryxCheckboxList", "AstryxToggleButton", "AstryxIconButton"],
    should: [],
  },

  // 6 ── Advanced search & selection + tokenizer (5 components)
  {
    label: "Advanced search & selection",
    prompt: [
      "Design a team management filter panel.",
      "Include a search-as-you-type typeahead for finding users by name.",
      "Add a multi-select dropdown for filtering by role: Admin, Editor, Viewer.",
      "Add a power search bar with filter chips showing status:active and team:engineering.",
      "Add a complex selector for projects where each option shows a title and description.",
      "Add a tokenizer field where users type comma-separated email addresses to invite.",
    ].join(" "),
    must: ["AstryxTypeahead", "AstryxMultiSelector", "AstryxPowerSearch",
           "AstryxComplexSelector", "AstryxTokenizer"],
    should: [],
  },

  // 7 ── Status & feedback + Avatar + Icon (6 components)
  {
    label: "Status feedback, Avatar, Icon",
    prompt: [
      "Design a file upload status page.",
      "Show a progress bar at 65% for an in-progress upload.",
      "Show a spinning loader while content is loading.",
      "Show skeleton placeholder shapes for content that is still loading.",
      "Show a coloured status dot indicating each user's online/offline presence.",
      "Show user avatars with initials next to each entry.",
      "Place small standalone icon glyphs (not buttons) — such as a home glyph, a bell glyph,",
      "and a settings glyph — as decorative labels in the header.",
    ].join(" "),
    must: ["AstryxProgressBar", "AstryxSpinner", "AstryxSkeleton",
           "AstryxStatusDot", "AstryxAvatar"],
    should: ["AstryxIcon"],
  },

  // 8 ── Data display (7 components)
  {
    label: "Table, Tabs, Accordion, Calendar, Command, Carousel, Resizable",
    prompt: [
      "Design a content management workspace.",
      "Show a data table with Name, Status, Date, and Owner columns and 4 rows.",
      "Add tabs for Overview, Activity, and Settings.",
      "Show a collapsible accordion section for FAQ entries.",
      "Include a month calendar view.",
      "Add a command palette for quick navigation.",
      "Show an image carousel with three slides.",
      "Use a resizable split panel so the editor and preview sit side by side.",
    ].join(" "),
    must: ["AstryxTable", "AstryxTabs", "AstryxAccordion", "AstryxCalendar",
           "AstryxCommand", "AstryxCarousel", "AstryxResizable"],
    should: [],
  },

  // 9 ── Charts (3 components)
  {
    label: "Charts",
    prompt: [
      "Design a revenue analytics dashboard.",
      "Include a bar chart for monthly revenue (Jan–Jun).",
      "Add a line chart for daily active users over the same period.",
      "Add a pie chart for traffic sources: Organic, Paid, Referral, Direct.",
    ].join(" "),
    must: ["AstryxBarChart", "AstryxLineChart", "AstryxPieChart"],
    should: [],
  },

  // 10 ── Navigation (8 components)
  {
    label: "Navigation components",
    prompt: [
      "Design a full admin dashboard with mobile support.",
      "Include a top navigation bar with logo, links for Dashboard, Users, Reports, Settings, and a Sign Out button.",
      "Add a sidebar with items Dashboard, Analytics, Team, Billing, Settings — Dashboard active.",
      "Show a breadcrumb: Home > Dashboard > Overview.",
      "Add pagination controls showing page 3 of 15.",
      "Add a vertical navigation menu panel with sub-links for Overview, Members, and Settings.",
      "Add a bottom mobile navigation bar with tabs: Home, Search, Notifications, and Profile.",
      "Include small navigation icon elements for bell, gear, and user.",
      "Use inline text links throughout the content.",
    ].join(" "),
    must: ["AstryxNavbar", "AstryxSidebar", "AstryxBreadcrumb", "AstryxPagination",
           "AstryxNavMenu", "AstryxMobileNav", "AstryxLink"],
    should: ["AstryxNavIcon"],
  },

  // 11 ── Display primitives + selectable cards + media (8 components)
  {
    label: "Display primitives, selectable cards, media",
    prompt: [
      "Design a team activity and plan selection screen.",
      "Each activity entry shows a group of stacked overlapping avatars,",
      "a coloured status indicator dot, a relative timestamp like '3 hours ago',",
      "and a small thumbnail image tile for attachments.",
      "Show a plan selection grid where each plan is a selectable card with a check indicator.",
      "Show feature highlight items as clickable cards that navigate when pressed.",
      "Show a video player with title 'Getting Started' and duration 5:42.",
      "Show a JavaScript code snippet with syntax highlighting.",
    ].join(" "),
    must: ["AstryxAvatarGroup", "AstryxIndicator", "AstryxTimestamp", "AstryxThumbnail",
           "AstryxSelectableCard", "AstryxClickableCard",
           "AstryxVideoPlayer", "AstryxCodeBlock"],
    should: [],
  },

  // 12 ── Content, lists, layout, base typography & controls (16 components)
  {
    label: "Content, lists, layout, typography & base controls",
    prompt: [
      "Design a settings and activity screen.",
      "Show a scrollable list of notification items with dividers between rows;",
      "each row has an icon glyph, a label, and a '2 min ago' meta note.",
      "Show a chat thread with bubbles — some sent by the current user, some received.",
      "Show an empty state placeholder when there are no notifications.",
      "Show removable token chips for selected tags.",
      "Use horizontal dividers to separate content sections.",
      "Include a grid layout with 3 equal columns for feature cards.",
      "Each feature is a content card container holding a heading and body text.",
      "Use horizontal rows and vertical stacks to arrange content.",
      "Include prominent section headings and body copy.",
      "Show badge chips labelled Active and Beta, an info banner, a select for timezone,",
      "a checkbox for accepting terms, a radio group for notification frequency,",
      "a slider for volume, text input fields, and action buttons.",
    ].join(" "),
    must: ["AstryxList", "AstryxListItem", "AstryxChatMessage", "AstryxEmptyState",
           "AstryxToken", "AstryxDivider",
           "AstryxGrid", "AstryxCard",
           "AstryxHeading", "AstryxText",
           "AstryxBadge", "AstryxBanner", "AstryxSelect",
           "AstryxCheckbox", "AstryxRadioGroup", "AstryxSlider",
           "AstryxButton", "AstryxTextInput"],
    should: ["AstryxSection", "AstryxHStack", "AstryxStack"],
  },
];

// Verify coverage: every catalog component should appear in at least one must/should list.
// AstryxArtboard is excluded — it appears implicitly in every generated response.
const coveredByCase = new Set(CASES.flatMap((c) => [...c.must, ...(c.should ?? [])]));
const notCovered = FULL_CATALOG.filter((n) => n !== "AstryxArtboard" && !coveredByCase.has(n));
if (notCovered.length > 0) {
  console.warn(`\nWarning: ${notCovered.length} catalog components not explicitly targeted by any prompt:`);
  notCovered.forEach((n) => console.warn(`  - ${n}`));
} else {
  console.log(`All ${FULL_CATALOG.length - 1} non-root catalog components are explicitly targeted.`);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
const client = new Client({ connectionString: DB_URL });
await client.connect();

const USER_ID = "e2e-catalog-coverage-user";
const EMAIL = "e2e-catalog-coverage@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta, subscription_tier)
   VALUES ($1, $2, 'E2ECatalog', true, 'pro')
   ON CONFLICT (id) DO UPDATE SET is_beta = true, subscription_tier = 'pro'`,
  [USER_ID, EMAIL],
);
const cookie = await createSession(client, USER_ID, EMAIL);
console.log(`\nRunning against: ${BASE}`);
console.log(`${CASES.length} targeted prompts covering ${coveredByCase.size} / ${FULL_CATALOG.length - 1} non-root catalog components\n`);
console.log("=".repeat(72));

// ── Run each case ─────────────────────────────────────────────────────────────
const caseResults = [];
const everUsed = new Set();

for (const tc of CASES) {
  console.log(`\n[${tc.label}]`);
  console.log(`Prompt: ${tc.prompt.slice(0, 120)}...`);
  console.log("Calling POST /api/ai/design (~20s)...");

  const caseFailures = [];
  const caseMustMissing = [];
  const caseShouldMissing = [];
  let caseUnknown = [];
  let caseUsed = [];

  const { status, json } = await postDesign("/api/ai/design", { prompt: tc.prompt, source: "workflow" }, cookie);
  const checkName = (suffix) => `[${tc.label}] ${suffix}`;

  if (status !== 200) {
    const body = JSON.stringify(json)?.slice(0, 300) ?? "";
    // Credit/quota exhaustion is a transient infrastructure issue, not an AI
    // behaviour failure. Record the case as skipped (not passed) so the final
    // exit code is INCOMPLETE rather than FAILED — but still nonzero, because
    // a skipped group means those components were not verified this run.
    const isQuota = /credit|quota|rate.?limit|insufficient/i.test(body);
    if (isQuota) {
      console.warn(`  SKIP — [${tc.label}] quota exhausted (status=${status}) — components not verified this run`);
      caseResults.push({ label: tc.label, ok: false, skipped: true, mustMissing: tc.must, shouldMissing: tc.should ?? [], unknown: [], used: [] });
      continue;
    }
    recordFail(checkName("POST /api/ai/design → 200"), `status=${status} body=${body}`);
    caseFailures.push("http");
    caseResults.push({ label: tc.label, ok: false, mustMissing: tc.must, shouldMissing: tc.should ?? [], unknown: [], used: [] });
    continue;
  }
  recordPass(checkName("POST /api/ai/design → 200"), `type=${json?.type}`);

  const state = extractState(json);
  if (!state || typeof state !== "object") {
    recordFail(checkName("response carries a parseable craft state"), JSON.stringify(json)?.slice(0, 300));
    caseFailures.push("state");
    caseResults.push({ label: tc.label, ok: false, mustMissing: tc.must, shouldMissing: tc.should ?? [], unknown: [], used: [] });
    continue;
  }
  recordPass(checkName("response carries a parseable craft state"), `${Object.keys(state).length} nodes`);

  const used = componentNames(state);
  caseUsed = [...used].filter((n) => n.startsWith("Astryx")).sort();
  used.forEach((n) => everUsed.add(n));

  // Unknown-component check
  caseUnknown = [...used].filter((n) => /Unknown/i.test(n));
  if (caseUnknown.length === 0) {
    recordPass(checkName("no components degraded to a placeholder"));
  } else {
    recordFail(checkName("no components degraded to a placeholder"), caseUnknown.join(", "));
    caseFailures.push("unknown");
  }

  // Must-use: every required component must appear
  for (const n of tc.must) {
    if (used.has(n)) {
      recordPass(checkName(`AI emits required component ${n}`));
    } else {
      recordFail(checkName(`AI emits required component ${n}`),
        `not found; used: ${caseUsed.join(", ")}`);
      caseFailures.push(`must:${n}`);
      caseMustMissing.push(n);
    }
  }

  // Should-use: at least ceil(n/2) of the implied components must appear
  if ((tc.should ?? []).length > 0) {
    const shouldPresent = tc.should.filter((n) => used.has(n));
    const shouldMissing = tc.should.filter((n) => !used.has(n));
    caseShouldMissing.push(...shouldMissing);
    const threshold = Math.ceil(tc.should.length / 2);
    if (shouldPresent.length >= threshold) {
      recordPass(checkName("AI uses implied components broadly"),
        `${shouldPresent.length}/${tc.should.length}: ${shouldPresent.join(", ")}`);
    } else {
      recordFail(checkName("AI uses implied components broadly"),
        `only ${shouldPresent.length}/${tc.should.length} (need ≥${threshold}): present=${shouldPresent.join(", ") || "none"} missing=${shouldMissing.join(", ")}`);
      caseFailures.push("should");
    }
  }

  caseResults.push({
    label: tc.label,
    ok: caseFailures.length === 0,
    mustMissing: caseMustMissing,
    shouldMissing: caseShouldMissing,
    unknown: caseUnknown,
    used: caseUsed,
  });
  console.log(`  components used: ${caseUsed.join(", ")}`);
}

await client.end();

// ── Full coverage summary ─────────────────────────────────────────────────────
console.log("\n" + "=".repeat(72));
console.log("CATALOG COVERAGE SUMMARY");
console.log("=".repeat(72));

const neverUsed = FULL_CATALOG.filter((n) => !everUsed.has(n));
const usedCount = FULL_CATALOG.filter((n) => everUsed.has(n)).length;

console.log(`\nComponents produced by AI: ${usedCount} / ${FULL_CATALOG.length}`);
console.log(`Coverage: ${Math.round(100 * usedCount / FULL_CATALOG.length)}%`);

if (neverUsed.length === 0) {
  console.log("AI produced every component in the catalog across these prompts.");
} else {
  console.log(`\nComponents the AI never emitted across any prompt (${neverUsed.length}):`);
  for (const n of neverUsed) {
    const requiredBy = CASES.filter((c) => c.must.includes(n) || (c.should ?? []).includes(n)).map((c) => c.label);
    const tag = requiredBy.length > 0
      ? ` ← explicitly required by: ${requiredBy.join(", ")}`
      : " (not explicitly required — incidental coverage only)";
    console.log(`  - ${n}${tag}`);
  }
}

console.log("\nPer-prompt results:");
for (const c of caseResults) {
  const icon = c.skipped ? "⚠" : c.ok ? "✓" : "✗";
  const parts = c.skipped ? ["quota-skipped"] : [];
  if (c.mustMissing.length > 0) parts.push(`must-missing: ${c.mustMissing.join(", ")}`);
  if (c.shouldMissing.length > 0) parts.push(`should-missing: ${c.shouldMissing.join(", ")}`);
  if (c.unknown.length > 0) parts.push(`unknown: ${c.unknown.join(", ")}`);
  const detail = parts.length > 0 ? ` [${parts.join("; ")}]` : "";
  console.log(`  ${icon} ${c.label}${detail}`);
}

const skippedCases = caseResults.filter((c) => c.skipped);
const failedChecks = allChecks.filter((r) => !r.ok);
const verifiedCount = caseResults.filter((c) => !c.skipped).length;

console.log(`\nVerified: ${verifiedCount}/${CASES.length} prompt groups ran live AI calls`);
console.log(`${allChecks.length - failedChecks.length}/${allChecks.length} assertions passed`);

if (failedChecks.length > 0) {
  console.error(`\n${failedChecks.length} assertion(s) FAILED:`);
  failedChecks.forEach((f) => console.error(`  - ${f.name}: ${f.detail?.slice(0, 200)}`));
  process.exit(1);
}

if (skippedCases.length > 0) {
  console.error(`\nINCOMPLETE — ${skippedCases.length} prompt group(s) were quota-skipped and not verified:`);
  skippedCases.forEach((c) => {
    console.error(`  ⚠ ${c.label} (must-verify: ${c.mustMissing.join(", ")})`);
  });
  console.error("\nRerun after API credits are replenished to complete coverage.");
  process.exit(2);
}

console.log("\nAll prompt groups verified. Full catalog coverage confirmed.");
