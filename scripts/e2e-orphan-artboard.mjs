// E2E for task #513: a stored design whose second artboard is MISSING from
// ROOT.nodes (AI orphan bug) must render both artboards, not a blank canvas.
// Seeds the broken design + forged session, then drives a real browser.
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task513-user";
const EMAIL = "e2e-task513@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const node = (over) => ({
  isCanvas: false, props: {}, displayName: "", custom: {}, hidden: false,
  nodes: [], linkedNodes: {}, ...over,
});

// ROOT references only artboard-1; artboard-2 (with content) is orphaned.
// A truly empty ghost artboard is also present and must NOT come back.
const craftState = {
  ROOT: node({
    type: { resolvedName: "AstryxSection" }, isCanvas: true, parent: null,
    props: { direction: "row", gap: 80, padding: 40 },
    displayName: "AstryxSection", nodes: ["artboard-1"],
  }),
  "artboard-1": node({
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true, parent: "ROOT",
    props: { label: "Login Screen", width: 390, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", nodes: ["btn-1"],
  }),
  "btn-1": node({
    type: { resolvedName: "AstryxButton" }, parent: "artboard-1",
    props: { children: "Sign in", variant: "primary" }, displayName: "AstryxButton",
  }),
  "artboard-2": node({
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true, parent: "ROOT",
    props: { label: "Dashboard Screen", width: 390, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", nodes: ["heading-2"],
  }),
  "heading-2": node({
    type: { resolvedName: "AstryxHeading" }, parent: "artboard-2",
    props: { children: "Dashboard Overview" }, displayName: "AstryxHeading",
  }),
  "ghost-artboard": node({
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true, parent: "ROOT",
    props: { label: "Ghost Blank", width: 390 }, displayName: "AstryxArtboard",
  }),
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 513', 'workflow-bridge') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)],
);
const designId = res.rows[0].id;

const sid = crypto.randomBytes(16).toString("hex");
const expire = new Date(Date.now() + 24 * 3600 * 1000);
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify({
    cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    passport: { user: { id: USER_ID, email: EMAIL } },
  }), expire],
);
const hmac = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "");
const cookieValue = "s:" + sid + "." + hmac;
await client.end();

const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

const inspect = async (label) => {
  await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `/tmp/e2e-513-${label}.png` });
  const body = await page.evaluate(() => document.body.innerText);
  return body;
};

// ── 1. First open: orphaned artboard rendered, ghost gone ────────────────────
{
  const text = await inspect("first-open");
  check("Login Screen artboard renders", text.includes("Login Screen"));
  check("Sign in button renders", text.includes("Sign in"));
  check("Orphaned Dashboard artboard renders (was blank before fix)", text.includes("Dashboard Screen"));
  check("Orphaned artboard content renders", text.includes("Dashboard Overview"));
  // The cleanup banner quotes the ghost's label, so "Ghost Blank" appears once
  // (banner) — a second occurrence would mean it rendered on the canvas too.
  check("Ghost cleanup banner shown", text.includes("blank artboard"));
  check("Empty ghost artboard is NOT resurrected on canvas", text.split("Ghost Blank").length <= 2);
}

// ── 2. Reload: content persists (auto-save must not have clobbered it) ───────
{
  const text = await inspect("after-reload");
  check("Dashboard artboard persists after reload", text.includes("Dashboard Screen") && text.includes("Dashboard Overview"));
}

// ── 3. Real API routes: POST /api/designs and PATCH must repair before prune ─
{
  const api = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: `connect.sid=${cookieValue}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };

  const post = await api("POST", "/api/designs", {
    craftState: JSON.stringify(craftState),
    title: "E2E 513 API",
    source: "workflow-bridge",
  });
  check("POST /api/designs accepts orphaned state", post.status === 201, `status=${post.status}`);
  if (post.status === 201) {
    const got = await api("GET", `/api/designs/${post.json.id}`);
    const persisted = got.json?.craftState ?? {};
    check("POST persisted the orphaned artboard", !!persisted["artboard-2"] && !!persisted["heading-2"]);
    check("POST reattached it under ROOT", Array.isArray(persisted.ROOT?.nodes) && persisted.ROOT.nodes.includes("artboard-2"));
    check("POST pruned the empty ghost artboard", !persisted["ghost-artboard"]);

    const patch = await api("PATCH", `/api/designs/${post.json.id}`, { craftState });
    check("PATCH /api/designs accepts orphaned state", patch.status === 200, `status=${patch.status}`);
    const got2 = await api("GET", `/api/designs/${post.json.id}`);
    const persisted2 = got2.json?.craftState ?? {};
    check("PATCH persisted the orphaned artboard", !!persisted2["artboard-2"] && Array.isArray(persisted2.ROOT?.nodes) && persisted2.ROOT.nodes.includes("artboard-2"));
    check("PATCH pruned the empty ghost artboard", !persisted2["ghost-artboard"]);
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
