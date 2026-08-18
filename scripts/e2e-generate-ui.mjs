/**
 * End-to-end verification for task #462:
 * Confirm "Generate UI" succeeds after the repairCraftState validation fix.
 *
 * Tests:
 *   1. POST /api/designs with a "clean" valid craft state → 201
 *   2. POST /api/designs with an AI-style broken craft state (missing required
 *      fields, dangling child refs) → repairCraftState should heal it → 201
 *   3. POST /api/designs with a large craft state (10+ nodes / 2 screens) → 201
 *   4. POST /api/ai/design with a workflow prompt → 200 with a parseable craft state
 *
 * Usage:
 *   node scripts/e2e-generate-ui.mjs
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true });
  console.log(`PASS — ${name}${detail ? " :: " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL — ${name}${detail ? " :: " + detail : ""}`);
}

// Forge a valid express-session cookie for a given user.
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
    headers: {
      "Content-Type": "application/json",
      Cookie: `connect.sid=${cookie}`,
    },
    body: JSON.stringify(body),
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

// ── Seed user ─────────────────────────────────────────────────────────────────

const client = new Client({ connectionString: DB_URL });
await client.connect();

const USER_ID = "e2e-task462-user";
const EMAIL = "e2e-task462@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta, subscription_tier)
   VALUES ($1, $2, 'E2ETask462', true, 'pro')
   ON CONFLICT (id) DO UPDATE SET is_beta = true, subscription_tier = 'pro'`,
  [USER_ID, EMAIL],
);

const cookie = await createSession(client, USER_ID, EMAIL);
console.log(`\nRunning against: ${BASE}\n`);

// ── Test 1: Clean valid craft state → 201 ────────────────────────────────────

const cleanState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    isCanvas: true,
    props: { direction: "row", gap: 80 },
    displayName: "AstryxSection",
    custom: {},
    parent: null,
    hidden: false,
    nodes: ["artboard-1"],
    linkedNodes: {},
  },
  "artboard-1": {
    type: { resolvedName: "AstryxArtboard" },
    isCanvas: true,
    props: { label: "Screen 1", width: 390 },
    displayName: "AstryxArtboard",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["btn-1"],
    linkedNodes: {},
  },
  "btn-1": {
    type: { resolvedName: "AstryxButton" },
    isCanvas: false,
    props: { children: "Submit" },
    displayName: "AstryxButton",
    custom: {},
    parent: "artboard-1",
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
};

{
  const { status, json } = await post("/api/designs", { craftState: JSON.stringify(cleanState), title: "E2E Clean", source: "native" }, cookie);
  if (status === 201 && json?.id) {
    pass("POST /api/designs — clean state → 201", `designId=${json.id}`);
  } else {
    fail("POST /api/designs — clean state → 201", `status=${status} body=${JSON.stringify(json)}`);
  }
}

// ── Test 2: AI-style broken craft state → repairCraftState heals it → 201 ────
// Simulate common AI omissions:
//   - Missing `props` on a node
//   - Missing `linkedNodes` on a node  
//   - Missing `nodes` array on a node
//   - Dangling child reference in ROOT.nodes
//   - Parent pointer referencing a non-existent node

const brokenState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    isCanvas: true,
    // 'props' intentionally missing — repair should add {}
    displayName: "AstryxSection",
    custom: {},
    parent: null,
    hidden: false,
    nodes: ["artboard-b1", "ghost-node"],  // ghost-node does not exist → should be stripped
    // 'linkedNodes' intentionally missing — repair should add {}
  },
  "artboard-b1": {
    type: { resolvedName: "AstryxArtboard" },
    isCanvas: true,
    props: { label: "Broken Screen", width: 390 },
    displayName: "AstryxArtboard",
    custom: {},
    parent: "ROOT",
    hidden: false,
    // 'nodes' intentionally missing — repair should add []
    linkedNodes: {},
  },
};

{
  const { status, json } = await post("/api/designs", { craftState: JSON.stringify(brokenState), title: "E2E Broken (should repair)", source: "native" }, cookie);
  if (status === 201 && json?.id) {
    pass("POST /api/designs — AI-broken state (repairCraftState) → 201", `designId=${json.id}`);
  } else {
    fail("POST /api/designs — AI-broken state (repairCraftState) → 201", `status=${status} body=${JSON.stringify(json)}`);
  }
}

// ── Test 3: Large craft state (10+ nodes, 2 screens) → 201 ──────────────────

function makeNode(id, resolvedName, parent, children = [], props = {}) {
  return [id, {
    type: { resolvedName },
    isCanvas: resolvedName === "AstryxArtboard" || resolvedName === "AstryxSection" || resolvedName === "AstryxStack",
    props,
    displayName: resolvedName,
    custom: {},
    parent,
    hidden: false,
    nodes: children,
    linkedNodes: {},
  }];
}

const largeState = Object.fromEntries([
  makeNode("ROOT", "AstryxSection", null, ["ab-left", "ab-right"], { direction: "row", gap: 60 }),
  makeNode("ab-left",  "AstryxArtboard", "ROOT", ["h1","h2","h3","h4","h5","h6"], { label: "Screen A", width: 390 }),
  makeNode("ab-right", "AstryxArtboard", "ROOT", ["i1","i2","i3","i4","i5","i6"], { label: "Screen B", width: 390 }),
  makeNode("h1", "AstryxHeading",   "ab-left",  [], { text: "Dashboard", level: 1 }),
  makeNode("h2", "AstryxText",      "ab-left",  [], { text: "Welcome back" }),
  makeNode("h3", "AstryxButton",    "ab-left",  [], { children: "New Project" }),
  makeNode("h4", "AstryxBadge",     "ab-left",  [], { label: "Active", color: "green" }),
  makeNode("h5", "AstryxDivider",   "ab-left",  [], {}),
  makeNode("h6", "AstryxProgressBar","ab-left", [], { value: 65 }),
  makeNode("i1", "AstryxHeading",   "ab-right", [], { text: "Settings", level: 1 }),
  makeNode("i2", "AstryxTextInput", "ab-right", [], { placeholder: "Search..." }),
  makeNode("i3", "AstryxSelect",    "ab-right", [], { placeholder: "Choose theme" }),
  makeNode("i4", "AstryxCheckbox",  "ab-right", [], { label: "Dark mode" }),
  makeNode("i5", "AstryxButton",    "ab-right", [], { children: "Save Changes" }),
  makeNode("i6", "AstryxSpinner",   "ab-right", [], {}),
]);

{
  const { status, json } = await post("/api/designs", { craftState: JSON.stringify(largeState), title: "E2E Large (10+ nodes)", source: "native" }, cookie);
  const nodeCount = Object.keys(largeState).length;
  if (status === 201 && json?.id) {
    pass(`POST /api/designs — large state (${nodeCount} nodes, 2 screens) → 201`, `designId=${json.id}`);
  } else {
    fail(`POST /api/designs — large state (${nodeCount} nodes, 2 screens) → 201`, `status=${status} body=${JSON.stringify(json)}`);
  }
}

// ── Test 4: POST /api/ai/design with a workflow prompt → 200 ─────────────────
// We send a real prompt to confirm the endpoint responds 200 and returns
// parseable JSON with a craft state (not a 422 or 500).

{
  console.log("\n[Test 4] Calling POST /api/ai/design (live AI call, may take ~10s)...");
  const prompt = `Generate a simple login screen with a heading "Sign In", email input, password input, and a submit button. Source: workflow generation test.`;
  const { status, json } = await post("/api/ai/design", { prompt, source: "workflow" }, cookie);
  
  if (status !== 200) {
    fail("POST /api/ai/design — workflow prompt → 200", `status=${status} body=${JSON.stringify(json)?.slice(0, 300)}`);
  } else if (!json) {
    fail("POST /api/ai/design — response is parseable JSON", "null response");
  } else {
    pass("POST /api/ai/design — workflow prompt → 200", `type=${json.type}`);

    // Workflow generation MUST return a full state (not a patch or message) so
    // the design can be saved.  Any other shape is a FAIL for this test.
    if (json.type !== "state") {
      fail(
        "POST /api/ai/design — workflow prompt must return type=state",
        `got type='${json.type}' — workflow generation should never return a patch or message`,
      );
    } else if (!json.craftState) {
      fail("POST /api/ai/design → craftState field must be present in type=state response");
    } else {
      // Confirm the craft state is valid JSON
      let cs;
      try { cs = JSON.parse(json.craftState); } catch { cs = null; }
      if (!cs) {
        fail("POST /api/ai/design → craftState is parseable JSON");
      } else {
        pass("POST /api/ai/design → craftState is parseable JSON", `keys=${Object.keys(cs).length}`);
        // Save it — this is the exact end-to-end path that was failing with 422
        // before repairCraftState was wired into the validateCraftState wrapper.
        const { status: saveStatus, json: saveJson } = await post(
          "/api/designs",
          { craftState: json.craftState, title: json.title || "E2E AI Generated", source: "workflow-bridge" },
          cookie,
        );
        if (saveStatus === 201 && saveJson?.id) {
          pass("POST /api/designs — AI-generated craft state → 201", `designId=${saveJson.id}`);
        } else {
          fail("POST /api/designs — AI-generated craft state → 201", `status=${saveStatus} body=${JSON.stringify(saveJson)?.slice(0, 400)}`);
        }
      }
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

await client.end();

console.log("\n─────────────────────────────────────");
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log(`Results: ${passed}/${results.length} passed`);
if (failed.length > 0) {
  console.error("Failed checks:");
  for (const f of failed) console.error(`  • ${f.name}${f.detail ? " — " + f.detail : ""}`);
  process.exit(1);
} else {
  console.log("All checks passed ✓");
  process.exit(0);
}
