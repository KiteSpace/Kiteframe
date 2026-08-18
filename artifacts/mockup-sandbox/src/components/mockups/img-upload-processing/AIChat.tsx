import { Sparkles, Loader2, Send, Paperclip, ImageIcon, Layers, ZoomIn, ZoomOut, Square } from "lucide-react";

/* Fake artboard on the dark canvas */
function FakeArtboard() {
  return (
    <div
      className="absolute bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden"
      style={{
        left: 72,
        top: 52,
        width: 540,
        height: 390,
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
      }}
    >
      {/* Fake app chrome */}
      <div className="h-8 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2 px-3 flex-shrink-0">
        <div className="w-24 h-2 bg-neutral-300 dark:bg-neutral-600 rounded" />
        <div className="ml-auto flex gap-2">
          <div className="w-12 h-2 bg-neutral-300 dark:bg-neutral-600 rounded" />
          <div className="w-12 h-2 bg-neutral-300 dark:bg-neutral-600 rounded" />
        </div>
      </div>
      <div className="flex" style={{ height: "calc(100% - 32px)" }}>
        {/* Sidebar */}
        <div className="w-28 bg-neutral-50 dark:bg-neutral-800/80 border-r border-neutral-200 dark:border-neutral-700 p-2.5 flex flex-col gap-2 flex-shrink-0">
          {[100, 75, 90, 65, 82].map((w, i) => (
            <div key={i} className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 p-3 flex flex-col gap-2.5 min-w-0">
          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-2/5" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
              />
            ))}
          </div>
          <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 min-h-[60px]" />
        </div>
      </div>
    </div>
  );
}

export function AIChat() {
  return (
    <div className="h-screen w-full flex overflow-hidden font-sans" style={{ background: "#161616" }}>
      {/* ── Layers panel ─────────────────────────────────────────────── */}
      <div
        className="w-44 flex-shrink-0 flex flex-col border-r"
        style={{ background: "#1e1e1e", borderColor: "#2a2a2a" }}
      >
        <div
          className="h-10 border-b flex items-center px-3 gap-2 flex-shrink-0"
          style={{ borderColor: "#2a2a2a" }}
        >
          <Layers size={12} className="text-neutral-500" />
          <span className="text-[11px] font-medium text-neutral-400">Layers</span>
        </div>
        <div className="p-2 space-y-0.5 opacity-45">
          {[
            { label: "Artboard 1", depth: 0 },
            { label: "Navigation", depth: 1 },
            { label: "Hero Section", depth: 1 },
            { label: "Cards Row", depth: 1 },
            { label: "Footer", depth: 1 },
          ].map(({ label, depth }, i) => (
            <div
              key={i}
              className={`text-[10px] px-2 py-[3px] rounded ${depth === 0 ? "text-neutral-300 font-medium" : "text-neutral-600"}`}
              style={{ paddingLeft: depth * 12 + 8 }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div
          className="h-10 border-b flex items-center gap-2 px-4 flex-shrink-0"
          style={{ background: "#1e1e1e", borderColor: "#2a2a2a" }}
        >
          <div className="flex items-center gap-0.5">
            <button className="p-1.5 rounded hover:bg-white/5 text-neutral-500">
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] text-neutral-500 w-10 text-center tabular-nums">100%</span>
            <button className="p-1.5 rounded hover:bg-white/5 text-neutral-500">
              <ZoomIn size={12} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[11px] text-neutral-500">My Design</span>
          </div>
          {/* Processing badge in toolbar */}
          <div className="flex items-center gap-1.5 text-[10px] text-violet-400 bg-violet-900/25 border border-violet-800/40 px-2.5 py-1 rounded-full">
            <Loader2 size={10} className="animate-spin" />
            AI is reading your image…
          </div>
        </div>

        {/* Canvas surface */}
        <div
          className="flex-1 relative overflow-hidden"
          style={{
            backgroundImage: "radial-gradient(circle, #2e2e2e 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <FakeArtboard />
        </div>
      </div>

      {/* ── AI Chat panel ────────────────────────────────────────────── */}
      <div
        className="w-72 flex-shrink-0 border-l flex flex-col"
        style={{ background: "#1e1e1e", borderColor: "#2a2a2a" }}
      >
        {/* Chat header */}
        <div
          className="h-10 border-b flex items-center gap-2 px-3 flex-shrink-0"
          style={{ borderColor: "#2a2a2a" }}
        >
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles size={10} className="text-white" />
          </div>
          <span className="text-[11px] font-semibold text-neutral-200">Design AI</span>
          <span className="ml-auto text-[9px] text-violet-400 bg-violet-900/30 border border-violet-800/40 px-2 py-0.5 rounded-full font-medium">
            Reading image…
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {/* Prior conversation for context */}
          <div className="flex justify-start">
            <div
              className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm text-[11px] leading-snug text-neutral-300"
              style={{ background: "#2a2a2a" }}
            >
              I can redesign this layout. Want me to make the cards more prominent?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-violet-600 text-white px-3 py-2 rounded-2xl rounded-br-sm text-[11px] leading-snug">
              Actually, here — use this reference design
            </div>
          </div>

          {/* ── User image upload bubble ─── */}
          <div className="flex justify-end">
            <div className="max-w-[92%]">
              <div
                className="rounded-2xl rounded-br-sm overflow-hidden"
                style={{ background: "#5b21b6" }}
              >
                {/* Thumbnail with shimmer + spinner */}
                <div className="w-full h-28 relative overflow-hidden" style={{ background: "#4c1d95" }}>
                  {/* Fake UI skeleton inside thumbnail */}
                  <div className="absolute inset-0 flex flex-col opacity-50">
                    <div className="h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
                    <div className="flex flex-1">
                      <div className="w-10 flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }} />
                      <div className="flex-1 p-1.5 space-y-1">
                        <div className="h-1.5 rounded" style={{ width: "65%", background: "rgba(255,255,255,0.12)" }} />
                        <div className="h-1.5 rounded" style={{ width: "100%", background: "rgba(255,255,255,0.08)" }} />
                        <div className="h-8 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                      </div>
                    </div>
                  </div>

                  {/* Shimmer sweep */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 50%, transparent 100%)",
                      animation: "sweep 2s ease-in-out infinite",
                    }}
                  />

                  {/* Spinner overlay */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
                    style={{ background: "rgba(60,10,100,0.35)" }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
                    >
                      <Loader2 size={16} className="animate-spin text-white" />
                    </div>
                    <span className="text-[9px] text-white/70 font-medium">Analysing…</span>
                  </div>
                </div>

                {/* Filename row */}
                <div className="px-3 py-2 flex items-center gap-1.5">
                  <ImageIcon size={10} className="text-white/60" />
                  <span className="text-[10px] text-white/75">reference-design.png</span>
                  <span className="ml-auto text-[9px] text-white/40">1.2 MB</span>
                </div>
              </div>
            </div>
          </div>

          {/* KiteAI typing indicator */}
          <div className="flex justify-start gap-2 items-start">
            <div
              className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 flex items-center justify-center shadow-sm mt-0.5"
              style={{ opacity: 0.65 }}
            >
              <Sparkles size={9} className="text-white" />
            </div>
            <div
              className="px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center"
              style={{ background: "#2a2a2a" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: "#6b7280", animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: "#6b7280", animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: "#6b7280", animationDelay: "300ms" }}
              />
            </div>
          </div>

          {/* Divider with status text */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px" style={{ background: "#2a2a2a" }} />
            <span className="text-[9px] text-neutral-600">Extracting layout from image</span>
            <div className="flex-1 h-px" style={{ background: "#2a2a2a" }} />
          </div>
        </div>

        {/* Input — locked */}
        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: "#2a2a2a" }}>
          <div
            className="relative flex items-center gap-2 rounded-xl px-3 py-2 opacity-50 select-none cursor-not-allowed"
            style={{ background: "#2a2a2a", border: "1px solid #333" }}
          >
            <button disabled className="text-neutral-600 p-0.5">
              <Paperclip size={12} />
            </button>
            <input
              disabled
              placeholder="Analysing your image…"
              className="flex-1 text-[11px] bg-transparent border-none outline-none placeholder-neutral-600 text-neutral-600 cursor-not-allowed min-w-0"
            />
            <Loader2 size={11} className="animate-spin text-violet-500 flex-shrink-0" />
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(139,92,246,0.25)" }}
            >
              <Send size={10} className="text-violet-400" />
            </div>
          </div>
          <p className="text-[9px] text-center mt-1.5" style={{ color: "#404040" }}>
            Chat unlocks when image analysis is complete
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
