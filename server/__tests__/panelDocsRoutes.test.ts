/**
 * Integration tests for PUT /api/project/:projectUuid/panel-docs —
 * the canvas-independent persistence path for notes / overview.
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
  updatedAt: Date;
};

const projectStore: FakeProject[] = [];
const broadcasts: Array<{ shareId: string; data: any }> = [];

vi.mock('../storage', () => {
  const storage = {
    async getProjectByProjectUuid(projectUuid: string) {
      return projectStore.find((p) => p.projectUuid === projectUuid) ?? null;
    },
    async updateSavedProject(id: string, userId: string, patch: Partial<FakeProject>) {
      const proj = projectStore.find((p) => p.id === id && p.userId === userId);
      if (!proj) return null;
      Object.assign(proj, patch);
      proj.updatedAt = new Date();
      return proj;
    },
    async mutateProjectWorkflowData(
      projectUuid: string,
      userId: string,
      mutate: (workflowData: any) => any,
    ) {
      const proj = projectStore.find((p) => p.projectUuid === projectUuid);
      if (!proj) return { status: 'notFound' as const };
      if (proj.userId !== userId) return { status: 'forbidden' as const };
      proj.workflowData = mutate(proj.workflowData);
      proj.updatedAt = new Date();
      return { status: 'ok' as const, project: proj };
    },
  };
  return { storage };
});

vi.mock('../replitAuth', () => ({
  isAuthenticated: (req: Request, res: Response, next: NextFunction) => {
    const userId = req.header('x-test-user');
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    (req as any).user = { claims: { sub: userId } };
    next();
  },
}));

async function loadApp() {
  const { registerDocumentRoutes } = await import('../documentRoutes');
  const app = express();
  app.use(express.json());
  (app as any).broadcastShareUpdate = (shareId: string, data: any) => {
    broadcasts.push({ shareId, data });
  };
  registerDocumentRoutes(app);
  return app;
}

beforeEach(() => {
  projectStore.length = 0;
  broadcasts.length = 0;
});

describe('PUT /api/project/:projectUuid/panel-docs', () => {
  it('persists notes and details without touching canvas nodes', async () => {
    const app = await loadApp();
    const projectUuid = crypto.randomUUID();
    projectStore.push({
      id: 'proj-1',
      userId: 'alice',
      projectUuid,
      shareUuid: crypto.randomUUID(),
      isShareEnabled: true,
      name: 'Original',
      description: null,
      workflowData: {
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1' }],
        prdData: { projectName: 'Original', sections: [] },
      },
      updatedAt: new Date(),
    });

    const notesData = JSON.stringify({ notes: [{ id: 'n', content: 'hello' }] });
    const detailsData = JSON.stringify({ name: 'Renamed', description: 'overview' });

    const res = await request(app)
      .put(`/api/project/${projectUuid}/panel-docs`)
      .set('x-test-user', 'alice')
      .send({ notesData, detailsData, name: 'Renamed', description: 'overview' });

    expect(res.status).toBe(200);
    expect(res.body.notesData).toBe(notesData);
    expect(res.body.detailsData).toBe(detailsData);
    expect(res.body.name).toBe('Renamed');

    const proj = projectStore[0];
    expect(proj.workflowData.nodes).toEqual([{ id: 'n1' }]);
    expect(proj.workflowData.edges).toEqual([{ id: 'e1' }]);
    expect(proj.workflowData.prdData.projectName).toBe('Original');
    expect(proj.workflowData.notesData).toBe(notesData);
    expect(proj.name).toBe('Renamed');

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].shareId).toBe(proj.shareUuid);
    expect(broadcasts[0].data.notesData).toBe(notesData);
    expect(broadcasts[0].data.detailsData).toBe(detailsData);
    expect(broadcasts[0].data.prdData.projectName).toBe('Original');
  });

  it('rejects unauthenticated callers', async () => {
    const app = await loadApp();
    const res = await request(app)
      .put(`/api/project/${crypto.randomUUID()}/panel-docs`)
      .send({ notesData: '{}' });
    expect(res.status).toBe(401);
  });

  it('forbids non-owners', async () => {
    const app = await loadApp();
    const projectUuid = crypto.randomUUID();
    projectStore.push({
      id: 'proj-1',
      userId: 'alice',
      projectUuid,
      shareUuid: null,
      isShareEnabled: false,
      name: 'X',
      description: null,
      workflowData: { nodes: [] },
      updatedAt: new Date(),
    });

    const res = await request(app)
      .put(`/api/project/${projectUuid}/panel-docs`)
      .set('x-test-user', 'bob')
      .send({ notesData: '{}' });
    expect(res.status).toBe(403);
  });
});
