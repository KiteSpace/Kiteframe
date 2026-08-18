import { getUncachableStripeClient } from "../server/stripeClient";

const command = process.argv[2];
const webhookId = process.argv[3];

async function main() {
  const stripe = await getUncachableStripeClient();

  if (command === "list") {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    for (const endpoint of endpoints.data) {
      console.log(JSON.stringify({
        id: endpoint.id,
        url: endpoint.url,
        status: endpoint.status,
        description: endpoint.description,
        liveMode: endpoint.livemode,
      }));
    }
    return;
  }

  if (command === "delete" && webhookId) {
    const endpoint = await stripe.webhookEndpoints.retrieve(webhookId);
    if (!endpoint.url.includes(".replit.dev")) {
      throw new Error(
        `Refusing to delete ${webhookId}: it does not target a stale .replit.dev workspace URL.`,
      );
    }
    await stripe.webhookEndpoints.del(webhookId);
    console.log(`Deleted stale Stripe webhook ${webhookId}: ${endpoint.url}`);
    return;
  }

  throw new Error(
    "Usage: npx tsx scripts/manage-stripe-webhooks.ts list | delete <webhook-id>",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});