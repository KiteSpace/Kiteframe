import { Sparkles, Send, Paperclip, Loader2, ChevronRight, X } from "lucide-react";

// When reached via "Create Interface" from a workflow, the AI already has
// context — no need to prompt the user to describe anything. The conversation
// starts with the AI acknowledging it's analysing the workflow.
const MESSAGES = [
  {
    role: "ai" as const,
    text: "I've analysed your workflow and I'm building screen proposals now. You'll see them appear on the right as I work.",
  },
];

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-3 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Preview area */}
      <div className="w-full aspect-[16/10] bg-muted rounded-lg mb-3 relative overflow-hidden">
        {/* Fake screen chrome */}
        <div className="absolute inset-0 flex flex-col">
          <div className="h-5 bg-muted-foreground/10 flex items-center gap-1 px-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="flex flex-1">
            {/* Sidebar skeleton */}
            <div className="w-10 bg-muted-foreground/10 flex flex-col gap-1.5 p-1.5">
              <div className="h-2 bg-muted-foreground/20 rounded" />
              <div className="h-2 bg-muted-foreground/20 rounded w-2/3" />
              <div className="h-2 bg-muted-foreground/20 rounded" />
              <div className="h-2 bg-muted-foreground/20 rounded w-3/4" />
            </div>
            {/* Content skeleton */}
            <div className="flex-1 p-2 flex flex-col gap-1.5">
              <div className="h-3 bg-muted-foreground/20 rounded w-1/2" />
              <div className="flex gap-1 flex-1">
                <div className="flex-1 bg-muted-foreground/15 rounded" />
                <div className="flex-1 bg-muted-foreground/15 rounded" />
                <div className="flex-1 bg-muted-foreground/15 rounded" />
              </div>
              <div className="flex-1 bg-muted-foreground/15 rounded" />
            </div>
          </div>
        </div>
      </div>
      {/* Label area */}
      <div className="flex items-start gap-2">
        <div className="w-4 h-4 rounded bg-muted-foreground/20 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-muted-foreground/20 rounded w-3/4" />
          <div className="h-2 bg-muted-foreground/15 rounded w-full" />
          <div className="h-2 bg-muted-foreground/15 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ role, text }: { role: "ai" | "user"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 mt-0.5 shadow-sm" />
      )}
      <div
        className={`max-w-[85%] px-3 py-2 text-sm leading-snug rounded-2xl ${
          isUser
            ? "bg-violet-600 text-white rounded-br-sm shadow-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

export function GenerationScreen() {
  const skeletons = [0, 150, 300, 450, 600, 750];

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden font-sans">
      {/* ── Left: AI Chat panel ─────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col h-full bg-card">
        {/* Header */}
        <div className="h-12 border-b border-border flex items-center gap-2 px-4 flex-shrink-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">KiteAI</span>
          <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium tracking-wide">
            Generating…
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {MESSAGES.map((m, i) => (
            <ChatMessage key={i} role={m.role} text={m.text} />
          ))}
          {/* Typing indicator */}
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 mt-0.5 opacity-50" />
            <div className="bg-muted px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>

        {/* Disabled input */}
        <div className="p-3 border-t border-border flex-shrink-0">
          <div className="relative flex items-center gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2 opacity-50 cursor-not-allowed select-none">
            <input
              disabled
              placeholder="Chat available after generation…"
              className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/60 text-muted-foreground cursor-not-allowed min-w-0"
            />
            <Loader2 size={14} className="animate-spin text-violet-500 flex-shrink-0" />
            <button disabled className="w-6 h-6 rounded-lg bg-violet-500/40 text-white flex items-center justify-center flex-shrink-0">
              <Send size={11} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5 leading-tight">
            Chat unlocks when your screens are ready
          </p>
        </div>
      </div>

      {/* ── Right: Skeleton grid fills remaining viewport ───────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <div className="h-12 border-b border-border flex items-center gap-3 px-5 flex-shrink-0">
          <span className="text-sm font-medium text-foreground">Generating screens</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin text-violet-500" />
            <span>Building your interface…</span>
          </div>
          <div className="ml-auto">
            <button disabled className="text-xs px-4 py-1.5 rounded-lg bg-violet-600 text-white opacity-40 cursor-not-allowed flex items-center gap-1.5">
              <Sparkles size={12} />
              Generate UI
            </button>
          </div>
        </div>

        {/* Full-width skeleton grid */}
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-3 gap-4 h-full" style={{ gridTemplateRows: "1fr 1fr", gridAutoRows: "1fr" }}>
            {skeletons.map((delay, i) => (
              <SkeletonCard key={i} delay={delay} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
