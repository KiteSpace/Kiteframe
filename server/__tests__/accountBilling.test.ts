import { describe, expect, it } from 'vitest';
import { getBillingAccountAvailability } from '../accountBilling';

describe('billing account availability', () => {
  it('allows a linked paid account to manage billing', () => {
    expect(
      getBillingAccountAvailability({ stripeCustomerId: 'cus_linked' }, false),
    ).toEqual({ canManageBilling: true, reason: 'linked' });
  });

  it('does not expose a broken portal action for a paid account without a customer', () => {
    expect(
      getBillingAccountAvailability({ stripeCustomerId: null }, false),
    ).toEqual({ canManageBilling: false, reason: 'missing_customer' });
  });

  it('does not offer Stripe management to an admin account', () => {
    expect(
      getBillingAccountAvailability({ stripeCustomerId: 'cus_admin' }, true),
    ).toEqual({ canManageBilling: false, reason: 'admin' });
  });

  it('treats an undefined customer reference as unavailable', () => {
    expect(getBillingAccountAvailability({}, false)).toEqual({
      canManageBilling: false,
      reason: 'missing_customer',
    });
  });

});