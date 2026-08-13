// Real-browser proof that KiteAI stops discarding valid new workflows.
//
// The reported failure: on a project whose canvas already held a healthy
// workflow, asking KiteAI to create a *separate* workflow produced a perfectly
// good proposal that was then thrown away. The stabilization gate compared a
// baseline measured over the whole canvas against the new workflow judged
// ALONE, so the newcomer's missing failure path looked like a brand-new
// regression. The user saw "This proposal introduced new issues and was not
// applied." and lost the generation entirely.
//
// This drives the real UI with a stubbed AI reply, so the run is deterministic,
// free, and exercises the whole parse -> assess -> draft path.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-kiteai-stabilization-gate.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-kiteai-gate-user";
const EMAIL = "e2e-kiteai-gate@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

// A canvas already in good shape: it branches, handles failure, and terminates.
// Scores ZERO diagnostics — which is exactly what made the old gate impossible
// to satisfy, because any finding in the proposal counted as "net new".
const node = (id, type, label, x) => ({
  id, type, position: { x, y: 200 }, width: 200, height: 100,
  data: { label, description: label },
});
const edge = (id, source, target, label) => ({ id, source, target, type: "bezier", data: label ? { label } : {} });

const existingWorkflow = {
  nodes: [
    node("1", "input", "Receive payment request", 300),
    node("2", "condition", "Payment authorized?", 550),
    node("3", "process", "Ship order", 800),
    node("4", "error", "Handle declined payment", 800),
    node("5", "end", "Order complete", 1050),
  ],
  edges: [
    edge("e1", "1", "2"),
    edge("e2", "2", "3", "Yes"),
    edge("e3", "2", "4", "No"),
    edge("e4", "3", "5"),
    edge("e5", "4", "5"),
  ],
  canvasObjects: [],
};

// Re-runnable: drop what a previous run left behind.
await client.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);

const proj = await client.query(
  `INSERT INTO saved_projects (user_id, name, description, workflow_data)
   VALUES ($1, 'E2E KiteAI Stabilization Gate', 'Healthy baseline canvas', $2)
   RETURNING project_uuid`,
  [USER_ID, JSON.stringify(existingWorkflow)],
);
const projectUuid = proj.rows[0].project_uuid;

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
console.log("Seeded project", projectUuid);

// The AI's answer: a genuinely useful new workflow that simply has no failure
// path yet — a normal first draft, and the shape that used to be discarded.
const aiWorkflow = {
  nodes: [
    { id: "r1", type: "input", position: { x: 300, y: 500 }, data: { label: "Receive refund request" } },
    { id: "r2", type: "process", position: { x: 550, y: 500 }, data: { label: "Review refund request" } },
    { id: "r3", type: "end", position: { x: 800, y: 500 }, data: { label: "Refund complete" } },
  ],
  edges: [
    { id: "re1", source: "r1", target: "r2" },
    { id: "re2", source: "r2", target: "r3" },
  ],
};
const aiText = "Here is the refund workflow.\n```json\n" + JSON.stringify(aiWorkflow) + "\n```";

const domain = process.env.REPLIT_DEV_DOMAIN;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);

const page = await ctx.newPage();

// Stub the AI job pair so the reply is deterministic and costs nothing.
await page.route("**/api/ai/job", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobId: "e2e-job-1" }) }),
);
await page.route("**/api/ai/jobs/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "completed", text: aiText }) }),
);

const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"} — ${n}${d ? " :: " + d : ""}`); };

const consoleLines = [];
// Chrome's console preview truncates objects at five properties, so the printed
// text is not enough to assert on telemetry. Pull the real argument instead.
const stabilityPayloads = [];
page.on("console", (m) => {
  consoleLines.push(m.text());
  if (m.text().includes("[AI_STABILITY]")) {
    const arg = m.args()[1];
    if (arg) stabilityPayloads.push(arg.jsonValue().catch(() => null));
  }
});

// Open the project the way a user does. Navigating straight to /project/:uuid
// lands on the editor's home screen with no tab open, which is the *home*
// surface — and that surface deliberately skips these guardrails, so it would
// prove nothing.
await page.goto(`https://${domain}/app`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
await page.waitForTimeout(1000);
await page.locator('text="E2E KiteAI Stabilization Gate"').first().click();
await page.waitForTimeout(5000);

check("Existing workflow rendered on the canvas", (await page.locator('text="Payment authorized?"').count()) >= 1);
check("Existing failure path is on the canvas", (await page.locator('text="Handle declined payment"').count()) >= 1);

const chatBox = page.locator('textarea[placeholder*="Describe your workflow"]').first();
check("KiteAI chat input is reachable", (await chatBox.count()) === 1);

// "Create" marks this as a structural expansion, which is exactly the path the
// user hit: fix-scope was bypassed and ONLY the new-issues gate rejected it.
await chatBox.fill("Create a separate workflow for handling refund requests");
await page.keyboard.press("Enter");
await page.waitForTimeout(6000);

const body = await page.locator("body").innerText();

// ── The core assertion ───────────────────────────────────────────────────────
check(
  "Proposal was NOT discarded",
  !/introduced new issues and was not applied|was not applied/i.test(body),
  body.match(/.{0,80}not applied.{0,80}/i)?.[0] ?? "",
);
check(
  "A usable workflow draft is offered",
  /Workflow ready/i.test(body),
  body.match(/Workflow ready[^\n]*/i)?.[0] ?? "",
);

// ── The advice survived rather than being used as a veto ─────────────────────
check(
  "The missing failure path is reported as advice, naming the finding",
  /Worth adding:/i.test(body) && /No failure or retry paths detected/i.test(body),
  body.match(/Worth adding:[^\n]*/i)?.[0] ?? "",
);
// ── The gate ran; it just reached the right verdict ──────────────────────────
const metricsLine = consoleLines.find((l) => l.includes("[AiStabilization] Stability metrics"));
check("Stabilization guardrails actually ran", Boolean(metricsLine), metricsLine ?? "no metrics line");
const metrics = (await Promise.all(stabilityPayloads)).filter(Boolean).pop();
check("Stability metrics were reported to telemetry", Boolean(metrics), JSON.stringify(metrics ?? null));
check(
  "Telemetry records an accepted-with-warnings outcome",
  metrics?.acceptedWithWarnings === true && (metrics?.warningCodes ?? []).includes("NO_FAILURE_PATH"),
  JSON.stringify(metrics ?? null),
);
check(
  "Telemetry reports no net-new issues once the proposal is applied",
  metrics?.newIssueCount === 0 && metrics?.proposalRejected === false,
  JSON.stringify(metrics ?? null),
);
check(
  "No rejection was recorded in telemetry",
  !consoleLines.some((l) => l.includes("Proposal rejected")),
  consoleLines.find((l) => l.includes("Proposal rejected")) ?? "",
);

await page.screenshot({ path: "/tmp/e2e-kiteai-gate.png", fullPage: false });
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => f.n).join(" | "));
  process.exit(1);
}
