// Real-browser proof that a generated interface leaves a usable conversation
// behind, instead of dropping the user on a canvas with no record of what they
// asked for.
//
// Unit tests already cover the storage module in isolation. What they cannot
// show is the thing the user actually experiences: open the design that was
// just generated and find your own words, KiteAI's reply, a preview of what it
// made and an invitation to change it — still there after a reload, and able
// to be continued.
//
// The home screen itself is gated behind Firebase sign-in, which cannot be
// driven headlessly. So the exchange is recorded by calling the *real* module
// the home screen calls (imported through Vite in the page), and the assertions
// are made against the rendered design page. Everything downstream of the stash
// — adoption across the project boundary, rendering, persistence, continuation
// — is exercised for real.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-kiteai-generation-transcript.mjs
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

const USER_ID = "e2e-transcript-user";
const EMAIL = "e2e-transcript@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);

/** Two labelled screens, so the inline preview has real labels to show. */
const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    displayName: "AstryxSection",
    isCanvas: true,
    props: { direction: "row", gap: 80 },
    custom: {}, hidden: false, parent: null,
    nodes: ["ab-browse", "ab-checkout"], linkedNodes: {},
  },
  "ab-browse": {
    type: { resolvedName: "AstryxArtboard" },
    displayName: "AstryxArtboard",
    props: { label: "Browse Rooms", width: 390, height: 600, x: 40, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["h-browse"], linkedNodes: {},
  },
  "ab-checkout": {
    type: { resolvedName: "AstryxArtboard" },
    displayName: "AstryxArtboard",
    props: { label: "Confirm Booking", width: 390, height: 600, x: 500, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["h-checkout"], linkedNodes: {},
  },
  "h-browse": {
    type: { resolvedName: "AstryxHeading" }, displayName: "AstryxHeading",
    props: { children: "BROWSE_SCREEN_MARKER" },
    custom: {}, hidden: false, parent: "ab-browse", isCanvas: false, nodes: [], linkedNodes: {},
  },
  "h-checkout": {
    type: { resolvedName: "AstryxHeading" }, displayName: "AstryxHeading",
    props: { children: "CHECKOUT_SCREEN_MARKER" },
    custom: {}, hidden: false, parent: "ab-checkout", isCanvas: false, nodes: [], linkedNodes: {},
  },
};

const TITLE = "Room Booking App";
const designRow = await client.query(
  `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
   VALUES ($1, 'home-ai', $2, $3) RETURNING id`,
  [USER_ID, JSON.stringify(craftState), TITLE],
);
const designId = designRow.rows[0].id;

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
const PROMPT = "a room booking app for a small hotel";

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

// Continuing the conversation must not depend on a live model. Stub only the
// AI call; every other request hits the real server.
await page.route("**/api/ai/design", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ type: "message", text: "FOLLOWUP_REPLY_MARKER" }),
  });
});

const openDesign = async () => {
  await page.goto(`https://${domain}/designs/${designId}`, { waitUntil: "networkidle", timeout: 90000 });
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(4000);
};

const openKiteAITab = async () => {
  try { await page.locator('button[role="tab"]:has-text("KiteAI")').click({ timeout: 5000 }); } catch {}
  await page.waitForTimeout(800);
};

await openDesign();

// ── Record the exchange exactly as the home screen does ──────────────────────
// Imported through Vite so this is the shipped implementation, not a
// re-creation of its output format.
const recorded = await page.evaluate(async ({ prompt, designId, title, ownerId, state }) => {
  const mod = await import("/src/lib/kiteaiTranscript.ts");
  const entries = mod.buildGenerationExchange({
    prompt,
    designId,
    title,
    screenLabels: mod.extractScreenLabels(state),
    origin: "home",
  });
  mod.stashPendingTranscript(entries, { ownerId, designId });
  return entries.map((e) => ({ role: e.role, content: e.content, preview: e.designPreview ?? null }));
}, { prompt: PROMPT, designId, title: TITLE, ownerId: USER_ID, state: craftState });

check("The shipped transcript module records a three-part exchange", recorded?.length === 3,
  `entries=${recorded?.length}`);
check("The recorded exchange carries an inline preview of the generated design",
  recorded?.some((e) => e.preview?.designId === designId),
  JSON.stringify(recorded?.map((e) => e.preview?.screenLabels ?? null)));

const [userEntry, replyEntry, offerEntry] = recorded ?? [];

// ── The exchange survives the crossing into the design ───────────────────────
await openDesign();
await openKiteAITab();

const bodyText = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
let text = await bodyText();

check("The user's original prompt appears in the chat, in their own words",
  text.includes(PROMPT), PROMPT);
check("KiteAI's reply to the generation appears beneath it",
  !!replyEntry && text.includes(replyEntry.content.slice(0, 40).replace(/\s+/g, " ")),
  replyEntry?.content?.slice(0, 60));
check("The closing offer to make changes appears",
  !!offerEntry && text.includes(offerEntry.content.slice(0, 40).replace(/\s+/g, " ")),
  offerEntry?.content?.slice(0, 60));

check("An inline preview card for the generated design is rendered",
  (await page.locator(`[data-testid="design-chat-preview-${designId}"]`).count()) >= 1);
check("The preview names the screens that were generated",
  text.includes("Browse Rooms") && text.includes("Confirm Booking"));

// Order matters: the prompt must precede the reply, which must precede the offer.
const order = [PROMPT, replyEntry?.content?.slice(0, 30), offerEntry?.content?.slice(0, 30)]
  .map((s) => (s ? text.indexOf(s.replace(/\s+/g, " ")) : -1));
check("Prompt, reply and offer appear in that order",
  order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2],
  JSON.stringify(order));

// The stash is a one-shot handoff; leaving it behind would re-inject the
// exchange into the next design opened in this browser.
const stashLeft = await page.evaluate(() => localStorage.getItem("kiteframe-kiteai-pending-exchange"));
check("The pending handoff is consumed once adopted", stashLeft === null, String(stashLeft));

// ── It survives a reload, without duplicating ────────────────────────────────
await openDesign();
await openKiteAITab();
text = await bodyText();
check("The conversation is still there after a reload", text.includes(PROMPT));
const promptOccurrences = text.split(PROMPT).length - 1;
check("Reloading does not duplicate the exchange", promptOccurrences === 1, `occurrences=${promptOccurrences}`);
check("The preview card survives the reload",
  (await page.locator(`[data-testid="design-chat-preview-${designId}"]`).count()) >= 1);

// ── It survives switching away to another tab and back ───────────────────────
try { await page.locator('button[role="tab"]:has-text("Layers")').click({ timeout: 5000 }); } catch {}
await page.waitForTimeout(600);
await openKiteAITab();
text = await bodyText();
check("The conversation is still there after switching tabs and back", text.includes(PROMPT));

// ── The conversation can be continued from that point ────────────────────────
const input = page.locator('input[placeholder*="Ask KiteAI"]').first();
const canType = (await input.count()) > 0;
check("The chat is ready to accept a follow-up", canType);

if (canType) {
  await input.click();
  await input.fill("make the confirm button green");
  await input.press("Enter");
  await page.waitForTimeout(5000);

  text = await bodyText();
  check("A follow-up message joins the same thread",
    text.includes("make the confirm button green"));
  check("KiteAI's answer to the follow-up is shown", text.includes("FOLLOWUP_REPLY_MARKER"));
  check("The original generation exchange is still above the follow-up",
    text.includes(PROMPT) &&
      text.indexOf(PROMPT) < text.indexOf("make the confirm button green"));

  // The whole point of persisting: come back later and it is all still there.
  await openDesign();
  await openKiteAITab();
  text = await bodyText();
  check("The continued conversation survives a reload as one thread",
    text.includes(PROMPT) &&
      text.includes("make the confirm button green") &&
      text.includes("FOLLOWUP_REPLY_MARKER"));
}

// ── The design itself still renders (the transcript must not disturb it) ─────
check("The generated screens still render on the canvas",
  (await page.locator('text="BROWSE_SCREEN_MARKER"').count()) >= 1 &&
    (await page.locator('text="CHECKOUT_SCREEN_MARKER"').count()) >= 1);

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
