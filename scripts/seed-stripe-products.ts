import { getUncachableStripeClient } from '../server/stripeClient';

async function createProducts() {
  console.log('Creating Stripe products and prices for KiteAI...');
  const stripe = await getUncachableStripeClient();

  // Check if products already exist
  const existingProducts = await stripe.products.search({ query: "name:'KiteAI'" });
  if (existingProducts.data.length > 0) {
    console.log('KiteAI products already exist. Skipping creation.');
    console.log('Existing products:', existingProducts.data.map(p => p.name));
    return;
  }

  // Free tier - No product needed, it's the default

  // Advanced tier
  console.log('Creating Advanced tier product...');
  const advancedProduct = await stripe.products.create({
    name: 'KiteAI Advanced',
    description: 'Advanced tier with 150 AI credits per month for power users',
    metadata: {
      tier: 'advanced',
      credits: '150',
    },
  });

  const advancedMonthly = await stripe.prices.create({
    product: advancedProduct.id,
    unit_amount: 1499, // $14.99
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      tier: 'advanced',
      interval: 'monthly',
    },
  });

  const advancedAnnual = await stripe.prices.create({
    product: advancedProduct.id,
    unit_amount: 14390, // $143.90 (20% off = ~$12/month)
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      tier: 'advanced',
      interval: 'annual',
    },
  });

  console.log(`Created Advanced product: ${advancedProduct.id}`);
  console.log(`  Monthly price: ${advancedMonthly.id} ($14.99/month)`);
  console.log(`  Annual price: ${advancedAnnual.id} ($143.90/year)`);

  // Pro tier
  console.log('Creating Pro tier product...');
  const proProduct = await stripe.products.create({
    name: 'KiteAI Pro',
    description: 'Pro tier with 500 AI credits per month and cloud-saved projects',
    metadata: {
      tier: 'pro',
      credits: '500',
      features: 'cloud_saved_projects,priority_support',
    },
  });

  const proMonthly = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 2999, // $29.99
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      tier: 'pro',
      interval: 'monthly',
    },
  });

  const proAnnual = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 28790, // $287.90 (20% off = ~$24/month)
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      tier: 'pro',
      interval: 'annual',
    },
  });

  console.log(`Created Pro product: ${proProduct.id}`);
  console.log(`  Monthly price: ${proMonthly.id} ($29.99/month)`);
  console.log(`  Annual price: ${proAnnual.id} ($287.90/year)`);

  console.log('\nAll products created successfully!');
  console.log('\nTier Summary:');
  console.log('- Free: 25 credits/month (no subscription needed)');
  console.log('- Advanced: 150 credits/month ($14.99/month or $143.90/year)');
  console.log('- Pro: 500 credits/month + Cloud Saved Projects ($29.99/month or $287.90/year)');
}

createProducts()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error creating products:', error);
    process.exit(1);
  });
