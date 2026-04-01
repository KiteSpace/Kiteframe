import { useState, useEffect } from "react";

const steps = [
  { icon: "🪙", label: "50 AI credits added to your account", done: true },
  { icon: "☁️", label: "Cloud storage activated", done: true },
  { icon: "✨", label: "Workflow reasoning & PRD generation unlocked", done: true },
  { icon: "📁", label: "Project limit raised to 100", done: true },
];

export default function UpgradeSuccess() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible < steps.length) {
      const t = setTimeout(() => setVisible((v) => v + 1), 280);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const secondsLeft = 5;

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)",
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Animated checkmark */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 8px 32px rgba(59,130,246,0.35)",
            fontSize: 36,
          }}
        >
          ✓
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#0f172a",
            margin: "0 0 8px",
          }}
        >
          You're on Advanced! 🎉
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#64748b",
            lineHeight: 1.6,
            margin: "0 0 28px",
            maxWidth: 340,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Your 7-day free trial has started. Cancel before day 7 and you won't be charged a thing.
        </p>

        {/* Trial timeline */}
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            padding: "14px 20px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {[
            { label: "Today", sub: "Trial starts", dot: "blue", active: true },
            { label: "Day 7", sub: "Billing begins", dot: "slate", active: false },
            { label: "Anytime", sub: "Cancel free", dot: "green", active: false },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background:
                      item.dot === "blue"
                        ? "#3b82f6"
                        : item.dot === "green"
                        ? "#22c55e"
                        : "#94a3b8",
                    margin: "0 auto 4px",
                    boxShadow:
                      item.active ? "0 0 0 3px rgba(59,130,246,0.2)" : "none",
                  }}
                />
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{item.sub}</div>
              </div>
              {i < arr.length - 1 && (
                <div
                  style={{
                    flex: "0 0 24px",
                    height: 1,
                    background: "#bfdbfe",
                    margin: "0 4px",
                    marginTop: -14,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* What's been unlocked */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "18px 20px",
            marginBottom: 28,
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#94a3b8",
              marginBottom: 12,
            }}
          >
            What's now unlocked
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: i < visible ? 1 : 0,
                  transform: i < visible ? "translateX(0)" : "translateX(-8px)",
                  transition: "opacity 0.3s ease, transform 0.3s ease",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </div>
                <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
                  {step.label}
                </span>
                <svg
                  style={{ marginLeft: "auto", flexShrink: 0 }}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <circle cx="8" cy="8" r="8" fill="#22c55e" fillOpacity="0.15" />
                  <path
                    d="M4.5 8.5l2 2 4-4"
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          style={{
            width: "100%",
            padding: "14px 0",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(59,130,246,0.35)",
            marginBottom: 12,
          }}
        >
          Go to app →
        </button>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
          Redirecting automatically in {secondsLeft}s…
        </p>
      </div>
    </div>
  );
}
