type StripeErrorLike = {
  code?: string;
  param?: string;
  statusCode?: number;
};

export type AccountDeletionBillingResult =
  | { status: "canceled" }
  | { status: "not_found" }
  | { status: "not_required" };

/**
 * Ensures a locally recorded subscription cannot continue billing after
 * account deletion. Stripe customer records are intentionally retained because
 * they may be required for invoices, payments, and other financial history.
 */
export async function cancelSubscriptionBeforeAccountDeletion(
  subscriptionId: string | null | undefined,
  cancelSubscription: (subscriptionId: string) => Promise<unknown>,
): Promise<AccountDeletionBillingResult> {
  if (!subscriptionId) {
    return { status: "not_required" };
  }

  try {
    await cancelSubscription(subscriptionId);
    return { status: "canceled" };
  } catch (error) {
    const stripeError = error as StripeErrorLike;

    // A deleted or already-canceled subscription cannot create future
    // recurring charges, so it is safe to continue account deletion.
    if (
      stripeError.code === "resource_missing" &&
      stripeError.param === "subscription"
    ) {
      return { status: "not_found" };
    }

    throw error;
  }
}