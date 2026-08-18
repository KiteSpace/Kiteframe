import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { queryClient } from '@/lib/queryClient';

const PLAN_LABELS: Record<string, string> = {
  advanced: 'Advanced',
  pro: 'Pro',
};

const TIER_UNLOCK_STEPS: Record<string, { icon: string; label: string }[]> = {
  advanced: [
    { icon: '🪙', label: '50 AI credits added to your account daily' },
    { icon: '☁️', label: 'Cloud storage activated' },
    { icon: '✨', label: 'Workflow reasoning & PRD generation unlocked' },
    { icon: '📁', label: 'Project limit raised to 100' },
  ],
  pro: [
    { icon: '🪙', label: '200 AI credits added to your account daily' },
    { icon: '☁️', label: 'Cloud storage activated' },
    { icon: '✨', label: 'Workflow reasoning & PRD generation unlocked' },
    { icon: '🚀', label: 'Priority AI routing & GPT-5 access' },
    { icon: '♾️', label: 'Unlimited projects' },
  ],
};

const FALLBACK_STEPS = [
  { icon: '🪙', label: 'AI credits added to your account' },
  { icon: '☁️', label: 'Cloud storage activated' },
  { icon: '✨', label: 'Workflow reasoning & PRD generation unlocked' },
];

const CheckmarkSvg = () => (
  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="#22c55e" fillOpacity="0.15" />
    <path d="M4.5 8.5l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 12000;

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(0);
  const [confirmedTier, setConfirmedTier] = useState<string | null>(null);
  const [isTrialing, setIsTrialing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const startRedirect = (delaySecs: number) => {
    setSecondsLeft(delaySecs);
    let secs = delaySecs;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      secs -= 1;
      setSecondsLeft(secs);
      if (secs <= 0) {
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      }
    }, 1000);
    redirectRef.current = setTimeout(() => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setLocation('/app');
    }, delaySecs * 1000);
  };

  const confirmTier = (tier: string, trialing: boolean) => {
    stopPolling();
    setConfirmedTier(tier);
    setIsTrialing(trialing);
    queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
    queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
    startRedirect(4);
  };

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
    queryClient.invalidateQueries({ queryKey: ['/api/credits'] });

    const poll = async () => {
      try {
        const res = await fetch('/api/subscription', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.tier && data.tier !== 'free') {
          confirmTier(data.tier, data.status === 'trialing');
        }
      } catch {
        // retry silently
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setConfirmedTier('activated');
      startRedirect(3);
    }, POLL_TIMEOUT_MS);

    return () => {
      stopPolling();
      if (redirectRef.current) clearTimeout(redirectRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (!confirmedTier) return;
    const unlockSteps = TIER_UNLOCK_STEPS[confirmedTier] ?? FALLBACK_STEPS;
    if (visible < unlockSteps.length) {
      const t = setTimeout(() => setVisible(v => v + 1), 320);
      return () => clearTimeout(t);
    }
  }, [confirmedTier, visible]);

  const planName = confirmedTier && confirmedTier !== 'activated'
    ? (PLAN_LABELS[confirmedTier] ?? confirmedTier)
    : null;

  const unlockSteps = confirmedTier
    ? (TIER_UNLOCK_STEPS[confirmedTier] ?? FALLBACK_STEPS)
    : FALLBACK_STEPS;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)',
      }}
    >
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>

        {/* Headline */}
        {confirmedTier ? (
          <>
            <h1
              className="font-extrabold mb-2"
              style={{ fontSize: 28, letterSpacing: '-0.02em', color: '#0f172a', margin: '0 0 8px' }}
            >
              {planName ? `You're on ${planName}! 🎉` : "You're all set! 🎉"}
            </h1>
            <p
              className="text-sm mb-7 mx-auto"
              style={{ color: '#64748b', lineHeight: 1.65, maxWidth: 340 }}
            >
              {isTrialing
                ? "Your 7-day free trial has started. Cancel before day 7 and you won't be charged a thing."
                : planName
                  ? `Your ${planName} plan is now active. Enjoy the full experience.`
                  : 'Your subscription is now active. Enjoy the full experience.'}
            </p>
          </>
        ) : (
          <>
            <h1
              className="font-extrabold mb-2"
              style={{ fontSize: 28, letterSpacing: '-0.02em', color: '#0f172a', margin: '0 0 8px' }}
            >
              Activating your plan… ⏳
            </h1>
            <p
              className="text-sm mb-7 mx-auto"
              style={{ color: '#64748b', lineHeight: 1.65, maxWidth: 340 }}
            >
              Hang tight — confirming your subscription with Stripe. This takes just a moment.
            </p>
          </>
        )}

        {/* Trial timeline — only shown when trialing */}
        {isTrialing && (
          <div
            className="rounded-xl px-5 py-3.5 mb-7 flex items-center gap-2"
            style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}
          >
            {[
              { label: 'Today', sub: 'Trial starts', dot: 'blue', active: true },
              { label: 'Day 7', sub: 'Billing begins', dot: 'slate', active: false },
              { label: 'Anytime', sub: 'Cancel free', dot: 'green', active: false },
            ].map((item, i, arr) => (
              <div key={i} className="flex items-center flex-1">
                <div className="text-center flex-1">
                  <div
                    className="rounded-full mx-auto mb-1"
                    style={{
                      width: 10,
                      height: 10,
                      background: item.dot === 'blue' ? '#3b82f6' : item.dot === 'green' ? '#22c55e' : '#94a3b8',
                      boxShadow: item.active ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none',
                    }}
                  />
                  <div className="text-xs font-bold" style={{ color: '#0f172a' }}>{item.label}</div>
                  <div className="text-xs" style={{ color: '#64748b' }}>{item.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ flex: '0 0 24px', height: 1, background: '#bfdbfe', margin: '0 4px', marginTop: -14 }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* What's now unlocked */}
        {confirmedTier && (
          <div
            className="rounded-2xl mb-7"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', textAlign: 'left', padding: '18px 20px' }}
          >
            <div
              className="text-xs font-bold mb-3"
              style={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}
            >
              What's now unlocked
            </div>
            <div className="flex flex-col gap-2.5">
              {unlockSteps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3"
                  style={{
                    opacity: i < visible ? 1 : 0,
                    transform: i < visible ? 'translateX(0)' : 'translateX(-8px)',
                    transition: 'opacity 0.3s ease, transform 0.3s ease',
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg shrink-0 text-base"
                    style={{ width: 32, height: 32, background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                  >
                    {step.icon}
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#334155' }}>{step.label}</span>
                  <CheckmarkSvg />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pulsing dots while waiting */}
        {!confirmedTier && (
          <div className="flex justify-center mb-7">
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', opacity: 0.4,
                    animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <style>{`
              @keyframes pulse-dot {
                0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
                40% { opacity: 1; transform: scale(1); }
              }
            `}</style>
          </div>
        )}

        {/* CTA */}
        <button
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white mb-3"
          onClick={() => setLocation('/app')}
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
          }}
        >
          Go to app →
        </button>
        {secondsLeft !== null && (
          <p className="text-xs" style={{ color: '#94a3b8', margin: 0 }}>
            Redirecting automatically in {secondsLeft}s…
          </p>
        )}
      </div>
    </div>
  );
}
