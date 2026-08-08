import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStripeWebhookBaseUrl } from "../lib/publicAppUrl";
import { registerStripeWebhookRoute } from "../lib/stripeWebhookRoute";

describe("Stripe webhook URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured published HTTPS URL", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://kiteframe.space/");
    expect(getStripeWebhookBaseUrl()).toBe("https://kiteframe.space");
  });

  it("refuses workspace development URLs", () => {
    vi.stubEnv(
      "PUBLIC_APP_URL",
      "https://a3695e9e-75a3-493f-96e8-c7b25c2638e2.worf.replit.dev",
    );
    expect(() => getStripeWebhookBaseUrl()).toThrow(/public HTTPS deployment URL/);
  });
});

describe("Stripe webhook route", () => {
  it("accepts the UUID route with the raw request body before JSON parsing", async () => {
    const app = express();
    const processor = vi.fn(async () => undefined);
    registerStripeWebhookRoute(app, processor);
    app.use(express.json());

    const payload = JSON.stringify({ type: "customer.subscription.updated" });
    const response = await request(app)
      .post("/api/stripe/webhook/managed-webhook-uuid")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=test")
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(processor).toHaveBeenCalledWith(
      expect.any(Buffer),
      "t=1,v1=test",
      "managed-webhook-uuid",
    );
  });

  it("returns a client error when Stripe omits its signature", async () => {
    const app = express();
    registerStripeWebhookRoute(app, async () => undefined);

    const response = await request(app)
      .post("/api/stripe/webhook/managed-webhook-uuid")
      .set("Content-Type", "application/json")
      .send("{}");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Missing stripe-signature" });
  });
});