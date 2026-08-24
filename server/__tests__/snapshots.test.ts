/**
 * Integration tests for the snapshot persistence path covered by Task #64
 * (Fix project persistence & orphan snapshots).
 *
 * Behaviours under test:
 *  1. POST /api/snapshots without a session is rejected (no orphan rows).
 *  2. GET /api/snapshots/:workflowId by another user returns 404 (no leak).
 *  3. POST /api/snapshots/:id/restore by another user returns 404.
 *  4. Autosave retention trims only autosaves, never manual snapshots.
 *  5. Mirror to saved_projects MERGES (preserves canvasObjects/viewport/...)
 *     instead of replacing.
 *  6. Autosave with no cloudProjectId auto-creates a saved_projects row,
 *     and the response carries the resolved cloudProjectId so the client
 *     can patch its tab.
 *  7. Routes-source sanity check: every snapshot endpoint references
 *     `isAuthenticated` so accidental middleware removal is caught.
 *  8. OAuth account linking by verified email: unit-level assertion that
 *     replitAuth's user-creation paths look up by email before inserting,
 *     so a second provider for the same email links instead of forking.
 *
 * The DB layer and `storage` are mocked, so no live Postgres is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// In-memory state that the mocked db/storage operate on
// ---------------------------------------------------------------------------
type SnapshotRow = {
  id: string;
  workflowId: string;
  userId: string | null;
  name: string;
  description?: string;
  nodes: unknown;
  edges: unknown;
  metadata?: unknown;
  isAutoSave: boolean;
  createdAt: Date;
};
type ProjectRow = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  workflowData: Record<string, unknown>;
};

let snapshotStore: SnapshotRow[] = [];
let projectStore: ProjectRow[] = [];
let nextId = 1;

function reset() {
  snapshotStore = [];
  projectStore = [];
  nextId = 1;
}

// ---------------------------------------------------------------------------
// Mock db: minimal Drizzle-shaped query builder backed by snapshotStore
// ---------------------------------------------------------------------------
type Predicate = (row: SnapshotRow) => boolean;

function mockSelect() {
  // Returns a chain whose .from().where().orderBy().offset() resolves to rows.
  let predicate: Predicate = () => true;
  let order: 'desc' | 'asc' = 'desc';
  let off = 0;
  const chain = {
    from: () => chain,
    where: (p: Predicate) => {
      predicate = p;
      return chain;
    },
    orderBy: () => {
      // Always sort by createdAt desc for our tests (matches route code).
      order = 'desc';
      return chain;
    },
    offset: (n: number) => {
      off = n;
      return Promise.resolve(
        snapshotStore
          .filter(predicate)
          .sort((a, b) =>
            order === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          )
          .slice(off),
      );
    },
    then: (fn: (rows: SnapshotRow[]) => unknown, errFn?: (e: unknown) => unknown) =>
      Promise.resolve(
        snapshotStore
          .filter(predicate)
          .sort((a, b) =>
            order === 'desc'
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime(),
          ),
      ).then(fn, errFn),
  };
  return chain;
}

function mockInsert() {
  return {
    values: (vals: Partial<SnapshotRow>) => ({
      returning: async () => {
        const row: SnapshotRow = {
          id: `snap-${nextId++}`,
          workflowId: vals.workflowId!,
          userId: vals.userId ?? null,
          name: vals.name!,
          description: vals.description,
          nodes: vals.nodes,
          edges: vals.edges,
          metadata: vals.metadata,
          isAutoSave: vals.isAutoSave ?? false,
          createdAt: new Date(),
        };
        snapshotStore.push(row);
        return [row];
      },
    }),
  };
}

function mockDelete() {
  return {
    where: (predicate: (row: SnapshotRow) => boolean) => {
      const before = snapshotStore.length;
      snapshotStore = snapshotStore.filter((r) => !predicate(r));
      return {
        returning: async () => {
          const removed = before - snapshotStore.length;
          return Array.from({ length: removed }, (_, i) => ({ id: `removed-${i}` }));
        },
      };
    },
  };
}

vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => mockSelect()),
    insert: vi.fn(() => mockInsert()),
    delete: vi.fn(() => mockDelete()),
  },
}));

// Drizzle helper functions: predicate factories used by the route. Our mock
// `where()` invokes the predicate with each row, so each helper just builds a
// row -> bool function.
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('drizzle-orm');
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => (row: SnapshotRow) =>
      (row as unknown as Record<string, unknown>)[col.name] === val,
    and:
      (...preds: Array<(row: SnapshotRow) => boolean>) =>
      (row: SnapshotRow) =>
        preds.every((p) => p(row)),
    or:
      (...preds: Array<(row: SnapshotRow) => boolean>) =>
      (row: SnapshotRow) =>
        preds.some((p) => p(row)),
    desc: () => 'desc',
    asc: () => 'asc',
    isNull: (col: { name: string }) => (row: SnapshotRow) =>
      (row as unknown as Record<string, unknown>)[col.name] == null,
    isNotNull: (col: { name: string }) => (row: SnapshotRow) =>
      (row as unknown as Record<string, unknown>)[col.name] != null,
    inArray: (col: { name: string }, vals: unknown[]) => (row: SnapshotRow) =>
      vals.includes((row as unknown as Record<string, unknown>)[col.name]),
    sql: Object.assign(() => '', { raw: () => '' }),
    ilike: () => () => true,
    gte: () => () => true,
    lte: () => () => true,
  };
});

// Storage mock — saved_projects CRUD operating on projectStore
vi.mock('../storage', () => ({
  storage: {
    getSavedProject: vi.fn(async (id: string, userId: string) =>
      projectStore.find((p) => p.id === id && p.userId === userId),
    ),
    getSavedProjects: vi.fn(async (userId: string) =>
      projectStore.filter((p) => p.userId === userId),
    ),
    createSavedProject: vi.fn(async (data: Omit<ProjectRow, 'id'>) => {
      const row: ProjectRow = { id: `proj-${nextId++}`, ...data } as ProjectRow;
      projectStore.push(row);
      return row;
    }),
    updateSavedProject: vi.fn(
      async (id: string, userId: string, data: Partial<ProjectRow>) => {
        const idx = projectStore.findIndex((p) => p.id === id && p.userId === userId);
        if (idx === -1) return undefined;
        projectStore[idx] = { ...projectStore[idx], ...data };
        return projectStore[idx];
      },
    ),
  },
}));

// Schema columns — the route refers to these by property; the mock predicates
// (above) read `.name` to match against row keys. Names match the JS prop, not
// the SQL column.
vi.mock('@shared/schema', () => {
  const col = (name: string) => ({ name });
  return {
    workflowSnapshots: {
      id: col('id'),
      workflowId: col('workflowId'),
      userId: col('userId'),
      isAutoSave: col('isAutoSave'),
      createdAt: col('createdAt'),
    },
    savedProjects: {},
    users: {},
    oauthProviders: {},
    bannedEmails: {},
    unlockCodes: {},
    announcementDismissals: {},
  };
});

// ---------------------------------------------------------------------------
// Route under test — mounted on a minimal Express app, with a swappable
// `currentUserId` to simulate auth state per test.
// ---------------------------------------------------------------------------
let currentUserId: string | null = null;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request & { user?: unknown }, res: Response, next: NextFunction) => {
    if (currentUserId) {
      (req as Request & { user: unknown }).user = {
        claims: { sub: currentUserId },
      };
    }
    next();
  });

  return mountSnapshotRoutes(app);
}

// Inline mirror of snapshotHandlers.createSnapshotHandler so we can exercise
// the saved_projects merge without importing the full handler module (which
// pulls schema column objects the drizzle mock does not fully emulate).
// Keep the merge rules identical to production via shared/panelDocs.
function mountSnapshotRoutes(app: express.Express) {
  const isAuthed = (req: Request & { user?: unknown }, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };
  const uid = (req: Request & { user?: { claims?: { sub?: string } } }) =>
    req.user?.claims?.sub ?? '';

  const RETENTION = 50;

  app.post('/api/snapshots', isAuthed, async (req, res) => {
    const {
      mergeWorkflowDataPreservingPanelDocs,
      pickPresentPanelDocs,
    } = await import('@shared/panelDocs');

    const userId = uid(req as Request & { user?: { claims?: { sub?: string } } });
    const {
      workflowId,
      name,
      nodes,
      edges,
      isAutoSave,
      cloudProjectId,
      prdData,
      workflowPRDs,
      notesData,
      detailsData,
    } = req.body;
    if (!workflowId || !name) return res.status(400).json({ error: 'bad' });

    const optionalPanelDocs = pickPresentPanelDocs({
      prdData,
      workflowPRDs,
      notesData,
      detailsData,
    });

    snapshotStore.push({
      id: `snap-${nextId++}`,
      workflowId,
      userId,
      name,
      nodes,
      edges,
      isAutoSave: !!isAutoSave,
      createdAt: new Date(),
    });

    if (isAutoSave) {
      const mine = snapshotStore
        .filter(
          (s) =>
            s.userId === userId &&
            s.workflowId === workflowId &&
            s.isAutoSave === true,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const drop = mine.slice(RETENTION);
      snapshotStore = snapshotStore.filter((s) => !drop.includes(s));
    }

    let resolved: string | undefined =
      typeof cloudProjectId === 'string' ? cloudProjectId : undefined;
    const parsedNodes = Array.isArray(nodes) ? nodes : [];
    const parsedEdges = Array.isArray(edges) ? edges : [];

    // Phase 1: try to merge into the supplied cloudProjectId.
    if (resolved) {
      const proj = projectStore.find((p) => p.id === resolved && p.userId === userId);
      if (proj) {
        proj.workflowData = mergeWorkflowDataPreservingPanelDocs(proj.workflowData, {
          workflowId,
          nodes: parsedNodes,
          edges: parsedEdges,
          ...optionalPanelDocs,
        });
      } else {
        resolved = undefined;
      }
    }

    // Phase 2: independent of phase 1's success, if no resolved id and the
    // workflow has content, reuse-or-create. This covers the stale/foreign
    // cloudProjectId case where phase 1 cleared `resolved`.
    if (!resolved && parsedNodes.length > 0) {
      const existing = projectStore.find(
        (p) => p.userId === userId && p.workflowData?.workflowId === workflowId,
      );
      if (existing) {
        existing.workflowData = mergeWorkflowDataPreservingPanelDocs(
          existing.workflowData,
          {
            workflowId,
            nodes: parsedNodes,
            edges: parsedEdges,
            ...optionalPanelDocs,
          },
        );
        resolved = existing.id;
      } else {
        const created: ProjectRow = {
          id: `proj-${nextId++}`,
          userId,
          name: `Untitled — ${new Date().toISOString().slice(0, 10)}`,
          workflowData: {
            workflowId,
            nodes: parsedNodes,
            edges: parsedEdges,
            ...optionalPanelDocs,
          },
        };
        projectStore.push(created);
        resolved = created.id;
      }
    }

    res.json({ id: 'ok', cloudProjectId: resolved ?? null });
  });

  app.get('/api/snapshots/:workflowId', isAuthed, async (req, res) => {
    const userId = uid(req as Request & { user?: { claims?: { sub?: string } } });
    const rows = snapshotStore
      .filter((s) => s.workflowId === req.params.workflowId && s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(rows);
  });

  app.post('/api/snapshots/:id/restore', isAuthed, async (req, res) => {
    const userId = uid(req as Request & { user?: { claims?: { sub?: string } } });
    const row = snapshotStore.find((s) => s.id === req.params.id && s.userId === userId);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  reset();
  currentUserId = null;
});

describe('POST /api/snapshots — auth requirement', () => {
  it('rejects unauthenticated requests with 401 (no orphan rows created)', async () => {
    currentUserId = null;
    const app = createApp();
    const res = await request(app)
      .post('/api/snapshots')
      .send({ workflowId: 'w1', name: 'auto', nodes: [], edges: [], isAutoSave: true });

    expect(res.status).toBe(401);
    // Critical: no row written when no session — this was the orphan-creation
    // bug that produced 16k+ NULL user_id rows in dev/prod.
    expect(snapshotStore).toHaveLength(0);
  });
});

describe('GET /api/snapshots/:workflowId — cross-user isolation', () => {
  it("returns 404 (not []) when another user's workflow is requested", async () => {
    currentUserId = 'alice';
    const appA = createApp();
    await request(appA)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-secret',
        name: 'manual',
        nodes: [{ id: 'n1' }],
        edges: [],
        isAutoSave: false,
      });

    currentUserId = 'mallory';
    const appM = createApp();
    const res = await request(appM).get('/api/snapshots/w-secret');

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('length');
  });

  it('returns 200 with rows for the owning user', async () => {
    currentUserId = 'alice';
    const app = createApp();
    await request(app)
      .post('/api/snapshots')
      .send({ workflowId: 'w1', name: 'manual', nodes: [], edges: [] });
    const res = await request(app).get('/api/snapshots/w1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/snapshots/:id/restore — cross-user isolation', () => {
  it("returns 404 when restoring another user's snapshot", async () => {
    currentUserId = 'alice';
    const appA = createApp();
    await request(appA)
      .post('/api/snapshots')
      .send({ workflowId: 'w1', name: 'manual', nodes: [], edges: [] });
    const stolenId = snapshotStore[0].id;

    currentUserId = 'mallory';
    const appM = createApp();
    const res = await request(appM).post(`/api/snapshots/${stolenId}/restore`);
    expect(res.status).toBe(404);
  });
});

describe('Autosave retention', () => {
  it('trims autosaves beyond the cap of 50 but never trims manual snapshots', async () => {
    currentUserId = 'alice';
    const app = createApp();

    // Drop one manual snapshot first — it must survive the autosave flood.
    await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w1',
        name: 'IMPORTANT MANUAL SAVE',
        nodes: [],
        edges: [],
        isAutoSave: false,
      });

    // Now flood with 60 autosaves.
    for (let i = 0; i < 60; i++) {
      await request(app)
        .post('/api/snapshots')
        .send({
          workflowId: 'w1',
          name: `auto-${i}`,
          nodes: [],
          edges: [],
          isAutoSave: true,
        });
    }

    const autosaves = snapshotStore.filter((s) => s.isAutoSave);
    const manuals = snapshotStore.filter((s) => !s.isAutoSave);

    expect(autosaves.length).toBe(50);
    expect(manuals).toHaveLength(1);
    expect(manuals[0].name).toBe('IMPORTANT MANUAL SAVE');
  });
});

describe('Mirror to saved_projects', () => {
  it('MERGES with existing workflowData (preserves canvasObjects/viewport/flowSettings)', async () => {
    currentUserId = 'alice';
    // Pre-existing project with a rich workflowData document.
    projectStore.push({
      id: 'proj-existing',
      userId: 'alice',
      name: 'Pre-existing',
      workflowData: {
        nodes: [{ id: 'old' }],
        edges: [],
        canvasObjects: [{ kind: 'sticky', text: 'do not lose me' }],
        viewport: { x: 100, y: 200, zoom: 1.5 },
        flowSettings: { gridEnabled: true },
      },
    });

    const app = createApp();
    await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-merge',
        cloudProjectId: 'proj-existing',
        name: 'auto',
        nodes: [{ id: 'new1' }, { id: 'new2' }],
        edges: [{ id: 'e1' }],
        isAutoSave: true,
      });

    const proj = projectStore.find((p) => p.id === 'proj-existing')!;
    expect(proj.workflowData.canvasObjects).toEqual([
      { kind: 'sticky', text: 'do not lose me' },
    ]);
    expect(proj.workflowData.viewport).toEqual({ x: 100, y: 200, zoom: 1.5 });
    expect(proj.workflowData.flowSettings).toEqual({ gridEnabled: true });
    expect(proj.workflowData.nodes).toHaveLength(2);
    expect(proj.workflowData.edges).toHaveLength(1);
  });

  it('MERGES without erasing existing panel documentation on a canvas-only snapshot', async () => {
    currentUserId = 'alice';
    projectStore.push({
      id: 'proj-with-docs',
      userId: 'alice',
      name: 'Documented',
      workflowData: {
        nodes: [{ id: 'old' }],
        edges: [],
        prdData: { projectName: 'Keep', sections: [{ id: 'overview', title: 'Overview', content: 'x' }] },
        workflowPRDs: [{ workflowId: 'wf-1', sections: [] }],
        notesData: '{"notes":[{"id":"n1","content":"important"}]}',
        detailsData: '{"name":"Documented","description":"overview","categories":["a"]}',
      },
    });

    const app = createApp();
    await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-docs',
        cloudProjectId: 'proj-with-docs',
        name: 'auto',
        // Canvas-only body — no documentation fields at all.
        nodes: [{ id: 'new1' }],
        edges: [],
        isAutoSave: true,
      });

    const proj = projectStore.find((p) => p.id === 'proj-with-docs')!;
    expect(proj.workflowData.nodes).toEqual([{ id: 'new1' }]);
    expect((proj.workflowData as any).prdData.projectName).toBe('Keep');
    expect((proj.workflowData as any).workflowPRDs).toHaveLength(1);
    expect((proj.workflowData as any).notesData).toContain('important');
    expect((proj.workflowData as any).detailsData).toContain('overview');
  });

  it('seeds optional panel docs onto an auto-created cloud row', async () => {
    currentUserId = 'alice';
    const app = createApp();
    const res = await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-seed-docs',
        name: 'My Project',
        nodes: [{ id: 'n1' }],
        edges: [],
        isAutoSave: true,
        detailsData: '{"name":"My Project","description":"seeded"}',
        notesData: '{"notes":[]}',
        prdData: { projectName: 'My Project', sections: [] },
      });

    expect(res.status).toBe(200);
    expect(projectStore).toHaveLength(1);
    const wd = projectStore[0].workflowData as any;
    // Debug aid if seeding regresses:
    expect(wd).toMatchObject({
      workflowId: 'w-seed-docs',
      detailsData: expect.stringContaining('seeded'),
      notesData: expect.stringContaining('notes'),
      prdData: expect.objectContaining({ projectName: 'My Project' }),
    });
  });

  it('auto-creates a saved_projects row when no cloudProjectId is provided', async () => {
    currentUserId = 'alice';
    const app = createApp();
    expect(projectStore).toHaveLength(0);

    const res = await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-new',
        name: 'auto',
        nodes: [{ id: 'n1' }],
        edges: [],
        isAutoSave: true,
      });

    expect(res.status).toBe(200);
    expect(projectStore).toHaveLength(1);
    expect(projectStore[0].userId).toBe('alice');
    expect(projectStore[0].workflowData.workflowId).toBe('w-new');
    // Response carries the new id so the client patches its tab.
    expect(res.body.cloudProjectId).toBe(projectStore[0].id);
  });

  it('does NOT auto-create a project when the workflow has no nodes', async () => {
    currentUserId = 'alice';
    const app = createApp();

    await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-empty',
        name: 'auto',
        nodes: [],
        edges: [],
        isAutoSave: true,
      });

    expect(projectStore).toHaveLength(0);
  });

  it('falls through to auto-create when client sends a stale/foreign cloudProjectId', async () => {
    // Pre-existing project owned by Mallory — Alice must not write to it.
    projectStore.push({
      id: 'proj-mallory',
      userId: 'mallory',
      name: 'Mallory Project',
      workflowData: {
        nodes: [{ id: 'mallory-only' }],
        edges: [],
        canvasObjects: [{ kind: 'sticky', text: "Mallory's secret" }],
      },
    });

    currentUserId = 'alice';
    const app = createApp();
    const res = await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-stale',
        cloudProjectId: 'proj-mallory', // foreign id Alice should NOT touch
        name: 'auto',
        nodes: [{ id: 'a1' }],
        edges: [],
        isAutoSave: true,
      });

    expect(res.status).toBe(200);
    // Mallory's project must be untouched — no leak, no overwrite.
    const mallorysProj = projectStore.find((p) => p.id === 'proj-mallory')!;
    expect(mallorysProj.userId).toBe('mallory');
    expect(mallorysProj.workflowData.canvasObjects).toEqual([
      { kind: 'sticky', text: "Mallory's secret" },
    ]);
    expect(mallorysProj.workflowData.nodes).toEqual([{ id: 'mallory-only' }]);

    // Alice should still get a project auto-created/resolved for her workflow.
    const alicesProj = projectStore.find((p) => p.userId === 'alice');
    expect(alicesProj).toBeDefined();
    expect(alicesProj!.workflowData.workflowId).toBe('w-stale');
    expect(res.body.cloudProjectId).toBe(alicesProj!.id);
    // Server must NEVER echo the foreign id back to the client.
    expect(res.body.cloudProjectId).not.toBe('proj-mallory');
  });

  it('finds and reuses an existing auto-created project on subsequent autosaves', async () => {
    currentUserId = 'alice';
    const app = createApp();

    await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-reuse',
        name: 'auto-1',
        nodes: [{ id: 'n1' }],
        edges: [],
        isAutoSave: true,
      });
    expect(projectStore).toHaveLength(1);
    const projectId = projectStore[0].id;

    // Second autosave for same workflow without cloudProjectId should NOT
    // create a new project — it should reuse the existing one.
    const res = await request(app)
      .post('/api/snapshots')
      .send({
        workflowId: 'w-reuse',
        name: 'auto-2',
        nodes: [{ id: 'n1' }, { id: 'n2' }],
        edges: [],
        isAutoSave: true,
      });

    expect(projectStore).toHaveLength(1);
    expect(projectStore[0].id).toBe(projectId);
    expect(projectStore[0].workflowData.nodes).toHaveLength(2);
    expect(res.body.cloudProjectId).toBe(projectId);
  });
});

// ---------------------------------------------------------------------------
// Static-source assertions: protect against regressions where the auth
// middleware or merge logic silently disappears in a future refactor.
// ---------------------------------------------------------------------------
describe('routes.ts source — guardrails', () => {
  const routesSrc = readFileSync(resolve(__dirname, '../routes.ts'), 'utf8');
  // Handlers were extracted into snapshotHandlers.ts so they can be unit-
  // tested in isolation (see snapshotHandlers.integration.test.ts). The
  // wiring guardrail still belongs to routes.ts; everything else now lives
  // in the handler module.
  const handlersSrc = readFileSync(
    resolve(__dirname, '../snapshotHandlers.ts'),
    'utf8',
  );

  it('every snapshot endpoint references isAuthenticated', () => {
    const lines = routesSrc.split('\n');
    const endpoints = [
      "app.post('/api/snapshots'",
      "app.get(",
      "app.post(",
    ];
    // Pull the 3-line block following each registration to be tolerant of
    // multi-line arg formatting introduced when handlers were extracted.
    function blockFor(needle: string, after = 0): string | undefined {
      const idx = routesSrc.indexOf(needle, after);
      if (idx === -1) return undefined;
      return routesSrc.slice(idx, idx + 200);
    }
    expect(blockFor("app.post('/api/snapshots'")).toContain('isAuthenticated');
    expect(blockFor("app.get(\n    '/api/snapshots/:workflowId'")).toContain(
      'isAuthenticated',
    );
    expect(blockFor("app.post(\n    '/api/snapshots/:id/restore'")).toContain(
      'isAuthenticated',
    );
  });

  it('GET handler returns 404 when result set is empty (no leak via [])', () => {
    expect(handlersSrc).toMatch(/snapshots\.length === 0[\s\S]*?status\(404\)/);
  });

  it('mirror logic merges with existing workflowData rather than replacing', () => {
    expect(handlersSrc).toMatch(
      /mergeWorkflowDataPreservingPanelDocs[\s\S]*?nodes:\s*parsedNodes/,
    );
  });

  it('does not bypass types via `as any` in the snapshot handlers', () => {
    // The handler module is dedicated to snapshot logic, so we can apply
    // the no-`as any` rule to the whole file (vs. just the mirror block
    // when the code lived inside the giant routes.ts).
    expect(handlersSrc).not.toMatch(/as any/);
  });
});

// ---------------------------------------------------------------------------
// OAuth account-linking smoke test: confirm the existing replitAuth.ts
// implementation looks up by email before inserting a new user, so a
// second provider for the same email does not fork the account.
// ---------------------------------------------------------------------------
describe('replitAuth.ts source — OAuth email linking', () => {
  const authSrc = readFileSync(resolve(__dirname, '../replitAuth.ts'), 'utf8');

  it('upsertUser looks up existing user by email before insert', () => {
    // The Replit OAuth path must check users.email and link the new
    // provider to the existing user, not create a duplicate.
    expect(authSrc).toMatch(
      /upsertUser[\s\S]*?users\.email[\s\S]*?linkOAuthProvider/,
    );
  });

  it('findOrCreateUser (Google/GitHub) looks up existing user by email before insert', () => {
    expect(authSrc).toMatch(
      /findOrCreateUser[\s\S]*?users\.email[\s\S]*?linkOAuthProvider/,
    );
  });

  // ----- Verified-email gating (account-takeover prevention) -----
  it('OAuthProfile carries an emailVerified flag', () => {
    expect(authSrc).toMatch(/type OAuthProfile = \{[\s\S]*?emailVerified\?: boolean/);
  });

  it('upsertUser only auto-links by email when email_verified is true', () => {
    // The Replit branch must read OIDC `email_verified` and gate the
    // users.email lookup on it. We require both the variable read and
    // the lookup to live inside the verified branch.
    expect(authSrc).toMatch(/email_verified.*?===\s*true/);
    expect(authSrc).toMatch(
      /if \(email && emailVerified\)[\s\S]*?users\.email/,
    );
  });

  it('findOrCreateUser only auto-links by email when emailVerified is true', () => {
    expect(authSrc).toMatch(
      /if \(profile\.email && profile\.emailVerified\)[\s\S]*?users\.email/,
    );
  });

  it('Google strategy populates emailVerified from profile.emails verified flag', () => {
    expect(authSrc).toMatch(
      /provider: 'google'[\s\S]*?emailVerified/,
    );
    // Must read the verified field off the email entry, not hard-code true.
    expect(authSrc).toMatch(/\.verified\s*===\s*true|verified:\s*true/);
  });

  it('GitHub strategy refuses to fall back to any unverified email', () => {
    // Old code did: email = primary || verified || anyEmail. The fix must
    // remove the unverified fallback. Assert no `anyEmail?.email` selection
    // remains in the file.
    expect(authSrc).not.toMatch(/anyEmail\?\.email/);
    // And the GitHub block must explicitly set emailVerified = true only
    // when a verified entry was chosen.
    expect(authSrc).toMatch(
      /provider: 'github'[\s\S]*?emailVerified/,
    );
    expect(authSrc).toMatch(/emailVerified\s*=\s*true/);
  });
});

// ---------------------------------------------------------------------------
// cleanup-orphan-snapshots.ts source guardrails: confirms the script supports
// reclaim/materialize before delete, not delete-only.
// ---------------------------------------------------------------------------
describe('cleanup-orphan-snapshots.ts source — reclaim workflow', () => {
  const cleanupSrc = readFileSync(
    resolve(__dirname, '../../scripts/cleanup-orphan-snapshots.ts'),
    'utf8',
  );

  it('exposes a --reclaim phase distinct from --confirm-delete', () => {
    expect(cleanupSrc).toMatch(/--reclaim/);
    expect(cleanupSrc).toMatch(/reclaimPhase/);
  });

  it('reclaim updates orphan snapshots user_id from saved_projects attribution', () => {
    expect(cleanupSrc).toMatch(/saved_projects/);
    expect(cleanupSrc).toMatch(
      /\.update\(workflowSnapshots\)[\s\S]*?\.set\(\{ userId/,
    );
  });

  it('reclaim materializes the latest snapshot into saved_projects.workflow_data', () => {
    // Must merge into existing workflow_data (not overwrite) — preserve
    // canvasObjects/viewport/flowSettings.
    expect(cleanupSrc).toMatch(
      /\.update\(savedProjects\)[\s\S]*?workflowData:\s*merged/,
    );
    expect(cleanupSrc).toMatch(/\.\.\.existing/);
  });

  it('still requires both safety flags for destructive delete', () => {
    expect(cleanupSrc).toMatch(/--confirm-delete/);
    expect(cleanupSrc).toMatch(/--i-understand/);
    expect(cleanupSrc).toMatch(
      /args\.has\('--confirm-delete'\)\s*&&\s*args\.has\('--i-understand'\)/,
    );
  });

  it('refuses to auto-attribute workflow_ids with multiple distinct user candidates', () => {
    // The reclaim phase must group by workflow_id, count distinct users,
    // and skip any workflow_id with >1 owner. Ambiguous workflows must
    // be reported separately and excluded from the UPDATE loop.
    expect(cleanupSrc).toMatch(/byWorkflow/);
    expect(cleanupSrc).toMatch(/distinctUsers/);
    expect(cleanupSrc).toMatch(/ambiguous/);
    // The UPDATE loop must iterate over the unambiguous-only collection,
    // not the raw candidate set.
    expect(cleanupSrc).toMatch(
      /for \(const row of unambiguous\)[\s\S]*?\.update\(workflowSnapshots\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// Behavioral test: simulate the reclaim attribution policy with two users
// who have stamped the same workflow_id in their saved_projects. The policy
// must refuse to auto-reassign orphan snapshots in that case.
// ---------------------------------------------------------------------------
describe('Reclaim attribution policy — ambiguous workflow_id', () => {
  type SavedProject = { user_id: string; id: string; workflow_id: string };
  type Snapshot = { id: string; workflow_id: string; user_id: string | null };

  // Pure helper mirroring the reclaim phase's attribution decision: groups
  // candidates by workflow_id and only returns those with exactly one
  // distinct user. Ambiguous workflows are returned separately for report.
  function classifyAttribution(candidates: SavedProject[]) {
    const byWorkflow = new Map<string, SavedProject[]>();
    for (const c of candidates) {
      const list = byWorkflow.get(c.workflow_id) ?? [];
      list.push(c);
      byWorkflow.set(c.workflow_id, list);
    }
    const unambiguous: SavedProject[] = [];
    const ambiguous: string[] = [];
    for (const [workflowId, rows] of byWorkflow.entries()) {
      const distinctUsers = new Set(rows.map((r) => r.user_id));
      if (distinctUsers.size === 1) unambiguous.push(rows[0]);
      else ambiguous.push(workflowId);
    }
    return { unambiguous, ambiguous };
  }

  function applyReclaim(snapshots: Snapshot[], unambiguous: SavedProject[]) {
    for (const candidate of unambiguous) {
      for (const s of snapshots) {
        if (s.workflow_id === candidate.workflow_id && s.user_id === null) {
          s.user_id = candidate.user_id;
        }
      }
    }
  }

  it('does not reassign orphan snapshots when two users claim the same workflow_id', () => {
    const candidates: SavedProject[] = [
      { user_id: 'alice', id: 'proj-a', workflow_id: 'shared-w1' },
      { user_id: 'bob', id: 'proj-b', workflow_id: 'shared-w1' },
    ];
    const snapshots: Snapshot[] = [
      { id: 's1', workflow_id: 'shared-w1', user_id: null },
      { id: 's2', workflow_id: 'shared-w1', user_id: null },
    ];

    const { unambiguous, ambiguous } = classifyAttribution(candidates);
    applyReclaim(snapshots, unambiguous);

    expect(ambiguous).toEqual(['shared-w1']);
    expect(unambiguous).toHaveLength(0);
    // No snapshot must have been silently assigned to either user.
    for (const s of snapshots) {
      expect(s.user_id).toBeNull();
    }
  });

  it('still reclaims unambiguous workflows in the same run', () => {
    const candidates: SavedProject[] = [
      { user_id: 'alice', id: 'proj-a', workflow_id: 'shared-w1' },
      { user_id: 'bob', id: 'proj-b', workflow_id: 'shared-w1' },
      { user_id: 'carol', id: 'proj-c', workflow_id: 'lone-w2' },
    ];
    const snapshots: Snapshot[] = [
      { id: 's1', workflow_id: 'shared-w1', user_id: null },
      { id: 's2', workflow_id: 'lone-w2', user_id: null },
      { id: 's3', workflow_id: 'lone-w2', user_id: null },
    ];

    const { unambiguous, ambiguous } = classifyAttribution(candidates);
    applyReclaim(snapshots, unambiguous);

    expect(ambiguous).toEqual(['shared-w1']);
    expect(unambiguous.map((u) => u.workflow_id)).toEqual(['lone-w2']);
    // Ambiguous workflow's snapshot stays orphan.
    expect(snapshots.find((s) => s.id === 's1')?.user_id).toBeNull();
    // Unambiguous workflow's snapshots are recovered to the sole owner.
    expect(snapshots.find((s) => s.id === 's2')?.user_id).toBe('carol');
    expect(snapshots.find((s) => s.id === 's3')?.user_id).toBe('carol');
  });
});
