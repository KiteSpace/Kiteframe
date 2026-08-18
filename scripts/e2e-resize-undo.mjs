// Real-browser verification: width/height resize is a SINGLE undo step.
//
// Seeds a design with one artboard containing a sized button, then in a real
// authenticated browser:
//   1. Selects the button, drags its east resize handle right (many moves).
//   2. Verifies the width grew.
//   3. Presses Ctrl+Z once and verifies the width fully reverts (proving the
//      whole drag was one history entry, not dozens).
//   4. Presses Ctrl+Shift+Z once and verifies redo restores the final width.
//   5. Resizes the ARTBOARD east handle and repeats the one-step undo check.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-resize-undo.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-resize-undo-user";
const EMAIL = "e2e-resize-undo@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" }, isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40, align: "start", justify: "start" },
    displayName: "AstryxSection", custom: {}, parent: null, hidden: false,
    nodes: ["ab-1"], linkedNodes: {},
  },
  "ab-1": {
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true,
    props: { label: "Screen A", x: 120, y: 120, width: 400, height: 500, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", custom: {}, parent: "ROOT", hidden: false,
    nodes: ["btn-1"], linkedNodes: {},
  },
  "btn-1": {
    type: { resolvedName: "AstryxButton" }, isCanvas: false,
    props: { children: "Resize me", variant: "primary", width: 160, height: 48 },
    displayName: "AstryxButton", custom: {}, parent: "ab-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
};

const res = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Resize Undo', 'native') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)],
);
const designId = res.rows[0].id;

const sid = crypto.randomBytes(16).toString("hex");
const expire = new Date(Date.now() + 24 * 3600 * 1000);
const sess = {
  cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  passport: { user: { id: USER_ID, email: EMAIL } },
};
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify(sess), expire],
);
const secret = process.env.SESSION_SECRET;
const cookieValue = "s:" + sid + "." + crypto.createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
await client.end();
console.log("Seeded design", designId);

const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}

/** Reads a node's width/height/x from the live editor via the button's rendered box. */
const buttonBox = () => page.locator('button:text-is("Resize me")').boundingBox();

// ── Helper: drag a handle by (dx,dy) from a starting element box center-right ──
async function dragHandleFrom(startX, startY, dx, dy) {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (dx * i) / steps, startY + (dy * i) / steps);
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
}

// ═══ 1. Component resize → single undo ═══════════════════════════════════════
// Select the button.
const b0 = await buttonBox();
await page.mouse.click(b0.x + b0.width / 2, b0.y + b0.height / 2);
await page.waitForTimeout(500);

const before = await buttonBox();
// The east resize handle sits just past the right edge of the wrapper.
await dragHandleFrom(before.x + before.width + 2, before.y + before.height / 2, 80, 0);
await page.waitForTimeout(500);
const afterResize = await buttonBox();
const grew = afterResize.width - before.width > 40;
check("Component: width grew after east resize drag", grew, `before=${Math.round(before.width)} after=${Math.round(afterResize.width)}`);
await page.screenshot({ path: "/tmp/e2e-resize-1-grown.png" });

// One Ctrl+Z should fully revert.
await page.keyboard.press("ControlOrMeta+z");
await page.waitForTimeout(600);
const afterUndo = await buttonBox();
const reverted = Math.abs(afterUndo.width - before.width) <= 3;
check("Component: single Ctrl+Z fully reverts the resize", reverted, `before=${Math.round(before.width)} afterUndo=${Math.round(afterUndo.width)}`);
await page.screenshot({ path: "/tmp/e2e-resize-2-undone.png" });

// One redo should restore the final width.
await page.keyboard.press("ControlOrMeta+Shift+z");
await page.waitForTimeout(600);
const afterRedo = await buttonBox();
const restored = Math.abs(afterRedo.width - afterResize.width) <= 3;
check("Component: single redo restores the final width", restored, `final=${Math.round(afterResize.width)} afterRedo=${Math.round(afterRedo.width)}`);

// ═══ 2. Artboard resize → single undo ════════════════════════════════════════
const frameOf = (label) => page.locator(`div:text-is("${label}") >> xpath=following-sibling::div[1]`).first();
const abFrame = frameOf("Screen A");
const abBefore = await abFrame.boundingBox();
// Select the artboard first (click its frame center).
await page.mouse.click(abBefore.x + abBefore.width / 2, abBefore.y + abBefore.height / 2);
await page.waitForTimeout(400);
const abBox = await abFrame.boundingBox();
// East handle just past the right edge.
await dragHandleFrom(abBox.x + abBox.width + 2, abBox.y + abBox.height / 2, 90, 0);
await page.waitForTimeout(500);
const abGrown = await abFrame.boundingBox();
const abGrew = abGrown.width - abBox.width > 40;
check("Artboard: width grew after east resize drag", abGrew, `before=${Math.round(abBox.width)} after=${Math.round(abGrown.width)}`);
await page.screenshot({ path: "/tmp/e2e-resize-3-ab-grown.png" });

await page.keyboard.press("ControlOrMeta+z");
await page.waitForTimeout(600);
const abUndone = await abFrame.boundingBox();
const abReverted = Math.abs(abUndone.width - abBox.width) <= 4;
check("Artboard: single Ctrl+Z fully reverts the resize", abReverted, `before=${Math.round(abBox.width)} afterUndo=${Math.round(abUndone.width)}`);
await page.screenshot({ path: "/tmp/e2e-resize-4-ab-undone.png" });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
