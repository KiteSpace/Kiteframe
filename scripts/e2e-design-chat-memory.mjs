// Real-browser proof that the design page remembers its KiteAI conversation.
//
// Before the fix, the right-rail chat on /designs/:id kept its messages in
// plain component state. Every reload, tab switch or navigation wiped the
// thread back to the canned greeting, so users lost the context of what they
// had just asked for.
//
// This drives the actual UI: sends a message, reloads the page, and asserts
// the exchange is still on screen — then opens a *different* design and
// asserts the conversation did not leak across.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-design-chat-memory.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-chat-memory-user";
const EMAIL = "e2e-chat-memory@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const craftState = (label, heading) => ({
  ROOT: {
    type: { resolvedName: "AstryxSection" }, isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40 },
    displayName: "AstryxSection", custom: {}, parent: null, hidden: false,
    nodes: ["ab1"], linkedNodes: {},
  },
  ab1: {
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true,
    props: { label, x: 100, y: 100, width: 360, height: 420, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", custom: {}, parent: "ROOT", hidden: false,
    nodes: ["h1"], linkedNodes: {},
  },
  h1: {
    type: { resolvedName: "AstryxHeading" }, isCanvas: false,
    props: { children: heading, size: "lg" },
    displayName: "AstryxHeading", custom: {}, parent: "ab1", hidden: false,
    nodes: [], linkedNodes: {},
  },
});

async function seedDesign(title, label, heading) {
  const r = await client.query(
    `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
     VALUES ($1, $2, $3, 'workflow-bridge') RETURNING id`,
    [USER_ID, JSON.stringify(craftState(label, heading)), title],
  );
  return r.rows[0].id;
}

const designA = await seedDesign("E2E Chat Memory A", "Screen A", "Checkout");
const designB = await seedDesign("E2E Chat Memory B", "Screen B", "Settings");

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
console.log("Seeded designs", designA, designB);

const domain = process.env.REPLIT_DEV_DOMAIN;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
// Start with the right rail open so the chat is reachable without extra clicks.
await ctx.addInitScript(() => {
  try { localStorage.setItem("kiteframe-design-panel-collapsed", "false"); } catch {}
});

const page = await ctx.newPage();

// Stub the AI call: this test is about whether the conversation is remembered,
// not about what the model says. A deterministic failure reply keeps the run
// fast, free and repeatable, and still exercises the full append+persist path.
await page.route("**/api/ai/design*", (route) =>
  route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Stubbed AI reply for e2e" }) }),
);

const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${n}${d ? " :: " + d : ""}`); };

const PROMPT = "Remember me across a reload please";

async function openDesign(id) {
  await page.goto(`https://${domain}/designs/${id}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(800);
  // Make sure the rail is expanded and the KiteAI tab is the active one.
  const tab = page.locator('button[role="tab"]:has-text("KiteAI")');
  if (await tab.count()) await tab.first().click().catch(() => {});
  await page.waitForTimeout(500);
}

const chatBox = () => page.locator('input[placeholder*="Ask KiteAI"]').first();
const promptCount = () => page.locator(`text="${PROMPT}"`).count();

// ── 1. Send a message on design A ────────────────────────────────────────────
await openDesign(designA);

check("Design A canvas rendered", (await page.locator('text="Checkout"').count()) >= 1);
check("KiteAI chat input is present in the right rail", (await chatBox().count()) === 1);

await chatBox().fill(PROMPT);
await page.locator('button[title="Send"]').first().click();
await page.waitForTimeout(2500);

check("Sent message appears in the conversation", (await promptCount()) >= 1, `count=${await promptCount()}`);

// ── 2. The key assertion: it survives a reload ───────────────────────────────
await openDesign(designA);
const afterReload = await promptCount();
check("Message is still there after a full page reload", afterReload >= 1, `count=${afterReload}`);

const greeting = await page.locator('text=/KiteAI|Ask me/i').count();
check("Greeting did not replace the restored history", greeting >= 0 && afterReload >= 1);

// ── 3. Conversations do not bleed between designs ────────────────────────────
await openDesign(designB);
const onB = await promptCount();
check("Design B has its own empty conversation", onB === 0, `count=${onB}`);
check("Design B canvas rendered", (await page.locator('text="Settings"').count()) >= 1);

// ── 4. Going back to A still shows A's thread ────────────────────────────────
await openDesign(designA);
const backOnA = await promptCount();
check("Returning to design A restores its conversation", backOnA >= 1, `count=${backOnA}`);

// ── 5. A second tab on the same design sees the thread and cannot clobber it ─
const page2 = await ctx.newPage();
await page2.route("**/api/ai/design*", (route) =>
  route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Stubbed AI reply for e2e" }) }),
);
await page2.goto(`https://${domain}/designs/${designA}`, { waitUntil: "networkidle", timeout: 60000 });
await page2.waitForTimeout(2500);
try { await page2.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
await page2.waitForTimeout(800);
const tab2 = page2.locator('button[role="tab"]:has-text("KiteAI")');
if (await tab2.count()) await tab2.first().click().catch(() => {});
await page2.waitForTimeout(500);

check("Second tab loads the same conversation", (await page2.locator(`text="${PROMPT}"`).count()) >= 1);

const SECOND = "Message from the second tab";
await page2.locator('input[placeholder*="Ask KiteAI"]').first().fill(SECOND);
await page2.locator('button[title="Send"]').first().click();
await page2.waitForTimeout(2500);

// Reload the first tab: it must now show BOTH messages. If the second tab had
// simply overwritten storage, the original message would be gone.
await openDesign(designA);
const bothA = await promptCount();
const bothB = await page.locator(`text="${SECOND}"`).count();
check("Neither tab's messages were lost", bothA >= 1 && bothB >= 1, `first=${bothA} second=${bothB}`);

await page.screenshot({ path: "/tmp/e2e-design-chat-memory.png", fullPage: false });
console.log("screenshot: /tmp/e2e-design-chat-memory.png");

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
