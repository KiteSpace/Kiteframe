const ORB_KEYFRAMES = `
  @keyframes kf-orb1 {
    0%   { transform: translate(0%,   0%)  scale(1);    }
    20%  { transform: translate(12%, -14%) scale(1.22); }
    45%  { transform: translate(-8%,  10%) scale(0.88); }
    70%  { transform: translate(16%,   6%) scale(1.18); }
    100% { transform: translate(0%,   0%)  scale(1);    }
  }
  @keyframes kf-orb2 {
    0%   { transform: translate(0%,    0%)  scale(1);    }
    25%  { transform: translate(-14%,  12%) scale(1.16); }
    55%  { transform: translate(10%,  -10%) scale(0.84); }
    80%  { transform: translate(-6%,   16%) scale(1.20); }
    100% { transform: translate(0%,    0%)  scale(1);    }
  }
  @keyframes kf-orb3 {
    0%   { transform: translate(0%,    0%)   scale(1);    }
    30%  { transform: translate(-10%,  -8%)  scale(1.28); }
    60%  { transform: translate(14%,   12%)  scale(0.80); }
    100% { transform: translate(0%,    0%)   scale(1);    }
  }
  @keyframes kf-orb4 {
    0%   { transform: translate(0%,   0%)  scale(1);    }
    35%  { transform: translate(18%,  -6%) scale(1.14); }
    65%  { transform: translate(-12%,  8%) scale(0.90); }
    100% { transform: translate(0%,   0%)  scale(1);    }
  }
  @keyframes kf-orb5 {
    0%   { transform: translate(0%,    0%)   scale(1);    }
    40%  { transform: translate(-6%,  -16%)  scale(1.24); }
    75%  { transform: translate(8%,    10%)  scale(0.86); }
    100% { transform: translate(0%,    0%)   scale(1);    }
  }
`;

export function GradientOrbs() {
  return (
    <>
      <style>{ORB_KEYFRAMES}</style>
      <div className="absolute pointer-events-none" style={{
        top: "-20%", left: "-15%", width: "85%", paddingTop: "85%",
        background: "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.20) 0%, rgba(139,92,246,0.09) 40%, transparent 68%)",
        borderRadius: "50%", animation: "kf-orb1 14s ease-in-out infinite", filter: "blur(8px)",
      }} />
      <div className="absolute pointer-events-none" style={{
        bottom: "-25%", right: "-10%", width: "90%", paddingTop: "90%",
        background: "radial-gradient(circle at 50% 50%, rgba(167,139,250,0.16) 0%, rgba(196,181,253,0.06) 42%, transparent 66%)",
        borderRadius: "50%", animation: "kf-orb2 18s ease-in-out infinite", filter: "blur(10px)",
      }} />
      <div className="absolute pointer-events-none" style={{
        top: "5%", left: "25%", width: "70%", paddingTop: "70%",
        background: "radial-gradient(circle at 50% 50%, rgba(139,92,246,0.12) 0%, rgba(167,139,250,0.04) 50%, transparent 70%)",
        borderRadius: "50%", animation: "kf-orb3 11s ease-in-out infinite", animationDelay: "-4s", filter: "blur(12px)",
      }} />
      <div className="absolute pointer-events-none" style={{
        top: "-5%", right: "-5%", width: "55%", paddingTop: "55%",
        background: "radial-gradient(circle at 50% 50%, rgba(192,132,252,0.15) 0%, rgba(216,180,254,0.05) 48%, transparent 68%)",
        borderRadius: "50%", animation: "kf-orb4 9s ease-in-out infinite", animationDelay: "-2s", filter: "blur(6px)",
      }} />
      <div className="absolute pointer-events-none" style={{
        bottom: "-10%", left: "5%", width: "75%", paddingTop: "75%",
        background: "radial-gradient(circle at 50% 50%, rgba(167,139,250,0.09) 0%, rgba(139,92,246,0.03) 55%, transparent 72%)",
        borderRadius: "50%", animation: "kf-orb5 22s ease-in-out infinite", animationDelay: "-8s", filter: "blur(16px)",
      }} />
    </>
  );
}
