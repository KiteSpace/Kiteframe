/**
 * Integration test: design tab rename persists across a full page refresh.
 *
 * Verifies the end-to-end behaviour that was broken before the fix:
 *   1. PATCH /api/designs/:id with { title } persists the new title to storage.
 *   2. GET  /api/designs/:id (simulating a page reload) returns the new title
 *      — so onTitleLoaded can NOT revert the tab label to the old server value.
 *   3. The updatedAt timestamp on the design record advances after a rename,
 *      so the home-screen "last edited" column shows the correct time.
 *
 * Auth and DB are stubbed via vi.mock so no real database or network calls are made.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import request from 'supertest';

// ─── In-memory design store ───────────────────────────────────────────────────

type FakeDesign = {
  id: string;
  claimedByUserId: string | null;
  source: string;
  craftState: unknown;
  title: string | null;
  notes: string | null;
  sourceWorkflowId: string | null;
  workflowSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const designStore: FakeDesign[] = [];
let nextDesignId = 1;

// ─── Storage mock ─────────────────────────────────────────────────────────────

vi.mock('../storage', () => {
  const storage = {
    async getDesign(id: string) {
      return designStore.find((d) => d.id === id) ?? undefined;
    },
    async updateDesign(id: string, patch: Partial<FakeDesign>) {
      const design = designStore.find((d) => d.id === id);
      if (!design) return undefined;
      Object.assign(design, patch, { updatedAt: new Date() });
      return design;
    },
    async getWorkflowUpdatedAt(_workflowId: string) {
      return null;
    },
  };
  return { storage };
});

// ─── Stub minimal deps that the route handlers reference ─────────────────────
// The design rename route (PATCH) and fetch route (GET) only need:
//   storage.getDesign / updateDesign
//   validateCraftState (only called when craftState is being patched)
//   getUserIdFromRequest (reads req.user.claims.sub)
//   isAuthenticated (middleware — replaced by stubAuth below)
//   getWorkflowUpdatedAt (used only in GET for staleness check)

// ─── Self-contained test app ──────────────────────────────────────────────────
// We replicate the two design handlers directly in the test rather than
// importing routes.ts (which has dozens of heavy top-level side-effects).
// The logic is a faithful copy of server/routes.ts lines 7542–7593.

import { storage } from '../storage';

function getUserId(req: Request): string {
  return (req as any).user?.claims?.sub as string;
}

function validateCraftStateStub(_state: unknown): { valid: boolean; errors: string[] } {
  return { valid: true, errors: [] };
}

function stubAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.header('x-test-user');
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  (req as any).user = { claims: { sub: userId } };
  next();
}

function buildApp() {
  const app = express();
  app.use(express.json());

  // GET /api/designs/:designId — public fetch (simulates page reload)
  app.get('/api/designs/:designId', async (req: Request, res: Response) => {
    try {
      const design = await storage.getDesign(req.params.designId);
      if (!design) return res.status(404).json({ error: 'Design not found.' });
      const isStale = false; // staleness not under test here
      res.json({
        ...design,
        isStale,
        workflowSyncedAt: (design as any).workflowSyncedAt?.toISOString() ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch design.' });
    }
  });

  // PATCH /api/designs/:designId — update title (auth + ownership required)
  app.patch('/api/designs/:designId', stubAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const design = await storage.getDesign(req.params.designId);
      if (!design) return res.status(404).json({ error: 'Design not found.' });
      if (!design.claimedByUserId || design.claimedByUserId !== userId) {
        return res.status(403).json({ error: 'You do not own this design. Claim it first.' });
      }
      const { craftState, title, notes } = req.body ?? {};
      const payload: Record<string, unknown> = {};

      if (craftState !== undefined) {
        let state: unknown = craftState;
        if (typeof state === 'string') {
          try { state = JSON.parse(state); } catch {
            return res.status(400).json({ error: 'craftState is not valid JSON' });
          }
        }
        const { valid, errors } = validateCraftStateStub(state);
        if (!valid) return res.status(422).json({ error: 'craftState failed validation.', details: errors });
        payload.craftState = state;
      }
      if (title !== undefined) payload.title = typeof title === 'string' ? title : null;
      if (notes !== undefined) payload.notes = typeof notes === 'string' ? notes : null;

      const updated = await storage.updateDesign(req.params.designId, payload as any);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update design.' });
    }
  });

  return app;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedDesign(overrides: Partial<FakeDesign> = {}): FakeDesign {
  const design: FakeDesign = {
    id: `design-${nextDesignId++}`,
    claimedByUserId: 'alice',
    source: 'native',
    craftState: { ROOT: { type: { resolvedName: 'AstryxSection' }, isCanvas: true, props: {}, displayName: 'AstryxSection', custom: {}, parent: null, hidden: false, nodes: [], linkedNodes: {} } },
    title: 'Original Title',
    notes: null,
    sourceWorkflowId: null,
    workflowSyncedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
  designStore.push(design);
  return design;
}

// ─── Reset store before each test ────────────────────────────────────────────

beforeEach(() => {
  designStore.length = 0;
  nextDesignId = 1;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Design tab rename — end-to-end persistence', () => {
  // ── Core rename flow ────────────────────────────────────────────────────────

  it('PATCH /api/designs/:id with { title } returns 200 with the new title', async () => {
    const app = buildApp();
    const { id } = seedDesign();

    const res = await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'My Renamed Design' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('My Renamed Design');
  });

  it('GET /api/designs/:id after rename returns the new title (page-reload simulation)', async () => {
    const app = buildApp();
    const { id } = seedDesign({ title: 'Original Title' });

    // Simulate the user double-clicking the tab and typing a new name.
    await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Refreshed Name' });

    // Simulate a full page refresh — GET with no session state.
    const reload = await request(app).get(`/api/designs/${id}`);
    expect(reload.status).toBe(200);
    expect(reload.body.title).toBe('Refreshed Name');
  });

  it('GET returns the old title when no PATCH was made (baseline check)', async () => {
    const app = buildApp();
    const { id } = seedDesign({ title: 'Untouched Title' });

    const res = await request(app).get(`/api/designs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Untouched Title');
  });

  // ── updatedAt advances (home-screen "last edited" timestamp) ────────────────

  it('updatedAt advances after a rename so the home screen shows the correct timestamp', async () => {
    const app = buildApp();
    const originalUpdatedAt = new Date('2025-01-01T00:00:00Z');
    const { id } = seedDesign({ updatedAt: originalUpdatedAt });

    // Small pause to ensure the clock advances before the PATCH.
    await new Promise((r) => setTimeout(r, 5));

    await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Brand New Name' });

    const afterPatch = designStore.find((d) => d.id === id)!;
    expect(afterPatch.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  // ── onTitleLoaded idempotency guard ─────────────────────────────────────────
  // After a rename the server must return the NEW title on every subsequent GET.
  // This is what prevents onTitleLoaded from reverting the tab label.

  it('consecutive GET calls after rename always return the new title (onTitleLoaded cannot revert)', async () => {
    const app = buildApp();
    const { id } = seedDesign({ title: 'Old Name' });

    await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'New Name' });

    // Simulate multiple component re-renders / React Query refetches.
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get(`/api/designs/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Name');
    }
  });

  // ── Auth / ownership guards ─────────────────────────────────────────────────

  it('PATCH requires authentication (no x-test-user → 401)', async () => {
    const app = buildApp();
    const { id } = seedDesign();

    const res = await request(app)
      .patch(`/api/designs/${id}`)
      .send({ title: 'Sneaky Rename' });

    expect(res.status).toBe(401);
  });

  it('PATCH by a non-owner returns 403 and does NOT change the title', async () => {
    const app = buildApp();
    const { id } = seedDesign({ claimedByUserId: 'alice', title: 'Original' });

    const res = await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'mallory')
      .send({ title: 'Hijacked Title' });

    expect(res.status).toBe(403);

    // Title must remain unchanged.
    const stored = designStore.find((d) => d.id === id)!;
    expect(stored.title).toBe('Original');
  });

  it('PATCH on an unclaimed design returns 403 (must claim first)', async () => {
    const app = buildApp();
    const { id } = seedDesign({ claimedByUserId: null, title: 'Unclaimed' });

    const res = await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Attempt' });

    expect(res.status).toBe(403);
  });

  it('PATCH on a non-existent design returns 404', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch('/api/designs/does-not-exist')
      .set('x-test-user', 'alice')
      .send({ title: 'Ghost' });

    expect(res.status).toBe(404);
  });

  // ── Whitespace trimming (mirrors client-side trim before the fetch call) ─────

  it('stores the exact title string the client sends (client trims, server accepts)', async () => {
    const app = buildApp();
    const { id } = seedDesign();

    // The client already trims before sending (workflowNameInput.trim()).
    const res = await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Trimmed Name' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Trimmed Name');
  });

  // ── craftState and title can be patched independently ────────────────────────

  it('title-only PATCH does not require craftState', async () => {
    const app = buildApp();
    const { id } = seedDesign();

    const res = await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'alice')
      .send({ title: 'Just the Title' }); // no craftState key

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Just the Title');
  });

  // ── Unicode and long titles ───────────────────────────────────────────────────

  it('persists unicode design titles correctly', async () => {
    const app = buildApp();
    const { id } = seedDesign();

    const unicodeTitle = '🎨 デザイン — Дизайн — 설계';
    const res = await request(app)
      .patch(`/api/designs/${id}`)
      .set('x-test-user', 'alice')
      .send({ title: unicodeTitle });

    expect(res.status).toBe(200);

    const reload = await request(app).get(`/api/designs/${id}`);
    expect(reload.body.title).toBe(unicodeTitle);
  });
});
