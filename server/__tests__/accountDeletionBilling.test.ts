import { describe, expect, it, vi } from "vitest";
import { cancelSubscriptionBeforeAccountDeletion } from "../accountDeletionBilling";

describe("account deletion billing safety", () => {
  it("does not contact Stripe when the user has no recorded subscription", async () => {
    const cancelSubscription = vi.fn();

    await expect(
      cancelSubscriptionBeforeAccountDeletion(null, cancelSubscription),
    ).resolves.toEqual({ status: "not_required" });
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  it("requires Stripe to confirm cancellation before deletion can continue", async () => {
    const cancelSubscription = vi.fn().mockResolvedValue({ status: "canceled" });

    await expect(
      cancelSubscriptionBeforeAccountDeletion("sub_active", cancelSubscription),
    ).resolves.toEqual({ status: "canceled" });
    expect(cancelSubscription).toHaveBeenCalledWith("sub_active");
  });

  it("allows deletion when Stripe reports that the subscription is already gone", async () => {
    const cancelSubscription = vi.fn().mockRejectedValue({
      code: "resource_missing",
      param: "subscription",
      statusCode: 404,
    });

    await expect(
      cancelSubscriptionBeforeAccountDeletion("sub_already_deleted", cancelSubscription),
    ).resolves.toEqual({ status: "not_found" });
  });

  it("blocks deletion when Stripe cancellation cannot be confirmed", async () => {
    const cancellationFailure = Object.assign(new Error("Stripe unavailable"), {
      code: "api_connection_error",
    });
    const cancelSubscription = vi.fn().mockRejectedValue(cancellationFailure);

    await expect(
      cancelSubscriptionBeforeAccountDeletion("sub_active", cancelSubscription),
    ).rejects.toBe(cancellationFailure);
  });
});