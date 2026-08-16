/**
 * Live-AI verification that the navigation & display palette actually reaches
 * the model.
 *
 * Background: every message handed to executeAiChat - including the
 * server-owned system prompt - was run through an HTML sanitizer capped at
 * 10,000 characters. The design template is ~28k characters, so the model only
 * ever saw the first third of the component catalog. The 11 navigation and
 * display components live past character 11,500 and were therefore invisible
 * to the AI no matter how explicitly a prompt asked for them.
 *
 * This script asks for a screen that unambiguously calls for those components
 * and asserts the model actually emits them.
 *
 * Usage:
 *   node scripts/e2e-ai-uses-nav-display.mjs
 */

import pg from "pg";
import crypto from "crypto";

const { Client } = pg;
const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DOMAIN = process.env.REPLIT_DEV_DOMAIN;
const BASE = `https://${DOMAIN}`;

if (!DB_URL) throw new Error("DATABASE_URL / NEON_DATABASE_URL not set");
if (!SESSION_SECRET) throw new Error("SESSION_SECRET not set");
if (!DOMAIN) throw new Error("REPLIT_DEV_DOMAIN not set");

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true });
  console.log(`PASS — ${name}${detail ? " :: " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL — ${name}${detail ? " :: " + detail : ""}`);
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

async function post(path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `connect.sid=${cookie}` },
    body: JSON.stringify(body),
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

// Collect every resolvedName present in a craft state, whatever shape it is in.
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

const client = new Client({ connectionString: DB_URL });
await client.connect();

const USER_ID = "e2e-navdisplay-ai-user";
const EMAIL = "e2e-navdisplay-ai@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta, subscription_tier)
   VALUES ($1, $2, 'E2ENavDisplayAI', true, 'pro')
   ON CONFLICT (id) DO UPDATE SET is_beta = true, subscription_tier = 'pro'`,
  [USER_ID, EMAIL],
);
const cookie = await createSession(client, USER_ID, EMAIL);
console.log(`\nRunning against: ${BASE}\n`);

// The 11 components added for the navigation & display palette.
const NAV = ["AstryxNavMenu", "AstryxMobileNav", "AstryxNavIcon", "AstryxPagination", "AstryxLink"];
const DISPLAY = ["AstryxTimestamp", "AstryxIndicator", "AstryxThumbnail", "AstryxAvatarGroup"];
const CARDS = ["AstryxClickableCard", "AstryxSelectableCard"];
const ALL_NEW = [...NAV, ...DISPLAY, ...CARDS];

const prompt = [
  "Design a team members screen.",
  "Put a horizontal navigation menu across the top with links for Overview, Members and Settings.",
  "Below it, show a list of selectable member cards. Each card must show a stack of overlapping",
  "member avatars, a small coloured status indicator dot, and a relative timestamp like",
  '"2 hours ago" for when the member was last active.',
  "At the bottom of the list, add pagination controls for page 1 of 12.",
].join(" ");

console.log("[Live AI] POST /api/ai/design (may take ~20s)...\n");
const { status, json } = await post("/api/ai/design", { prompt, source: "workflow" }, cookie);

if (status !== 200) {
  fail("POST /api/ai/design → 200", `status=${status} body=${JSON.stringify(json)?.slice(0, 300)}`);
} else {
  pass("POST /api/ai/design → 200", `type=${json?.type}`);

  const state = extractState(json);
  if (!state || typeof state !== "object") {
    fail("response carries a parseable craft state", JSON.stringify(json)?.slice(0, 300));
  } else {
    const nodeCount = Object.keys(state).length;
    pass("response carries a parseable craft state", `${nodeCount} nodes`);

    const used = componentNames(state);
    const usedNew = ALL_NEW.filter((n) => used.has(n));
    const missing = ALL_NEW.filter((n) => !used.has(n));

    console.log(`\n  components used: ${[...used].sort().join(", ")}\n`);
    console.log(`  new-palette components used (${usedNew.length}/${ALL_NEW.length}): ${usedNew.join(", ") || "NONE"}`);
    console.log(`  new-palette components not used: ${missing.join(", ") || "none"}\n`);

    // The core assertion. Before the sanitizer fix this was always zero,
    // because the catalog entries never reached the model.
    if (usedNew.length === 0) {
      fail("AI uses at least one new nav/display component", "used none — prompt likely still truncated");
    } else {
      pass("AI uses at least one new nav/display component", `${usedNew.length} of ${ALL_NEW.length}`);
    }

    // The prompt names a nav menu, avatars, an indicator, a timestamp and
    // pagination outright, so we expect broad uptake, not a token single hit.
    if (usedNew.length >= 4) {
      pass("AI uses the explicitly-requested components broadly", usedNew.join(", "));
    } else {
      fail("AI uses the explicitly-requested components broadly", `only ${usedNew.length}: ${usedNew.join(", ")}`);
    }

    // Nothing should degrade to the unknown-component placeholder.
    const unknown = [...used].filter((n) => /Unknown/i.test(n));
    if (unknown.length === 0) pass("no components degraded to a placeholder");
    else fail("no components degraded to a placeholder", unknown.join(", "));
  }
}

await client.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.error(`\n${failed.length} FAILED:`);
  failed.forEach((f) => console.error(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
