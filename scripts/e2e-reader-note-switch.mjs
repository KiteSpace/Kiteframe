/**
 * Real-browser regression coverage for unsaved note drafts in the reader.
 *
 * The test uses the same forged-session editor harness as the other browser
 * checks, but drives the reader and Project → Spec card through the UI:
 *
 *   CHROME_BIN=$(which chromium) node scripts/e2e-reader-note-switch.mjs
 */
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const USER_ID = "e2e-task647-user";
const EMAIL = "e2e-task647@example.com";
const PROJECT_NAME = "E2E Reader Note Guard";
let noteId = "";
let noteStorageKey = "";
let localProjectId = "";

const workflowData = {
  nodes: [
    { id: "n1", type: "process", position: { x: 100, y: 100 }, data: { label: "Intake" } },
    { id: "n2", type: "process", position: { x: 360, y: 100 }, data: { label: "Review" } },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
  canvasObjects: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

await db.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await db.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);

const projectResult = await db.query(
  `INSERT INTO saved_projects (user_id, name, workflow_data)
   VALUES ($1, $2, $3)
   RETURNING project_uuid`,
  [USER_ID, PROJECT_NAME, JSON.stringify(workflowData)],
);
const projectUuid = projectResult.rows[0].project_uuid;

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
await db.end();

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

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
};

page.on("pageerror", (error) => {
  console.log("PAGEERROR:", error.message.split("\n")[0]);
});

// Keep the test independent from another run's panel and note preferences.
await page.addInitScript(() => {
  localStorage.setItem("kiteframe-project-panel-width", "600");
  localStorage.setItem("kiteframe-project-panel-collapsed", "false");
  localStorage.setItem("kiteframe-project-panel-active-tab", "project");
});

async function waitForReaderNote() {
  await page.waitForSelector('[data-testid="reader-pane"]', { timeout: 15000 });
  await page.waitForSelector(`[data-testid="reader-note-nav-${noteId}"][data-active="true"]`, { timeout: 15000 });
}

async function openSeedNote() {
  await page.locator('[data-testid="tab-project"]').click();
  await page.locator('[data-testid="mode-overview"]').click();
  await page.waitForSelector(`[data-testid="note-card-${noteId}"]`, { timeout: 15000 });
  await page.locator(`[data-testid="note-card-${noteId}"]`).click();
  await waitForReaderNote();
}

async function startDraft(content, title = "Meeting notes") {
  await page.locator('[data-testid="reader-edit-note"]').click();
  await page.locator('[data-testid="reader-note-title-input"]').fill(title);
  await page.locator('[data-testid="reader-note-content-input"]').fill(content);
}

async function requestProjectSpec() {
  await page.locator('[data-testid="tab-project"]').click();
  await page.locator('[data-testid="mode-spec"]').click();
  await page.waitForSelector('[data-testid="document-card-project-prd"]', { timeout: 15000 });
  await page.locator('[data-testid="document-card-project-prd"]').click();
  await page.waitForSelector('[data-testid="reader-note-leave-confirmation"]', { timeout: 15000 });
}

async function resolvePending(label) {
  await page.locator('[data-testid="reader-note-leave-confirmation"] button', { hasText: label }).click();
}

async function mutateStoredNote(mutator) {
  await page.evaluate(({ key, projectId, currentNoteId, mutatorSource }) => {
    const current = JSON.parse(localStorage.getItem(key) || '{"notes":[]}');
    const next = Function("payload", "noteId", `return (${mutatorSource})(payload, noteId)`)(current, currentNoteId);
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("kiteframe:panelDataRefresh", { detail: { projectId } }));
  }, {
    key: noteStorageKey,
    projectId: localProjectId,
    currentNoteId: noteId,
    mutatorSource: mutator.toString(),
  });
}

try {
  await page.goto(`${base}/project/${projectUuid}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  try {
    await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 });
  } catch {}

  // Routed workflow projects must be opened from the Recent Projects card.
  if ((await page.locator('[data-testid="project-panel"]').count()) === 0) {
    await page.locator(`text=${PROJECT_NAME}`).first().click({ timeout: 15000 });
  }
  await page.waitForSelector('[data-testid="project-panel"]', { timeout: 45000 });
  await page.waitForSelector('[data-testid="project-doc-tab"]', { timeout: 15000 });

  // Create the initial note through the authenticated panel instead of guessing
  // the route's temporary local project key. The test then derives that key from
  // the real write before it simulates another tab's update/delete.
  await page.locator('[data-testid="tab-project"]').click();
  await page.waitForSelector('[data-testid="button-create-note"]', { timeout: 15000 });
  await page.locator('[data-testid="button-create-note"]').click();
  await page.waitForSelector('[data-testid="reader-pane"]', { timeout: 15000 });
  const activeNoteTestId = await page
    .locator('[data-testid^="reader-note-nav-"][data-active="true"]')
    .getAttribute("data-testid");
  noteId = activeNoteTestId?.replace("reader-note-nav-", "") || "";
  check("a newly created note opens in the authenticated reader", !!noteId);
  await startDraft("Original note body.");
  await page.locator('[data-testid="reader-save-note"]').click();
  await page.waitForSelector('[data-testid="reader-edit-note"]', { timeout: 15000 });
  noteStorageKey = await page.evaluate(
    (id) =>
      Object.keys(localStorage).find(
        (key) => key.startsWith("kiteframe-notes-") && (localStorage.getItem(key) || "").includes(id),
      ) || "",
    noteId,
  );
  localProjectId = noteStorageKey.replace("kiteframe-notes-", "");
  check("the browser exposes the note under the reader's active project key", !!localProjectId);

  // ── Save: the requested Project Spec opens only after the draft is saved. ──
  await openSeedNote();
  await startDraft("Saved draft body.");
  await requestProjectSpec();
  check(
    "Save confirmation keeps the note reader open before resolving",
    (await page.locator('[data-testid="reader-note-leave-confirmation"]').count()) === 1 &&
      (await page.locator('[data-testid="reader-note-content-input"]').inputValue()) === "Saved draft body.",
  );
  await resolvePending("Save");
  await page.waitForSelector('[data-testid="reader-pane"]', { timeout: 15000 });
  await page.waitForFunction(
    (name) => document.querySelector('[data-testid="reader-title"]')?.textContent?.includes(name),
    PROJECT_NAME,
  );
  check(
    "Save opens the Project Spec and keeps the reader open",
    (await page.locator('[data-testid="reader-title"]').innerText()).includes(`${PROJECT_NAME} Spec`),
  );
  const savedBody = await page.evaluate((key) => localStorage.getItem(key) || "", noteStorageKey);
  check("Save persists the draft before switching documents", savedBody.includes("Saved draft body."));

  // ── Cancel then Discard: Cancel leaves the draft and reader target intact;
  //    a second attempt can discard it and open the requested spec. ────────────
  await openSeedNote();
  await startDraft("Cancel draft body.");
  await requestProjectSpec();
  await resolvePending("Cancel");
  check(
    "Cancel keeps the reader on the note with the draft intact",
    (await page.locator(`[data-testid="reader-note-nav-${noteId}"][data-active="true"]`).count()) === 1 &&
      (await page.locator('[data-testid="reader-note-content-input"]').inputValue()) === "Cancel draft body." &&
      (await page.locator('[data-testid="reader-note-leave-confirmation"]').count()) === 0,
  );
  await requestProjectSpec();
  await resolvePending("Discard");
  await page.waitForFunction(
    (name) => document.querySelector('[data-testid="reader-title"]')?.textContent?.includes(name),
    PROJECT_NAME,
  );
  check(
    "Discard opens the Project Spec and keeps the reader open",
    (await page.locator('[data-testid="reader-title"]').innerText()).includes(`${PROJECT_NAME} Spec`),
  );
  const discardedBody = await page.evaluate((key) => localStorage.getItem(key) || "", noteStorageKey);
  check("Discard does not persist the abandoned draft", !discardedBody.includes("Cancel draft body."));

  // ── Concurrent update: saving an edit based on an old version stops and
  //    offers Reload latest instead of overwriting the other update. ───────────
  await openSeedNote();
  await startDraft("Draft made before the concurrent update.");
  await mutateStoredNote((payload, currentNoteId) => ({
    ...payload,
    notes: payload.notes.map((note) => note.id === currentNoteId
      ? { ...note, content: "Remote note update.", version: note.version + 1, updatedAt: new Date().toISOString() }
      : note),
  }));
  await page.locator('[data-testid="reader-save-note"]').click();
  await page.waitForSelector('[data-testid="reader-note-conflict"]', { timeout: 15000 });
  check(
    "a concurrent note update requires an explicit reload",
    (await page.locator('[data-testid="reader-note-conflict"]').innerText()).includes("Reload the latest version") &&
      (await page.locator(`[data-testid="reader-note-nav-${noteId}"][data-active="true"]`).count()) === 1,
  );
  await page.locator('[data-testid="reader-reload-note"]').click();
  check(
    "Reload latest keeps the note reader open and adopts the concurrent update",
    (await page.locator(`[data-testid="reader-note-nav-${noteId}"][data-active="true"]`).count()) === 1 &&
      (await page.locator('[data-testid="reader-note-content-input"]').inputValue()) === "Remote note update.",
  );

  // ── Concurrent deletion: retain the draft, then recover it as a new note. ─
  await page.locator('[data-testid="reader-note-title-input"]').fill("Recovered meeting notes");
  await page.locator('[data-testid="reader-note-content-input"]').fill("Draft recovered after concurrent deletion.");
  await mutateStoredNote((payload, currentNoteId) => ({
    ...payload,
    notes: payload.notes.filter((note) => note.id !== currentNoteId),
  }));
  await page.locator('[data-testid="reader-save-note"]').click();
  await page.waitForSelector('[data-testid="reader-note-conflict"]', { timeout: 15000 });
  check(
    "a concurrent deletion keeps the draft open for recovery",
    (await page.locator('[data-testid="reader-note-conflict"]').innerText()).includes("Recover your draft") &&
      (await page.locator('[data-testid="reader-note-content-input"]').inputValue()) ===
        "Draft recovered after concurrent deletion.",
  );
  await page.locator('[data-testid="reader-recover-note"]').click();
  await page.waitForSelector('[data-testid="reader-note-content"]', { timeout: 15000 });
  const activeRecoveredNav = page.locator('[data-testid^="reader-note-nav-"][data-active="true"]');
  check(
    "Recover as new note keeps the reader open on the recovered document",
    (await activeRecoveredNav.count()) === 1 &&
      (await page.locator('[data-testid="reader-doc-title"]').innerText()) === "Recovered meeting notes" &&
      (await page.locator('[data-testid="reader-note-content"]').innerText()) ===
        "Draft recovered after concurrent deletion.",
  );
} finally {
  await browser.close();
  const cleanup = new Client({ connectionString: process.env.DATABASE_URL });
  await cleanup.connect();
  await cleanup.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);
  await cleanup.end();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILED:", failed.map((result) => result.name).join(" | "));
  process.exit(1);
}