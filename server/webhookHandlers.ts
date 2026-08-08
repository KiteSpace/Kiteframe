import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { stripeService } from './stripeService';
import { creditService } from './creditService';
import { db } from './db';
import { sql } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);

    const event = JSON.parse(payload.toString('utf8'));
    await WebhookHandlers.syncUserSubscriptionTier(event);
  }

  static async syncUserSubscriptionTier(event: any): Promise<void> {
    const subscriptionEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ];

    if (!subscriptionEvents.includes(event.type)) return;

    const subscription = event.data?.object;
    if (!subscription) return;

    const customerId = subscription.customer;
    const status: string = subscription.status;

    if (!customerId) return;

    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      console.log(`[Webhook] No user found for Stripe customer ${customerId}`);
      return;
    }

    let priceTier: string | undefined = subscription.items?.data?.[0]?.price?.metadata?.tier;

    if (!priceTier) {
      const priceId = subscription.items?.data?.[0]?.price?.id;
      if (priceId) {
        const price = await stripeService.getPrice(priceId);
        priceTier = (price?.metadata as Record<string, string> | null)?.tier;

        if (!priceTier && price?.product) {
          const product = await stripeService.getProduct(price.product as string);
          priceTier = (product?.metadata as Record<string, string> | null)?.tier;
        }
      }
    }

    const tier: 'free' | 'advanced' | 'pro' =
      priceTier === 'advanced' || priceTier === 'pro' ? priceTier : 'free';

    let subscriptionTier: string;
    let subscriptionStatus: string;

    if (status === 'trialing' || status === 'active') {
      subscriptionTier = tier;
      subscriptionStatus = status;
    } else if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
      subscriptionTier = 'free';
      subscriptionStatus = 'canceled';
    } else {
      subscriptionTier = tier;
      subscriptionStatus = status;
    }

    await storage.updateUserSubscription(user.id, {
      subscriptionTier,
      subscriptionStatus,
      stripeSubscriptionId: subscription.id,
    });

    await creditService.syncUserCreditsWithTier(
      user.id,
      subscriptionTier as 'free' | 'advanced' | 'pro',
    );

    console.log(`[Webhook] Updated user ${user.id}: tier=${subscriptionTier}, status=${subscriptionStatus}, credits synced (event: ${event.type})`);
  }

  /**
   * Before running a full payment-method sync, check every locally-known
   * non-deleted Stripe customer against the live Stripe API.  When a customer
   * no longer exists in Stripe ("No such customer" / resource_missing), mark it
   * as deleted in the local stripe.customers mirror so the sync library skips
   * it, and clear the stale stripeCustomerId reference from our users table.
   *
   * This prevents a single removed customer from interrupting synchronisation
   * for all remaining customers via an unhandled Promise rejection inside the
   * sync library's per-customer Promise.all loop.
   */
  static async reconcileRemovedCustomers(): Promise<{ reconciled: number; errors: number }> {
    let reconciled = 0;
    let errors = 0;
    try {
      const stripe = await getUncachableStripeClient();

      const result = await db.execute(
        sql`SELECT id FROM stripe.customers WHERE COALESCE(deleted, false) <> true`
      );
      const customerIds: string[] = (result.rows as Array<{ id: string }>).map((r) => r.id);

      if (customerIds.length === 0) {
        console.log('[CustomerReconcile] No active customers to check');
        return { reconciled, errors };
      }

      console.log(`[CustomerReconcile] Checking ${customerIds.length} customer(s) against Stripe`);

      for (const customerId of customerIds) {
        try {
          const customer = await stripe.customers.retrieve(customerId);
          // Stripe may return a DeletedCustomer object (soft-deleted) instead of throwing
          if ((customer as { deleted?: boolean }).deleted) {
            console.warn(`[CustomerReconcile] Customer ${customerId} is deleted in Stripe — reconciling locally`);
            await WebhookHandlers.markCustomerDeleted(customerId);
            reconciled++;
          }
        } catch (err: any) {
          if (err?.code === 'resource_missing') {
            console.warn(`[CustomerReconcile] Customer ${customerId} not found in Stripe — marking deleted locally`);
            await WebhookHandlers.markCustomerDeleted(customerId);
            reconciled++;
          } else {
            console.error(`[CustomerReconcile] Unexpected error checking customer ${customerId}:`, err);
            errors++;
          }
        }
      }

      console.log(`[CustomerReconcile] Done: ${reconciled} reconciled, ${errors} errors`);
    } catch (err) {
      console.error('[CustomerReconcile] Fatal error during reconciliation:', err);
      errors++;
    }
    return { reconciled, errors };
  }

  /**
   * Mark a customer as deleted in the local stripe.customers mirror and clear
   * the matching stripeCustomerId on our users table so that future operations
   * (checkout, portal, tier-sync) treat the account as if no customer exists.
   */
  private static async markCustomerDeleted(customerId: string): Promise<void> {
    // Mark as deleted in the synced stripe.customers table
    await db.execute(
      sql`UPDATE stripe.customers SET deleted = true WHERE id = ${customerId}`
    );

    // Clear the dangling reference from our application users table
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (user) {
      await storage.updateUserSubscription(user.id, { stripeCustomerId: null });
      console.log(`[CustomerReconcile] Cleared stale stripeCustomerId for user ${user.id}`);
    }
  }

  static async fixMismatchedTiers(): Promise<void> {
    try {
      const users = await storage.getUsersWithMismatchedTier();
      if (users.length === 0) {
        console.log('[TierSync] No mismatched tiers found');
        return;
      }
      console.log(`[TierSync] Fixing ${users.length} user(s) with mismatched subscription tiers`);
      for (const user of users) {
        try {
          if (!user.stripeSubscriptionId) continue;
          const items = await stripeService.getSubscriptionItems(user.stripeSubscriptionId);
          if (!items.length) continue;
          const priceId = items[0].price as string;
          if (!priceId) continue;

          const price = await stripeService.getPrice(priceId);
          let priceTier = (price?.metadata as Record<string, string> | null)?.tier;
          if (!priceTier && price?.product) {
            const product = await stripeService.getProduct(price.product as string);
            priceTier = (product?.metadata as Record<string, string> | null)?.tier;
          }

          const correctTier: 'free' | 'advanced' | 'pro' =
            priceTier === 'advanced' || priceTier === 'pro' ? priceTier : 'free';

          if (correctTier !== 'free' && correctTier !== user.subscriptionTier) {
            await storage.updateUserSubscription(user.id, {
              subscriptionTier: correctTier,
              subscriptionStatus: 'active',
            });
            await creditService.syncUserCreditsWithTier(user.id, correctTier);
            console.log(`[TierSync] Fixed user ${user.id} (${user.email}): ${user.subscriptionTier} → ${correctTier}`);
          }
        } catch (userErr) {
          console.error(`[TierSync] Error fixing user ${user.id}:`, userErr);
        }
      }
    } catch (err) {
      console.error('[TierSync] Error during mismatch fix:', err);
    }
  }
}
