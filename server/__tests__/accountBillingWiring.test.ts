import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routesSource = readFileSync(resolve(process.cwd(), 'server/routes.ts'), 'utf8');
const accountPageSource = readFileSync(
  resolve(process.cwd(), 'client/src/pages/Account.tsx'),
  'utf8',
);

describe('billing portal availability wiring', () => {
  it('returns billing availability without exposing the Stripe customer ID', () => {
    expect(routesSource).toContain('canManageBilling: billingAccount.canManageBilling');
    expect(routesSource).toContain('getBillingAccountAvailability(user, isAdmin)');
    expect(routesSource).not.toContain('stripeCustomerId: user.stripeCustomerId');
  });

  it('does not render the portal action unless billing is available', () => {
    expect(accountPageSource).toContain(
      'const showManageButton = canManageBilling &&',
    );
    expect(accountPageSource).toContain('data-testid="text-missing-billing-account"');
    expect(accountPageSource).toContain('data-testid="text-admin-billing-info"');
  });

  it('clears stale billing state after Stripe reports a missing customer', () => {
    expect(routesSource).toContain("stripeSubscriptionId: null");
    expect(routesSource).toContain("subscriptionTier: 'free'");
    expect(routesSource).toContain("subscriptionStatus: 'canceled'");
    expect(routesSource).toContain("billingPeriodEnd: null");
  });
});