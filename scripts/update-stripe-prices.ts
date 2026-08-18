import { getUncachableStripeClient } from '../server/stripeClient';

async function updatePrices() {
  console.log('Updating Stripe prices to new amounts...');
  const stripe = await getUncachableStripeClient();

  // Find existing products by tier metadata
  const allProducts = await stripe.products.list({ limit: 100 });
  const advancedProduct = allProducts.data.find(p => p.metadata?.tier === 'advanced');
  const proProduct = allProducts.data.find(p => p.metadata?.tier === 'pro');

  if (!advancedProduct || !proProduct) {
    console.error('Could not find Advanced or Pro products. Run seed-stripe-products.ts first.');
    process.exit(1);
  }

  console.log(`Found Advanced product: ${advancedProduct.id}`);
  console.log(`Found Pro product: ${proProduct.id}`);

  // Archive all existing prices for both products
  const existingPrices = await stripe.prices.list({ limit: 100 });
  const toArchive = existingPrices.data.filter(
    p => p.product === advancedProduct.id || p.product === proProduct.id
  );

  for (const price of toArchive) {
    if (price.active) {
      await stripe.prices.update(price.id, { active: false });
      console.log(`Archived old price: ${price.id} (${price.unit_amount} ${price.currency})`);
    }
  }

  // Create new Advanced prices — $6/mo, $60/yr ($5/mo)
  const advancedMonthly = await stripe.prices.create({
    product: advancedProduct.id,
    unit_amount: 600, // $6.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'advanced', interval: 'monthly' },
  });

  const advancedAnnual = await stripe.prices.create({
    product: advancedProduct.id,
    unit_amount: 6000, // $60.00/yr ($5/mo)
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { tier: 'advanced', interval: 'annual' },
  });

  // Set default price for Advanced
  await stripe.products.update(advancedProduct.id, {
    default_price: advancedMonthly.id,
  });

  console.log(`Created Advanced monthly: ${advancedMonthly.id} ($6.00/month)`);
  console.log(`Created Advanced annual:  ${advancedAnnual.id} ($60.00/year = $5/mo)`);

  // Create new Pro prices — $10/mo, $108/yr ($9/mo)
  const proMonthly = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 1000, // $10.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'pro', interval: 'monthly' },
  });

  const proAnnual = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 10800, // $108.00/yr ($9/mo)
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { tier: 'pro', interval: 'annual' },
  });

  // Set default price for Pro
  await stripe.products.update(proProduct.id, {
    default_price: proMonthly.id,
  });

  console.log(`Created Pro monthly: ${proMonthly.id} ($10.00/month)`);
  console.log(`Created Pro annual:  ${proAnnual.id} ($108.00/year = $9/mo)`);

  console.log('\nDone! New prices are live in Stripe.');
  console.log('The local DB will sync on next server start or webhook event.');
}

updatePrices()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
