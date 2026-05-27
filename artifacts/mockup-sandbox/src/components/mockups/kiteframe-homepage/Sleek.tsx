import { useEffect, useRef } from "react";
import { Check, ArrowRight, Zap, Shield, Download, Users, Palette, Code, Rocket, Github, Chrome, Terminal } from "lucide-react";

/* ─────────────────────────────────────────────
   Authentic Kiteframe node rendered in SVG
   Mirrors: bg-white border-2 border-gray-200 rounded-lg shadow-md
   with blue connection handles and type/label/description layout
───────────────────────────────────────────── */
interface KFNodeProps {
  x: number;
  y: number;
  w?: number;
  h?: number;
  type: string;
  label: string;
  desc?: string;
  typeColor?: string;
  selected?: boolean;
  handles?: ("top"|"bottom"|"left"|"right")[];
}

const TYPE_COLORS: Record<string, string> = {
  input:     "#8b5cf6",
  process:   "#3b82f6",
  condition: "#f59e0b",
  output:    "#10b981",
  ai:        "#7c3aed",
};

function KFNode({ x, y, w = 190, h = 72, type, label, desc, selected, handles = ["right","bottom"] }: KFNodeProps) {
  const r = 8;
  const tc = TYPE_COLORS[type] ?? "#6b7280";
  const selColor = "#ef4444"; // ring-red-500 matching actual code

  return (
    <g>
      {/* Drop shadow */}
      <rect x={x+2} y={y+4} width={w} height={h} rx={r} fill="rgba(0,0,0,0.07)" />
      {/* Selection ring */}
      {selected && <rect x={x-2} y={y-2} width={w+4} height={h+4} rx={r+2} fill="none" stroke={selColor} strokeWidth="2.5" />}
      {/* Card body */}
      <rect x={x} y={y} width={w} height={h} rx={r} fill="white" stroke="#e5e7eb" strokeWidth="1.5" />
      {/* Type badge strip */}
      <rect x={x+10} y={y+10} width={50} height={13} rx={4} fill={tc + "18"} />
      <text x={x+14} y={y+20} fontSize="8.5" fontWeight="600" fill={tc} fontFamily="system-ui" letterSpacing="0.04em">
        {type.toUpperCase()}
      </text>
      {/* Label */}
      <text x={x+10} y={y+40} fontSize="12.5" fontWeight="600" fill="#111827" fontFamily="system-ui">{label}</text>
      {/* Description */}
      {desc && <text x={x+10} y={y+56} fontSize="10" fill="#9ca3af" fontFamily="system-ui">{desc}</text>}
      {/* Connection handles — blue circles, matching stroke="#3b82f6" */}
      {handles.includes("right")  && <circle cx={x+w} cy={y+h/2} r={5} fill="white" stroke="#3b82f6" strokeWidth="1.8" />}
      {handles.includes("bottom") && <circle cx={x+w/2} cy={y+h} r={5} fill="white" stroke="#3b82f6" strokeWidth="1.8" />}
      {handles.includes("left")   && <circle cx={x} cy={y+h/2} r={5} fill="white" stroke="#3b82f6" strokeWidth="1.8" />}
      {handles.includes("top")    && <circle cx={x+w/2} cy={y} r={5} fill="white" stroke="#3b82f6" strokeWidth="1.8" />}
    </g>
  );
}

/* Cubic bezier edge between two points */
function KFEdge({ x1, y1, x2, y2, color = "#d1d5db", dashed = false }: {
  x1: number; y1: number; x2: number; y2: number; color?: string; dashed?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
  return (
    <path d={d} stroke={color} strokeWidth="1.8" fill="none"
      strokeDasharray={dashed ? "5 4" : undefined}
      markerEnd="url(#arrowhead)" />
  );
}

/* Main hero workflow diagram — authentic Kiteframe look */
function HeroWorkflow() {
  return (
    <svg viewBox="0 0 540 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#d1d5db" />
        </marker>
        <marker id="arrowhead-purple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#8b5cf6" />
        </marker>
      </defs>

      {/* Subtle canvas background */}
      <rect width="540" height="340" rx="0" fill="#fafbfc" />

      {/* Kiteframe toolbar strip at top */}
      <rect x="0" y="0" width="540" height="36" fill="white" />
      <rect x="0" y="36" width="540" height="1" fill="#e5e7eb" />
      {/* Toolbar icons */}
      <rect x="10" y="10" width="16" height="16" rx="3" fill="#f3f4f6" />
      <rect x="32" y="10" width="16" height="16" rx="3" fill="#f3f4f6" />
      <rect x="54" y="10" width="16" height="16" rx="3" fill="#f3f4f6" />
      <rect x="78" y="10" width="1" height="16" fill="#e5e7eb" />
      <rect x="86" y="10" width="16" height="16" rx="3" fill="#7c3aed" />
      <rect x="108" y="10" width="16" height="16" rx="3" fill="#f3f4f6" />
      {/* Zoom controls right side */}
      <rect x="440" y="10" width="90" height="16" rx="8" fill="#f3f4f6" />
      <text x="452" y="22" fontSize="9" fill="#9ca3af" fontFamily="system-ui">⌘  100%  +  −</text>

      {/* Canvas content: nodes + edges */}
      {/* Edges first (behind nodes) */}
      <KFEdge x1={195} y1={109} x2={230} y2={152} color="#c4b5fd" />
      <KFEdge x1={420} y1={126} x2={300} y2={172} color="#c4b5fd" />
      <KFEdge x1={300+95} y1={208} x2={410} y2={260} color="#8b5cf6" />
      <KFEdge x1={195} y1={109} x2={80} y2={195} color="#e5e7eb" dashed />

      {/* Nodes */}
      <KFNode x={5}   y={73}  type="input"     label="User Request"  desc="form submission"  handles={["right","bottom"]} />
      <KFNode x={230} y={116} type="process"   label="Validate"      desc="schema check"     handles={["right","left","bottom"]} />
      <KFNode x={230} y={195} type="ai"        label="Generate PRD"  desc="claude-sonnet-4"  selected handles={["right","left"]}  w={180}/>
      <KFNode x={410} y={225} type="output"    label="PRD Ready"     desc="1,240 words"      handles={["top","left"]}  w={120} h={60}/>
      <KFNode x={5}   y={195} type="condition" label="Review?"       handles={["right","top"]} w={160}/>
      {/* Second row — process chain */}
      <KFNode x={280} y={73}  type="process"   label="Notify Team"   desc="email + slack"    handles={["left","bottom"]} w={150}/>
    </svg>
  );
}

/* ── Section feature mockup: 4 nodes in a grid showing different states ── */
function CanvasMockup() {
  return (
    <svg viewBox="0 0 480 280" className="w-full h-full">
      <rect width="480" height="280" fill="#fafbfc" />

      {/* Toolbar */}
      <rect width="480" height="32" fill="white" />
      <rect y="32" width="480" height="1" fill="#e5e7eb" />
      <rect x="8" y="8" width="14" height="14" rx="3" fill="#f3f4f6" />
      <rect x="28" y="8" width="14" height="14" rx="3" fill="#f3f4f6" />
      <rect x="48" y="8" width="14" height="14" rx="3" fill="#7c3aed" />
      {/* auto-layout buttons */}
      {["Horiz", "Vert", "Grid", "Circ"].map((t, i) => (
        <g key={t}>
          <rect x={280 + i * 50} y={8} width={44} height={16} rx={4} fill={i === 0 ? "#f5f3ff" : "#f3f4f6"} />
          <text x={286 + i * 50} y={20} fontSize="8" fill={i === 0 ? "#7c3aed" : "#6b7280"} fontFamily="system-ui">{t}</text>
        </g>
      ))}

      {/* Edges */}
      <path d="M 196 118 C 216 118 220 158 236 158" stroke="#d1d5db" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead2)" />
      <path d="M 196 198 C 216 198 220 238 236 238" stroke="#c4b5fd" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />

      <defs>
        <marker id="arrowhead2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0,0 L0,5 L5,2.5 z" fill="#d1d5db" />
        </marker>
      </defs>

      {/* 4 nodes */}
      <KFNode x={8}   y={48}  w={180} h={68} type="input"     label="Start" handles={["right","bottom"]} />
      <KFNode x={236} y={128} w={180} h={68} type="process"   label="Process" handles={["left","right","bottom"]} />
      <KFNode x={8}   y={168} w={180} h={68} type="condition" label="Decision?" handles={["right","bottom"]} />
      <KFNode x={236} y={208} w={180} h={68} type="output"    label="Output" handles={["top","left"]} />

      {/* Selection indicator */}
      <rect x="8" y="248" width="140" height="22" rx="11" fill="white" stroke="#e5e7eb" strokeWidth="1" />
      <circle cx="24" cy="259" r="4" fill="#22c55e" />
      <text x="34" y="263" fontSize="9" fill="#6b7280" fontFamily="system-ui">4 nodes  ·  ⌘A to select all</text>
    </svg>
  );
}

/* ── AI section mockup ── */
function AIMockup() {
  return (
    <div className="space-y-3">
      {/* Chat input */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-gray-500 font-medium">KiteAI</span>
          <span className="ml-auto text-[10px] text-gray-400 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200">claude-sonnet-4</span>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 font-mono mb-3">
          Generate a user onboarding workflow with email verification
        </div>
        <div className="flex items-center gap-2 text-xs text-violet-600 font-medium">
          <Zap className="w-3 h-3" />
          Generating 6 nodes…
        </div>
      </div>

      {/* Generated mini-nodes */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { type: "input",   label: "Welcome",      color: TYPE_COLORS.input },
          { type: "process", label: "Send email",   color: TYPE_COLORS.process },
          { type: "output",  label: "Onboarding",   color: TYPE_COLORS.output },
        ].map(({ type, label, color }) => (
          <div key={label} className="bg-white rounded-xl border-2 border-gray-200 px-3 py-2.5 shadow-sm">
            <div className="text-[9px] font-semibold uppercase mb-1.5 px-1.5 py-0.5 rounded inline-block"
              style={{ color, backgroundColor: color + "18" }}>
              {type}
            </div>
            <div className="text-xs font-semibold text-gray-900 truncate">{label}</div>
          </div>
        ))}
      </div>

      {/* PRD pill */}
      <div className="bg-violet-50 rounded-xl border border-violet-100 px-4 py-3 flex items-center gap-3">
        <Check className="w-4 h-4 text-violet-600 shrink-0" />
        <span className="text-xs text-violet-700 font-medium">PRD auto-generated — 1,180 words</span>
      </div>
    </div>
  );
}

const TYPE_COLORS_EXPORT: Record<string, string> = TYPE_COLORS;

/* ── Animated gradient orb background ── */
function GradientBackground() {
  return (
    <>
      <style>{`
        @keyframes kf-orb1 {
          0%   { transform: translate(0%,    0%)   scale(1);    }
          20%  { transform: translate(12%,  -14%)  scale(1.22); }
          45%  { transform: translate(-8%,   10%)  scale(0.88); }
          70%  { transform: translate(16%,   6%)   scale(1.18); }
          100% { transform: translate(0%,    0%)   scale(1);    }
        }
        @keyframes kf-orb2 {
          0%   { transform: translate(0%,    0%)   scale(1);    }
          25%  { transform: translate(-14%,  12%)  scale(1.16); }
          55%  { transform: translate(10%,  -10%)  scale(0.84); }
          80%  { transform: translate(-6%,   16%)  scale(1.20); }
          100% { transform: translate(0%,    0%)   scale(1);    }
        }
        @keyframes kf-orb3 {
          0%   { transform: translate(0%,    0%)   scale(1);    }
          30%  { transform: translate(-10%,  -8%)  scale(1.28); }
          60%  { transform: translate(14%,   12%)  scale(0.80); }
          100% { transform: translate(0%,    0%)   scale(1);    }
        }
        @keyframes kf-orb4 {
          0%   { transform: translate(0%,    0%)   scale(1);    }
          35%  { transform: translate(18%,  -6%)   scale(1.14); }
          65%  { transform: translate(-12%,  8%)   scale(0.90); }
          100% { transform: translate(0%,    0%)   scale(1);    }
        }
        @keyframes kf-orb5 {
          0%   { transform: translate(0%,    0%)   scale(1);    }
          40%  { transform: translate(-6%,  -16%)  scale(1.24); }
          75%  { transform: translate(8%,    10%)  scale(0.86); }
          100% { transform: translate(0%,    0%)   scale(1);    }
        }
      `}</style>

      {/* Orb 1 — large deep violet, anchored top-left, sweeps right */}
      <div className="absolute pointer-events-none" style={{
        top: "-20%", left: "-15%",
        width: "85%", paddingTop: "85%",
        background: "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.22) 0%, rgba(139,92,246,0.10) 40%, transparent 68%)",
        borderRadius: "50%",
        animation: "kf-orb1 14s ease-in-out infinite",
        filter: "blur(8px)",
      }} />

      {/* Orb 2 — large lavender, anchored bottom-right, counter-sweeps */}
      <div className="absolute pointer-events-none" style={{
        bottom: "-25%", right: "-10%",
        width: "90%", paddingTop: "90%",
        background: "radial-gradient(circle at 50% 50%, rgba(167,139,250,0.18) 0%, rgba(196,181,253,0.07) 42%, transparent 66%)",
        borderRadius: "50%",
        animation: "kf-orb2 18s ease-in-out infinite",
        filter: "blur(10px)",
      }} />

      {/* Orb 3 — mid violet, center, pulses large */}
      <div className="absolute pointer-events-none" style={{
        top: "5%", left: "25%",
        width: "70%", paddingTop: "70%",
        background: "radial-gradient(circle at 50% 50%, rgba(139,92,246,0.13) 0%, rgba(167,139,250,0.05) 50%, transparent 70%)",
        borderRadius: "50%",
        animation: "kf-orb3 11s ease-in-out infinite",
        animationDelay: "-4s",
        filter: "blur(12px)",
      }} />

      {/* Orb 4 — bright violet accent, top-right, fast */}
      <div className="absolute pointer-events-none" style={{
        top: "-5%", right: "-5%",
        width: "55%", paddingTop: "55%",
        background: "radial-gradient(circle at 50% 50%, rgba(192,132,252,0.16) 0%, rgba(216,180,254,0.06) 48%, transparent 68%)",
        borderRadius: "50%",
        animation: "kf-orb4 9s ease-in-out infinite",
        animationDelay: "-2s",
        filter: "blur(6px)",
      }} />

      {/* Orb 5 — wide diffuse wash, bottom-left, very slow */}
      <div className="absolute pointer-events-none" style={{
        bottom: "-10%", left: "5%",
        width: "75%", paddingTop: "75%",
        background: "radial-gradient(circle at 50% 50%, rgba(167,139,250,0.10) 0%, rgba(139,92,246,0.04) 55%, transparent 72%)",
        borderRadius: "50%",
        animation: "kf-orb5 22s ease-in-out infinite",
        animationDelay: "-8s",
        filter: "blur(16px)",
      }} />
    </>
  );
}

export function Sleek() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[17px] font-bold text-gray-900 tracking-tight">Kiteframe</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-violet-100 text-violet-700 rounded-full uppercase">
              Early Access
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <a href="#" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-50">FAQ</a>
            <a href="#" className="ml-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-50">
              Already have an account? <span className="text-violet-600 font-medium">Sign in</span>
            </a>
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-20 pb-20">
        <GradientBackground />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">

            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
                AI-powered workflow editor
              </div>

              <h1 className="text-[52px] leading-[1.08] font-extrabold text-gray-900 tracking-tight mb-5">
                Kiteframe helps<br />
                ideas{" "}
                <span style={{ color: "#7c3aed" }}>take flight</span>
              </h1>

              <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-[480px]">
                An AI-powered visual workflow editor for product alignment,
                connecting designs to execution, and generating PRDs — all in
                one place.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  Create an Account
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 transition-all active:scale-[0.98]">
                  Learn More
                </button>
              </div>

              <p className="mt-5 text-xs text-gray-400">
                From idea to handoff — powered by AI
              </p>
            </div>

            {/* Right: Kiteframe canvas window */}
            <div className="relative">
              <div
                className="rounded-2xl overflow-hidden border border-gray-200"
                style={{ boxShadow: "0 32px 64px -12px rgba(124,58,237,0.12), 0 8px 24px -4px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)" }}
              >
                {/* Window chrome */}
                <div className="bg-[#f1f2f4] px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-xs text-gray-400 ml-2">Max Altitude · Kiteframe</span>
                </div>
                <div style={{ height: 310 }}>
                  <HeroWorkflow />
                </div>
              </div>

              {/* Floating PRD badge */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)" }}>
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900">PRD Generated</div>
                  <div className="text-[10px] text-gray-400">2s ago · 1,240 words</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="border-y border-gray-100 bg-gray-50/50 py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 divide-x divide-gray-200">
            {[
              { Icon: Shield,   title: "Early Access",    sub: "Exclusive early access" },
              { Icon: Zap,      title: "AI-Powered",      sub: "Intelligent generation" },
              { Icon: Download, title: "Export Everything", sub: "No lock-in, ever" },
            ].map(({ Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-4 px-8 justify-center">
                <Icon className="w-5 h-5 text-violet-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{title}</div>
                  <div className="text-xs text-gray-500">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION A: Ready out-of-the-box ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col gap-12">
          {/* Top row: copy left, checklist right */}
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Canvas</p>
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
                Ready out-of-the-box
              </h2>
              <p className="text-lg text-gray-500 leading-relaxed">
                Drag, zoom, pan, select multiple nodes — everything works from the
                start. No setup required. Just open and start building your workflows.
              </p>
            </div>
            <ul className="space-y-3.5">
              {[
                "Intuitive drag-and-drop interface",
                "Smooth zoom and pan controls",
                "Multi-select and batch editing",
                "Keyboard shortcuts for power users",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-600 text-sm">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom row: full-width canvas demo */}
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg w-full" style={{ height: 440 }}>
            <CanvasMockup />
          </div>
        </div>
      </section>

      {/* ── CALLOUT: Not just diagramming ── */}
      <section className="relative overflow-hidden bg-gray-50 border-y border-gray-100 py-20">
        {/* subtle gradient hint */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]"
          style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-3 leading-tight">
            Not just the basic diagramming nodes
          </h2>
          <p className="text-lg font-medium text-violet-600 mb-5">A canvas built for real product work</p>
          <p className="text-gray-500 leading-relaxed">
            Kiteframe goes beyond basic boxes and arrows with rich, extensible building blocks designed
            for how teams actually work—supporting structure, logic, data, and context in one unified
            workflow. This isn't just diagramming; it's a system for thinking, aligning, and shipping together.
          </p>
        </div>
      </section>

      {/* ── SECTION B: More than just nodes ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Visual: node type showcase */}
          <div className="grid grid-cols-2 gap-3">
            {/* Each card looks like an actual Kiteframe node, larger */}
            {([
              { type: "ai",        label: "Generate PRD",   desc: "claude-sonnet-4" },
              { type: "condition", label: "Review?",        desc: "branch logic" },
              { type: "input",     label: "User Request",   desc: "form submission" },
              { type: "output",    label: "PRD Ready",      desc: "1,240 words" },
            ] as const).map(({ type, label, desc }) => {
              const color = TYPE_COLORS_EXPORT[type] ?? "#6b7280";
              return (
                <div key={label} className="bg-white rounded-xl border-2 border-gray-200 shadow-md p-4 relative">
                  {/* Connection handles at corners */}
                  <div className="absolute -right-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-400" />
                  <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-400" />
                  <span className="inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded mb-2"
                    style={{ color, backgroundColor: color + "18" }}>
                    {type}
                  </span>
                  <div className="font-semibold text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                </div>
              );
            })}
          </div>

          {/* Text */}
          <div>
            <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Context</p>
            <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
              More than just nodes
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed">
              Add context to your workflows with sticky notes, shapes, text
              annotations, and link previews. Everything you need to
              communicate ideas clearly.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION C: AI-assisted ── */}
      <section className="relative overflow-hidden bg-gray-50 border-y border-gray-100 py-24">
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px]"
          style={{ background: "radial-gradient(ellipse at bottom right, rgba(139,92,246,0.08) 0%, transparent 65%)" }} />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Intelligence</p>
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
                AI-assisted,<br />human-controlled
              </h2>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Generate workflows from natural language prompts. Analyze Figma
                designs. Create PRDs automatically. The AI helps you move faster
                while you stay in control.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Generate workflows from text descriptions",
                  "Import and analyze Figma designs",
                  "Auto-generate PRDs from workflows",
                  "Privacy-first with local AI options",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-600 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
                      <Check className="w-3 h-3" style={{ color: "#7c3aed" }} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <AIMockup />
          </div>
        </div>
      </section>

      {/* ── TEAM SECTION ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">Built for cross-functional teams</h2>
          <p className="text-lg text-gray-500">A shared language for everyone involved in building products.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Users,   color: "#3b82f6", bg: "#eff6ff", border: "#dbeafe", title: "Product Managers", sub: "From concept to PRD in one tool" },
            { icon: Palette, color: "#ec4899", bg: "#fdf2f8", border: "#fce7f3", title: "Designers",        sub: "Connect Figma to execution" },
            { icon: Code,    color: "#10b981", bg: "#f0fdf4", border: "#d1fae5", title: "Engineers",        sub: "Clear requirements, no ambiguity" },
            { icon: Rocket,  color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", title: "Founders",         sub: "Move fast without losing context" },
          ].map(({ icon: Icon, color, bg, border, title, sub }) => (
            <div key={title} className="rounded-2xl p-6 border text-center" style={{ backgroundColor: bg, borderColor: border }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "white", border: `1.5px solid ${border}` }}>
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DARK CTA SECTION ── */}
      <section className="bg-[#0a0a0f] py-24">
        <div className="max-w-lg mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-8">Create an Account</h2>
          <div className="space-y-3">
            {[
              { Icon: Chrome,   label: "Continue with Google" },
              { Icon: Github,   label: "Continue with GitHub" },
              { Icon: Terminal, label: "Continue with Replit" },
            ].map(({ Icon, label }) => (
              <button key={label} className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-medium text-white border border-white/20 hover:border-white/40 transition-colors">
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs text-white/40">Already have an account? Just sign in above.</p>
          <p className="mt-2 text-xs text-white/30 leading-relaxed">
            By continuing, you acknowledge that you agree to Kiteframe's{" "}
            <span className="underline cursor-pointer">Terms and Conditions</span> and{" "}
            <span className="underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Kiteframe</span>
          <span className="text-sm text-gray-400">© 2025</span>
          <div className="flex gap-5">
            {["Terms", "Privacy", "FAQ"].map(l => (
              <a key={l} href="#" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
