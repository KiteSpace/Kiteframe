/**
 * Workflow prompt regression. AI responses are intercepted to verify request
 * content and UI behavior without consuming credits or calling a model.
 * CHROME_BIN=$(which chromium) node scripts/e2e-workflow-prompt.mjs
 */
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  throw new Error("This regression must only run in development.");
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const userId = "e2e-workflow-prompt-user";
const email = "e2e-workflow-prompt@example.com";
const sid = crypto.randomBytes(16).toString("hex");
let projectUuid;
let browser;
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
};

try {
  await db.query(`INSERT INTO users (id, email, first_name, is_beta)
    VALUES ($1, $2, 'Prompt Test', true) ON CONFLICT (id) DO UPDATE SET is_beta = true`, [userId, email]);
  const project = await db.query(`INSERT INTO saved_projects (user_id, name, workflow_data)
    VALUES ($1, 'Workflow prompt regression', $2) RETURNING project_uuid`, [userId, JSON.stringify({
    nodes: [{ id: "start", type: "start", position: { x: 100, y: 100 }, data: { label: "Start" } }],
    edges: [], canvasObjects: [], viewport: { x: 0, y: 0, zoom: 1 },
  })]);
  projectUuid = project.rows[0].project_uuid;
  await db.query(`INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)`, [
    sid,
    JSON.stringify({ cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      passport: { user: { id: userId, email } } }),
    new Date(Date.now() + 3600000),
  ]);
  const cookie = `s:${sid}.${crypto.createHmac("sha256", process.env.SESSION_SECRET)
    .update(sid).digest("base64").replace(/=+$/, "")}`;
  const domain = process.env.REPLIT_DEV_DOMAIN;
  const base = `https://${domain}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 800 } });
  await context.addCookies([{ name: "connect.sid", value: cookie, domain, path: "/", httpOnly: true, secure: true }]);
  await context.addInitScript(() => {
    localStorage.setItem("kiteframe_cookie_consent", "necessary");
    localStorage.setItem("kiteframe-project-panel-collapsed", "false");
    localStorage.setItem("kiteframe-project-panel-active-tab", "kite-ai");
  });
  const requests = [];
  const reply = JSON.stringify({
    nodes: [
      { id: "generated-start", type: "start", position: { x: 0, y: 0 }, data: { label: "Start" } },
      { id: "generated-review", type: "process", position: { x: 200, y: 0 }, data: { label: "Review document" } },
      { id: "generated-end", type: "end", position: { x: 400, y: 0 }, data: { label: "Done" } },
    ],
    edges: [
      { id: "edge-a", source: "generated-start", target: "generated-review" },
      { id: "edge-b", source: "generated-review", target: "generated-end" },
    ],
  });
  await context.route("**/api/ai/job", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { jobId: `prompt-regression-${requests.length}` } });
  });
  await context.route("**/api/ai/jobs/prompt-regression-*", route =>
    route.fulfill({ json: { status: "completed", text: reply } }));
  const page = await context.newPage();
  let fileChoosers = 0;
  page.on("filechooser", chooser => { fileChoosers++; void chooser.setFiles([]); });
  await page.goto(`${base}/project/${projectUuid}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('[data-testid="tab-kite-ai"]').click();
  const input = page.locator('[data-testid="input-kiteai-message"]');
  await input.waitFor({ state: "visible" });
  const longText = "Create a workflow for document review.\n" +
    "Users upload a file or image, reviewers validate the file, then import approved records.\n".repeat(35);
  await input.fill(longText);
  await input.focus();
  await input.press("End");
  await input.press("Shift+Enter");
  check("Shift+Enter inserts a newline without sending or opening import", requests.length === 0 && fileChoosers === 0);
  const bounds = await input.evaluate(el => {
    const r = el.getBoundingClientRect();
    const panel = el.closest('[data-testid="project-panel"]').getBoundingClientRect();
    const composer = el.closest('[data-testid="kiteai-composer"]').getBoundingClientRect();
    return {
      inputVisible: r.bottom <= panel.bottom + 1 && r.top >= panel.top,
      composerVisible: composer.bottom <= panel.bottom + 1,
      caretVisible: el.scrollHeight - el.scrollTop - el.clientHeight <= 2,
      height: r.height,
    };
  });
  check("the full chat composer stays within its panel", bounds.inputVisible && bounds.composerVisible, JSON.stringify(bounds));
  check("the final line of long input is visible", bounds.caretVisible && bounds.height <= 120, JSON.stringify(bounds));
  await input.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-testid="input-kiteai-message"]').disabled);
  check("Enter sends a long workflow brief without opening import", requests.length > 0 && fileChoosers === 0);
  check("the complete long brief reaches the AI request", requests[0]?.messages.some(m =>
    m.role === "user" && m.content.includes(longText.trim())));

  const md = "# Markdown brief\nRoute requests to the BLUE review queue.";
  const txt = "Plain text instructions: finish with GREEN approval.";
  await page.locator('[data-testid="input-kiteai-attachment"]').setInputFiles([
    { name: "brief.md", mimeType: "text/markdown", buffer: Buffer.from(md) },
    { name: "steps.TXT", mimeType: "text/plain", buffer: Buffer.from(txt) },
  ]);
  check("Markdown and text files appear as prompt attachments",
    await page.getByText("brief.md", { exact: true }).isVisible() &&
    await page.getByText("steps.TXT", { exact: true }).isVisible());
  await input.fill("Create a workflow using both attached documents.");
  const beforeFiles = requests.length;
  await input.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-testid="input-kiteai-message"]').disabled);
  const documentRequest = requests[beforeFiles];
  check("both document contents reach the model as user context", documentRequest?.messages.some(m =>
    m.role === "user" && m.content.includes(md) && m.content.includes(txt)));

  await page.locator('[data-testid="kiteai-composer"]').evaluate(el => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["Dropped document requirements."], "dropped.md", { type: "text/markdown" }));
    el.querySelector("textarea").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await page.getByText("dropped.md", { exact: true }).waitFor({ state: "visible" });
  check("drag-and-drop accepts Markdown documents", await page.getByText("dropped.md", { exact: true }).isVisible());
  await input.fill("Create a workflow from this document.");
  const beforeDrop = requests.length;
  await input.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-testid="input-kiteai-message"]').disabled);
  check("dropped documents are sent rather than parsed as workflow JSON",
    requests[beforeDrop]?.messages.some(m => m.role === "user" && m.content.includes("Dropped document requirements.")));
  check("earlier document attachments remain in follow-up conversation context",
    requests[beforeDrop]?.messages.some(m => m.content.includes(md)));

  await input.fill("Import a workflow from an image or .kiteframe file.");
  await input.press("Enter");
  await page.waitForTimeout(300);
  check("explicit short import requests still open the file picker", fileChoosers === 1);

  // The same text attachments must work in the original home prompt.
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator('[data-testid="input-hero-document"]').setInputFiles({
    name: "home-brief.md", mimeType: "text/markdown", buffer: Buffer.from("# Home brief\nAdd a BLUE approval step."),
  });
  check("the home Workflow prompt accepts Markdown documents",
    await page.getByText("home-brief.md", { exact: true }).first().isVisible());
  const homeRequests = requests.length;
  const homeRequestStarted = page.waitForRequest(req => req.url().endsWith("/api/ai/job") && req.method() === "POST");
  await page.locator('[data-testid="button-start-designing"]').click();
  await page.waitForURL("**/app/chat?prompt=**");
  await homeRequestStarted;
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="input-kiteai-message"]');
    return el && !el.disabled;
  });
  check("a document-only home prompt reaches the chat generation request",
    requests.slice(homeRequests).some(r => r.messages.some(m => m.role === "user" && m.content.includes("# Home brief"))));
} finally {
  await browser?.close();
  await db.query("DELETE FROM sessions WHERE sid = $1", [sid]);
  await db.query("DELETE FROM workflow_snapshots WHERE user_id = $1", [userId]);
  await db.query("DELETE FROM saved_projects WHERE user_id = $1", [userId]);
  await db.end();
}
if (checks.some(c => !c.ok)) process.exitCode = 1;
