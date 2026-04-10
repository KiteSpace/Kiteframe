import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import kiteframeIcon from "@assets/kiteframe@2x_1758226635607.png";
import { useReplitAuth } from '@/hooks/useReplitAuth';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  metadata: { tier?: string; interval?: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: { tier?: string; credits?: string; features?: string } | null;
  prices: Price[];
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="8" cy="8" r="8" fill="#22c55e" fillOpacity="0.15" />
    <path d="M4.5 8.5l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="8" cy="8" r="8" fill="#94a3b8" fillOpacity="0.15" />
    <path d="M5 8h6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const tierData = {
  free: {
    name: 'Free',
    tagline: 'Get started at no cost',
    fallbackMonthly: 0,
    fallbackAnnual: 0,
    credits: 25,
    icon: '⚡',
    iconBg: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
    highlight: false,
    badge: null as string | null,
    features: [
      { label: '25 AI credits per day', has: true },
      { label: 'Visual workflow editor', has: true },
      { label: 'Import & export .kiteframe files', has: true },
      { label: 'Up to 10 saved projects', has: true },
      { label: 'AI chat assistant', has: true },
      { label: 'Workflow reasoning & generation', has: false },
      { label: 'PRD document generation & export', has: false },
      { label: 'Image-to-workflow conversion', has: false },
      { label: 'Cloud-synced project storage', has: true },
    ],
  },
  advanced: {
    name: 'Advanced',
    tagline: 'For power users who need more AI',
    fallbackMonthly: 600,
    fallbackAnnual: 6000,
    credits: 50,
    icon: '✨',
    iconBg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    highlight: true,
    badge: 'Recommended' as string | null,
    features: [
      { label: '50 AI credits per day', has: true },
      { label: 'Visual workflow editor', has: true },
      { label: 'Import & export .kiteframe files', has: true },
      { label: 'Up to 50 saved projects', has: true },
      { label: 'AI chat assistant', has: true },
      { label: 'Workflow reasoning & generation', has: true },
      { label: 'PRD document generation & export', has: true },
      { label: 'Image-to-workflow conversion', has: true },
      { label: 'Cloud-synced project storage', has: true },
    ],
  },
  pro: {
    name: 'Pro',
    tagline: 'For professionals',
    fallbackMonthly: 1000,
    fallbackAnnual: 10800,
    credits: 150,
    icon: '👑',
    iconBg: 'linear-gradient(135deg, #fde68a, #f59e0b)',
    highlight: false,
    badge: null as string | null,
    features: [
      { label: '150 AI credits per day', has: true },
      { label: 'Visual workflow editor', has: true },
      { label: 'Import & export .kiteframe files', has: true },
      { label: 'Up to 100 saved projects', has: true },
      { label: 'AI chat assistant', has: true },
      { label: 'Workflow reasoning & generation', has: true },
      { label: 'PRD document generation & export', has: true },
      { label: 'Image-to-workflow conversion', has: true },
      { label: 'Cloud-synced project storage', has: true },
    ],
  },
};

const creditCosts = [
  { action: 'AI chat message', cost: 1, icon: '💬' },
  { action: 'Workflow generate / edit', cost: 3, icon: '🔀' },
  { action: 'PRD document generation', cost: 3, icon: '📄' },
  { action: 'Image analysis & import', cost: 5, icon: '🖼️' },
];

const faqs = [
  {
    q: 'What are AI credits?',
    a: 'Credits are consumed whenever Kiteframe uses AI — generating workflows, building PRDs, or analyzing images. Your daily allowance resets every 24 hours.',
  },
  {
    q: 'What happens during the 7-day trial?',
    a: 'You get full Advanced access immediately. If you cancel before day 7, your card is never charged. After 7 days, billing starts automatically.',
  },
  {
    q: 'Can I upgrade or downgrade anytime?',
    a: 'Yes. Upgrades take effect instantly. Downgrades apply at the end of your billing period — you keep access until then.',
  },
  {
    q: 'What are cloud-synced projects?',
    a: 'Advanced and Pro users can save workflows to the cloud, access them from any device, and keep them backed up automatically.',
  },
];

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { isAuthenticated: isReplitAuthenticated } = useReplitAuth();
  const { isAuthenticated: isFirebaseAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['/api/products'],
  });

  // Single subscription query: ungated so Passport.js session users are detected too.
  // retry: false avoids retrying 401s for unauthenticated visitors.
  const { data: subscriptionData, isLoading: subLoading, error: subError } = useQuery<{ tier?: string; status?: string; billingPeriodEnd?: string }>({
    queryKey: ['/api/subscription'],
    retry: false,
  });

  // isServerAuthenticated: subscription query succeeded → user has a backend session
  const isServerAuthenticated = !subLoading && !subError && subscriptionData !== undefined;
  const isAuthenticated = isReplitAuthenticated || isFirebaseAuthenticated || isServerAuthenticated;

  const checkoutMutation = useMutation({
    mutationFn: async ({ priceId, trial }: { priceId: string; trial?: boolean }) => {
      const response = await apiRequest('POST', '/api/checkout', { priceId, trial: trial ?? false });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: 'Checkout Failed',
        description: error.message || 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const products = productsData?.data || [];
  const currentTier = (subscriptionData?.tier as 'free' | 'advanced' | 'pro') || 'free';

  const advancedProduct = products.find(p => p.metadata?.tier === 'advanced');
  const proProduct = products.find(p => p.metadata?.tier === 'pro');

  const getPriceForInterval = (product: Product, interval: 'month' | 'year') =>
    product.prices.find(p => p.recurring?.interval === interval);

  const getDisplayPrice = (tierId: 'free' | 'advanced' | 'pro') => {
    const meta = tierData[tierId];
    if (tierId === 'free') return { monthly: 0, annual: 0 };

    const product = tierId === 'advanced' ? advancedProduct : proProduct;
    if (!product) {
      const fallbackMonthly = meta.fallbackMonthly / 100;
      return {
        monthly: fallbackMonthly,
        annual: Math.round((meta.fallbackAnnual / 100) / 12),
        annualTotal: meta.fallbackAnnual / 100,
      };
    }

    const monthlyPrice = getPriceForInterval(product, 'month')?.unit_amount || meta.fallbackMonthly;
    const annualPrice = getPriceForInterval(product, 'year')?.unit_amount || null;
    return {
      monthly: monthlyPrice / 100,
      annual: annualPrice ? Math.round(annualPrice / 12 / 100 * 100) / 100 : Math.round(monthlyPrice / 100 * 0.8 * 100) / 100,
      annualTotal: annualPrice ? annualPrice / 100 : Math.round(monthlyPrice / 100 * 0.8 * 12 * 100) / 100,
    };
  };

  const handleSelectPlan = (priceId: string, trial?: boolean) => {
    if (!isAuthenticated) {
      window.location.href = '/api/login';
      return;
    }
    checkoutMutation.mutate({ priceId, trial });
  };

  const openBillingPortal = async () => {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const getCtaForTier = (tierId: 'free' | 'advanced' | 'pro') => {
    if (tierId === 'free') {
      if (!isAuthenticated) {
        return {
          label: 'Create free account',
          disabled: false,
          showSpinner: false,
          onClick: () => { window.location.href = '/signin'; },
          style: {
            background: 'linear-gradient(135deg, #0f172a, #334155)',
            color: '#ffffff',
            border: 'none',
          } as CSSProperties,
        };
      }
      const isDowngrade = currentTier !== 'free';
      return {
        label: currentTier === 'free' ? 'Current plan' : 'Downgrade to Free',
        disabled: currentTier === 'free',
        showSpinner: false,
        onClick: isDowngrade ? openBillingPortal : undefined,
        style: {
          background: '#f1f5f9',
          color: '#64748b',
          border: '1px solid #e2e8f0',
        } as CSSProperties,
      };
    }
    if (tierId === 'advanced') {
      const isCurrent = currentTier === 'advanced';
      const isDowngrade = currentTier === 'pro';
      const price = advancedProduct
        ? (isAnnual
          ? getPriceForInterval(advancedProduct, 'year')
          : getPriceForInterval(advancedProduct, 'month'))
        : undefined;
      const hasPrice = !!price;
      const label = isCurrent
        ? 'Current plan'
        : isDowngrade
        ? 'Downgrade to Advanced'
        : 'Start 7-day free trial';
      return {
        label,
        disabled: isCurrent || (isDowngrade ? false : !hasPrice),
        showSpinner: !isCurrent && !isDowngrade && checkoutMutation.isPending,
        onClick: isCurrent ? undefined : isDowngrade ? openBillingPortal : !hasPrice ? undefined : () => {
          handleSelectPlan(price!.id, true);
        },
        style: {
          background: isCurrent || isDowngrade ? '#f1f5f9' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          color: isCurrent || isDowngrade ? '#64748b' : '#ffffff',
          border: 'none',
        } as CSSProperties,
        trialNote: (!isCurrent && !isDowngrade) ? `then $${getDisplayPrice('advanced').monthly}/mo · cancel before day 7 to pay nothing` : null,
      };
    }
    // pro
    const isCurrent = currentTier === 'pro';
    const price = proProduct
      ? (isAnnual
        ? getPriceForInterval(proProduct, 'year')
        : getPriceForInterval(proProduct, 'month'))
      : undefined;
    const hasPrice = !!price;
    return {
      label: isCurrent ? 'Current plan' : 'Upgrade to Pro',
      disabled: isCurrent || checkoutMutation.isPending || !hasPrice,
      showSpinner: !isCurrent && checkoutMutation.isPending,
      onClick: isCurrent || !hasPrice ? undefined : () => {
        handleSelectPlan(price!.id, false);
      },
      style: {
        background: isCurrent ? '#f1f5f9' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
        color: isCurrent ? '#64748b' : '#ffffff',
        border: 'none',
      } as CSSProperties,
    };
  };

  if (productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const tiers = (['free', 'advanced', 'pro'] as const);

  return (
    <div
      className="min-h-screen"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        color: '#0f172a',
      }}
    >
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 h-14 bg-[#f8fafc]/95 backdrop-blur-sm">
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-2 no-underline"
          style={{ color: '#0f172a' }}
        >
          <img src={kiteframeIcon} alt="Kiteframe" className="w-7 h-7" />
          <span className="font-bold text-[15px] tracking-tight">Kiteframe</span>
        </a>

        {/* Auth actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <a
              href="/app"
              className="inline-flex items-center px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-85"
              style={{ background: '#0f172a', color: '#f8fafc', textDecoration: 'none' }}
            >
              Go to app →
            </a>
          ) : (
            <a
              href="/signin"
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors hover:text-slate-900"
              style={{ color: '#475569', textDecoration: 'none' }}
            >
              Sign in
            </a>
          )}
        </div>
      </nav>

      <div style={{ padding: '48px 32px 80px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div className="text-center mb-9">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3" style={{ color: '#0f172a' }}>
            Choose your plan
          </h1>
          <p className="text-base mb-6 mx-auto" style={{ color: '#64748b', maxWidth: 480, lineHeight: 1.65 }}>
            Start free. Upgrade when you need more AI power. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div
            className="inline-flex items-center gap-1 rounded-full p-1.5"
            style={{ background: '#f1f5f9' }}
          >
            <button
              onClick={() => setIsAnnual(false)}
              className="rounded-full px-4 py-1.5 text-sm transition-all"
              style={{
                background: !isAnnual ? '#fff' : 'transparent',
                fontWeight: !isAnnual ? 600 : 400,
                color: !isAnnual ? '#0f172a' : '#64748b',
                border: 'none',
                cursor: 'pointer',
                boxShadow: !isAnnual ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className="rounded-full px-4 py-1.5 text-sm flex items-center gap-2 transition-all"
              style={{
                background: isAnnual ? '#fff' : 'transparent',
                fontWeight: isAnnual ? 600 : 400,
                color: isAnnual ? '#0f172a' : '#64748b',
                border: 'none',
                cursor: 'pointer',
                boxShadow: isAnnual ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Annual
              {isAnnual && (
                <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  Save up to 17%
                </span>
              )}
            </button>
            {!isAnnual && (
              <span className="text-xs font-semibold mr-1" style={{ color: '#16a34a' }}>
                ↑ Save with annual billing
              </span>
            )}
          </div>
        </div>

        {/* Tier Cards */}
        <div
          className="grid grid-cols-3 gap-5 mb-12"
          style={{ alignItems: 'start' }}
        >
          {tiers.map((tierId) => {
            const meta = tierData[tierId];
            const prices = getDisplayPrice(tierId);
            const cta = getCtaForTier(tierId);

            return (
              <div
                key={tierId}
                className="relative rounded-2xl p-6"
                style={{
                  background: '#fff',
                  border: meta.highlight ? '2px solid #3b82f6' : '1.5px solid #e2e8f0',
                  boxShadow: meta.highlight
                    ? '0 8px 32px rgba(59,130,246,0.18), 0 2px 8px rgba(59,130,246,0.08)'
                    : '0 1px 4px rgba(0,0,0,0.06)',
                  transform: meta.highlight ? 'scale(1.03)' : 'scale(1)',
                }}
                data-testid={`card-tier-${tierId}`}
              >
                {/* Recommended badge */}
                {meta.badge && (
                  <div
                    className="absolute text-xs font-bold px-3.5 py-1 rounded-full text-white"
                    style={{
                      top: -13,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⭐ {meta.badge}
                  </div>
                )}

                {/* Icon + name */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex items-center justify-center text-xl rounded-xl shrink-0"
                    style={{ width: 40, height: 40, background: meta.iconBg }}
                  >
                    {meta.icon}
                  </div>
                  <div>
                    <div className="font-bold text-lg" style={{ color: '#0f172a' }}>{meta.name}</div>
                    <div className="text-xs" style={{ color: '#94a3b8', marginTop: 1 }}>{meta.tagline}</div>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-extrabold" style={{ fontSize: 38, letterSpacing: '-0.03em', color: '#0f172a' }}>
                      {tierId === 'free'
                        ? '$0'
                        : isAnnual
                        ? `$${prices.annual}`
                        : `$${prices.monthly}`}
                    </span>
                    <span className="text-sm" style={{ color: '#94a3b8' }}>/mo</span>
                  </div>
                  {isAnnual && tierId !== 'free' && (
                    <div className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                      billed ${prices.annualTotal}/yr
                    </div>
                  )}
                  {/* Credit callout */}
                  <div
                    className="mt-2.5 rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                    style={{
                      background: meta.highlight ? '#eff6ff' : '#f8fafc',
                    }}
                  >
                    <span className="text-sm">🪙</span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: meta.highlight ? '#2563eb' : '#475569' }}
                    >
                      {meta.credits} AI credits / day
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="mb-5 flex flex-col gap-2.5 p-0 list-none">
                  {meta.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {f.has ? <CheckIcon /> : <MinusIcon />}
                      <span className="text-sm" style={{ color: f.has ? '#334155' : '#cbd5e1' }}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  disabled={cta.disabled}
                  onClick={cta.onClick}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity"
                  style={{
                    ...cta.style,
                    opacity: cta.disabled ? 0.7 : 1,
                    cursor: cta.disabled ? 'default' : 'pointer',
                  }}
                  data-testid={`button-select-${tierId}`}
                >
                  {cta.showSpinner ? (
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  ) : null}
                  {cta.label}
                </button>

                {'trialNote' in cta && cta.trialNote && (
                  <p className="text-xs text-center mt-2" style={{ color: '#94a3b8' }}>
                    {cta.trialNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Credit cost reference */}
        <div
          className="rounded-2xl p-6 mb-10"
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        >
          <div className="text-sm font-bold mb-4" style={{ color: '#0f172a' }}>
            🪙 What does each credit get you?
          </div>
          <div className="grid grid-cols-2 gap-3">
            {creditCosts.map((item) => (
              <div
                key={item.action}
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                style={{ background: '#fff', border: '1px solid #e2e8f0' }}
              >
                <div className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
                  <span className="text-base">{item.icon}</span>
                  {item.action}
                </div>
                <div
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: '#eff6ff', color: '#2563eb' }}
                >
                  {item.cost} credit{item.cost > 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3.5" style={{ color: '#94a3b8' }}>
            Credits reset every 24 hours at midnight UTC. Unused credits do not roll over.
          </p>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold text-center mb-4" style={{ color: '#0f172a' }}>
            Questions? We've got answers.
          </h2>
          <div className="flex flex-col gap-1">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden mb-1"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-semibold"
                  style={{ background: '#fff', border: 'none', cursor: 'pointer', color: '#0f172a' }}
                >
                  {faq.q}
                  <span className="text-lg ml-4 shrink-0" style={{ color: '#94a3b8', lineHeight: 1 }}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div
                    className="px-4 pb-3.5 text-sm"
                    style={{ background: '#fff', color: '#475569', lineHeight: 1.65 }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
