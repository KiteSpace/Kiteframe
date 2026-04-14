import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import { stripeService } from './stripeService';
import { creditService } from './creditService';

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
