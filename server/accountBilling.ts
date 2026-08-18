export type BillingAccountOwner = {
  stripeCustomerId?: string | null;
};

export type BillingAccountAvailability = {
  canManageBilling: boolean;
  reason: 'admin' | 'missing_customer' | 'linked';
};

/**
 * Determines whether the current account can use the Stripe customer portal.
 * This deliberately returns a boolean and reason, never the Stripe customer ID.
 */
export function getBillingAccountAvailability(
  user: BillingAccountOwner,
  isAdmin: boolean,
): BillingAccountAvailability {
  if (isAdmin) {
    return { canManageBilling: false, reason: 'admin' };
  }

  if (!user.stripeCustomerId) {
    return { canManageBilling: false, reason: 'missing_customer' };
  }

  return { canManageBilling: true, reason: 'linked' };
}