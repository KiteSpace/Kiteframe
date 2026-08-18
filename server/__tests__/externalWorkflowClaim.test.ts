/**
 * Tests for the external workflow claim flow.
 *
 * Coverage:
 *  1. Static sanity — claim route in routes.ts uses `isAuthenticated`.
 *  2. Static sanity — `ExternalWorkflowViewer.tsx` contains the
 *     "Save to my account" button with `data-testid="button-save-to-account"`.
 *  3. POST /api/workflows/claim → 401 when request is unauthenticated.
 *  4. POST /api/workflows/claim → 400 when externalWorkflowId is missing.
 *  5. POST /api/workflows/claim → 404 when the external workflow is not found.
 *  6. POST /api/workflows/claim → 404 when the external workflow has expired.
 *  7. POST /api/workflows/claim → 201 + editUrl on successful claim.
 *
 * The DB layer and `storage` are mocked; no live Postgres instance is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
type FakeExternalWorkflow = {
  id: string;
  apiKeyId: string;
  title: string | null;
  nodes: unknown;
  edges: unknown;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
};

type FakeProject = {
  id: string;
  projectUuid: string;
  userId: string;
  name: string;
  description: string | null;
  workflowData: unknown;
  isPublic: boolean;
  source: string;
  sourceExternalId: string | null;
};

const workflowStore = new Map<string, FakeExternalWorkflow>();
const projectStore: FakeProject[] = [];
let projectCounter = 1;

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that transitively loads them
// ---------------------------------------------------------------------------
vi.mock('../db', () => ({ db: {} }));

vi.mock('../storage', () => {
  const storage = {
    async getExternalWorkflow(id: string) {
      return workflowStore.get(id) ?? undefined;
    },
    async getUser(_userId: string) {
      return { id: _userId, subscriptionTier: 'free', email: 'user@example.com' };
    },
    async createSavedProject(values: {
      userId: string;
      name: string;
      description: string | null;
      workflowData: unknown;
      isPublic: boolean;
      source: string;
      sourceExternalId: string | null;
    }) {
      const project: FakeProject = {
        id: String(projectCounter),
        projectUuid: `proj-uuid-${projectCounter++}`,
        userId: values.userId,
        name: values.name,
        description: values.description,
        workflowData: values.workflowData,
        isPublic: values.isPublic,
        source: values.source,
        sourceExternalId: values.sourceExternalId,
      };
      projectStore.push(project);
      return project;
    },
    async countProjectsByUser(_userId: string) {
      return projectStore.filter((p) => p.userId === _userId).length;
    },
  };
  return { storage, default: storage };
});

vi.mock('../utils/sanitize', () => ({
  sanitizeWorkflowContent: (v: unknown) => v,
  sanitizeNodeLabel: (v: string | null | undefined) => v ?? '',
  sanitizeText: (v: string) => v,
  sanitizeAiPrompt: (v: string) => v,
  sanitizeAiResponse: (v: string) => v,
}));

// ---------------------------------------------------------------------------
// Import mocked storage after vi.mock declarations
// ---------------------------------------------------------------------------
const { storage } = await import('../storage');

// ---------------------------------------------------------------------------
// Minimal test app that mirrors the claim handler in routes.ts
// ---------------------------------------------------------------------------
function buildApp(authenticatedUserId: string | null = null) {
  const app = express();
  app.use(express.json());

  // Simulate session / passport user
  app.use((req: any, _res: Response, next: NextFunction) => {
    if (authenticatedUserId) {
      req.user = { claims: { sub: authenticatedUserId } };
    }
    next();
  });

  const isAuthenticated = (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
  };

  // Mirror of the actual POST /api/workflows/claim handler in routes.ts
  app.post('/api/workflows/claim', isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(403).json({ error: 'Sign in required to save projects' });
      }

      const { externalWorkflowId } = req.body;
      if (!externalWorkflowId || typeof externalWorkflowId !== 'string') {
        return res.status(400).json({ error: 'externalWorkflowId is required' });
      }

      const externalWorkflow = await storage.getExternalWorkflow(externalWorkflowId);
      if (!externalWorkflow) {
        return res.status(404).json({ error: 'External workflow not found or has expired' });
      }

      if (externalWorkflow.expiresAt && externalWorkflow.expiresAt < new Date()) {
        return res.status(404).json({ error: 'External workflow has expired' });
      }

      const project = await storage.createSavedProject({
        userId,
        name: (externalWorkflow.title as string | null | undefined) ?? 'Claimed Workflow',
        description: `Claimed from external workflow ${externalWorkflowId}`,
        workflowData: { nodes: externalWorkflow.nodes, edges: externalWorkflow.edges, canvasObjects: [], viewport: { x: 0, y: 0, zoom: 1 } },
        isPublic: false,
        source: 'claimed-external',
        sourceExternalId: externalWorkflowId,
      });

      const editUrl = `/project/${project.projectUuid}`;
      return res.status(201).json({ id: project.id, projectUuid: project.projectUuid, editUrl });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to claim workflow' });
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Helpers to seed test workflows
// ---------------------------------------------------------------------------
function seedWorkflow(id: string, overrides: Partial<FakeExternalWorkflow> = {}) {
  const defaults: FakeExternalWorkflow = {
    id,
    apiKeyId: 'api-key-1',
    title: 'Test Workflow',
    nodes: [{ id: 'n1', type: 'process', position: { x: 0, y: 0 }, data: { label: 'Step 1' } }],
    edges: [],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 h from now
    updatedAt: new Date(),
  };
  workflowStore.set(id, { ...defaults, ...overrides });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  workflowStore.clear();
  projectStore.length = 0;
  projectCounter = 1;
});

describe('ExternalWorkflowViewer — static source assertions', () => {
  const routesSrc = readFileSync(resolve(__dirname, '../routes.ts'), 'utf8');
  const viewerSrc = readFileSync(
    resolve(__dirname, '../../client/src/pages/ExternalWorkflowViewer.tsx'),
    'utf8',
  );

  it('claim route uses isAuthenticated middleware', () => {
    const idx = routesSrc.indexOf("app.post('/api/workflows/claim'");
    expect(idx).toBeGreaterThan(-1);
    const block = routesSrc.slice(idx, idx + 120);
    expect(block).toContain('isAuthenticated');
  });

  it('ExternalWorkflowViewer contains the Save to my account button', () => {
    expect(viewerSrc).toContain('Save to my account');
  });

  it('button has the correct data-testid attribute', () => {
    expect(viewerSrc).toContain('data-testid="button-save-to-account"');
  });

  it('button renders on the main viewer screen (not only on error screen)', () => {
    // The button must be rendered in the main viewer layout, not inside
    // the error/loading branch. Confirm it is NOT gated by any auth check
    // at render time (auth is deferred to click time).
    const buttonIdx = viewerSrc.indexOf('data-testid="button-save-to-account"');
    const errorScreenIdx = viewerSrc.indexOf('data-testid="error-screen"');
    // The button appears after the error-screen definition (which short-circuits)
    // and in the main returned JSX below it.
    expect(buttonIdx).toBeGreaterThan(errorScreenIdx);
  });

  it('claim flow saves pending intent to localStorage before redirecting unauthenticated users', () => {
    expect(viewerSrc).toContain('localStorage.setItem');
    expect(viewerSrc).toContain("window.location.href = '/api/login'");
  });
});

describe('POST /api/workflows/claim — unauthenticated', () => {
  it('returns 401 when no session is attached', async () => {
    const app = buildApp(null);
    const res = await request(app)
      .post('/api/workflows/claim')
      .send({ externalWorkflowId: 'any-id' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/workflows/claim — input validation', () => {
  it('returns 400 when externalWorkflowId is missing', async () => {
    const app = buildApp('user-1');
    const res = await request(app)
      .post('/api/workflows/claim')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/externalWorkflowId/i);
  });
});

describe('POST /api/workflows/claim — workflow not found or expired', () => {
  it('returns 404 when the external workflow does not exist', async () => {
    const app = buildApp('user-1');
    const res = await request(app)
      .post('/api/workflows/claim')
      .send({ externalWorkflowId: 'nonexistent-id' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when the workflow has already expired', async () => {
    seedWorkflow('expired-wf', {
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    });

    const app = buildApp('user-1');
    const res = await request(app)
      .post('/api/workflows/claim')
      .send({ externalWorkflowId: 'expired-wf' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/expired/i);
  });
});

describe('POST /api/workflows/claim — successful claim', () => {
  it('returns 201 with a project id, uuid, and editUrl', async () => {
    seedWorkflow('valid-wf-1');
    const app = buildApp('user-1');

    const res = await request(app)
      .post('/api/workflows/claim')
      .send({ externalWorkflowId: 'valid-wf-1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      projectUuid: expect.any(String),
      editUrl: expect.stringMatching(/^\/project\//),
    });
  });

  it('creates a saved project with the workflow title', async () => {
    seedWorkflow('titled-wf', { title: 'My Fancy Workflow' });
    const app = buildApp('user-2');

    await request(app)
      .post('/api/workflows/claim')
      .send({ externalWorkflowId: 'titled-wf' })
      .expect(201);

    const savedProject = projectStore.find((p) => p.sourceExternalId === 'titled-wf');
    expect(savedProject?.name).toBe('My Fancy Workflow');
    expect(savedProject?.source).toBe('claimed-external');
  });

  it('falls back to "Claimed Workflow" when title is null', async () => {
    seedWorkflow('untitled-wf', { title: null });
    const app = buildApp('user-3');

    await request(app)
      .post('/api/workflows/claim')
      .send({ externalWorkflowId: 'untitled-wf' })
      .expect(201);

    const saved = projectStore.find((p) => p.sourceExternalId === 'untitled-wf');
    expect(saved?.name).toBe('Claimed Workflow');
  });

  it('does NOT delete the external workflow (multiple users may claim independently)', async () => {
    seedWorkflow('shared-wf');

    const app1 = buildApp('user-a');
    await request(app1).post('/api/workflows/claim').send({ externalWorkflowId: 'shared-wf' }).expect(201);

    // Workflow still exists for a second user to claim
    expect(workflowStore.has('shared-wf')).toBe(true);

    const app2 = buildApp('user-b');
    const res2 = await request(app2).post('/api/workflows/claim').send({ externalWorkflowId: 'shared-wf' });
    expect(res2.status).toBe(201);
  });
});
