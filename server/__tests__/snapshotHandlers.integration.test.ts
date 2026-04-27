/**
 * Integration test for the REAL snapshot route handlers (not a re-
 * implementation). Imports server/snapshotHandlers.ts, mounts it on a
 * fresh Express app with a stub auth middleware, and uses supertest to
 * exercise the full request/response cycle. db, storage, and drizzle-orm
 * are mocked at the module level so we never touch the real database.
 *
 * This complements the wider behavioral test in snapshots.test.ts —
 * the inline test there documents intended behavior for many edge cases;
 * this file confirms the actual production handler matches it end-to-end
 * for the highest-value paths (auth gating, user scoping, mirror auto-
 * create, stale cloudProjectId fallback, restore 404).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import request from 'supertest';

type FakeSnapshot = {
  id: string;
  workflowId: string;
  userId: string | null;
  name: string;
  description?: string;
  nodes?: unknown;
  edges?: unknown;
  metadata?: unknown;
  isAutoSave: boolean;
  createdAt: Date;
};

type FakeProject = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  workflowData: any;
  updatedAt: Date;
};

const snapshotStore: FakeSnapshot[] = [];
const projectStore: FakeProject[] = [];
let nextSnapshotId = 1;
let nextProjectId = 1;

// ---- drizzle-orm mock -----------------------------------------------------
// Replace the predicate helpers with plain JS values that our db mock can
// inspect. The shape `{ __op, col, val }` is opaque to the handler (it just
// passes them through) but lets the mock evaluate filters against rows.
vi.mock('drizzle-orm', () => {
  const eq = (col: any, val: any) => ({
    __op: 'eq',
    col: col?.name ?? String(col),
    val,
  });
  const and = (...preds: any[]) => ({ __op: 'and', preds });
  const desc = (col: any) => ({ __op: 'desc', col });
  const inArray = (col: any, vals: any[]) => ({
    __op: 'inArray',
    col: col?.name ?? String(col),
    vals,
  });
  return { eq, and, desc, inArray };
});

// Schema mock returns plain objects with a .name marker so eq() above can
// stringify them deterministically.
vi.mock('../../shared/schema', () => {
  const col = (n: string) => ({ name: n });
  return {
    workflowSnapshots: {
      id: col('id'),
      workflowId: col('workflowId'),
      userId: col('userId'),
      isAutoSave: col('isAutoSave'),
      createdAt: col('createdAt'),
    },
  };
});

// Predicate evaluator: walks the {__op, ...} tree and returns true/false
// for a row.
function evalPred(pred: any, row: FakeSnapshot): boolean {
  if (!pred || typeof pred !== 'object') return true;
  if (pred.__op === 'and') return pred.preds.every((p: any) => evalPred(p, row));
  if (pred.__op === 'eq') return (row as any)[pred.col] === pred.val;
  if (pred.__op === 'inArray') return pred.vals.includes((row as any)[pred.col]);
  return true;
}

// ---- db mock --------------------------------------------------------------
vi.mock('../db', () => {
  function makeInsertChain() {
    const chain: any = {
      _values: null,
      values(v: any) {
        this._values = v;
        return this;
      },
      async returning() {
        const row: FakeSnapshot = {
          id: `snap-${nextSnapshotId++}`,
          workflowId: this._values.workflowId,
          userId: this._values.userId ?? null,
          name: this._values.name,
          description: this._values.description,
          nodes: this._values.nodes,
          edges: this._values.edges,
          metadata: this._values.metadata,
          isAutoSave: !!this._values.isAutoSave,
          createdAt: new Date(),
        };
        snapshotStore.push(row);
        return [row];
      },
    };
    return chain;
  }

  function makeSelectChain(selection?: any) {
    const chain: any = {
      _selection: selection,
      _pred: null,
      _offset: 0,
      from(_t: any) {
        return this;
      },
      where(p: any) {
        this._pred = p;
        return this;
      },
      orderBy(_o: any) {
        return this;
      },
      offset(n: number) {
        this._offset = n;
        return this._resolve();
      },
      then(onFulfilled: any, onRejected: any) {
        return this._resolve().then(onFulfilled, onRejected);
      },
      async _resolve() {
        let rows = snapshotStore.filter((r) => evalPred(this._pred, r));
        rows = [...rows].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );
        if (this._offset > 0) rows = rows.slice(this._offset);
        if (this._selection && this._selection.id) {
          return rows.map((r) => ({ id: r.id }));
        }
        return rows;
      },
    };
    return chain;
  }

  function makeDeleteChain() {
    return {
      async where(pred: any) {
        const before = snapshotStore.length;
        for (let i = snapshotStore.length - 1; i >= 0; i--) {
          if (evalPred(pred, snapshotStore[i])) snapshotStore.splice(i, 1);
        }
        return { rowCount: before - snapshotStore.length };
      },
    };
  }

  const db = {
    insert: () => makeInsertChain(),
    select: (s?: any) => makeSelectChain(s),
    delete: () => makeDeleteChain(),
  };
  return { db };
});

// ---- storage mock ---------------------------------------------------------
vi.mock('../storage', () => {
  const storage = {
    async getSavedProject(projectId: string, userId: string) {
      return (
        projectStore.find((p) => p.id === projectId && p.userId === userId) ??
        null
      );
    },
    async getSavedProjects(userId: string) {
      return projectStore.filter((p) => p.userId === userId);
    },
    async updateSavedProject(
      projectId: string,
      userId: string,
      patch: Partial<FakeProject>,
    ) {
      const proj = projectStore.find(
        (p) => p.id === projectId && p.userId === userId,
      );
      if (!proj) return null;
      Object.assign(proj, patch, { updatedAt: new Date() });
      return proj;
    },
    async createSavedProject(values: Omit<FakeProject, 'id' | 'updatedAt'>) {
      const proj: FakeProject = {
        id: `proj-${nextProjectId++}`,
        updatedAt: new Date(),
        ...values,
      };
      projectStore.push(proj);
      return proj;
    },
  };
  return { storage };
});

// ---- harness --------------------------------------------------------------
function stubAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.header('x-test-user');
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  (req as any).user = { claims: { sub: userId } };
  next();
}

async function loadHandlersAndApp() {
  const handlers = await import('../snapshotHandlers');
  const app = express();
  app.use(express.json());
  app.post('/api/snapshots', stubAuth, handlers.createSnapshotHandler);
  app.get(
    '/api/snapshots/:workflowId',
    stubAuth,
    handlers.listSnapshotsHandler,
  );
  app.post(
    '/api/snapshots/:id/restore',
    stubAuth,
    handlers.restoreSnapshotHandler,
  );
  return { app, handlers };
}

beforeEach(() => {
  snapshotStore.length = 0;
  projectStore.length = 0;
  nextSnapshotId = 1;
  nextProjectId = 1;
});

describe('snapshotHandlers — real handler integration', () => {
  it('POST /api/snapshots requires auth (no x-test-user → 401)', async () => {
    const { app } = await loadHandlersAndApp();
    const res = await request(app).post('/api/snapshots').send({
      workflowId: 'w1',
      name: 'auto',
      nodes: [],
      edges: [],
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/snapshots stamps userId from session, not body', async () => {
    const { app } = await loadHandlersAndApp();
    const res = await request(app)
      .post('/api/snapshots')
      .set('x-test-user', 'alice')
      .send({
        workflowId: 'w1',
        // Attempt to spoof another user via body — must be ignored.
        userId: 'mallory',
        name: 'auto',
        nodes: [{ id: 'n1' }],
        edges: [],
        isAutoSave: true,
      });
    expect(res.status).toBe(200);
    expect(snapshotStore).toHaveLength(1);
    expect(snapshotStore[0].userId).toBe('alice');
  });

  it('POST /api/snapshots auto-creates a saved_project for a fresh workflow', async () => {
    const { app } = await loadHandlersAndApp();
    const res = await request(app)
      .post('/api/snapshots')
      .set('x-test-user', 'alice')
      .send({
        workflowId: 'w-fresh',
        name: 'auto',
        nodes: [{ id: 'n1' }],
        edges: [],
        isAutoSave: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.cloudProjectId).toBeTruthy();
    const proj = projectStore.find((p) => p.id === res.body.cloudProjectId);
    expect(proj?.userId).toBe('alice');
    expect(proj?.workflowData.workflowId).toBe('w-fresh');
  });

  it('POST /api/snapshots falls through to a fresh project when a foreign cloudProjectId is supplied', async () => {
    const { app } = await loadHandlersAndApp();
    // Mallory's pre-existing project — Alice must NOT touch it.
    projectStore.push({
      id: 'proj-mallory',
      userId: 'mallory',
      name: 'Mallory',
      workflowData: { canvasObjects: [{ kind: 'sticky', text: 'private' }] },
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/snapshots')
      .set('x-test-user', 'alice')
      .send({
        workflowId: 'w-stale',
        cloudProjectId: 'proj-mallory',
        name: 'auto',
        nodes: [{ id: 'a1' }],
        edges: [],
        isAutoSave: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.cloudProjectId).not.toBe('proj-mallory');

    const mallorys = projectStore.find((p) => p.id === 'proj-mallory')!;
    expect(mallorys.workflowData.canvasObjects).toEqual([
      { kind: 'sticky', text: 'private' },
    ]);

    const alices = projectStore.find((p) => p.userId === 'alice');
    expect(alices?.id).toBe(res.body.cloudProjectId);
  });

  it('GET /api/snapshots/:workflowId returns 404 when caller has no rows for this workflow', async () => {
    const { app } = await loadHandlersAndApp();
    snapshotStore.push({
      id: 's1',
      workflowId: 'w-bob',
      userId: 'bob',
      name: 'snap',
      isAutoSave: false,
      createdAt: new Date(),
    });
    const res = await request(app)
      .get('/api/snapshots/w-bob')
      .set('x-test-user', 'alice');
    expect(res.status).toBe(404);
  });

  it('GET /api/snapshots/:workflowId returns the caller-owned snapshots', async () => {
    const { app } = await loadHandlersAndApp();
    snapshotStore.push({
      id: 's1',
      workflowId: 'w-shared',
      userId: 'alice',
      name: 'mine',
      isAutoSave: false,
      createdAt: new Date(),
    });
    snapshotStore.push({
      id: 's2',
      workflowId: 'w-shared',
      userId: 'bob',
      name: 'bobs',
      isAutoSave: false,
      createdAt: new Date(),
    });
    const res = await request(app)
      .get('/api/snapshots/w-shared')
      .set('x-test-user', 'alice');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('s1');
  });

  it('POST /api/snapshots/:id/restore returns 404 for cross-user restore attempt', async () => {
    const { app } = await loadHandlersAndApp();
    snapshotStore.push({
      id: 's1',
      workflowId: 'w-bob',
      userId: 'bob',
      name: 'bobs',
      isAutoSave: false,
      createdAt: new Date(),
    });
    const res = await request(app)
      .post('/api/snapshots/s1/restore')
      .set('x-test-user', 'alice');
    expect(res.status).toBe(404);
  });

  it('POST /api/snapshots/:id/restore returns the snapshot for its owner', async () => {
    const { app } = await loadHandlersAndApp();
    snapshotStore.push({
      id: 's1',
      workflowId: 'w-alice',
      userId: 'alice',
      name: 'mine',
      isAutoSave: false,
      createdAt: new Date(),
    });
    const res = await request(app)
      .post('/api/snapshots/s1/restore')
      .set('x-test-user', 'alice');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('s1');
  });
});
