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
    description: 'Advanced tier with 50 AI credits per day for power users',
    metadata: {
      tier: 'advanced',
      credits: '50',
    },
  });

  const advancedMonthly = await stripe.prices.create({
    product: advancedProduct.id,
    unit_amount: 600, // $6.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      tier: 'advanced',
      interval: 'monthly',
    },
  });

  const advancedAnnual = await stripe.prices.create({
    product: advancedProduct.id,
    unit_amount: 6000, // $60.00/yr ($5/mo)
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      tier: 'advanced',
      interval: 'annual',
    },
  });

  await stripe.products.update(advancedProduct.id, {
    default_price: advancedMonthly.id,
  });

  console.log(`Created Advanced product: ${advancedProduct.id}`);
  console.log(`  Monthly price: ${advancedMonthly.id} ($6.00/month)`);
  console.log(`  Annual price: ${advancedAnnual.id} ($60.00/year = $5/mo)`);

  // Pro tier
  console.log('Creating Pro tier product...');
  const proProduct = await stripe.products.create({
    name: 'KiteAI Pro',
    description: 'Pro tier with 150 AI credits per day and full feature access',
    metadata: {
      tier: 'pro',
      credits: '150',
      features: 'cloud_saved_projects,priority_support',
    },
  });

  const proMonthly = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 1000, // $10.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      tier: 'pro',
      interval: 'monthly',
    },
  });

  const proAnnual = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 10800, // $108.00/yr ($9/mo)
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      tier: 'pro',
      interval: 'annual',
    },
  });

  await stripe.products.update(proProduct.id, {
    default_price: proMonthly.id,
  });

  console.log(`Created Pro product: ${proProduct.id}`);
  console.log(`  Monthly price: ${proMonthly.id} ($10.00/month)`);
  console.log(`  Annual price: ${proAnnual.id} ($108.00/year = $9/mo)`);

  console.log('\nAll products created successfully!');
  console.log('\nTier Summary:');
  console.log('- Free: 25 credits/day (no subscription needed)');
  console.log('- Advanced: 50 credits/day ($6.00/month or $60.00/year)');
  console.log('- Pro: 150 credits/day ($10.00/month or $108.00/year)');
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
