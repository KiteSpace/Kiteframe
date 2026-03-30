import { getStripeSync } from './stripeClient';
import { storage } from './storage';

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

    try {
      const event = JSON.parse(payload.toString('utf8'));
      await WebhookHandlers.syncUserSubscriptionTier(event);
    } catch (err) {
      console.error('Error syncing user subscription tier from webhook:', err);
    }
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

    const priceTier = subscription.items?.data?.[0]?.price?.metadata?.tier;
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

    console.log(`[Webhook] Updated user ${user.id}: tier=${subscriptionTier}, status=${subscriptionStatus} (event: ${event.type})`);
  }
}
