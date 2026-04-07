import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// --- Mock db BEFORE importing the module under test ---
const mockSelect = vi.fn();

vi.mock('../db', () => ({
  db: { select: mockSelect },
}));

// Mock creditService (imported by creditCheck.ts but not used by requireAdvancedOrPro)
vi.mock('../creditService', () => ({
  creditService: {
    getUserIdentifier: vi.fn(() => 'test-identifier'),
    checkCredits: vi.fn(),
    deductCredits: vi.fn(),
  },
  getCreditCost: vi.fn(() => 1),
}));

// Import AFTER mocks are registered
const { requireAdvancedOrPro } = await import('../middleware/creditCheck');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates a chainable Drizzle query mock that resolves to `rows` when awaited.
 * Handles both .limit() terminated and direct-await patterns.
 */
function makeChain(rows: any[]): any {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
    then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
    catch: (fn: any) => Promise.resolve(rows).catch(fn),
    finally: (fn: any) => Promise.resolve(rows).finally(fn),
  };
  return chain;
}

function makeReq(userOverrides?: Record<string, any>): Partial<Request> {
  return { user: userOverrides } as any;
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

const noopNext: NextFunction = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireAdvancedOrPro middleware', () => {
  beforeEach(() => {
    // resetAllMocks clears both call history AND the pending mockReturnValueOnce queue,
    // preventing leftover mocks from leaking between tests.
    vi.resetAllMocks();
    // Default: ADMIN_EMAILS not set
    delete process.env.ADMIN_EMAILS;
  });

  // -------------------------------------------------------------------------
  // Unauthenticated (no req.user)
  // -------------------------------------------------------------------------

  describe('unauthenticated requests', () => {
    it('returns 403 with requiresUpgrade: true when req.user is undefined', async () => {
      const req = makeReq(undefined);
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({ requiresUpgrade: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when req.user is null', async () => {
      const req = { user: null } as any;
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({ requiresUpgrade: true });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Free-tier authenticated users
  // -------------------------------------------------------------------------

  describe('free-tier users', () => {
    it('returns 403 for a user with subscriptionTier: free (id-based lookup)', async () => {
      // Query 1: getUserGroupAccessControls → no memberships
      mockSelect.mockReturnValueOnce(makeChain([]));
      // Query 2: user lookup → free tier
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }])
      );

      const req = makeReq({ id: 'user-free-1', email: 'free@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({ requiresUpgrade: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 for a user with subscriptionTier: free (claims.sub-based lookup)', async () => {
      mockSelect.mockReturnValueOnce(makeChain([]));
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }])
      );

      const req = makeReq({ claims: { sub: 'user-free-2', email: 'free@example.com' } });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({ requiresUpgrade: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user exists in DB but has no subscriptionTier (null → treated as free)', async () => {
      mockSelect.mockReturnValueOnce(makeChain([]));
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: null, email: 'notier@example.com' }])
      );

      const req = makeReq({ id: 'user-notier', email: 'notier@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({ requiresUpgrade: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user id is not found in DB', async () => {
      mockSelect.mockReturnValueOnce(makeChain([]));  // group controls
      mockSelect.mockReturnValueOnce(makeChain([]));  // user not found

      const req = makeReq({ id: 'ghost-user', email: 'ghost@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({ requiresUpgrade: true });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Advanced-tier users (should pass through)
  // -------------------------------------------------------------------------

  describe('advanced-tier users', () => {
    it('calls next() for a user with subscriptionTier: advanced', async () => {
      mockSelect.mockReturnValueOnce(makeChain([]));
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'advanced', email: 'advanced@example.com' }])
      );

      const req = makeReq({ id: 'user-adv-1', email: 'advanced@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('does not return 403 for advanced user (via claims.sub)', async () => {
      mockSelect.mockReturnValueOnce(makeChain([]));
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'advanced', email: 'adv@example.com' }])
      );

      const req = makeReq({ claims: { sub: 'user-adv-claims' } });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Pro-tier users (should pass through)
  // -------------------------------------------------------------------------

  describe('pro-tier users', () => {
    it('calls next() for a user with subscriptionTier: pro', async () => {
      mockSelect.mockReturnValueOnce(makeChain([]));
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'pro', email: 'pro@example.com' }])
      );

      const req = makeReq({ id: 'user-pro-1', email: 'pro@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Group-based tier overrides
  // -------------------------------------------------------------------------

  describe('group-based tier overrides', () => {
    it('calls next() when group grants subscriptionTierOverride: advanced (user is otherwise free)', async () => {
      // getUserGroupAccessControls: returns a membership with advanced override
      mockSelect.mockReturnValueOnce(
        makeChain([{
          groupId: 'group-1',
          accessControls: { subscriptionTierOverride: 'advanced' },
        }])
      );
      // User lookup should NOT be called (group check short-circuits)
      // but if it were, user would be free
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }])
      );

      const req = makeReq({ id: 'user-group-adv', email: 'free@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when group grants unlimitedCredits (user is otherwise free)', async () => {
      mockSelect.mockReturnValueOnce(
        makeChain([{
          groupId: 'group-2',
          accessControls: { unlimitedCredits: true },
        }])
      );
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }])
      );

      const req = makeReq({ id: 'user-group-unlimited', email: 'free@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when group grants bypassCreditCheck (user is otherwise free)', async () => {
      mockSelect.mockReturnValueOnce(
        makeChain([{
          groupId: 'group-3',
          accessControls: { bypassCreditCheck: true },
        }])
      );
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }])
      );

      const req = makeReq({ id: 'user-group-bypass', email: 'free@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 403 when group has no override and user is free', async () => {
      mockSelect.mockReturnValueOnce(
        makeChain([{
          groupId: 'group-4',
          accessControls: {},  // no overrides
        }])
      );
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'free', email: 'free@example.com' }])
      );

      const req = makeReq({ id: 'user-group-none', email: 'free@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({ requiresUpgrade: true });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Admin bypass
  // -------------------------------------------------------------------------

  describe('admin users', () => {
    it('calls next() immediately for an admin email (no DB queries)', async () => {
      process.env.ADMIN_EMAILS = 'admin@kiteframe.com';

      const req = makeReq({ email: 'admin@kiteframe.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
      // DB should not have been called
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('calls next() for admin email via claims', async () => {
      process.env.ADMIN_EMAILS = 'admin@kiteframe.com';

      const req = makeReq({ claims: { email: 'admin@kiteframe.com' } });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledOnce();
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('returns 403 for non-admin email when ADMIN_EMAILS is set', async () => {
      process.env.ADMIN_EMAILS = 'admin@kiteframe.com';
      mockSelect.mockReturnValueOnce(makeChain([]));
      mockSelect.mockReturnValueOnce(
        makeChain([{ subscriptionTier: 'free', email: 'notadmin@example.com' }])
      );

      const req = makeReq({ id: 'user-notadmin', email: 'notadmin@example.com' });
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Response shape
  // -------------------------------------------------------------------------

  describe('403 response body shape', () => {
    it('includes both error message and requiresUpgrade: true in the 403 body', async () => {
      const req = makeReq(undefined);
      const res = makeRes();
      const next = vi.fn();

      await requireAdvancedOrPro(req as Request, res as Response, next as NextFunction);

      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('requiresUpgrade', true);
      expect(typeof res.body.error).toBe('string');
    });
  });
});
