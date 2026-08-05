import { Sparkles, Loader2, Layout, Type, Square, MousePointer2 } from "lucide-react";

function DetectedElement({
  icon: Icon,
  label,
  sub,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  delay: number;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-violet-500" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-2.5 bg-muted-foreground/25 rounded w-3/4" />
        <div className="h-2 bg-muted-foreground/15 rounded w-1/2" />
      </div>
      <div
        className="w-2 h-2 rounded-full bg-violet-400 animate-ping"
        style={{ animationDelay: `${delay + 300}ms` }}
      />
    </div>
  );
}

export function NewInterface() {
  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden font-sans">
      {/* ── Top progress bar ─────────────────────────────────────────── */}
      <div className="h-12 border-b border-border bg-card flex items-center gap-4 px-6 flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">KiteAI</span>
        </div>

        {/* Step track */}
        <div className="flex items-center gap-2 ml-4 text-xs select-none">
          {/* Step 1 — done */}
          <div className="flex items-center gap-1.5 text-violet-600 font-medium">
            <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold">
              ✓
            </div>
            Upload
          </div>
          <div className="w-10 h-px bg-violet-400 rounded" />
          {/* Step 2 — active */}
          <div className="flex items-center gap-1.5 text-violet-600 font-medium">
            <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center">
              <Loader2 size={10} className="animate-spin" />
            </div>
            Analysing
          </div>
          <div className="w-10 h-px bg-border rounded" />
          {/* Step 3 — pending */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-[10px] font-semibold">
              3
            </div>
            Build
          </div>
        </div>

        {/* Status pill */}
        <div className="ml-auto text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
          <Loader2 size={10} className="animate-spin text-violet-500" />
          Reading layout…
        </div>
      </div>

      {/* ── Main split ───────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Left — image preview with scan overlay */}
        <div className="flex-1 flex items-center justify-center bg-muted/20 relative overflow-hidden p-10">
          {/* Dot grid bg */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #7c3aed 1.5px, transparent 1.5px)",
              backgroundSize: "32px 32px",
            }}
          />

          {/* Image card */}
          <div className="relative w-full max-w-[540px]">
            {/* Preview box */}
            <div
              className="w-full aspect-[4/3] rounded-2xl border-2 border-violet-200 dark:border-violet-800/60 bg-card shadow-2xl overflow-hidden relative"
              style={{ boxShadow: "0 0 0 1px rgba(139,92,246,0.15), 0 24px 48px rgba(0,0,0,0.18)" }}
            >
              {/* Fake uploaded UI content */}
              <div className="absolute inset-0 flex flex-col">
                <div className="h-9 bg-muted border-b border-border flex items-center gap-2 px-4 flex-shrink-0">
                  <div className="w-24 h-2.5 bg-muted-foreground/20 rounded" />
                  <div className="ml-auto flex gap-2">
                    <div className="w-14 h-2 bg-muted-foreground/15 rounded" />
                    <div className="w-14 h-2 bg-muted-foreground/15 rounded" />
                  </div>
                </div>
                <div className="flex flex-1 min-h-0">
                  <div className="w-28 bg-muted/60 border-r border-border p-3 flex flex-col gap-2 flex-shrink-0">
                    {[100, 75, 90, 65, 80].map((w, i) => (
                      <div key={i} className="h-2 bg-muted-foreground/20 rounded" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                  <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
                    <div className="h-7 bg-muted-foreground/10 rounded-lg w-2/5" />
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="bg-muted-foreground/10 rounded-xl border border-border" />
                      ))}
                    </div>
                    <div className="h-16 bg-muted-foreground/10 rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Animated scan line */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                  className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent"
                  style={{ animation: "scanline 2.4s ease-in-out infinite", opacity: 0.85 }}
                />
              </div>

              {/* Soft violet tint */}
              <div className="absolute inset-0 bg-gradient-to-b from-violet-600/[0.04] via-transparent to-violet-600/[0.04] pointer-events-none" />

              {/* Corner brackets */}
              {(
                [
                  "top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
                  "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
                  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
                  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl",
                ] as const
              ).map((cls, i) => (
                <div key={i} className={`absolute w-5 h-5 border-violet-500 ${cls} pointer-events-none`} />
              ))}
            </div>

            {/* Status badge below image */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-violet-600 text-white text-[11px] font-medium px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
              <Loader2 size={11} className="animate-spin" />
              Mapping layout to components…
            </div>
          </div>
        </div>

        {/* Right — analysis panel */}
        <div className="w-[300px] flex-shrink-0 border-l border-border bg-card flex flex-col">
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles size={13} className="text-violet-500" />
              <span className="text-sm font-semibold text-foreground">Detecting elements</span>
            </div>
            <p className="text-xs text-muted-foreground">Mapping image regions to UI components</p>
          </div>

          {/* Element list */}
          <div className="flex-1 overflow-auto p-4 space-y-2.5">
            <DetectedElement icon={Layout} label="Navigation" sub="Top bar" delay={0} />
            <DetectedElement icon={Square} label="Card grid" sub="3 columns" delay={200} />
            <DetectedElement icon={Layout} label="Sidebar" sub="Left nav" delay={400} />
            <DetectedElement icon={Type} label="Text blocks" sub="Headings + body" delay={600} />
            <DetectedElement icon={MousePointer2} label="Action buttons" sub="CTAs" delay={800} />

            {/* Progress */}
            <div className="pt-2 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Analysis progress</span>
                <span className="text-violet-500 font-medium tabular-nums">68%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full w-[68%] relative">
                  <div className="absolute inset-0 animate-pulse bg-white/25 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer hint */}
          <div className="px-5 py-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground text-center leading-snug">
              Usually 10–20 seconds.
              <br />
              Your design opens automatically.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: -4px; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
