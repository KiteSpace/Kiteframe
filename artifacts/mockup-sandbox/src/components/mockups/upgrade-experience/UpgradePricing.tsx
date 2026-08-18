import { useState } from "react";

const CHECK = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="#22c55e" fillOpacity="0.15" />
    <path d="M4.5 8.5l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MINUS = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="#94a3b8" fillOpacity="0.15" />
    <path d="M5 8h6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const tiers = [
  {
    id: "free",
    name: "Free",
    tagline: "Get started at no cost",
    monthlyPrice: 0,
    annualPrice: 0,
    credits: 25,
    icon: "⚡",
    iconBg: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
    iconColor: "#64748b",
    border: "1.5px solid #e2e8f0",
    highlight: false,
    badge: null,
    cta: "Current plan",
    ctaDisabled: true,
    ctaStyle: {
      background: "#f1f5f9",
      color: "#64748b",
      border: "1px solid #e2e8f0",
    },
    features: [
      { label: "25 AI credits per day", has: true },
      { label: "Visual workflow editor", has: true },
      { label: "Import & export .kiteframe files", has: true },
      { label: "Up to 20 saved projects", has: true },
      { label: "AI chat assistant", has: true },
      { label: "Workflow reasoning & generation", has: false },
      { label: "PRD document generation", has: false },
      { label: "Image-to-workflow conversion", has: false },
      { label: "Cloud-synced project storage", has: false },
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    tagline: "For power users who need more AI",
    monthlyPrice: 5,
    annualPrice: 48,
    credits: 50,
    icon: "✨",
    iconBg: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
    iconColor: "#2563eb",
    border: "2px solid #3b82f6",
    highlight: true,
    badge: "Recommended",
    cta: "Start 7-day free trial",
    ctaDisabled: false,
    ctaStyle: {
      background: "linear-gradient(135deg, #3b82f6, #2563eb)",
      color: "#ffffff",
      border: "none",
    },
    trialNote: "then $5/mo — cancel before day 7 to pay nothing",
    features: [
      { label: "50 AI credits per day", has: true },
      { label: "Visual workflow editor", has: true },
      { label: "Import & export .kiteframe files", has: true },
      { label: "Up to 100 saved projects", has: true },
      { label: "AI chat assistant", has: true },
      { label: "Workflow reasoning & generation", has: true },
      { label: "PRD document generation", has: true },
      { label: "Image-to-workflow conversion", has: false },
      { label: "Cloud-synced project storage", has: true },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For professionals & teams",
    monthlyPrice: 10,
    annualPrice: 96,
    credits: 150,
    icon: "👑",
    iconBg: "linear-gradient(135deg, #fde68a, #f59e0b)",
    iconColor: "#92400e",
    border: "1.5px solid #d1d5db",
    highlight: false,
    badge: null,
    cta: "Upgrade to Pro",
    ctaDisabled: false,
    ctaStyle: {
      background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
      color: "#ffffff",
      border: "none",
    },
    features: [
      { label: "150 AI credits per day", has: true },
      { label: "Visual workflow editor", has: true },
      { label: "Import & export .kiteframe files", has: true },
      { label: "Up to 100 saved projects", has: true },
      { label: "AI chat assistant", has: true },
      { label: "Workflow reasoning & generation", has: true },
      { label: "PRD document generation", has: true },
      { label: "Image-to-workflow conversion", has: true },
      { label: "Cloud-synced project storage", has: true },
    ],
  },
];

const creditCosts = [
  { action: "AI chat message", cost: 1, icon: "💬" },
  { action: "Workflow generate / edit", cost: 2, icon: "🔀" },
  { action: "PRD document generation", cost: 2, icon: "📄" },
  { action: "Image analysis & import", cost: 3, icon: "🖼️" },
];

const faqs = [
  {
    q: "What are AI credits?",
    a: "Credits are consumed whenever Kiteframe uses AI — generating workflows, building PRDs, or analyzing images. Your daily allowance resets every 24 hours.",
  },
  {
    q: "What happens during the 7-day trial?",
    a: "You get full Advanced access immediately. If you cancel before day 7, your card is never charged. After 7 days, billing starts automatically.",
  },
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Upgrades take effect instantly. Downgrades apply at the end of your billing period — you keep access until then.",
  },
];

export default function UpgradePricing() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
        minHeight: "100%",
        padding: "48px 32px 64px",
        boxSizing: "border-box",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Intro Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #2AF1FF 0%, #FF1F97 100%)",
            borderRadius: 12,
            padding: "12px 20px",
            textAlign: "center",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 36,
            letterSpacing: "0.01em",
          }}
        >
          🎉 Lock in introductory pricing — create an account today
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#0f172a",
              margin: "0 0 12px",
            }}
          >
            Choose your plan
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "#64748b",
              maxWidth: 480,
              margin: "0 auto 24px",
              lineHeight: 1.6,
            }}
          >
            Start free. Upgrade when you need more AI power. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: "#f1f5f9",
              borderRadius: 999,
              padding: "6px 8px",
            }}
          >
            <button
              onClick={() => setIsAnnual(false)}
              style={{
                background: !isAnnual ? "#fff" : "transparent",
                border: "none",
                borderRadius: 999,
                padding: "6px 16px",
                fontWeight: !isAnnual ? 600 : 400,
                color: !isAnnual ? "#0f172a" : "#64748b",
                cursor: "pointer",
                fontSize: 14,
                boxShadow: !isAnnual ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              style={{
                background: isAnnual ? "#fff" : "transparent",
                border: "none",
                borderRadius: 999,
                padding: "6px 16px",
                fontWeight: isAnnual ? 600 : 400,
                color: isAnnual ? "#0f172a" : "#64748b",
                cursor: "pointer",
                fontSize: 14,
                boxShadow: isAnnual ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Annual
              {isAnnual && (
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#16a34a",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 999,
                  }}
                >
                  Save 20%
                </span>
              )}
            </button>
            {!isAnnual && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#16a34a",
                  marginRight: 4,
                }}
              >
                ↑ Save 20% annually
              </span>
            )}
          </div>
        </div>

        {/* Tier Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 20,
            alignItems: "start",
            marginBottom: 48,
          }}
        >
          {tiers.map((tier) => (
            <div
              key={tier.id}
              style={{
                background: "#ffffff",
                border: tier.border,
                borderRadius: 16,
                padding: 24,
                position: "relative",
                boxShadow: tier.highlight
                  ? "0 8px 32px rgba(59,130,246,0.18), 0 2px 8px rgba(59,130,246,0.08)"
                  : "0 1px 4px rgba(0,0,0,0.06)",
                transform: tier.highlight ? "scale(1.03)" : "scale(1)",
                transition: "box-shadow 0.2s",
              }}
            >
              {/* Badge */}
              {tier.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: -13,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 14px",
                    borderRadius: 999,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⭐ {tier.badge}
                </div>
              )}

              {/* Icon + name */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: tier.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {tier.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#0f172a" }}>
                    {tier.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
                    {tier.tagline}
                  </div>
                </div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a" }}>
                    {tier.monthlyPrice === 0
                      ? "$0"
                      : isAnnual
                      ? `$${Math.round(tier.annualPrice / 12)}`
                      : `$${tier.monthlyPrice}`}
                  </span>
                  <span style={{ fontSize: 14, color: "#94a3b8" }}>/mo</span>
                </div>
                {isAnnual && tier.annualPrice > 0 && (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    billed ${tier.annualPrice}/yr
                  </div>
                )}
                {/* Credit callout */}
                <div
                  style={{
                    marginTop: 10,
                    background: tier.highlight ? "#eff6ff" : "#f8fafc",
                    borderRadius: 8,
                    padding: "7px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 14 }}>🪙</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: tier.highlight ? "#2563eb" : "#475569" }}>
                    {tier.credits} AI credits / day
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: "none", margin: "0 0 20px", padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {tier.features.map((f, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 13,
                      color: f.has ? "#334155" : "#cbd5e1",
                      textDecoration: f.has ? "none" : "none",
                    }}
                  >
                    {f.has ? <CHECK /> : <MINUS />}
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                disabled={tier.ctaDisabled}
                style={{
                  width: "100%",
                  padding: "11px 0",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: tier.ctaDisabled ? "default" : "pointer",
                  opacity: tier.ctaDisabled ? 0.7 : 1,
                  transition: "opacity 0.15s, transform 0.1s",
                  ...tier.ctaStyle,
                }}
              >
                {tier.cta}
              </button>
              {tier.trialNote && (
                <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", margin: "8px 0 0" }}>
                  {tier.trialNote}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* What do credits buy you? */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
            🪙 What does each credit get you?
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {creditCosts.map((item) => (
              <div
                key={item.action}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "10px 14px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.action}
                </div>
                <div
                  style={{
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontWeight: 700,
                    fontSize: 12,
                    padding: "3px 10px",
                    borderRadius: 999,
                  }}
                >
                  {item.cost} credit{item.cost > 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "14px 0 0" }}>
            Credits reset every 24 hours at midnight UTC. Unused credits do not roll over.
          </p>
        </div>

        {/* FAQ */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 16, textAlign: "center" }}>
            Questions? We've got answers.
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  marginBottom: 4,
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%",
                    background: "#fff",
                    border: "none",
                    padding: "14px 18px",
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  {faq.q}
                  <span style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1 }}>
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && (
                  <div
                    style={{
                      padding: "0 18px 14px",
                      fontSize: 13,
                      color: "#475569",
                      lineHeight: 1.65,
                      background: "#fff",
                    }}
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
  );
}
