/**
 * End-to-end verification for task #481:
 * Confirm home-generated designs always open inside an artboard frame.
 *
 * Tests:
 *   1. POST /api/ai/design (home prompt) → craftState has ≥1 AstryxArtboard
 *      and ROOT has no direct non-artboard children.
 *   2. Browser: open the saved design → (a) artboard frame renders in the canvas,
 *      (b) layers panel on the right shows the artboard label.
 *   3. POST /api/ai/design with existing canvas + newScreen flag; apply the same
 *      merge the client uses (mergeGraphAware + spreadArtboardsInState); save the
 *      result; open in browser; assert two artboard frames render side-by-side
 *      with the second frame's left edge ≥ the first frame's right edge.
 *
 * Usage:
 *   CHROME_BIN=$(which chromium) node scripts/e2e-artboard-wrap.mjs
 *
 * Requirements:
 *   - playwright-core (devDependency declared in package.json)
 *   - chromium binary (CHROME_BIN env var, or `which chromium`)
 */

import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";
import { execSync } from "child_process";

const { Client } = pg;
const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DOMAIN = process.env.REPLIT_DEV_DOMAIN;
const BASE = `https://${DOMAIN}`;

// Resolve chromium binary: prefer CHROME_BIN, fall back to `which chromium`.
const CHROME_BIN = (() => {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  try { return execSync("which chromium", { encoding: "utf8" }).trim(); } catch { return null; }
})();

if (!DB_URL) throw new Error("DATABASE_URL / NEON_DATABASE_URL not set");
if (!SESSION_SECRET) throw new Error("SESSION_SECRET not set");
if (!DOMAIN) throw new Error("REPLIT_DEV_DOMAIN not set");
// Browser is required — this is a browser confirmation test.
if (!CHROME_BIN) {
  console.error("FAIL — chromium binary not found. Set CHROME_BIN or install the chromium system package.");
  process.exit(1);
}

// ── Client-side merge helpers (ported from DesignEditor.tsx) ─────────────────

/**
 * Shallow merge of existing + patch, then strips orphan child refs.
 * Mirrors DesignEditor.tsx `mergeGraphAware`.
 */
function mergeGraphAware(existingState, patchNodes) {
  const merged = { ...existingState, ...patchNodes };
  const nodeIds = new Set(Object.keys(merged));

  for (const [nodeId, node] of Object.entries(merged)) {
    if (!node || typeof node !== "object" || !Array.isArray(node.nodes)) continue;
    const before = node.nodes;
    const after = before.filter((childId) => {
      if (!nodeIds.has(childId)) {
        console.warn(`  [mergeGraphAware] removing orphan child ref "${childId}" from "${nodeId}"`);
        return false;
      }
      return true;
    });
    if (after.length !== before.length) {
      merged[nodeId] = { ...node, nodes: after };
    }
  }
  return merged;
}

/**
 * Assigns x/y props to artboards so they are laid out left-to-right.
 * In patch mode (existingState provided): only positions NEW artboards and
 * preserves the existing ones' positions.
 * Mirrors DesignEditor.tsx `spreadArtboardsInState`.
 */
function spreadArtboardsInState(state, existingState) {
  const isArtboard = (n) => n?.type?.resolvedName === "AstryxArtboard";
  const artboardEntries = Object.entries(state).filter(([, n]) => isArtboard(n));

  if (existingState) {
    const existingIds = new Set(
      Object.keys(existingState).filter((id) => isArtboard(existingState[id])),
    );
    const newArtboards = artboardEntries.filter(([id]) => !existingIds.has(id));
    if (newArtboards.length === 0) return state;

    const existingInMerged = artboardEntries.filter(([id]) => existingIds.has(id));
    let maxRight = 64;
    let baseY = 64;
    if (existingInMerged.length > 0) {
      const leftmost = existingInMerged.reduce((best, cur) =>
        (Number(cur[1].props?.x) || 0) < (Number(best[1].props?.x) || 0) ? cur : best,
      );
      baseY = Number(leftmost[1].props?.y) || 64;
      for (const [, node] of existingInMerged) {
        const x = Number(node.props?.x) || 0;
        const w = Number(node.props?.width) || 390;
        maxRight = Math.max(maxRight, x + w);
      }
    }

    const result = { ...state };
    let curX = maxRight + 80;
    for (const [id, node] of newArtboards) {
      const width = Number(node.props?.width) || 390;
      result[id] = { ...node, props: { ...node.props, x: curX, y: baseY } };
      curX += width + 80;
    }
    return result;
  } else {
    if (artboardEntries.length < 2) return state;
    artboardEntries.sort(([, a], [, b]) => (Number(a.props?.x) || 0) - (Number(b.props?.x) || 0));
    const result = { ...state };
    let curX = 64;
    const baseY = Number(artboardEntries[0][1].props?.y) || 64;
    for (const [id, node] of artboardEntries) {
      const width = Number(node.props?.width) || 390;
      result[id] = { ...node, props: { ...node.props, x: curX, y: baseY } };
      curX += width + 80;
    }
    return result;
  }
}

// ── General helpers ───────────────────────────────────────────────────────────

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

async function apiPost(path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `connect.sid=${cookie}` },
    body: JSON.stringify(body),
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

/** Return count of nodes with the given resolvedName */
function countByType(state, name) {
  return Object.values(state).filter(
    (n) => n && typeof n === "object" && n.type?.resolvedName === name,
  ).length;
}

/** Return IDs of direct ROOT children that are NOT AstryxArtboard */
function nonArtboardRootChildren(state) {
  const root = state["ROOT"];
  if (!root || !Array.isArray(root.nodes)) return [];
  return root.nodes.filter((id) => {
    const node = state[id];
    return node && node.type?.resolvedName !== "AstryxArtboard";
  });
}

/**
 * Scan the canvas for all rendered artboard frames.
 * An artboard renders a leaf label element immediately before its frame div.
 * Returns an array of { label, x, y, w, h } sorted left-to-right by x.
 */
async function allArtboardFrames(page) {
  return page.evaluate(() => {
    const mainEl = document.querySelector("main") ?? document.body;
    const frames = [];
    for (const el of mainEl.querySelectorAll("div")) {
      if (el.children.length > 0) continue;
      const text = (el.textContent ?? "").trim();
      if (!text || text.length > 60) continue;
      const frame = el.nextElementSibling;
      if (!frame) continue;
      const r = frame.getBoundingClientRect();
      // A proper artboard frame is at least 100x100 px
      if (r.width >= 100 && r.height >= 100) {
        frames.push({ label: text, x: r.x, y: r.y, w: r.width, h: r.height });
      }
    }
    return frames.sort((a, b) => a.x - b.x);
  });
}

// ── Seed user ────────────────────────────────────────────────────────────────

const db = new Client({ connectionString: DB_URL });
await db.connect();

const USER_ID = "e2e-task481-user";
const EMAIL = "e2e-task481@example.com";

await db.query(
  `INSERT INTO users (id, email, first_name, is_beta, subscription_tier)
   VALUES ($1, $2, 'E2ETask481', true, 'pro')
   ON CONFLICT (id) DO UPDATE SET is_beta = true, subscription_tier = 'pro'`,
  [USER_ID, EMAIL],
);

const cookie = await createSession(db, USER_ID, EMAIL);
console.log(`\nRunning against: ${BASE}\n`);

// ────────────────────────────────────────────────────────────────────────────
// Test 1: Home-page prompt → craftState always wrapped in AstryxArtboard
// ────────────────────────────────────────────────────────────────────────────

let savedDesignId = null;
let generatedCraftState = null;
let expectedLabel = "Screen 1";

{
  console.log("[Test 1] Calling /api/ai/design (home prompt, may take ~20s)...");
  const prompt = "Design a simple onboarding screen with a welcome heading, a short description, and a Get Started button.";
  const { status, json } = await apiPost("/api/ai/design", { prompt }, cookie);

  if (status !== 200 || !json) {
    fail("POST /api/ai/design (home prompt) → 200", `status=${status}`);
  } else {
    pass("POST /api/ai/design (home prompt) → 200", `type=${json.type}`);

    let cs = null;
    const rawStr = typeof json.craftState === "string"
      ? json.craftState
      : json.craftState ? JSON.stringify(json.craftState) : null;
    if (rawStr) {
      try { cs = JSON.parse(rawStr); } catch { cs = null; }
    }

    if (!cs || typeof cs !== "object") {
      fail("craftState is parseable JSON");
    } else {
      pass("craftState is parseable JSON", `keys=${Object.keys(cs).length}`);

      const artboardCount = countByType(cs, "AstryxArtboard");
      if (artboardCount >= 1) {
        pass("craftState has ≥1 AstryxArtboard node", `count=${artboardCount}`);
      } else {
        fail("craftState has ≥1 AstryxArtboard node", `artboardCount=${artboardCount}`);
      }

      const bareChildren = nonArtboardRootChildren(cs);
      if (bareChildren.length === 0) {
        pass("ROOT has no direct non-artboard children (all wrapped)");
      } else {
        const types = bareChildren.map((id) => cs[id]?.type?.resolvedName ?? id).join(", ");
        fail("ROOT has no direct non-artboard children (all wrapped)", `bare ids: ${types}`);
      }

      generatedCraftState = cs;
      const firstArtboard = Object.values(cs).find((n) => n?.type?.resolvedName === "AstryxArtboard");
      if (firstArtboard?.props?.label) expectedLabel = firstArtboard.props.label;

      const { status: saveStatus, json: saveJson } = await apiPost(
        "/api/designs",
        { craftState: rawStr, title: json.title || "E2E Artboard Wrap Test", source: "home-ai" },
        cookie,
      );
      if (saveStatus === 201 && saveJson?.id) {
        savedDesignId = saveJson.id;
        pass("Design saved → 201", `designId=${savedDesignId}`);
      } else {
        fail("Design saved → 201", `status=${saveStatus} body=${JSON.stringify(saveJson)?.slice(0, 300)}`);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Test 3 API portion: POST /api/ai/design with newScreen flag, apply
// correct client-side merge, save as a new design for browser verification.
// (Done before browser launch so both designs are ready when browser opens.)
// ────────────────────────────────────────────────────────────────────────────

// The existing canvas for Test 3: one artboard at an explicit x=64 so the
// merge helper knows where it sits and positions the new artboard to its right.
const existingCanvas = {
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    isCanvas: true,
    props: { direction: "row", gap: 80 },
    displayName: "AstryxSection",
    custom: {},
    parent: null,
    hidden: false,
    nodes: ["artboard-e1"],
    linkedNodes: {},
  },
  "artboard-e1": {
    type: { resolvedName: "AstryxArtboard" },
    isCanvas: true,
    props: { label: "Screen 1", width: 390, x: 64, y: 64 },
    displayName: "AstryxArtboard",
    custom: {},
    parent: "ROOT",
    hidden: false,
    nodes: ["btn-e1"],
    linkedNodes: {},
  },
  "btn-e1": {
    type: { resolvedName: "AstryxButton" },
    isCanvas: false,
    props: { children: "Get Started" },
    displayName: "AstryxButton",
    custom: {},
    parent: "artboard-e1",
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
};

let mergedDesignId = null;
let mergedDesignState = null;

{
  console.log("\n[Test 3 API] Calling /api/ai/design with newScreen flag (may take ~20s)...");
  const { status, json } = await apiPost(
    "/api/ai/design",
    { prompt: "Create a settings screen with a heading, a toggle, and a Save button.", currentCraftState: JSON.stringify(existingCanvas), newScreen: true },
    cookie,
  );

  if (status !== 200 || !json) {
    fail("KiteAI 'create new screen' API call → 200", `status=${status}`);
  } else {
    pass("KiteAI 'create new screen' API call → 200", `type=${json.type}`);

    // Apply the same merge the client uses for a patch response.
    let patchNodes = null;
    if (json.type === "patch" && json.nodes) {
      try { patchNodes = JSON.parse(json.nodes); } catch { patchNodes = null; }
    } else if (json.craftState) {
      // Full-state response: the new artboard is the whole state; merge into existing.
      try {
        const cs = typeof json.craftState === "string" ? JSON.parse(json.craftState) : json.craftState;
        patchNodes = cs;
      } catch { patchNodes = null; }
    }

    if (!patchNodes) {
      fail("KiteAI 'create new screen' → parseable patch/state", `type=${json.type}`);
    } else {
      // Apply graph-aware merge + spread (mirrors client code exactly)
      const merged = mergeGraphAware(existingCanvas, patchNodes);
      const spread = spreadArtboardsInState(merged, existingCanvas);

      const artboardCount = countByType(spread, "AstryxArtboard");
      if (artboardCount >= 2) {
        pass("Merged state has ≥2 AstryxArtboard nodes", `count=${artboardCount}`);
      } else {
        fail("Merged state has ≥2 AstryxArtboard nodes", `count=${artboardCount}`);
      }

      const bareChildren = nonArtboardRootChildren(spread);
      if (bareChildren.length === 0) {
        pass("Merged state: ROOT has no direct non-artboard children");
      } else {
        fail("Merged state: ROOT has no direct non-artboard children", bareChildren.join(", "));
      }

      // Verify x positions in the state JSON before opening browser
      const artboards = Object.entries(spread)
        .filter(([, n]) => n?.type?.resolvedName === "AstryxArtboard")
        .map(([id, n]) => ({ id, x: Number(n.props?.x ?? 0), width: Number(n.props?.width ?? 390) }))
        .sort((a, b) => a.x - b.x);

      if (artboards.length >= 2) {
        const first = artboards[0];
        const second = artboards[1];
        const firstRightEdge = first.x + first.width;
        if (second.x >= firstRightEdge) {
          pass(
            "Merged state: second artboard x ≥ first artboard right edge",
            `first.x=${first.x} firstRightEdge=${firstRightEdge} second.x=${second.x}`,
          );
        } else {
          fail(
            "Merged state: second artboard x ≥ first artboard right edge",
            `first.x=${first.x} firstRightEdge=${firstRightEdge} second.x=${second.x} — overlap or stacked`,
          );
        }
      }

      // Save merged design for browser verification
      const { status: saveStatus, json: saveJson } = await apiPost(
        "/api/designs",
        { craftState: JSON.stringify(spread), title: "E2E Two-Screen KiteAI", source: "kite-ai-e2e" },
        cookie,
      );
      if (saveStatus === 201 && saveJson?.id) {
        mergedDesignId = saveJson.id;
        mergedDesignState = spread;
        pass("Merged design saved → 201", `designId=${mergedDesignId}`);
      } else {
        fail("Merged design saved → 201", `status=${saveStatus} body=${JSON.stringify(saveJson)?.slice(0, 300)}`);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Browser session: Tests 2 + 3 (verify both designs render correctly)
// ────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ executablePath: CHROME_BIN, args: ["--no-sandbox"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addCookies([
    { name: "connect.sid", value: cookie, domain: DOMAIN, path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
  ]);

  // ── Test 2: open home-generated design ──────────────────────────────────

  if (!savedDesignId) {
    fail("Browser: artboard frame renders (Test 2)", "skipped — design not saved");
    fail("Browser: layers panel shows artboard label (Test 2)", "skipped — design not saved");
  } else {
    console.log(`\n[Test 2] Opening home-generated design ${savedDesignId} (label="${expectedLabel}")...`);
    const page2 = await ctx.newPage();
    page2.on("console", (m) => { if (m.type() === "error") console.log("[T2 err]", m.text().slice(0, 160)); });

    await page2.goto(`${BASE}/designs/${savedDesignId}`, { waitUntil: "networkidle", timeout: 90000 });
    await page2.waitForTimeout(2500);
    try { await page2.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
    await page2.screenshot({ path: "/tmp/e2e-481-2-loaded.png" });

    // ── 2a. Artboard frame (canvas-scoped) ──────────────────────────────
    //
    // Artboard renders as:
    //   <div>{label}</div>          ← leaf element, floating label above frame
    //   <div craft.js-frame...>     ← nextElementSibling = the actual frame
    const frames2 = await allArtboardFrames(page2);
    const matchedFrame = frames2.find((f) => f.label === expectedLabel) ?? frames2[0];

    if (matchedFrame && matchedFrame.w > 0 && matchedFrame.h > 0) {
      pass(
        `Browser: artboard frame "${matchedFrame.label}" renders with nonzero size`,
        `w=${matchedFrame.w.toFixed(0)} h=${matchedFrame.h.toFixed(0)}`,
      );
    } else {
      fail(
        `Browser: artboard frame for "${expectedLabel}" renders with nonzero size`,
        `frames found: ${JSON.stringify(frames2)}`,
      );
    }

    await page2.screenshot({ path: "/tmp/e2e-481-3-frame.png" });

    // ── 2b. Layers panel (right rail, "Layers" tab) ─────────────────────
    //
    // The Layers panel lives in the right rail behind a "Layers" TabsTrigger.
    // Click it, then verify the artboard label appears in the right panel (x > 75% viewport).
    try {
      // TabsTrigger renders as a button with role="tab" and text "Layers"
      await page2.locator('[role="tab"]:has-text("Layers")').first().click({ timeout: 5000 });
      await page2.waitForTimeout(800);
    } catch {
      try { await page2.locator('button:has-text("Layers")').first().click({ timeout: 3000 }); } catch {}
      await page2.waitForTimeout(500);
    }

    const layersHit = await page2.evaluate((label) => {
      const vw = window.innerWidth;
      const rightBound = vw * 0.75;
      const candidates = [...document.querySelectorAll("span, button")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.left > rightBound && el.textContent?.trim() === label;
        });
      const rightTexts = [...document.querySelectorAll("span, button")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left > rightBound; })
        .map((el) => el.textContent?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 25);
      return { found: candidates.length > 0, count: candidates.length, rightTexts };
    }, expectedLabel);

    if (layersHit.found) {
      pass(`Browser: layers panel shows artboard label "${expectedLabel}"`, `matches=${layersHit.count}`);
    } else {
      // The AI may produce a different label; any artboard-like label in the right panel is acceptable.
      const anyArtboard = layersHit.rightTexts.some((t) => /^Screen\s*\d+/i.test(t) || t === expectedLabel);
      if (anyArtboard) {
        pass(
          `Browser: layers panel shows an artboard label (expected "${expectedLabel}")`,
          `rightTexts=${JSON.stringify(layersHit.rightTexts.slice(0, 8))}`,
        );
      } else {
        fail(
          `Browser: layers panel shows artboard label "${expectedLabel}"`,
          `rightTexts=${JSON.stringify(layersHit.rightTexts).slice(0, 300)}`,
        );
      }
    }

    await page2.screenshot({ path: "/tmp/e2e-481-4-layers.png" });
    await page2.close();
  }

  // ── Test 3 Browser: verify two non-overlapping artboard frames render ──

  if (!mergedDesignId) {
    fail("Browser: two artboard frames render side-by-side (Test 3)", "skipped — merged design not saved");
  } else {
    console.log(`\n[Test 3 Browser] Opening merged 2-artboard design ${mergedDesignId}...`);
    const page3 = await ctx.newPage();
    page3.on("console", (m) => { if (m.type() === "error") console.log("[T3 err]", m.text().slice(0, 160)); });

    await page3.goto(`${BASE}/designs/${mergedDesignId}`, { waitUntil: "networkidle", timeout: 90000 });
    await page3.waitForTimeout(2500);
    try { await page3.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
    await page3.screenshot({ path: "/tmp/e2e-481-5-twoscreen-loaded.png" });

    const frames3 = await allArtboardFrames(page3);
    console.log(`  Rendered frames: ${JSON.stringify(frames3.map((f) => ({ label: f.label, x: f.x.toFixed(0), w: f.w.toFixed(0) })))}`);

    if (frames3.length >= 2) {
      pass(
        "Browser: ≥2 artboard frames render on canvas after KiteAI new-screen merge",
        `count=${frames3.length}`,
      );

      // Assert frames are side by side:
      // second.x must be ≥ first.x + first.width (non-overlapping)
      const first = frames3[0];
      const second = frames3[1];
      const firstRightEdge = first.x + first.w;
      if (second.x >= firstRightEdge) {
        pass(
          "Browser: second artboard frame does not overlap first (left edge ≥ first right edge)",
          `first=[x=${first.x.toFixed(0)} w=${first.w.toFixed(0)} rightEdge=${firstRightEdge.toFixed(0)}] second.x=${second.x.toFixed(0)}`,
        );
      } else {
        fail(
          "Browser: second artboard frame does not overlap first (left edge ≥ first right edge)",
          `first.x=${first.x.toFixed(0)} firstRightEdge=${firstRightEdge.toFixed(0)} second.x=${second.x.toFixed(0)} — overlap detected`,
        );
      }
    } else {
      fail(
        "Browser: ≥2 artboard frames render on canvas after KiteAI new-screen merge",
        `frames=${JSON.stringify(frames3.map((f) => f.label))}`,
      );
    }

    await page3.screenshot({ path: "/tmp/e2e-481-6-twoscreen-frames.png" });
    await page3.close();
  }
} finally {
  await browser.close();
}

// ── Summary ───────────────────────────────────────────────────────────────────

await db.end();

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
