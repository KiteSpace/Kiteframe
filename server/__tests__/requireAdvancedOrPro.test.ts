/**
 * Integration tests for the requireAdvancedOrPro middleware as applied to
 * the two gated endpoints:
 *   POST /api/generate-wireframe
 *   POST /api/ai/analyze-workflow-image
 *
 * Uses supertest to send real HTTP requests through a minimal Express app
 * that wires these routes with the actual middleware in the correct order.
 * The database layer is mocked so no live Postgres instance is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock db BEFORE importing anything that touches it
// ---------------------------------------------------------------------------
const mockSelect = vi.fn();

vi.mock('../db', () => ({
  db: { select: mockSelect },
}));

vi.mock('../creditService', () => ({
  creditService: {
    getUserIdentifier: vi.fn(() => 'test-identifier'),
    checkCredits: vi.fn(),
    deductCredits: vi.fn(),
  },
  getCreditCost: vi.fn(() => 1),
}));

// Import middleware AFTER mocks are in place
const { requireAdvancedOrPro } = await import('../middleware/creditCheck');

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

type DbRow = Record<string, unknown>;

/**
 * Creates a Drizzle-compatible awaitable query chain that resolves to `rows`.
 * Extends a real Promise so .then()/.catch()/.finally() work natively.
 */
function makeChain(rows: DbRow[]): Promise<DbRow[]> & Record<string, unknown> {
  const p = Promise.resolve(rows);
  const chain = Object.assign(p, {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  });
  return chain;
}

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal Express app with the two target routes, optionally
 * attaching `user` onto `req` to simulate an authenticated session.
 *
 * A stub handler is placed after `requireAdvancedOrPro` — if the middleware
 * calls next(), the stub responds 200 so tests can assert pass-through.
 */
function createApp(user?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());

  if (user !== undefined) {
    app.use((_req: Request, _res: Response, next: NextFunction) => {
      (_req as Request & { user: unknown }).user = user;
      next();
    });
  }

  const stubHandler = (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  };

  app.post('/api/generate-wireframe', requireAdvancedOrPro, stubHandler);
  app.post('/api/ai/analyze-workflow-image', requireAdvancedOrPro, stubHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

async function expect403(
  app: ReturnType<typeof createApp>,
  endpoint: string,
) {
  const res = await request(app).post(endpoint).send({});
  expect(res.status).toBe(403);
  expect(res.body).toMatchObject({ requiresUpgrade: true });
  expect(typeof res.body.error).toBe('string');
}

async function expect200(
  app: ReturnType<typeof createApp>,
  endpoint: string,
) {
  const res = await request(app).post(endpoint).send({});
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ ok: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  '/api/generate-wireframe',
  '/api/ai/analyze-workflow-image',
] as const;

describe('requireAdvancedOrPro — route-level enforcement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ADMIN_EMAILS;
  });

  // -------------------------------------------------------------------------
  // Unauthenticated
  // -------------------------------------------------------------------------

  describe('unauthenticated requests (no req.user)', () => {
    it.each(ENDPOINTS)('returns 403 on %s', async (endpoint) => {
      // No user attached — app created without a user
      const app = createApp(undefined);
      await expect403(app, endpoint);
    });
  });

  // -------------------------------------------------------------------------
  // Free-tier authenticated users
  // -------------------------------------------------------------------------

  describe('free-tier users', () => {
    it.each(ENDPOINTS)('returns 403 on %s for free-tier user (id lookup)', async (endpoint) => {
      mockSelect
        .mockReturnValueOnce(makeChain([]))  // getUserGroupAccessControls
        .mockReturnValueOnce(makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }]));

      const app = createApp({ id: 'user-free', email: 'free@example.com' });
      await expect403(app, endpoint);
    });

    it.each(ENDPOINTS)('returns 403 on %s for free-tier user (claims.sub lookup)', async (endpoint) => {
      mockSelect
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }]));

      const app = createApp({ claims: { sub: 'user-claims', email: 'free@example.com' } });
      await expect403(app, endpoint);
    });

    it.each(ENDPOINTS)('returns 403 on %s when user has no subscriptionTier set', async (endpoint) => {
      mockSelect
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ subscriptionTier: null, email: 'notier@example.com' }]));

      const app = createApp({ id: 'user-notier', email: 'notier@example.com' });
      await expect403(app, endpoint);
    });
  });

  // -------------------------------------------------------------------------
  // Advanced-tier users — must pass through
  // -------------------------------------------------------------------------

  describe('advanced-tier users', () => {
    it.each(ENDPOINTS)('passes through to handler on %s', async (endpoint) => {
      mockSelect
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ subscriptionTier: 'advanced', email: 'adv@example.com' }]));

      const app = createApp({ id: 'user-adv', email: 'adv@example.com' });
      await expect200(app, endpoint);
    });
  });

  // -------------------------------------------------------------------------
  // Pro-tier users — must pass through
  // -------------------------------------------------------------------------

  describe('pro-tier users', () => {
    it.each(ENDPOINTS)('passes through to handler on %s', async (endpoint) => {
      mockSelect
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ subscriptionTier: 'pro', email: 'pro@example.com' }]));

      const app = createApp({ id: 'user-pro', email: 'pro@example.com' });
      await expect200(app, endpoint);
    });
  });

  // -------------------------------------------------------------------------
  // Group-based tier overrides
  // -------------------------------------------------------------------------

  describe('group-based tier overrides', () => {
    it.each(ENDPOINTS)('passes through on %s when group grants Advanced override (user is free)', async (endpoint) => {
      mockSelect
        .mockReturnValueOnce(makeChain([{
          groupId: 'group-adv',
          accessControls: { subscriptionTierOverride: 'advanced' },
        }]))
        .mockReturnValueOnce(makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }]));

      const app = createApp({ id: 'user-group', email: 'free@example.com' });
      await expect200(app, endpoint);
    });

    it.each(ENDPOINTS)('passes through on %s when group grants unlimitedCredits (user is free)', async (endpoint) => {
      mockSelect
        .mockReturnValueOnce(makeChain([{
          groupId: 'group-unlimited',
          accessControls: { unlimitedCredits: true },
        }]))
        .mockReturnValueOnce(makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }]));

      const app = createApp({ id: 'user-group-unl', email: 'free@example.com' });
      await expect200(app, endpoint);
    });

    it.each(ENDPOINTS)('returns 403 on %s when group has no override and user is free', async (endpoint) => {
      mockSelect
        .mockReturnValueOnce(makeChain([{ groupId: 'group-none', accessControls: {} }]))
        .mockReturnValueOnce(makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }]));

      const app = createApp({ id: 'user-group-none', email: 'free@example.com' });
      await expect403(app, endpoint);
    });
  });

  // -------------------------------------------------------------------------
  // Admin bypass
  // -------------------------------------------------------------------------

  describe('admin email bypass', () => {
    it.each(ENDPOINTS)('passes through on %s immediately for admin email (no DB calls)', async (endpoint) => {
      process.env.ADMIN_EMAILS = 'admin@kiteframe.com';

      const app = createApp({ email: 'admin@kiteframe.com' });
      await expect200(app, endpoint);

      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Response contract
  // -------------------------------------------------------------------------

  describe('403 response body contract', () => {
    it.each(ENDPOINTS)('response on %s contains error string and requiresUpgrade: true', async (endpoint) => {
      const app = createApp(undefined);
      const res = await request(app).post(endpoint).send({});

      expect(res.status).toBe(403);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          requiresUpgrade: true,
        }),
      );
    });
  });
});
