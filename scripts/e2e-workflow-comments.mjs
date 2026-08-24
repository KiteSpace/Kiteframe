/**
 * Authenticated browser regression for workflow canvas comments.
 *
 * Covers cloud-project identity, pin dragging/persistence, popover dismissal,
 * and placing-mode click-through for canvas controls.
 *
 * CHROME_BIN=$(which chromium) node scripts/e2e-workflow-comments.mjs
 */
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  console.error("Refusing to run destructive E2E setup against a production environment.");
  process.exit(1);
}

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const USER_ID = "e2e-workflow-comments-user";
const EMAIL = "e2e-workflow-comments@example.com";
const PROJECT_NAME = "E2E Workflow Comments";
const workflowData = {
  nodes: [
    { id: "intake", type: "process", position: { x: 140, y: 140 }, data: { label: "Intake" } },
    { id: "review", type: "process", position: { x: 460, y: 140 }, data: { label: "Review" } },
  ],
  edges: [{ id: "intake-review", source: "intake", target: "review" }],
  canvasObjects: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

await db.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await db.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);

const project = await db.query(
  `INSERT INTO saved_projects (user_id, name, workflow_data)
   VALUES ($1, $2, $3)
   RETURNING project_uuid`,
  [USER_ID, PROJECT_NAME, JSON.stringify(workflowData)],
);
const projectUuid = project.rows[0].project_uuid;
const seededComment = await db.query(
  `INSERT INTO workflow_comments (workflow_id, user_id, position_x, position_y, content)
   VALUES ($1, $2, 620, 420, 'Persisted comment pin')
   RETURNING id`,
  [projectUuid, USER_ID],
);
const commentId = seededComment.rows[0].id;

const sid = crypto.randomBytes(16).toString("hex");
await db.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [
    sid,
    JSON.stringify({
      cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      passport: { user: { id: USER_ID, email: EMAIL } },
    }),
    new Date(Date.now() + 86400000),
  ],
);
const cookieValue =
  "s:" +
  sid +
  "." +
  crypto.createHmac("sha256", process.env.SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "");

const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addCookies([
  { name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
]);
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem("kiteframe_cookie_consent", "necessary");
  localStorage.setItem("kiteframe-project-panel-collapsed", "false");
  localStorage.setItem("kiteframe-project-panel-active-tab", "project");
});
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
};

try {
  await page.goto(`${base}/project/${projectUuid}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  try {
    await page.locator('button:has-text("Necessary Only")').click({ timeout: 2500 });
  } catch {}
  if ((await page.locator('[data-testid="project-panel"]').count()) === 0) {
    await page.getByText(PROJECT_NAME, { exact: true }).first().click({ timeout: 15000 });
  }

  await page.waitForSelector('[data-testid="project-panel"]', { timeout: 45000 });
  await page.waitForSelector(`[data-testid="comment-pin-${commentId}"]`, { timeout: 20000 });

  // The panel must query with the server project UUID, not a transient local tab id.
  await page.locator('[data-testid="tab-comments"]').click();
  await page.waitForSelector('[data-testid="comments-tab"]', { timeout: 10000 });
  check(
    "canvas comments appear in the Comments panel",
    (await page.locator('[data-testid="comments-tab"]').innerText()).includes("Persisted comment pin"),
  );

  const pin = page.locator(`[data-testid="comment-pin-${commentId}"]`);
  await pin.click();
  await page.waitForSelector(`[data-testid="comment-thread-${commentId}"]`, { timeout: 5000 });
  const canvasBox = await page.locator('[data-testid="workflow-canvas"]').boundingBox();
  if (canvasBox) {
    await page.mouse.click(canvasBox.x + canvasBox.width - 30, canvasBox.y + canvasBox.height - 30);
  }
  check(
    "clicking outside a comment popover dismisses it",
    (await page.locator(`[data-testid="comment-thread-${commentId}"]`).count()) === 0,
  );

  // When comment mode is on, canvas controls still receive clicks and do not
  // create a draft. Fit-to-view is a harmless representative toolbar control.
  await page.locator('[data-testid="comment-mode-toggle"]').click();
  await page.locator('button[title="Fit to View"]').click();
  await page.waitForTimeout(200);
  check(
    "toolbar controls stay clickable while comment mode is active",
    (await page.locator('[data-testid="comment-draft"]').count()) === 0 &&
      (await page.locator('[data-testid="comment-mode-toggle"]').getAttribute("title")) === "Exit comment mode (C)",
  );

  // Place on genuine canvas background, then cancel the draft so the seeded
  // thread remains the only comment being checked below.
  if (canvasBox) {
    await page.mouse.click(canvasBox.x + canvasBox.width - 90, canvasBox.y + 90);
    await page.waitForSelector('[data-testid="comment-draft"]', { timeout: 5000 });
  }
  check("empty canvas clicks open a comment draft", (await page.locator('[data-testid="comment-draft"]').count()) === 1);
  await page.locator('[data-testid="comment-draft-cancel"]').click();

  // A pin drag updates its database coordinates and does not open its thread.
  const pinBox = await pin.boundingBox();
  if (pinBox) {
    await page.mouse.move(pinBox.x + pinBox.width / 2, pinBox.y + pinBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(pinBox.x + pinBox.width / 2 + 110, pinBox.y + pinBox.height / 2 + 70, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(900);
  const moved = await db.query(
    `SELECT position_x, position_y FROM workflow_comments WHERE id = $1`,
    [commentId],
  );
  check(
    "dragging a pin persists its new canvas position",
    moved.rows.length === 1 && (moved.rows[0].position_x !== 620 || moved.rows[0].position_y !== 420),
    JSON.stringify(moved.rows[0] ?? {}),
  );
  check(
    "dragging a pin does not open the thread",
    (await page.locator(`[data-testid="comment-thread-${commentId}"]`).count()) === 0,
  );
} finally {
  await browser.close();
  await db.end();
}

if (results.some((result) => !result.ok)) {
  process.exitCode = 1;
}