/**
 * Real-browser verification that PRD documents survive a reload with an empty
 * localStorage — i.e. that the server, not the browser cache, is now the source
 * of truth for the Project Panel's documents.
 *
 *   CHROME_BIN=$(which chromium) node scripts/e2e-documents-browser.mjs
 */
import pg from 'pg';
import crypto from 'crypto';
import { chromium } from 'playwright-core';

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const USER_ID = 'e2e-docs-browser-user';
const EMAIL = 'e2e-docs-browser@example.com';
const PROJECT_NAME = 'E2E Docs Hydration';

await db.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await db.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);

// The document exists ONLY on the server. Nothing seeds localStorage, so if the
// panel renders it, it can only have come from the documents API.
const SERVER_ONLY_TEXT = 'Server-hydrated overview paragraph.';
const workflowData = {
  nodes: [
    { id: 'n1', type: 'process', position: { x: 100, y: 100 }, data: { label: 'Intake' } },
    { id: 'n2', type: 'process', position: { x: 360, y: 100 }, data: { label: 'Review' } },
  ],
  edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  canvasObjects: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  prdData: {
    projectId: 'p1',
    projectName: PROJECT_NAME,
    sections: [
      { id: 'overview', title: 'Overview', content: SERVER_ONLY_TEXT },
      { id: 'goals', title: 'Goals', content: 'Ship the reader pane.' },
    ],
    manualEditedAt: {},
    version: 1,
    generatedAt: Date.now() - 86400000,
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
};

const seeded = await db.query(
  `INSERT INTO saved_projects (user_id, name, workflow_data)
   VALUES ($1, $2, $3) RETURNING id, project_uuid`,
  [USER_ID, PROJECT_NAME, JSON.stringify(workflowData)],
);
const projectId = seeded.rows[0].id;
const projectUuid = seeded.rows[0].project_uuid;

const sid = crypto.randomBytes(16).toString('hex');
await db.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [
    sid,
    JSON.stringify({
      cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
      passport: { user: { id: USER_ID, email: EMAIL } },
    }),
    new Date(Date.now() + 86400000),
  ],
);
const cookieValue =
  's:' +
  sid +
  '.' +
  crypto.createHmac('sha256', process.env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');

console.log('Seeded project', projectUuid);

const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ['--no-sandbox'],
});

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};

async function openPanelDoc(page) {
  // A workflow project only reaches the editor by being opened into a tab from
  // the home screen; navigating to /project/:uuid renders the hero instead.
  await page.goto(`${base}/app`, { waitUntil: 'domcontentloaded' });
  await page.locator(`text=${PROJECT_NAME}`).first().click({ timeout: 30000 });
  await page.waitForSelector('[data-testid="project-panel"]', { timeout: 30000 });
  await page.locator('[data-testid="tab-project"]').click();
  await page.waitForSelector('[data-testid="project-doc-tab"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-project-prd"]').click();
  await page.waitForSelector('[data-testid="project-prd-section"]', { timeout: 15000 });
}

// ── 1. Cold browser: no localStorage at all ─────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addCookies([
    { name: 'connect.sid', value: cookieValue, domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
  ]);
  const page = await ctx.newPage();

  const docRequests = [];
  page.on('request', (r) => {
    if (r.url().includes('/documents')) docRequests.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });

  await openPanelDoc(page);
  await page.waitForTimeout(1500);

  const body = await page.locator('[data-testid="project-prd-section"]').innerText();
  check('document renders in a browser that has never cached it', body.includes(SERVER_ONLY_TEXT),
    body.slice(0, 120).replace(/\n/g, ' '));

  check('it was fetched from the documents API',
    docRequests.some((r) => r.includes(`GET /api/project/${projectUuid}/documents/project-prd`)),
    docRequests.join(', ') || 'no /documents requests');

  const stamp = page.locator('[data-testid="project-prd-updated-at"]');
  check('an Updated timestamp is shown instead of nothing', (await stamp.count()) > 0);
  if (await stamp.count()) {
    const text = await stamp.innerText();
    check('the timestamp is a real date, not "Unknown"',
      /\d{4}/.test(text) && !/unknown/i.test(text), text);
  }

  await ctx.close();
}

// ── 2. Edit, then reload with localStorage wiped ────────────────────────────
const EDIT_TEXT = 'Edited in the browser and expected to survive a cache wipe.';
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addCookies([
    { name: 'connect.sid', value: cookieValue, domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
  ]);
  const page = await ctx.newPage();
  await openPanelDoc(page);

  await page.locator('[data-testid="edit-overview"]').click();
  await page.locator('[data-testid="markdown-mode-overview"]').click();
  const textarea = page.locator('[data-testid="textarea-overview"]');
  await textarea.waitFor({ timeout: 10000 });
  await textarea.fill(EDIT_TEXT);
  await page.locator('[data-testid="save-edit-overview"]').click();

  // Section edits are debounced before they reach the server.
  await page.waitForTimeout(3000);

  const row = await db.query(`SELECT workflow_data FROM saved_projects WHERE id = $1`, [projectId]);
  const stored = row.rows[0].workflow_data;
  check('the edit reached the server database',
    stored.prdData?.sections?.[0]?.content === EDIT_TEXT,
    (stored.prdData?.sections?.[0]?.content || '').slice(0, 80));
  check('the canvas was not damaged by the document save', (stored.nodes || []).length === 2);
  check('the sibling section is intact',
    stored.prdData?.sections?.[1]?.content === 'Ship the reader pane.');

  await ctx.close();
}

// ── 3. Fresh cold browser sees the edit ─────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addCookies([
    { name: 'connect.sid', value: cookieValue, domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
  ]);
  const page = await ctx.newPage();
  await openPanelDoc(page);
  await page.waitForTimeout(1500);

  const body = await page.locator('[data-testid="project-prd-section"]').innerText();
  check('a different browser session sees the edit (true cross-device persistence)',
    body.includes(EDIT_TEXT), body.slice(0, 120).replace(/\n/g, ' '));
  check('the stale pre-edit text is gone', !body.includes(SERVER_ONLY_TEXT));

  await ctx.close();
}

await browser.close();
await db.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);
await db.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exit(1);
}
