/**
 * Authenticated proposal -> refinement -> generated artboards.
 * npx tsx scripts/e2e-interface-planning.ts
 * Add --real for a bounded comparison: 3 planning requests, at most one
 * corrective call per request, and 1 real design request. No retry loop.
 */
import pg from 'pg';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { interfacePlanningFixtures, userAddedPagePlan } from '../shared/__tests__/fixtures/interfacePlanningFixtures';
import { analyzeWorkflowScreens } from '../client/src/lib/buildInterfacePrompt';
import { selectInterfacePages, inspectInterfacePlan } from '../shared/interfacePlan';

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === 'production') throw new Error('Development only.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const userId = `e2e-interface-${crypto.randomUUID()}`;
const email = `${userId}@example.com`;
const sid = crypto.randomBytes(16).toString('hex');
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const check = (name: string, ok: boolean) => {
  if (!ok) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
};
const source = interfacePlanningFixtures.short.workflow;
const graph = {
  nodes: source.nodes.map((n, i) => ({ id: n.id, type: n.type, position: { x: 100 + i * 280, y: 100 },
    data: { label: n.label, description: n.description, actor: n.actor } })),
  edges: source.edges,
};
let createdProjectId: string | undefined;
try {
  await db.query(`INSERT INTO users (id,email,first_name,is_beta) VALUES ($1,$2,'Interface Test',true)`, [userId, email]);
  const result = await db.query(`INSERT INTO saved_projects (user_id,name,workflow_data) VALUES ($1,$2,$3) RETURNING id,project_uuid`, [
    userId, 'Interface planning regression', JSON.stringify({
      ...graph, canvasObjects: [], viewport: { x: 0, y: 0, zoom: 1 },
      prdData: { projectId: 'fixture', projectName: 'Members', sections: [{ id: 'orders', title: 'Orders', content: 'Display recent orders by update date.' }] },
    }),
  ]);
  const projectUuid = result.rows[0].project_uuid;
  createdProjectId = result.rows[0].id;
  await db.query(`INSERT INTO sessions (sid,sess,expire) VALUES ($1,$2,$3)`, [sid, JSON.stringify({
    cookie: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
    passport: { user: { id: userId, email } },
  }), new Date(Date.now() + 3600000)]);
  const signedCookie = `s:${sid}.${crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(sid).digest('base64').replace(/=+$/, '')}`;
  const domain = process.env.REPLIT_DEV_DOMAIN!;
  const base = `https://${domain}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: 'connect.sid', value: signedCookie, domain, path: '/', httpOnly: true, secure: true }]);
  await context.addInitScript(() => {
    localStorage.setItem('kiteframe_cookie_consent', 'necessary');
    localStorage.setItem('kiteframe-project-panel-collapsed', 'true');
  });
  const page = await context.newPage();

  if (process.argv.includes('--real')) {
    const metrics: any[] = [];
    let firstPlan: any;
    const only = process.argv.find(arg => arg.startsWith('--only='))?.split('=')[1];
    for (const name of (only ? only.split(',') : ['short', 'backend', 'approval'])) {
      const fixture = interfacePlanningFixtures[name];
      const response = await context.request.post(`${base}/api/ai/interface-proposal`, {
        data: { workflow: fixture.workflow, sourceProjectId: name === 'short' ? createdProjectId : undefined }, timeout: 120000,
      });
      const body = await response.json();
      check(`real ${name} planning succeeds: ${body.error || response.status()}`, response.ok());
      const report = inspectInterfacePlan(body.plan);
      check(`real ${name} preserves valid workflow mappings`, report.errors.length === 0);
      const pages = body.plan.screens.filter((s: any) => s.kind === 'page');
      const baselineNodes = fixture.workflow.nodes.map((n, i) => ({ id: n.id, type: n.type, position: { x: i * 100, y: 0 }, data: { label: n.label, description: n.description } }));
      const baseline = analyzeWorkflowScreens(baselineNodes, fixture.workflow.edges)?.length || 1;
      metrics.push({ fixture: name, baselinePages: baseline, plannedPages: pages.length, pageNames: pages.map((p: any) => p.name),
        actors: [...new Set(pages.map((p: any) => p.actor))], fields: pages.reduce((n: number, p: any) => n + p.dataRequirements.length, 0),
        states: pages.reduce((n: number, p: any) => n + p.states.length, 0), coverageWarnings: report.warnings.length });
      if (name === 'short') {
        check('real short journey separates sign-in and dashboard', pages.length === 2);
        check('real planner loads saved project Specs without opening the Specs panel', body.plan.workflow.context.includes('recent orders'));
        firstPlan = body.plan;
      }
      if (name === 'backend') check('real backend-heavy task stays on one page', pages.length === 1);
      if (name === 'approval') {
        check('real approval outcomes stay within task workspaces instead of separate pages', pages.length <= 3);
        check('real approval journey separates employee and manager tasks', new Set(pages.map((p: any) => p.actor)).size >= 2);
        check('real approval branches are explicitly covered', !report.warnings.some(w => w.startsWith('Branch')));
      }
    }
    console.log('REAL_MODEL_COMPARISON', JSON.stringify(metrics));
    if (firstPlan && !process.argv.includes('--planning-only')) {
    const response = await context.request.post(`${base}/api/ai/design`, {
      data: { prompt: 'Generate the approved interface.', source: 'workflow', interfacePlan: selectInterfacePages(firstPlan, firstPlan.screens.filter((s: any) => s.kind === 'page').map((s: any) => s.id)) },
      timeout: 180000,
    });
    const generated = await response.json();
    check(`real approved-plan generation succeeds: ${generated.error || response.status()}`, response.ok() && generated.type === 'state');
    console.log('REAL_GENERATION_REVIEW_NOTES', JSON.stringify(generated.warnings || []));
    const saved = await context.request.post(`${base}/api/designs`, { data: {
      craftState: generated.craftState, title: 'Real interface interpretation', source: 'workflow-bridge', sourceWorkflowId: createdProjectId,
    } });
    check('real generated interface saves without overwriting the workflow', saved.ok());
    const design = await saved.json();
    await page.goto(`${base}/designs/${design.id}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByText('Email', { exact: true }).first().waitFor({ timeout: 30000 });
    check('real generated sign-in fields render in the authenticated editor', true);
    await page.screenshot({ path: '/tmp/interface-planning-real.png' });
    }
  }

  if (!process.argv.includes('--evaluation-only')) {
  const requests: any[] = [];
  let plan = structuredClone(interfacePlanningFixtures.short.plan);
  await context.route('**/api/ai/interface-proposal', async route => {
    const body = route.request().postDataJSON();
    requests.push({ kind: 'proposal', body });
    plan = { ...plan, workflow: body.workflow };
    await route.fulfill({ json: { plan, warnings: [], previews: plan.screens.map(s => ({ id: s.id, svgWireframe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#eee"/></svg>' })) } });
  });
  await context.route('**/api/ai/interface-proposal-refine', async route => {
    const body = route.request().postDataJSON();
    requests.push({ kind: 'refine', body });
    plan = { ...structuredClone(userAddedPagePlan), workflow: body.plan.workflow };
    await route.fulfill({ json: { plan, warnings: [], previews: [], aiMessage: 'Added Reports with Download CSV.' } });
  });
  let generations = 0;
  await context.route('**/api/ai/design', async route => {
    const body = route.request().postDataJSON();
    requests.push({ kind: 'generation', body });
    if (++generations === 1) {
      await route.fulfill({ status: 422, json: { error: 'Some selected screens were not generated. Your plan is preserved; retry Generate.' } });
      return;
    }
    const state: any = { ROOT: { type: { resolvedName: 'AstryxContainer' }, isCanvas: true, props: {}, nodes: [], linkedNodes: {} } };
    for (const [i, surface] of body.interfacePlan.screens.filter((s: any) => s.kind === 'page' && s.selected).entries()) {
      const id = `artboard-${i}`;
      const textId = `text-${i}`;
      state.ROOT.nodes.push(id);
      state[id] = { type: { resolvedName: 'AstryxArtboard' }, isCanvas: true,
        props: { label: surface.name, width: 500, height: 400 }, custom: { interfaceScreenId: surface.id },
        parent: 'ROOT', nodes: [textId], linkedNodes: {} };
      state[textId] = { type: { resolvedName: 'AstryxText' }, isCanvas: false,
        props: { children: [...surface.dataRequirements.map((d: any) => d.label), ...surface.actions.map((a: any) => a.label)].join(' · ') },
        parent: id, nodes: [], linkedNodes: {} };
    }
    await route.fulfill({ json: { type: 'state', craftState: JSON.stringify(state), warnings: ['Check Reports: confirm Download CSV is a usable control.'] } });
  });
  await page.goto(`${base}/project/${projectUuid}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('[data-testid="workflow-canvas"]').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /generate interface|create interface/i }).first().click();
  await page.getByRole('checkbox', { name: 'Include Sign in' }).waitFor();
  check('full workflow reaches planning, including descriptions and labeled edges',
    requests[0].body.workflow.nodes[0].description.includes('email') && requests[0].body.workflow.edges[1].label === 'Valid credentials');
  await page.getByText('Inspect rationale, sources & requirements', { exact: true }).first().click();
  check('review exposes task rationale', await page.getByText('This is a distinct task and navigation context.', { exact: true }).first().isVisible());
  const input = page.getByPlaceholder('Ask to revise the proposal…');
  await input.fill('Add a Reports page with Report results and a Download CSV action.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Include Reports' }).waitFor();
  const generate = page.getByRole('button', { name: 'Generate UI', exact: true });
  await generate.click();
  await page.getByText(/Some selected screens were not generated/).first().waitFor();
  check('generation failure preserves the reviewed plan and permits retry', await page.getByRole('checkbox', { name: 'Include Reports' }).isChecked());
  await generate.click();
  await page.locator('[data-testid="interface-generation-notes"]').waitFor({ timeout: 30000 });
  const final = requests.filter(r => r.kind === 'generation').at(-1).body.interfacePlan;
  check('refined node-less page and complete fields/actions reach generation',
    final.screens.find((s: any) => s.id === 'reports-page').nodeIds.length === 0 &&
    final.screens.find((s: any) => s.id === 'reports-page').actions[0].label === 'Download CSV' &&
    final.screens.find((s: any) => s.id === 'login-page').dataRequirements.some((d: any) => d.label === 'Password'));
  await page.getByText('Report results · Download CSV', { exact: true }).first().waitFor();
  check('approved artboards render in the authenticated editor', true);
  await page.locator('[data-testid="interface-generation-notes"] summary').click();
  check('advisory generation notes are visible without discarding the design', await page.getByText('Check Reports: confirm Download CSV is a usable control.', { exact: true }).isVisible());
  await page.screenshot({ path: '/tmp/interface-planning-browser.png' });
  const savedRows = await db.query(`SELECT craft_state FROM designs WHERE claimed_by_user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId]);
  const savedState = typeof savedRows.rows[0].craft_state === 'string' ? JSON.parse(savedRows.rows[0].craft_state) : savedRows.rows[0].craft_state;
  check('all three selected artboards persist', Object.values(savedState).filter((n: any) => n.type?.resolvedName === 'AstryxArtboard').length === 3);
  }
} finally {
  await browser?.close();
  await db.query('DELETE FROM sessions WHERE sid=$1', [sid]);
  await db.query('DELETE FROM designs WHERE claimed_by_user_id=$1', [userId]);
  await db.query('DELETE FROM workflow_snapshots WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM saved_projects WHERE user_id=$1', [userId]);
  await db.end();
}
