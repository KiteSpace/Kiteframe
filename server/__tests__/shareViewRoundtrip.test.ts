/**
 * Integration test for the cloud share round-trip of Project Overview
 * details (name, description, categories, createdAt, updatedAt).
 *
 * The share / view-only handlers live in server/shareHandlers.ts and
 * are mounted in routes.ts; this test imports the SAME handler
 * functions and exercises them via supertest. Storage is mocked with an
 * in-memory store so we never touch the real database.
 *
 * The Project Overview section persists categories / createdAt /
 * updatedAt into localStorage('kiteframe-details-<projectId>');
 * SavedProjectsDrawer forwards that string verbatim into
 * workflowData.detailsData when it saves to the cloud, and the view
 * endpoint surfaces it back as `detailsData`. Round-tripping that JSON
 * blob is therefore the contract under test, alongside the
 * project.name / project.description columns that the view endpoint
 * surfaces directly.
 *
 * For the create / update endpoints we use minimal stand-in handlers
 * that mirror the relevant parts of routes.ts (POST /api/projects ~1066
 * and PUT /api/projects/:id ~1151) — they exist only to populate the
 * mocked storage so the real share + view handlers have something to
 * read. Sanitization is intentionally skipped here since this test is
 * about the share data flow, not input cleansing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import request from 'supertest';
import crypto from 'crypto';

type FakeProject = {
  id: string;
  userId: string;
  projectUuid: string;
  shareUuid: string | null;
  isShareEnabled: boolean;
  name: string;
  description: string | null;
  workflowData: any;
  createdAt: Date;
  updatedAt: Date;
  lastSharedAt: Date | null;
};

const projectStore: FakeProject[] = [];
let nextProjectId = 1;

vi.mock('../storage', () => {
  const storage = {
    async getSavedProject(id: string, userId: string) {
      return (
        projectStore.find((p) => p.id === id && p.userId === userId) ?? null
      );
    },
    async createSavedProject(values: {
      userId: string;
      name: string;
      description?: string | null;
      workflowData: any;
    }) {
      const now = new Date();
      const proj: FakeProject = {
        id: `proj-${nextProjectId++}`,
        userId: values.userId,
        projectUuid: crypto.randomUUID(),
        shareUuid: null,
        isShareEnabled: false,
        name: values.name,
        description: values.description ?? null,
        workflowData: values.workflowData ?? null,
        createdAt: now,
        updatedAt: now,
        lastSharedAt: null,
      };
      projectStore.push(proj);
      return proj;
    },
    async updateSavedProject(
      id: string,
      userId: string,
      patch: Partial<FakeProject>,
    ) {
      const proj = projectStore.find(
        (p) => p.id === id && p.userId === userId,
      );
      if (!proj) return null;
      // Mirror production's behavior: only assign defined fields.
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (proj as any)[k] = v;
      }
      proj.updatedAt = new Date();
      return proj;
    },
    async enableProjectSharing(id: string, userId: string) {
      const proj = projectStore.find(
        (p) => p.id === id && p.userId === userId,
      );
      if (!proj) return null;
      proj.isShareEnabled = true;
      if (!proj.shareUuid) proj.shareUuid = crypto.randomUUID();
      proj.lastSharedAt = new Date();
      proj.updatedAt = new Date();
      return proj;
    },
    async disableProjectSharing(id: string, userId: string) {
      const proj = projectStore.find(
        (p) => p.id === id && p.userId === userId,
      );
      if (!proj) return null;
      proj.isShareEnabled = false;
      proj.updatedAt = new Date();
      return proj;
    },
    async getProjectByShareUuid(shareUuid: string) {
      return (
        projectStore.find(
          (p) => p.shareUuid === shareUuid && p.isShareEnabled,
        ) ?? null
      );
    },
    async getShareLink() {
      return null;
    },
  };
  return { storage };
});

// ---- harness ---------------------------------------------------------------
function stubAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.header('x-test-user');
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  (req as any).user = { claims: { sub: userId } };
  next();
}

function attachOptionalUser(req: Request, _res: Response, next: NextFunction) {
  const userId = req.header('x-test-user');
  if (userId) (req as any).user = { claims: { sub: userId } };
  next();
}

async function loadApp() {
  const { storage } = (await import('../storage')) as any;
  const {
    enableProjectShareHandler,
    disableProjectShareHandler,
    viewSharedProjectHandler,
  } = await import('../shareHandlers');
  const { mergeWorkflowDataPreservingPanelDocs } = await import('@shared/panelDocs');

  const app = express();
  app.use(express.json());

  // Minimal create/update stand-ins (see file header for rationale).
  app.post('/api/projects', stubAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { name, description, workflowData } = req.body;
    const project = await storage.createSavedProject({
      userId,
      name: name || 'Untitled Project',
      description: description ?? null,
      workflowData: workflowData ?? null,
    });
    res.json({ project });
  });
  app.put('/api/projects/:id', stubAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    const { name, description, workflowData } = req.body;
    let nextWorkflowData = workflowData;
    if (workflowData) {
      const existing = await storage.getSavedProject(id, userId);
      if (existing?.workflowData) {
        nextWorkflowData = mergeWorkflowDataPreservingPanelDocs(
          existing.workflowData,
          workflowData,
        );
      }
    }
    const project = await storage.updateSavedProject(id, userId, {
      name,
      description,
      workflowData: nextWorkflowData,
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  });

  // Real production handlers under test.
  app.post('/api/projects/:id/share', stubAuth, enableProjectShareHandler);
  app.delete('/api/projects/:id/share', stubAuth, disableProjectShareHandler);
  app.get('/api/view/:shareUuid', attachOptionalUser, viewSharedProjectHandler);

  return app;
}

beforeEach(() => {
  projectStore.length = 0;
  nextProjectId = 1;
});

// Helpers --------------------------------------------------------------------
type OverviewBlob = {
  name: string;
  description: string;
  categories: string[];
  createdAt: number;
  updatedAt: number;
};

function buildWorkflowData(overview: OverviewBlob, extra?: any) {
  // Mirrors what SavedProjectsDrawer + workflow-editor.tsx send when the
  // user saves to the cloud: workflowData carries nodes/edges/etc. plus a
  // detailsData JSON string copied straight from
  // localStorage('kiteframe-details-<projectId>').
  return {
    nodes: extra?.nodes ?? [{ id: 'n1' }],
    edges: extra?.edges ?? [],
    canvasObjects: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
      name: overview.name,
      description: overview.description,
      links: [],
      linksFormat: 'text' as const,
      categories: overview.categories,
    },
    detailsData: JSON.stringify(overview),
  };
}

describe('Project Overview round-trips through cloud share links (real handlers)', () => {
  it('preserves name, description, categories, createdAt, updatedAt for a freshly-shared project', async () => {
    const app = await loadApp();
    const overview: OverviewBlob = {
      name: 'My Cool Workflow',
      description: 'A workflow with overview details',
      categories: ['research', 'product', 'launch-2026'],
      createdAt: Date.UTC(2026, 0, 15, 12, 0, 0),
      updatedAt: Date.UTC(2026, 0, 16, 9, 30, 0),
    };

    const createRes = await request(app)
      .post('/api/projects')
      .set('x-test-user', 'alice')
      .send({
        name: overview.name,
        description: overview.description,
        workflowData: buildWorkflowData(overview),
      });
    expect(createRes.status).toBe(200);
    const projectId = createRes.body.project.id;
    expect(projectId).toBeTruthy();

    const shareRes = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set('x-test-user', 'alice')
      .send({});
    expect(shareRes.status).toBe(200);
    const shareUuid: string = shareRes.body.shareUuid;
    expect(shareUuid).toBeTruthy();
    expect(shareRes.body.shareUrl).toBe(`/view/${shareUuid}`);

    // Open the share URL as another browser context (no auth header).
    const viewRes = await request(app).get(`/api/view/${shareUuid}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.isOwner).toBe(false);
    expect(viewRes.body.projectName).toBe(overview.name);
    expect(viewRes.body.projectDescription).toBe(overview.description);

    // Categories + timestamps survive via the detailsData JSON blob,
    // which the viewer seeds back into localStorage so ProjectOverview
    // renders identical content.
    expect(typeof viewRes.body.detailsData).toBe('string');
    const restored = JSON.parse(viewRes.body.detailsData) as OverviewBlob;
    expect(restored.name).toBe(overview.name);
    expect(restored.description).toBe(overview.description);
    expect(restored.categories).toEqual(overview.categories);
    expect(restored.createdAt).toBe(overview.createdAt);
    expect(restored.updatedAt).toBe(overview.updatedAt);
  });

  it('reflects edits made after sharing (re-share path keeps the same shareUuid and surfaces updated overview)', async () => {
    const app = await loadApp();
    const initial: OverviewBlob = {
      name: 'Workflow v1',
      description: 'first pass',
      categories: ['draft'],
      createdAt: Date.UTC(2026, 1, 1),
      updatedAt: Date.UTC(2026, 1, 1),
    };

    const createRes = await request(app)
      .post('/api/projects')
      .set('x-test-user', 'alice')
      .send({
        name: initial.name,
        description: initial.description,
        workflowData: buildWorkflowData(initial),
      });
    const projectId = createRes.body.project.id;

    const shareRes1 = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set('x-test-user', 'alice')
      .send({});
    const shareUuid1: string = shareRes1.body.shareUuid;

    // Author edits overview details and re-saves to the cloud.
    const edited: OverviewBlob = {
      name: 'Workflow v2',
      description: 'second pass with new categories',
      categories: ['draft', 'in-review', 'q2-2026'],
      createdAt: initial.createdAt,
      updatedAt: Date.UTC(2026, 1, 14, 18, 0, 0),
    };
    const updateRes = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('x-test-user', 'alice')
      .send({
        name: edited.name,
        description: edited.description,
        workflowData: buildWorkflowData(edited, {
          nodes: [{ id: 'n1' }, { id: 'n2' }],
        }),
      });
    expect(updateRes.status).toBe(200);

    // Calling /share again on an already-shared project must be idempotent.
    const shareRes2 = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set('x-test-user', 'alice')
      .send({});
    expect(shareRes2.status).toBe(200);
    expect(shareRes2.body.shareUuid).toBe(shareUuid1);

    const viewRes = await request(app).get(`/api/view/${shareUuid1}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.projectName).toBe(edited.name);
    expect(viewRes.body.projectDescription).toBe(edited.description);
    expect(viewRes.body.nodes).toHaveLength(2);

    const restored = JSON.parse(viewRes.body.detailsData) as OverviewBlob;
    expect(restored.categories).toEqual(edited.categories);
    expect(restored.createdAt).toBe(initial.createdAt);
    expect(restored.updatedAt).toBe(edited.updatedAt);
    // Sanity: the previously-stored categories are NOT leaking through.
    expect(restored.categories).not.toEqual(initial.categories);
  });

  it('returns an owner redirect (not view payload) when the owner opens their own share URL', async () => {
    const app = await loadApp();
    const overview: OverviewBlob = {
      name: 'Owner Project',
      description: 'd',
      categories: ['a'],
      createdAt: 1,
      updatedAt: 2,
    };
    const createRes = await request(app)
      .post('/api/projects')
      .set('x-test-user', 'alice')
      .send({
        name: overview.name,
        description: overview.description,
        workflowData: buildWorkflowData(overview),
      });
    const projectId = createRes.body.project.id;
    const shareRes = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set('x-test-user', 'alice')
      .send({});
    const shareUuid: string = shareRes.body.shareUuid;

    const ownerView = await request(app)
      .get(`/api/view/${shareUuid}`)
      .set('x-test-user', 'alice');
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.isOwner).toBe(true);
    expect(ownerView.body.redirect).toMatch(/^\/project\//);
  });

  it('404s for an unknown shareUuid', async () => {
    const app = await loadApp();
    const viewRes = await request(app).get('/api/view/does-not-exist');
    expect(viewRes.status).toBe(404);
  });

  it('404s after sharing is disabled, even with the same shareUuid', async () => {
    const app = await loadApp();
    const overview: OverviewBlob = {
      name: 'P',
      description: '',
      categories: [],
      createdAt: 0,
      updatedAt: 0,
    };
    const createRes = await request(app)
      .post('/api/projects')
      .set('x-test-user', 'alice')
      .send({ name: overview.name, workflowData: buildWorkflowData(overview) });
    const projectId = createRes.body.project.id;
    const shareRes = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set('x-test-user', 'alice')
      .send({});
    const shareUuid: string = shareRes.body.shareUuid;

    const disable = await request(app)
      .delete(`/api/projects/${projectId}/share`)
      .set('x-test-user', 'alice');
    expect(disable.status).toBe(200);

    const viewRes = await request(app).get(`/api/view/${shareUuid}`);
    expect(viewRes.status).toBe(404);
  });

  it('returns project PRD, workflow PRDs, and notes on first share open (no extra save)', async () => {
    const app = await loadApp();
    const overview: OverviewBlob = {
      name: 'Specced Project',
      description: 'full docs',
      categories: ['prd'],
      createdAt: Date.UTC(2026, 2, 1),
      updatedAt: Date.UTC(2026, 2, 2),
    };
    const prdData = {
      projectName: 'Specced Project',
      sections: [{ id: 'overview', title: 'Overview', content: 'Goals' }],
      version: 1,
      generatedAt: 1,
    };
    const workflowPRDs = [
      {
        workflowId: 'wf-alpha',
        workflowName: 'Alpha',
        sections: [{ id: 'goals', title: 'Goals', content: 'Ship' }],
        version: 1,
        generatedAt: 1,
      },
      {
        workflowId: 'wf-beta',
        workflowName: 'Beta',
        sections: [{ id: 'goals', title: 'Goals', content: 'Learn' }],
        version: 1,
        generatedAt: 1,
      },
    ];
    const notesData = JSON.stringify({
      notes: [{ id: 'note-1', title: 'Kickoff', content: 'Remember constraints', author: 'You', version: 1, createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' }],
    });

    const createRes = await request(app)
      .post('/api/projects')
      .set('x-test-user', 'alice')
      .send({
        name: overview.name,
        description: overview.description,
        workflowData: {
          ...buildWorkflowData(overview),
          prdData,
          workflowPRDs,
          notesData,
        },
      });
    const projectId = createRes.body.project.id;

    const shareRes = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set('x-test-user', 'alice')
      .send({});
    const shareUuid: string = shareRes.body.shareUuid;

    // First open of the share link — no further author save.
    const viewRes = await request(app).get(`/api/view/${shareUuid}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.projectUuid).toBeTruthy();
    expect(viewRes.body.shareUuid).toBe(shareUuid);
    expect(viewRes.body.projectUuid).not.toBe(shareUuid);
    expect(viewRes.body.prdData.sections[0].content).toBe('Goals');
    expect(viewRes.body.workflowPRDs).toHaveLength(2);
    expect(viewRes.body.workflowPRDs.map((w: any) => w.workflowId).sort()).toEqual([
      'wf-alpha',
      'wf-beta',
    ]);
    expect(JSON.parse(viewRes.body.notesData).notes[0].content).toContain('constraints');
    expect(JSON.parse(viewRes.body.detailsData).categories).toEqual(['prd']);
  });

  it('keeps documentation after a canvas-only update that omits panel docs', async () => {
    const app = await loadApp();
    const overview: OverviewBlob = {
      name: 'Durable Docs',
      description: 'must survive',
      categories: ['keep'],
      createdAt: 1,
      updatedAt: 2,
    };
    const createRes = await request(app)
      .post('/api/projects')
      .set('x-test-user', 'alice')
      .send({
        name: overview.name,
        description: overview.description,
        workflowData: {
          ...buildWorkflowData(overview),
          prdData: { projectName: 'Durable Docs', sections: [{ id: 'o', title: 'O', content: 'alive' }] },
          notesData: '{"notes":[{"id":"1","content":"alive"}]}',
        },
      });
    const projectId = createRes.body.project.id;
    const shareRes = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set('x-test-user', 'alice')
      .send({});
    const shareUuid: string = shareRes.body.shareUuid;

    // Canvas save that forgets to include documentation fields.
    const updateRes = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('x-test-user', 'alice')
      .send({
        name: overview.name,
        workflowData: {
          nodes: [{ id: 'n1' }, { id: 'n2' }],
          edges: [],
        },
      });
    expect(updateRes.status).toBe(200);

    const viewRes = await request(app).get(`/api/view/${shareUuid}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.nodes).toHaveLength(2);
    expect(viewRes.body.prdData.sections[0].content).toBe('alive');
    expect(viewRes.body.notesData).toContain('alive');
    expect(JSON.parse(viewRes.body.detailsData).categories).toEqual(['keep']);
  });
});
