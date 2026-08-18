/**
 * Rendered UI tests for Account page billing states.
 *
 * Verifies three guard conditions that the billing-state guard in
 * Account.tsx enforces:
 *
 * 1. A linked paid account sees "Manage Subscription" and can open the portal.
 * 2. A paid account whose Stripe customer is missing/stale sees the recovery
 *    message ("We couldn't find a linked billing account…") instead of a
 *    broken portal button.
 * 3. An admin/unlimited account sees the admin info text and no portal action.
 *
 * Heavy dependencies (canvas, wouter, image assets, SiteFooter) are mocked
 * so that only the subscription card logic is exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any real imports
// ---------------------------------------------------------------------------
vi.mock('wouter', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: vi.fn(() => ['/account', vi.fn()]),
  useParams: vi.fn(() => ({})),
}));

vi.mock('@assets/kiteframe@2x_1758226635607.png', () => ({
  default: 'mock-icon.png',
}));

vi.mock('@/components/SiteFooter', () => ({
  SiteFooter: () => <footer data-testid="mock-footer" />,
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  queryClient: new QueryClient(),
  getQueryFn: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Real import after mocks are registered
// ---------------------------------------------------------------------------
import Account from '../Account';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A fake user object that satisfies the `/api/auth/user` shape used by
 * useReplitAuth and the profile card.
 */
const FAKE_USER = {
  id: 'user-test-1',
  email: 'paid@example.com',
  firstName: 'Paid',
  lastName: 'User',
  profileImageUrl: null,
  authProvider: 'google',
  subscriptionTier: 'pro',
  subscriptionStatus: 'active',
  billingPeriodEnd: null,
  isBeta: true,
  betaGrantedAt: null,
  waitlistRequestedAt: null,
  waitlistRole: null,
  createdAt: new Date().toISOString(),
};

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function seedAndRender(
  client: QueryClient,
  subscriptionPayload: object,
) {
  // Seed both queries the component reads.
  client.setQueryData(['/api/auth/user'], FAKE_USER);
  client.setQueryData(['/api/subscription'], subscriptionPayload);

  return render(
    <QueryClientProvider client={client}>
      <Account />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Account page — billing subscription card', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
  });

  it('shows "Manage Subscription" for a linked paid account', () => {
    seedAndRender(client, {
      tier: 'pro',
      status: 'active',
      canManageBilling: true,
      isAdmin: false,
      isUnlimited: false,
    });

    expect(
      screen.getByTestId('button-manage-subscription'),
    ).toBeInTheDocument();

    // Recovery message must NOT appear.
    expect(
      screen.queryByTestId('text-missing-billing-account'),
    ).not.toBeInTheDocument();
  });

  it('shows the recovery message for a paid account whose Stripe customer is missing (stale reference)', () => {
    // This is the key stale-customer scenario: the user is on a non-free plan
    // but getBillingAccountAvailability returned canManageBilling:false because
    // the stored Stripe customer ID was deleted or never created.
    seedAndRender(client, {
      tier: 'pro',
      status: 'active',
      canManageBilling: false,   // ← stale / missing customer
      isAdmin: false,
      isUnlimited: false,
    });

    const recoveryMsg = screen.getByTestId('text-missing-billing-account');
    expect(recoveryMsg).toBeInTheDocument();
    // The message should prompt the user to visit Pricing to restore access.
    expect(recoveryMsg.textContent).toMatch(/linked billing account/i);
    expect(recoveryMsg.textContent).toMatch(/pricing/i);

    // Portal button must NOT appear for this account.
    expect(
      screen.queryByTestId('button-manage-subscription'),
    ).not.toBeInTheDocument();
  });

  it('shows admin info text and hides the portal button for an admin account', () => {
    seedAndRender(client, {
      tier: 'pro',
      status: 'active',
      canManageBilling: false,
      isAdmin: true,
      isUnlimited: true,
    });

    expect(
      screen.getByTestId('text-admin-billing-info'),
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId('button-manage-subscription'),
    ).not.toBeInTheDocument();

    // Admin recovery message must not appear either.
    expect(
      screen.queryByTestId('text-missing-billing-account'),
    ).not.toBeInTheDocument();
  });
});
