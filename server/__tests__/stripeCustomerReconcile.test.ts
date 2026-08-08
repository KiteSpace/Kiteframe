/**
 * Tests for WebhookHandlers.reconcileRemovedCustomers() and
 * StripeService.getCustomerPaymentMethods()
 *
 * Verifies that:
 * - A customer deleted in Stripe (resource_missing) is marked deleted locally
 *   and the stale stripeCustomerId is cleared from the users table
 * - A customer soft-deleted by Stripe (deleted: true in the returned object)
 *   is also reconciled
 * - One missing customer does NOT prevent remaining customers from being
 *   checked (isolation)
 * - Unexpected Stripe errors are counted as errors, not reconciled
 * - When there are no local customers the function short-circuits cleanly
 * - getCustomerPaymentMethods returns null instead of throwing on resource_missing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock db BEFORE any module that imports it
// ---------------------------------------------------------------------------
const mockDbExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: mockDbExecute },
}));

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------
const mockGetUserByStripeCustomerId = vi.fn();
const mockUpdateUserSubscription = vi.fn();
vi.mock('../storage', () => ({
  storage: {
    getUserByStripeCustomerId: mockGetUserByStripeCustomerId,
    updateUserSubscription: mockUpdateUserSubscription,
  },
}));

// ---------------------------------------------------------------------------
// Mock stripeService — keep the real StripeService class so we can
// instantiate it in tests, but stub the singleton so webhookHandlers
// doesn't trigger real Stripe calls when imported transitively.
// ---------------------------------------------------------------------------
vi.mock('../stripeService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stripeService')>();
  return {
    ...actual,
    stripeService: {},
  };
});

// ---------------------------------------------------------------------------
// Mock creditService
// ---------------------------------------------------------------------------
vi.mock('../creditService', () => ({
  creditService: {
    syncUserCreditsWithTier: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Single shared Stripe client mock — provides both customers and paymentMethods
// so both WebhookHandlers and StripeService can use the same factory mock.
// ---------------------------------------------------------------------------
const mockStripeRetrieve = vi.fn();
const mockPaymentMethodsList = vi.fn();

vi.mock('../stripeClient', () => ({
  getStripeSync: vi.fn(),
  getUncachableStripeClient: vi.fn(async () => ({
    customers: { retrieve: mockStripeRetrieve },
    paymentMethods: { list: mockPaymentMethodsList },
  })),
}));

// ---------------------------------------------------------------------------
// Import AFTER all mocks are in place
// ---------------------------------------------------------------------------
const { WebhookHandlers } = await import('../webhookHandlers');
const { StripeService } = await import('../stripeService');
const freshService = new StripeService();

// ---------------------------------------------------------------------------
// Tests — reconcileRemovedCustomers
// ---------------------------------------------------------------------------

describe('WebhookHandlers.reconcileRemovedCustomers()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserByStripeCustomerId.mockResolvedValue(null);
    mockUpdateUserSubscription.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  it('returns { reconciled: 0, errors: 0 } when there are no local customers', async () => {
    mockDbExecute.mockResolvedValue({ rows: [] });

    const result = await WebhookHandlers.reconcileRemovedCustomers();

    expect(result).toEqual({ reconciled: 0, errors: 0 });
    // Should not call Stripe at all
    expect(mockStripeRetrieve).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  it('reconciles a customer that Stripe reports as resource_missing', async () => {
    // SELECT returns one customer; UPDATE resolves cleanly
    mockDbExecute
      .mockResolvedValueOnce({ rows: [{ id: 'cus_removed' }] })
      .mockResolvedValueOnce({ rows: [] });

    const notFoundErr = Object.assign(new Error('No such customer'), { code: 'resource_missing' });
    mockStripeRetrieve.mockRejectedValue(notFoundErr);

    const result = await WebhookHandlers.reconcileRemovedCustomers();

    expect(result).toEqual({ reconciled: 1, errors: 0 });
    expect(mockDbExecute).toHaveBeenCalledTimes(2); // SELECT + UPDATE
  });

  // -------------------------------------------------------------------------
  it('clears stripeCustomerId from the user record when a removed customer is linked to a user', async () => {
    mockDbExecute
      .mockResolvedValueOnce({ rows: [{ id: 'cus_linked' }] })
      .mockResolvedValueOnce({ rows: [] });

    const notFoundErr = Object.assign(new Error('No such customer'), { code: 'resource_missing' });
    mockStripeRetrieve.mockRejectedValue(notFoundErr);

    const fakeUser = { id: 'user-123', stripeCustomerId: 'cus_linked' };
    mockGetUserByStripeCustomerId.mockResolvedValue(fakeUser);

    await WebhookHandlers.reconcileRemovedCustomers();

    expect(mockGetUserByStripeCustomerId).toHaveBeenCalledWith('cus_linked');
    expect(mockUpdateUserSubscription).toHaveBeenCalledWith('user-123', { stripeCustomerId: null });
  });

  // -------------------------------------------------------------------------
  it('reconciles a customer whose Stripe object carries deleted: true (soft delete)', async () => {
    mockDbExecute
      .mockResolvedValueOnce({ rows: [{ id: 'cus_soft' }] })
      .mockResolvedValueOnce({ rows: [] });

    // Stripe returns a DeletedCustomer object (not an error)
    mockStripeRetrieve.mockResolvedValue({ id: 'cus_soft', deleted: true });

    const result = await WebhookHandlers.reconcileRemovedCustomers();

    expect(result).toEqual({ reconciled: 1, errors: 0 });
  });

  // -------------------------------------------------------------------------
  it('does not reconcile a customer that still exists in Stripe', async () => {
    mockDbExecute.mockResolvedValueOnce({ rows: [{ id: 'cus_alive' }] });

    mockStripeRetrieve.mockResolvedValue({ id: 'cus_alive', deleted: false });

    const result = await WebhookHandlers.reconcileRemovedCustomers();

    expect(result).toEqual({ reconciled: 0, errors: 0 });
    // Only the SELECT should have run — no UPDATE
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  it('continues checking remaining customers when one is missing (isolation)', async () => {
    mockDbExecute
      .mockResolvedValueOnce({ rows: [{ id: 'cus_gone' }, { id: 'cus_ok' }] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE for cus_gone only

    const notFoundErr = Object.assign(new Error('No such customer'), { code: 'resource_missing' });
    mockStripeRetrieve
      .mockRejectedValueOnce(notFoundErr)                          // cus_gone
      .mockResolvedValueOnce({ id: 'cus_ok', deleted: false });   // cus_ok

    const result = await WebhookHandlers.reconcileRemovedCustomers();

    expect(result).toEqual({ reconciled: 1, errors: 0 });
    expect(mockStripeRetrieve).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  it('counts unexpected Stripe errors as errors without incrementing reconciled', async () => {
    mockDbExecute.mockResolvedValueOnce({ rows: [{ id: 'cus_flaky' }] });

    const networkErr = Object.assign(new Error('Network error'), { code: 'api_connection_error' });
    mockStripeRetrieve.mockRejectedValue(networkErr);

    const result = await WebhookHandlers.reconcileRemovedCustomers();

    expect(result).toEqual({ reconciled: 0, errors: 1 });
    // No UPDATE should have been attempted
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  it('handles multiple customers with mixed outcomes', async () => {
    mockDbExecute
      .mockResolvedValueOnce({ rows: [{ id: 'cus_a' }, { id: 'cus_b' }, { id: 'cus_c' }] })
      .mockResolvedValue({ rows: [] }); // UPDATEs for cus_a and cus_b

    const notFoundErr = Object.assign(new Error('No such customer'), { code: 'resource_missing' });
    mockStripeRetrieve
      .mockRejectedValueOnce(notFoundErr)                          // cus_a: gone
      .mockResolvedValueOnce({ id: 'cus_b', deleted: true })      // cus_b: soft-deleted
      .mockResolvedValueOnce({ id: 'cus_c', deleted: false });    // cus_c: alive

    const result = await WebhookHandlers.reconcileRemovedCustomers();

    expect(result).toEqual({ reconciled: 2, errors: 0 });
  });
});

// ---------------------------------------------------------------------------
// Tests — StripeService.getCustomerPaymentMethods
// ---------------------------------------------------------------------------

describe('StripeService.getCustomerPaymentMethods()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the payment method list for an existing customer', async () => {
    const fakeCards = [{ id: 'pm_abc', type: 'card' }];
    mockPaymentMethodsList.mockResolvedValue({ data: fakeCards });

    const result = await freshService.getCustomerPaymentMethods('cus_exists');

    expect(result).toEqual(fakeCards);
  });

  it('returns null (not throws) when the customer no longer exists in Stripe', async () => {
    const notFoundErr = Object.assign(new Error('No such customer'), { code: 'resource_missing' });
    mockPaymentMethodsList.mockRejectedValue(notFoundErr);

    const result = await freshService.getCustomerPaymentMethods('cus_deleted');

    expect(result).toBeNull();
  });

  it('re-throws errors unrelated to missing customers', async () => {
    const serverErr = Object.assign(new Error('Stripe 500'), { code: 'api_error' });
    mockPaymentMethodsList.mockRejectedValue(serverErr);

    await expect(freshService.getCustomerPaymentMethods('cus_x')).rejects.toThrow('Stripe 500');
  });
});
