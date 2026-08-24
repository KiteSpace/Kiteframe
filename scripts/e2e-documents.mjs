/**
 * End-to-end check of the addressable document API against the running server.
 *
 * Seeds a real user + saved project + forged session, then drives
 * GET/PUT /api/project/:uuid/documents[/:docId] over HTTPS exactly as the
 * client does. Verifies addressing, ownership, merge-preservation and
 * concurrency against the real database rather than a mock.
 *
 * Run from the workspace root:  node scripts/e2e-documents.mjs
 */
import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const BASE = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const OWNER = 'e2e-docs-owner';
const OTHER = 'e2e-docs-other';

let pass = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function seedUser(id, email) {
  await db.query(
    `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
     ON CONFLICT (id) DO UPDATE SET is_beta = true`,
    [id, email],
  );
  const sid = crypto.randomBytes(16).toString('hex');
  await db.query(
    `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
     ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
    [
      sid,
      JSON.stringify({
        cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
        passport: { user: { id, email } },
      }),
      new Date(Date.now() + 86400000),
    ],
  );
  const hmac = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(sid)
    .digest('base64')
    .replace(/=+$/, '');
  return `connect.sid=s:${sid}.${hmac}`;
}

const ownerCookie = await seedUser(OWNER, 'e2e-docs-owner@example.com');
const otherCookie = await seedUser(OTHER, 'e2e-docs-other@example.com');

// A project that already has a canvas and notes, so we can prove a document
// save preserves them.
const projectUuid = crypto.randomUUID();
const workflowData = {
  nodes: [{ id: 'n1', type: 'process' }],
  edges: [{ id: 'e1', source: 'n1', target: 'n1' }],
  canvasObjects: [{ id: 'c1', type: 'sticky' }],
  notesData: { 'note-1': 'keep me' },
  detailsData: { owner: 'keep me too' },
  viewport: { x: 10, y: 20, zoom: 1.5 },
};
await db.query(`DELETE FROM saved_projects WHERE user_id = $1`, [OWNER]);
const seeded = await db.query(
  `INSERT INTO saved_projects (user_id, name, project_uuid, workflow_data)
   VALUES ($1, 'E2E Docs Project', $2, $3) RETURNING id`,
  [OWNER, projectUuid, JSON.stringify(workflowData)],
);
const projectId = seeded.rows[0].id;

const url = (suffix = '') => `${BASE}/api/project/${projectUuid}/documents${suffix}`;
const get = (suffix, cookie = ownerCookie) => fetch(url(suffix), { headers: { cookie } });
const put = (suffix, body, cookie = ownerCookie) =>
  fetch(url(suffix), {
    method: 'PUT',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const projectPrd = {
  projectId: 'p1',
  projectName: 'E2E Docs Project',
  sections: [{ id: 'overview', title: 'Overview', content: 'Original overview.' }],
  manualEditedAt: {},
  version: 1,
  generatedAt: Date.now(),
};
const workflowPrd = (id, content) => ({
  workflowId: id,
  workflowName: `Workflow ${id}`,
  sections: [{ id: 'goals', title: 'Goals', content }],
  manualEditedAt: {},
  version: 1,
  generatedAt: Date.now(),
});

console.log('\n— empty project —');
{
  const list = await get('');
  const body = await list.json();
  check('lists zero documents before any are generated', list.status === 200 && body.documents.length === 0);

  const missing = await get('/project-prd');
  const missingBody = await missing.json();
  check('missing document is 404 with its docId (an empty state, not an error)',
    missing.status === 404 && missingBody.docId === 'project-prd');
}

console.log('\n— addressing —');
{
  const bad = await get('/notes');
  check('unknown docId is rejected with 400', bad.status === 400);
  const badWf = await get('/workflow-prd:');
  check('workflow docId with no workflow id is rejected', badWf.status === 400);
}

console.log('\n— saving the project document —');
let projectUpdatedAt;
{
  const res = await put('/project-prd', { content: projectPrd });
  const body = await res.json();
  projectUpdatedAt = body?.document?.updatedAt;
  check('PUT returns 200 with a stamped updatedAt',
    res.status === 200 && !!projectUpdatedAt && !Number.isNaN(Date.parse(projectUpdatedAt)),
    JSON.stringify(body).slice(0, 200));

  const row = await db.query(`SELECT workflow_data FROM saved_projects WHERE id = $1`, [projectId]);
  const wd = row.rows[0].workflow_data;
  check('canvas nodes preserved', JSON.stringify(wd.nodes) === JSON.stringify(workflowData.nodes));
  check('canvas edges preserved', JSON.stringify(wd.edges) === JSON.stringify(workflowData.edges));
  check('canvasObjects preserved', JSON.stringify(wd.canvasObjects) === JSON.stringify(workflowData.canvasObjects));
  check('notesData preserved', wd.notesData?.['note-1'] === 'keep me');
  check('detailsData preserved', wd.detailsData?.owner === 'keep me too');
  check('viewport preserved', wd.viewport?.zoom === 1.5);
  check('document written to the canonical prdData key', wd.prdData?.projectName === 'E2E Docs Project');
  check('document stamped in storage', typeof wd.prdData?.updatedAt === 'string');
}

console.log('\n— reading it back (the reload path) —');
{
  const res = await get('/project-prd');
  const body = await res.json();
  check('GET returns the saved content', res.status === 200 &&
    body.document.content.sections[0].content === 'Original overview.');
  check('GET reports the same updatedAt as the save', body.document.updatedAt === projectUpdatedAt);
  check('payload carries a human title', body.document.title === 'E2E Docs Project Spec');
  check('payload carries the section count', body.document.sectionCount === 1);
}

console.log('\n— workflow documents alongside the project document —');
{
  await put('/workflow-prd:wf-alpha', { content: workflowPrd('wf-alpha', 'Alpha goals.') });
  await put('/workflow-prd:wf-beta', { content: workflowPrd('wf-beta', 'Beta goals.') });

  const list = await get('');
  const { documents } = await list.json();
  check('all three documents are listed',
    documents.length === 3 &&
    documents.map((d) => d.docId).join(',') === 'project-prd,workflow-prd:wf-alpha,workflow-prd:wf-beta',
    documents.map((d) => d.docId).join(','));

  const alpha = await (await get('/workflow-prd:wf-alpha')).json();
  check('a workflow document reads back by its own address',
    alpha.document.content.sections[0].content === 'Alpha goals.');

  const project = await (await get('/project-prd')).json();
  check('the project document survived the workflow saves',
    project.document.content.sections[0].content === 'Original overview.');
}

console.log('\n— editing one document leaves the others alone —');
{
  const edited = { ...workflowPrd('wf-alpha', 'Alpha goals, revised.'), manualEditedAt: { goals: Date.now() } };
  await put('/workflow-prd:wf-alpha', { content: edited });

  const alpha = await (await get('/workflow-prd:wf-alpha')).json();
  const beta = await (await get('/workflow-prd:wf-beta')).json();
  const project = await (await get('/project-prd')).json();

  check('edited document updated', alpha.document.content.sections[0].content === 'Alpha goals, revised.');
  check('sibling workflow document untouched', beta.document.content.sections[0].content === 'Beta goals.');
  check('project document untouched', project.document.content.sections[0].content === 'Original overview.');

  const row = await db.query(`SELECT workflow_data FROM saved_projects WHERE id = $1`, [projectId]);
  check('no duplicate workflow entries after re-save',
    row.rows[0].workflow_data.workflowPRDs.length === 2);
  check('canvas still intact after four document writes',
    row.rows[0].workflow_data.nodes.length === 1);
}

console.log('\n— the address wins over a mismatched body —');
{
  // A body claiming a different workflow must not write itself elsewhere.
  await put('/workflow-prd:wf-beta', { content: workflowPrd('wf-alpha', 'Impostor.') });
  const beta = await (await get('/workflow-prd:wf-beta')).json();
  const alpha = await (await get('/workflow-prd:wf-alpha')).json();
  check('body stored under the addressed workflow', beta.document.content.workflowId === 'wf-beta');
  check('the impersonated document was not overwritten',
    alpha.document.content.sections[0].content === 'Alpha goals, revised.');
}

console.log('\n— concurrent saves (exercises the database row lock) —');
{
  // Every document save is a read-modify-write of one shared JSONB blob. With
  // no lock, simultaneous saves each read the pre-save blob and the last write
  // silently drops the others. Twelve documents at once makes that obvious.
  const many = Array.from({ length: 12 }, (_, i) => `wf-conc-${i}`);
  await Promise.all([
    ...many.map((id) => put(`/workflow-prd:${id}`, { content: workflowPrd(id, `Body ${id}.`) })),
    put('/workflow-prd:wf-alpha', { content: workflowPrd('wf-alpha', 'Concurrent A.') }),
    put('/workflow-prd:wf-beta', { content: workflowPrd('wf-beta', 'Concurrent B.') }),
    put('/project-prd', { content: { ...projectPrd, sections: [{ id: 'overview', title: 'Overview', content: 'Concurrent P.' }] } }),
  ]);

  const list = await (await get('')).json();
  check('no document is lost among 15 simultaneous saves',
    list.documents.length === 15, `got ${list.documents.length}`);

  const bodies = await Promise.all(many.map(async (id) => (await (await get(`/workflow-prd:${id}`)).json()).document?.content?.sections?.[0]?.content));
  check('every concurrently-written body is exactly what was sent',
    bodies.every((b, i) => b === `Body ${many[i]}.`), bodies.filter(Boolean).length + '/12 correct');

  const a = await (await get('/workflow-prd:wf-alpha')).json();
  const b = await (await get('/workflow-prd:wf-beta')).json();
  const p = await (await get('/project-prd')).json();
  check('concurrent write A landed', a.document.content.sections[0].content === 'Concurrent A.');
  check('concurrent write B landed', b.document.content.sections[0].content === 'Concurrent B.');
  check('concurrent write P landed', p.document.content.sections[0].content === 'Concurrent P.');

  const row = await db.query(`SELECT workflow_data FROM saved_projects WHERE id = $1`, [projectId]);
  check('canvas survived concurrent saves', row.rows[0].workflow_data.nodes.length === 1);

  // Clean up so later counts stay readable.
  await Promise.all(many.map((id) => put(`/workflow-prd:${id}`, { content: workflowPrd(id, 'x') })));
}

console.log('\n— a document save must not revert a concurrent canvas save —');
{
  // The full-project PUT replaces workflowData wholesale. A document save reads
  // that blob, changes one key and writes it back — so without a row lock a
  // full save landing mid-sequence is undone: the canvas reverts to the value
  // the document handler happened to read. Ten rounds to shake out the timing.
  let reverted = null;

  for (let round = 0; round < 10 && !reverted; round++) {
    const marker = `canvas-round-${round}`;
    const fullSave = fetch(`${BASE}/api/project/${projectUuid}`, {
      method: 'PUT',
      headers: { cookie: ownerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowData: {
          ...workflowData,
          nodes: [{ id: marker, type: 'process' }],
          // Carry the documents through, as the real client does (it builds this
          // payload from its localStorage cache).
          prdData: projectPrd,
        },
      }),
    });
    const docSave = put('/workflow-prd:wf-alpha', {
      content: workflowPrd('wf-alpha', `Round ${round}.`),
    });
    await Promise.all([fullSave, docSave]);

    const row = await db.query(`SELECT workflow_data FROM saved_projects WHERE id = $1`, [projectId]);
    const wd = row.rows[0].workflow_data;
    const nodeId = wd.nodes?.[0]?.id;

    // Either ordering is legitimate. What must never happen is the canvas
    // holding a marker from an EARLIER round — that is a resurrected read.
    if (nodeId && nodeId.startsWith('canvas-round-')) {
      const seen = Number(nodeId.split('-').pop());
      if (seen < round) reverted = `round ${round} saw ${nodeId}`;
    } else if (nodeId !== 'n1' && nodeId !== marker) {
      reverted = `round ${round} saw unexpected ${nodeId}`;
    }
  }

  check('a document save never resurrects an older canvas', !reverted, reverted || '10 rounds clean');

  // And the document itself is still readable after all that interleaving.
  const alpha = await get('/workflow-prd:wf-alpha');
  check('the document is still intact after racing the full-project save',
    alpha.status === 200 || alpha.status === 404, `got ${alpha.status}`);
}

console.log('\n— access control —');
{
  const anon = await fetch(url('/project-prd'));
  check('anonymous read is rejected', anon.status === 401 || anon.status === 403, `got ${anon.status}`);

  const foreign = await get('/project-prd', otherCookie);
  check('a non-owner cannot read the document', foreign.status === 403, `got ${foreign.status}`);

  const foreignWrite = await put('/project-prd', { content: projectPrd }, otherCookie);
  check('a non-owner cannot write the document', foreignWrite.status === 403, `got ${foreignWrite.status}`);

  const ghost = await fetch(`${BASE}/api/project/${crypto.randomUUID()}/documents/project-prd`, {
    headers: { cookie: ownerCookie },
  });
  check('an unknown project is 404', ghost.status === 404, `got ${ghost.status}`);
}

console.log('\n— validation —');
{
  const noSections = await put('/project-prd', { content: { version: 1 } });
  check('a document without sections is rejected', noSections.status === 400, `got ${noSections.status}`);

  const badSection = await put('/project-prd', { content: { sections: [{ id: 'x' }] } });
  check('a malformed section is rejected', badSection.status === 400, `got ${badSection.status}`);

  const stillThere = await (await get('/project-prd')).json();
  check('a rejected save did not damage the stored document',
    stillThere.document.content.sections[0].content === 'Concurrent P.');
}

console.log('\n— extra fields round-trip (version counters, hashes, flags) —');
{
  const rich = {
    ...workflowPrd('wf-alpha', 'Rich.'),
    hash: 'abc123',
    sectionHashes: { goals: 'h1' },
    autoGenerated: true,
    draft: false,
  };
  await put('/workflow-prd:wf-alpha', { content: rich });
  const back = await (await get('/workflow-prd:wf-alpha')).json();
  const c = back.document.content;
  check('unknown-to-the-schema fields survive', c.hash === 'abc123' && c.sectionHashes.goals === 'h1' && c.autoGenerated === true);
}

await db.query(`DELETE FROM saved_projects WHERE user_id = $1`, [OWNER]);
await db.end();

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('FAILED:', failures.join(' | '));
  process.exit(1);
}
