import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { queryClient } from '@/lib/queryClient';

const unlockSteps = [
  { icon: '🪙', label: '50 AI credits added to your account' },
  { icon: '☁️', label: 'Cloud storage activated' },
  { icon: '✨', label: 'Workflow reasoning & PRD generation unlocked' },
  { icon: '📁', label: 'Project limit raised to 100' },
];

const CheckmarkSvg = () => (
  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="#22c55e" fillOpacity="0.15" />
    <path d="M4.5 8.5l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
    queryClient.invalidateQueries({ queryKey: ['/api/credits'] });

    const timer = setTimeout(() => setLocation('/app'), 5000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  useEffect(() => {
    if (visible < unlockSteps.length) {
      const t = setTimeout(() => setVisible(v => v + 1), 320);
      return () => clearTimeout(t);
    }
  }, [visible]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

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
        <h1
          className="font-extrabold mb-2"
          style={{ fontSize: 28, letterSpacing: '-0.02em', color: '#0f172a', margin: '0 0 8px' }}
        >
          You're on Advanced! 🎉
        </h1>
        <p
          className="text-sm mb-7 mx-auto"
          style={{ color: '#64748b', lineHeight: 1.65, maxWidth: 340 }}
        >
          Your 7-day free trial has started. Cancel before day 7 and you won't be charged a thing.
        </p>

        {/* Trial timeline */}
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
                <div
                  style={{
                    flex: '0 0 24px',
                    height: 1,
                    background: '#bfdbfe',
                    margin: '0 4px',
                    marginTop: -14,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* What's now unlocked */}
        <div
          className="rounded-2xl px-5 py-4.5 mb-7"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            textAlign: 'left',
            padding: '18px 20px',
          }}
        >
          <div
            className="text-xs font-bold mb-3"
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94a3b8',
            }}
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
                  style={{
                    width: 32,
                    height: 32,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  {step.icon}
                </div>
                <span className="text-sm font-medium" style={{ color: '#334155' }}>
                  {step.label}
                </span>
                <CheckmarkSvg />
              </div>
            ))}
          </div>
        </div>

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
        <p className="text-xs" style={{ color: '#94a3b8', margin: 0 }}>
          Redirecting automatically in {secondsLeft}s…
        </p>
      </div>
    </div>
  );
}
