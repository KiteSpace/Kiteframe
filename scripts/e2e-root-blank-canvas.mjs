// Real-browser proof for the blank-canvas regression.
//
// Seeds a design shaped exactly like the failing production case: ROOT typed
// with craft.js's literal "Root" (not an allowed component), 3 artboards with
// real content, everything correctly parented. Before the fix, sanitize
// demoted ROOT to the leaf AstryxUnknown placeholder and the canvas rendered
// nothing at all despite every node surviving in the state map.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-root-blank-canvas.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-root-blank-user";
const EMAIL = "e2e-root-blank@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const artboard = (id, label, x, headingId, heading) => ({
  [id]: {
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true,
    props: { label, x, y: 100, width: 360, height: 420, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", custom: {}, parent: "ROOT", hidden: false,
    nodes: [headingId], linkedNodes: {},
  },
  [headingId]: {
    type: { resolvedName: "AstryxHeading" }, isCanvas: false,
    props: { children: heading, size: "lg" },
    displayName: "AstryxHeading", custom: {}, parent: id, hidden: false,
    nodes: [], linkedNodes: {},
  },
});

const craftState = {
  // ── The bug: ROOT typed "Root" ──
  ROOT: {
    type: { resolvedName: "Root" },
    isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40 },
    displayName: "Root",
    custom: {}, parent: null, hidden: false,
    nodes: ["ab-fleet", "ab-checkout", "ab-details"], linkedNodes: {},
  },
  ...artboard("ab-fleet", "Navigate to Fleet Management", 100, "h-fleet", "Fleet Management"),
  ...artboard("ab-checkout", "Immediate Checkout", 540, "h-checkout", "Immediate Checkout"),
  ...artboard("ab-details", "View Asset Details", 980, "h-details", "Asset Details"),
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Root Blank Canvas', 'workflow-bridge') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)],
);
const designId = res.rows[0].id;

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
await client.end();
console.log("Seeded design", designId, "with ROOT typed 'Root'");

const domain = process.env.REPLIT_DEV_DOMAIN;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
const warnings = [];
page.on("console", (m) => { const t = m.text(); if (t.includes("AstryxUnknown") || t.includes("ROOT")) warnings.push(t); });

const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${n}${d ? " :: " + d : ""}`); };

await page.goto(`https://${domain}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
await page.waitForTimeout(1000);

// 1. The three artboard labels are visible on the canvas.
for (const label of ["Navigate to Fleet Management", "Immediate Checkout", "View Asset Details"]) {
  const n = await page.locator(`text="${label}"`).count();
  check(`Artboard label rendered: "${label}"`, n >= 1, `count=${n}`);
}

// 2. The heading content inside the artboards actually renders.
for (const heading of ["Fleet Management", "Asset Details"]) {
  const n = await page.locator(`text="${heading}"`).count();
  check(`Artboard content rendered: "${heading}"`, n >= 1, `count=${n}`);
}

// 3. No "[Root]" placeholder box anywhere — that is the blank-canvas signature.
const placeholder = await page.locator('text="[Root]"').count();
check("No [Root] unknown-component placeholder on canvas", placeholder === 0, `count=${placeholder}`);

// 4. ROOT was never demoted to AstryxUnknown in the console.
const demoted = warnings.filter((w) => w.includes('"Root"') && w.includes("AstryxUnknown"));
check("ROOT was not replaced with AstryxUnknown", demoted.length === 0, demoted.join(" | ") || "no demotion warnings");

// 5. Canvas actually has painted artboard frames with real size.
const painted = [];
for (const t of ["Navigate to Fleet Management", "Immediate Checkout", "View Asset Details"]) {
  // The artboard frame is the sibling element immediately after its label.
  const frame = page.locator(`div:text-is("${t}") >> xpath=following-sibling::div[1]`).first();
  const r = await frame.boundingBox().catch(() => null);
  painted.push({ t, w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0) });
}
check("Artboard frames have real painted dimensions", painted.every((p) => p.w > 50 && p.h > 50), JSON.stringify(painted));

await page.screenshot({ path: "/tmp/e2e-root-blank-canvas.png", fullPage: false });
console.log("screenshot: /tmp/e2e-root-blank-canvas.png");
if (warnings.length) console.log("ROOT-related console lines:\n  " + warnings.slice(0, 6).join("\n  "));

await browser.close();
const c2 = new Client({ connectionString: process.env.DATABASE_URL });
await c2.connect();
await c2.query("DELETE FROM designs WHERE claimed_by_user_id=$1", [USER_ID]);
await c2.query("DELETE FROM sessions WHERE sid=$1", [sid]);
await c2.query("DELETE FROM users WHERE id=$1", [USER_ID]);
await c2.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
