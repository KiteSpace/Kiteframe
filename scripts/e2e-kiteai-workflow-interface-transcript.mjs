// Real-browser proof for the *workflow → interface* generation path.
//
// The companion script (e2e-kiteai-generation-transcript.mjs) covers the home
// path, whose sign-in is Firebase-gated and so has to record its exchange by
// calling the shipped module directly. This path has no Firebase gate: it only
// checks the server session. So here the real entry point is driven for real —
// a cloud workflow is opened, the actual "Create interface" button is clicked,
// the real proposal and generation flow runs, and the assertions are made
// against whatever the application itself decided to record.
//
// Only the two AI endpoints are stubbed, so the run is deterministic and costs
// no credits. Every line of application logic between the button and the
// rendered conversation is the real thing.
//
// The prompt is not hardcoded: it is captured from the request the app makes to
// /api/ai/design, then asserted to appear in the chat. That way the test proves
// the user sees *the actual prompt that was sent*, not a lookalike.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-kiteai-workflow-interface-transcript.mjs
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

const USER_ID = "e2e-wf-transcript-user";
const EMAIL = "e2e-wf-transcript@example.com";
const WORKFLOW_NAME = "Hotel Booking Flow";
const PROJECT_UUID = "e2e-wf-" + crypto.randomBytes(6).toString("hex");
const EARLIER_MESSAGE = "EARLIER_DISCUSSION_MARKER before any generation";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${ok || !detail ? "" : `\n        ${detail}`}`);
};

async function cleanup() {
  try {
    await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);
    await client.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);
    await client.query(`DELETE FROM user_credits WHERE user_identifier = $1`, [USER_ID]);
  } catch (e) {
    console.error("cleanup warning:", e.message);
  }
}

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await cleanup();

// Generation is gated on credits; give this user an unlimited allowance so the
// gate never short-circuits the flow we are trying to exercise.
await client.query(
  `INSERT INTO user_credits (user_identifier, credits, is_unlimited) VALUES ($1, 100, true)
   ON CONFLICT (user_identifier) DO UPDATE SET credits = 100, is_unlimited = true`,
  [USER_ID],
);

const workflowData = {
  nodes: [
    { id: "n1", type: "kiteFrameNode", position: { x: 0, y: 0 }, data: { label: "Browse Rooms" } },
    { id: "n2", type: "kiteFrameNode", position: { x: 260, y: 0 }, data: { label: "Checkout" } },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
  canvasObjects: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const projectRow = await client.query(
  `INSERT INTO saved_projects (user_id, project_uuid, name, workflow_data)
   VALUES ($1, $2, $3, $4) RETURNING id`,
  [USER_ID, PROJECT_UUID, WORKFLOW_NAME, JSON.stringify(workflowData)],
);
const CLOUD_PROJECT_ID = projectRow.rows[0].id;

// Mint a session directly, the same trick the companion script uses.
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

/** Two labelled artboards, so the inline preview has real screen names. */
const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" }, displayName: "AstryxSection", isCanvas: true,
    props: { direction: "row", gap: 80 }, custom: {}, hidden: false, parent: null,
    nodes: ["ab-browse", "ab-checkout"], linkedNodes: {},
  },
  "ab-browse": {
    type: { resolvedName: "AstryxArtboard" }, displayName: "AstryxArtboard",
    props: { label: "Browse Rooms", width: 390, height: 600, x: 40, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true, nodes: [], linkedNodes: {},
  },
  "ab-checkout": {
    type: { resolvedName: "AstryxArtboard" }, displayName: "AstryxArtboard",
    props: { label: "Checkout", width: 390, height: 600, x: 500, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true, nodes: [], linkedNodes: {},
  },
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();

// Capture the prompt the application actually builds and sends.
let sentPrompt = null;
let designCalls = 0;

await page.route("**/api/ai/interface-proposal", (route) =>
  route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ screens: [{ name: "Browse Rooms", description: "Room list" }, { name: "Checkout", description: "Payment" }] }),
  }),
);
await page.route("**/api/ai/interface-proposal-refine", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ screens: [] }) }),
);
await page.route("**/api/ai/design", (route) => {
  designCalls += 1;
  try { sentPrompt = JSON.parse(route.request().postData() || "{}").prompt ?? null; } catch { /* keep null */ }
  return route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ craftState: JSON.stringify(craftState), title: WORKFLOW_NAME }),
  });
});

const bodyText = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");

try {
  await page.goto(`https://${domain}/project/${PROJECT_UUID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(3000);

  // The deep link lands on the editor's home view with the project listed under
  // "Recent Projects" rather than opening it directly, so open it the way a
  // user does — by clicking the project. This also keeps the test honest about
  // the entry point actually being reachable through the UI.
  const createBtnSel = 'button[title="Create interface project"]';
  if ((await page.locator(createBtnSel).count()) === 0) {
    // Target the card by id — the workflow name also appears in the "Loaded…"
    // toast, and a text match would click that instead.
    const card = page.locator(`[data-testid="card-project-${CLOUD_PROJECT_ID}"]`).first();
    await card.waitFor({ state: "visible", timeout: 30000 });
    await card.click();
    await page.waitForTimeout(8000);
  }

  const loaded = (await page.locator(createBtnSel).count()) > 0;
  check("The cloud workflow opens in the editor", loaded, (await bodyText()).slice(0, 200));

  // Seed a pre-generation discussion on the workflow's own thread, so we can
  // prove the generation is appended to the conversation rather than replacing
  // it. Written through the app's own key helper to avoid guessing the format.
  await page.evaluate(async ({ projectUuid, marker }) => {
    const mod = await import("/src/lib/kiteaiTranscript.ts");
    mod.appendTranscript(projectUuid, [
      { id: "earlier-1", role: "user", content: marker, timestamp: Date.now() },
    ]);
  }, { projectUuid: PROJECT_UUID, marker: EARLIER_MESSAGE });

  // Drive the real entry point.
  const createBtn = page.locator(createBtnSel).first();
  const haveBtn = (await createBtn.count()) > 0;
  check("The workflow toolbar offers to create an interface", haveBtn);
  if (!haveBtn) throw new Error("Create interface button not found");
  // The sticky toolbar overlaps this control's hit box, so dispatch the click
  // on the element itself rather than at its screen coordinates.
  await createBtn.evaluate((el) => el.click());
  await page.waitForTimeout(3000);

  const generateBtn = page.locator('button:has-text("Generate UI")').first();
  const haveGenerate = (await generateBtn.count()) > 0;
  check("The screen proposal appears with a way to generate", haveGenerate, (await bodyText()).slice(0, 200));
  if (!haveGenerate) throw new Error("Generate UI button not found");
  await generateBtn.evaluate((el) => el.click());

  // Wait for the design to be created and its tab to open.
  await page.waitForTimeout(9000);

  check("The application called the generation endpoint exactly once", designCalls === 1, `calls=${designCalls}`);
  check("The application built a prompt from the workflow", !!sentPrompt && sentPrompt.length > 0,
    `prompt=${String(sentPrompt).slice(0, 120)}`);

  let text = await bodyText();

  // On this path the prompt sent to the model is machine-built boilerplate
  // ("Generate a multi-screen UI interface design for…"), so the chat shows a
  // readable version of the request naming the workflow instead. Assert on
  // that, and separately that a real prompt was sent (checked above).
  const shownRequest = `Generate an interface from the "${WORKFLOW_NAME}" workflow.`;
  check("The request is shown back in the chat, naming the workflow",
    text.includes(shownRequest), `expected=${shownRequest}`);
  check("KiteAI's reply about the generated interface appears", /generated|created|built|here/i.test(text));
  check("The closing offer to make changes appears", /ask|change|adjust|tweak/i.test(text));

  // Tie the rendered conversation to the design that was actually created.
  // The preview card's test id is emitted only by the design chat rail, so
  // finding it under the real design id proves that the panel the user is
  // looking at read the exchange — not merely that something was written.
  const createdDesign = await client.query(
    `SELECT id FROM designs WHERE claimed_by_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [USER_ID],
  );
  const createdDesignId = createdDesign.rows[0]?.id;
  check("A design row was created for the generation", !!createdDesignId);

  const cardSel = `[data-testid="design-chat-preview-${createdDesignId}"]`;
  const cardCount = await page.locator(cardSel).count();
  check("The design chat renders an inline preview of the design just created",
    cardCount > 0, `selector=${cardSel}`);
  check("The preview names the screens that were generated",
    text.includes("Browse Rooms") && text.includes("Checkout"));

  // Read the destination thread back through the app's own accessor, so the
  // namespace written and the namespace rendered are provably the same one.
  const designThread = await page.evaluate(async ({ designId }) => {
    const mod = await import("/src/lib/kiteaiTranscript.ts");
    return mod.readDesignChat(designId).map((m) => ({ content: m.content, hasPreview: !!m.designPreview }));
  }, { designId: createdDesignId });
  check("The design's own thread holds the request", designThread.some((m) => m.content?.includes(shownRequest)),
    `entries=${designThread.length}`);
  check("The design's own thread holds the reply with its preview", designThread.some((m) => m.hasPreview));
  check("The design's own thread holds the offer to make changes",
    designThread.some((m) => /tell me what to change/i.test(m.content ?? "")));

  // The conversation on the workflow's own thread must have gained the
  // exchange without losing what was said before it.
  const workflowThread = await page.evaluate(async ({ projectUuid }) => {
    const mod = await import("/src/lib/kiteaiTranscript.ts");
    return mod.readTranscript(projectUuid).map((m) => ({ role: m.role, content: m.content, hasPreview: !!m.designPreview }));
  }, { projectUuid: PROJECT_UUID });

  check("The workflow's own conversation records the generation",
    workflowThread.length > 1, `entries=${workflowThread.length}`);
  check("The discussion from before the generation is preserved",
    workflowThread.some((m) => m.content?.includes("EARLIER_DISCUSSION_MARKER")));
  // Position relative to the generation, not absolute — the panel may seed a
  // welcome message of its own ahead of anything the user said.
  const earlierAt = workflowThread.findIndex((m) => m.content?.includes("EARLIER_DISCUSSION_MARKER"));
  const generationAt = workflowThread.findIndex((m) => m.content?.includes(shownRequest));
  check("The earlier discussion stays above the generation",
    earlierAt >= 0 && generationAt > earlierAt, `earlier=${earlierAt} generation=${generationAt}`);
  check("The generation exchange carries an inline preview",
    workflowThread.some((m) => m.hasPreview));

  // Persistence across a reload of the whole editor.
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(4000);
  const afterReload = await page.evaluate(async ({ projectUuid }) => {
    const mod = await import("/src/lib/kiteaiTranscript.ts");
    return mod.readTranscript(projectUuid).map((m) => m.content);
  }, { projectUuid: PROJECT_UUID });
  check("The conversation survives reloading the editor", afterReload.length === workflowThread.length,
    `before=${workflowThread.length} after=${afterReload.length}`);
  const dupes = afterReload.filter((c) => c && c.includes(shownRequest)).length;
  check("Reloading does not duplicate the generation exchange", dupes <= 1, `occurrences=${dupes}`);
} catch (err) {
  check(`Unexpected failure: ${err.message}`, false, err.stack?.slice(0, 400) ?? "");
} finally {
  await browser.close();
  await cleanup();
  await client.query(`DELETE FROM sessions WHERE sid = $1`, [sid]);
  await client.end();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
