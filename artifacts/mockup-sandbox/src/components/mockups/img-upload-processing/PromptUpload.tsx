import { Sparkles, Loader2, ImageIcon, X, ChevronRight } from "lucide-react";

/* Faint workflow graph drawn behind the left panel */
function WorkflowBg() {
  const nodes = [
    { x: 60,  y: 110, label: "Start",          pill: true  },
    { x: 56,  y: 210, label: "User Login",      pill: false },
    { x: 240, y: 210, label: "Valid?",          diamond: true },
    { x: 420, y: 192, label: "Load Dashboard",  pill: false },
    { x: 420, y: 310, label: "Show Error",      pill: false },
    { x: 600, y: 192, label: "Fetch Data",      pill: false },
    { x: 740, y: 192, label: "Success",         pill: true  },
  ];

  return (
    <div className="absolute inset-0 opacity-35 pointer-events-none select-none">
      <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ zIndex: 0 }}>
        {/* connectors */}
        {[
          [120, 118, 80,  218],
          [80,  228, 240, 228],
          [308, 218, 420, 207],
          [272, 244, 420, 318],
          [508, 207, 600, 207],
          [664, 207, 740, 207],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#94a3b8" strokeWidth="1.5" strokeOpacity="0.45" markerEnd="url(#arrow)" />
        ))}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" opacity="0.5" />
          </marker>
        </defs>
      </svg>
      {nodes.map((n, i) =>
        n.diamond ? (
          <div key={i} className="absolute flex items-center justify-center" style={{ left: n.x, top: n.y }}>
            <div className="w-14 h-14 rotate-45 border-2 border-slate-400/30 bg-slate-200/20 dark:bg-slate-700/20">
              <span className="-rotate-45 absolute inset-0 flex items-center justify-center text-[8px] text-slate-400/60 font-medium">
                {n.label}
              </span>
            </div>
          </div>
        ) : (
          <div
            key={i}
            className={`absolute flex items-center justify-center border-2 border-slate-400/30 bg-slate-100/30 dark:bg-slate-700/20 ${n.pill ? "rounded-full px-3 h-8" : "rounded-lg w-28 h-10"}`}
            style={{ left: n.x, top: n.y }}
          >
            <span className="text-[8px] text-slate-400/60 font-medium text-center leading-tight px-1">{n.label}</span>
          </div>
        )
      )}
    </div>
  );
}

export function PromptUpload() {
  const detectedTags = ["Navigation bar", "Data table", "Stats cards"];

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden font-sans">
      {/* ── Left: blurred workflow canvas ─────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-muted/20">
        {/* Dot-grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.35,
          }}
        />
        <WorkflowBg />
        {/* Recede overlay */}
        <div className="absolute inset-0 bg-background/55 backdrop-blur-[1.5px]" />

        {/* Centre label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/40 select-none">Workflow editor</p>
        </div>
      </div>

      {/* ── Right: prompt / creation panel ────────────────────────── */}
      <div className="w-[440px] flex-shrink-0 border-l border-border flex flex-col bg-card">
        {/* Header */}
        <div className="h-12 border-b border-border flex items-center gap-2 px-4 flex-shrink-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">Create Interface</span>
          <span className="ml-auto text-[10px] text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2.5 py-0.5 rounded-full font-medium border border-violet-200 dark:border-violet-800">
            Processing image…
          </span>
        </div>

        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 min-h-0">
          {/* Prompt textarea */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
              Prompt
            </label>
            <div className="rounded-xl border border-border bg-background p-3 min-h-[72px] text-sm text-foreground/50 leading-relaxed opacity-60">
              Design a SaaS dashboard based on this uploaded mockup
            </div>
          </div>

          {/* ── Image attachment — processing state ── */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
              Attached image
            </label>
            <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800/50 bg-violet-50/40 dark:bg-violet-900/10 p-3">
              <div className="flex items-start gap-3">
                {/* Thumbnail with shimmer */}
                <div className="w-[72px] h-[58px] rounded-lg bg-muted overflow-hidden flex-shrink-0 relative">
                  {/* Fake UI inside thumbnail */}
                  <div className="absolute inset-0 flex flex-col">
                    <div className="h-3.5 bg-muted-foreground/15 flex-shrink-0" />
                    <div className="flex flex-1">
                      <div className="w-4 bg-muted-foreground/10 flex-shrink-0" />
                      <div className="flex-1 p-1 space-y-0.5">
                        <div className="h-1.5 bg-muted-foreground/15 rounded w-3/4" />
                        <div className="h-1.5 bg-muted-foreground/10 rounded" />
                        <div className="h-4 bg-muted-foreground/10 rounded mt-0.5" />
                      </div>
                    </div>
                  </div>
                  {/* Shimmer sweep */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.35) 50%, transparent 100%)",
                      animation: "sweep 1.9s ease-in-out infinite",
                    }}
                  />
                  {/* Spinner overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-violet-900/20">
                    <div className="w-7 h-7 rounded-full bg-violet-600/90 flex items-center justify-center shadow-md">
                      <Loader2 size={13} className="animate-spin text-white" />
                    </div>
                  </div>
                </div>

                {/* Info column */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold text-foreground truncate">dashboard-mockup.png</p>
                    <span className="shrink-0 text-[9px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-medium border border-violet-200 dark:border-violet-700">
                      Analysing
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">1.2 MB · PNG</p>

                  {/* Mini progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full w-[60%] relative"
                    >
                      <div className="absolute inset-0 animate-pulse bg-white/30 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin text-violet-500" />
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                      Reading UI structure…
                    </span>
                  </div>
                </div>
              </div>

              {/* Detected element chips */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {detectedTags.map((tag, i) => (
                  <div
                    key={tag}
                    className="flex items-center gap-1 text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-700 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    {tag}
                  </div>
                ))}
                <div
                  className="flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-0.5 rounded-full border border-dashed border-border animate-pulse"
                  style={{ animationDelay: "500ms" }}
                >
                  <Loader2 size={8} className="animate-spin" />
                  Detecting more…
                </div>
              </div>
            </div>
          </div>

          {/* Design target (locked) */}
          <div className="opacity-40 pointer-events-none">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
              Design target
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["Web App", "Mobile App", "Dashboard", "Landing Page"].map((opt) => (
                <div key={opt} className="rounded-lg border border-border px-3 py-2.5 text-xs text-muted-foreground">
                  {opt}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="p-4 border-t border-border flex-shrink-0 space-y-2">
          <button
            disabled
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Loader2 size={14} className="animate-spin" />
            Analysing image — please wait…
          </button>
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Generation starts automatically after analysis completes
          </p>
        </div>
      </div>

      <style>{`
        @keyframes sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
