import express, { type Express } from "express";

export type StripeWebhookProcessor = (
  payload: Buffer,
  signature: string,
  uuid: string,
) => Promise<void>;

/**
 * Register the managed Stripe webhook before express.json().
 *
 * Stripe signatures are verified against the exact raw request bytes, and the
 * managed endpoint includes a UUID path segment. Keeping this registration in
 * one helper makes both requirements explicit and regression-testable.
 */
export function registerStripeWebhookRoute(
  app: Express,
  processWebhook: StripeWebhookProcessor,
): void {
  app.post(
    "/api/stripe/webhook/:uuid",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];

      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature" });
      }

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;

        if (!Buffer.isBuffer(req.body)) {
          console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer");
          return res.status(500).json({ error: "Webhook processing error" });
        }

        await processWebhook(req.body, sig, req.params.uuid);
        return res.status(200).json({ received: true });
      } catch (error: any) {
        console.error("Webhook error:", error?.message || error);
        return res.status(400).json({ error: "Webhook processing error" });
      }
    },
  );
}