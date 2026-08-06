import { useState, useEffect, useRef, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { analyzeWorkflowScreens } from '@/lib/buildInterfacePrompt';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { Loader2, Sparkles, Send, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProposedScreen {
  id: string;
  name: string;
  description: string;
  svgWireframe: string;
  nodeIds: string[];
  selected: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InterfaceProposalViewProps {
  workflowName?: string;
  nodes: Node[];
  edges: Edge[];
  isGenerating: boolean;
  onConfirm: (selectedClusters: Array<{ name: string; nodes: Node[] }>) => void;
  onCancel: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildScreenInputs(
  nodes: Node[],
  edges: Edge[],
  workflowName?: string,
): Array<{ id: string; name: string; nodeLabels: string[]; nodeIds: string[] }> {
  const clusters = analyzeWorkflowScreens(nodes, edges);
  if (clusters && clusters.length >= 2) {
    return clusters.map((c, i) => ({
      id: `screen-${i}`,
      name: c.name,
      nodeLabels: c.nodes.map((n) => n.data?.label || n.id).slice(0, 10),
      nodeIds: c.nodes.map((n) => n.id),
    }));
  }
  return [
    {
      id: 'screen-0',
      name: workflowName || 'Main Screen',
      nodeLabels: nodes.map((n) => n.data?.label || n.id).slice(0, 10),
      nodeIds: nodes.map((n) => n.id),
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Skeleton card with fake browser chrome — matches the mockup design */
function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-3 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-full aspect-[16/10] bg-muted rounded-lg mb-3 relative overflow-hidden">
        <div className="absolute inset-0 flex flex-col">
          {/* Fake titlebar */}
          <div className="h-5 bg-muted-foreground/10 flex items-center gap-1 px-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="flex flex-1 min-h-0">
            {/* Fake sidebar */}
            <div className="w-10 bg-muted-foreground/10 flex flex-col gap-1.5 p-1.5 flex-shrink-0">
              <div className="h-2 bg-muted-foreground/20 rounded" />
              <div className="h-2 bg-muted-foreground/20 rounded w-2/3" />
              <div className="h-2 bg-muted-foreground/20 rounded" />
              <div className="h-2 bg-muted-foreground/20 rounded w-3/4" />
            </div>
            {/* Fake content */}
            <div className="flex-1 p-2 flex flex-col gap-1.5 min-w-0">
              <div className="h-3 bg-muted-foreground/20 rounded w-1/2" />
              <div className="flex gap-1 flex-1 min-h-0">
                <div className="flex-1 bg-muted-foreground/15 rounded" />
                <div className="flex-1 bg-muted-foreground/15 rounded" />
                <div className="flex-1 bg-muted-foreground/15 rounded" />
              </div>
              <div className="h-4 bg-muted-foreground/15 rounded" />
            </div>
          </div>
        </div>
      </div>
      {/* Label skeleton */}
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

function AiBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 flex items-center justify-center shadow-sm mt-0.5">
        <Sparkles size={10} className="text-white" />
      </div>
      <div className="bg-muted text-foreground px-3 py-2 rounded-2xl rounded-bl-sm text-xs leading-snug max-w-[85%]">
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-violet-600 text-white px-3 py-2 rounded-2xl rounded-br-sm text-xs leading-snug max-w-[85%]">
        {text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 flex items-center justify-center shadow-sm mt-0.5 opacity-60">
        <Sparkles size={10} className="text-white" />
      </div>
      <div className="bg-muted px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

/** Large canvas treatment shown while the selected screens become a real UI. */
function UiGenerationShimmer() {
  return (
    <div
      className="ui-generation-canvas flex-1 overflow-auto p-4 sm:p-6 lg:p-10"
      data-testid="ui-generation-shimmer"
      role="status"
      aria-label="Generating your UI"
    >
      <div className="ui-generation-mock mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        <div className="ui-generation-titlebar flex h-10 items-center gap-2 border-b border-border/70 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <div className="ui-shimmer-block ml-4 h-2.5 w-28 rounded-full" />
        </div>

        <div className="flex min-h-[min(58vw,520px)]">
          <aside className="ui-generation-sidebar hidden w-44 flex-shrink-0 border-r border-border/70 p-4 sm:block">
            <div className="ui-shimmer-block mb-7 h-7 w-24 rounded-md" />
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="ui-shimmer-block h-3 w-3 rounded-sm" />
                  <div className={`ui-shimmer-block h-2.5 rounded-full ${item === 0 ? 'w-24' : item === 2 ? 'w-16' : 'w-20'}`} />
                </div>
              ))}
            </div>
            <div className="ui-shimmer-block mt-12 h-20 w-full rounded-lg" />
          </aside>

          <main className="min-w-0 flex-1 p-5 sm:p-8">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="ui-shimmer-block h-5 w-36 rounded-md sm:w-52" />
                <div className="ui-shimmer-block h-2.5 w-48 rounded-full sm:w-72" />
              </div>
              <div className="ui-shimmer-block h-8 w-20 rounded-lg sm:w-28" />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-xl border border-border/60 p-3">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="ui-shimmer-block h-3 w-16 rounded-full" />
                    <div className="ui-shimmer-block h-6 w-6 rounded-md" />
                  </div>
                  <div className="ui-shimmer-block h-7 w-20 rounded-md" />
                  <div className="ui-shimmer-block mt-3 h-2 w-28 rounded-full" />
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <div className="rounded-xl border border-border/60 p-4">
                <div className="mb-5 flex items-center justify-between">
                  <div className="ui-shimmer-block h-3.5 w-28 rounded-full" />
                  <div className="ui-shimmer-block h-6 w-16 rounded-md" />
                </div>
                <div className="ui-shimmer-chart flex h-36 items-end gap-2 rounded-lg p-4">
                  {[42, 68, 52, 82, 61, 92, 74, 100, 78, 88].map((height, index) => (
                    <div
                      key={index}
                      className="ui-shimmer-block flex-1 rounded-t-md"
                      style={{ height: `${height}%`, animationDelay: `${index * 80}ms` }}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <div className="ui-shimmer-block mb-5 h-3.5 w-24 rounded-full" />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="ui-shimmer-block h-8 w-8 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="ui-shimmer-block h-2.5 w-3/4 rounded-full" />
                        <div className="ui-shimmer-block h-2 w-1/2 rounded-full" />
                      </div>
                      <div className="ui-shimmer-block h-2.5 w-10 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Assembling your interface from the selected screens…
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InterfaceProposalView({
  workflowName,
  nodes,
  edges,
  isGenerating,
  onConfirm,
  onCancel,
}: InterfaceProposalViewProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'refining'>('loading');
  const [screens, setScreens] = useState<ProposedScreen[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // Fetch proposals on mount
  useEffect(() => {
    const screenInputs = buildScreenInputs(nodes, edges, workflowName);

    fetch('/api/ai/interface-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ workflowName: workflowName || '', screens: screenInputs }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const proposed: ProposedScreen[] = (data.screens as any[]).map((s, i) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          svgWireframe: s.svgWireframe,
          nodeIds: screenInputs[i]?.nodeIds ?? [],
          selected: true,
        }));
        setScreens(proposed);
        setMessages([
          {
            role: 'assistant',
            content: `I've proposed ${proposed.length} screen${proposed.length !== 1 ? 's' : ''} based on your workflow. Uncheck any you don't need, refine via chat, then hit Generate UI.`,
          },
        ]);
        setStatus('ready');
      })
      .catch((err) => {
        toast({
          title: 'Could not generate preview',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
        onCancel();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = useCallback(async () => {
    const msg = inputValue.trim();
    if (!msg || status !== 'ready') return;
    setInputValue('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setStatus('refining');

    try {
      const r = await fetch('/api/ai/interface-proposal-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workflowName: workflowName || '', screens, userMessage: msg }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      const updatedScreens: ProposedScreen[] = (data.screens as ProposedScreen[]).map((s) => {
        const prev = screens.find((p) => p.id === s.id);
        return { ...s, nodeIds: prev?.nodeIds ?? [], selected: prev?.selected ?? true };
      });
      setScreens(updatedScreens);
      setMessages([...newMessages, { role: 'assistant', content: data.aiMessage }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: "Sorry, I couldn't process that request. Please try again." },
      ]);
    } finally {
      setStatus('ready');
    }
  }, [inputValue, status, messages, screens, workflowName]);

  const selectedCount = screens.filter((s) => s.selected).length;

  const handleConfirm = useCallback(() => {
    const selected = screens.filter((s) => s.selected);
    const clusters = selected.map((s) => ({
      name: s.name,
      nodes: nodes.filter((n) => s.nodeIds.includes(n.id)),
    }));
    const hasNodes = clusters.some((c) => c.nodes.length > 0);
    onConfirm(hasNodes ? clusters : []);
  }, [screens, nodes, onConfirm]);

  const toggleScreen = useCallback((id: string) => {
    setScreens((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
  }, []);

  const isLoading  = status === 'loading';
  const isRefining = status === 'refining';

  // ── KiteAI chat sidebar — shared across all phases ────────────────────────
  const chatSidebar = (
    <div className="w-72 flex-shrink-0 border-r border-border flex flex-col h-full bg-card">
      {/* Header */}
      <div className="h-12 border-b border-border flex items-center gap-2 px-4 flex-shrink-0">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
          <Sparkles size={12} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-foreground">KiteAI</span>
        {isLoading || isGenerating ? (
          <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium tracking-wide">
            {isGenerating ? 'Building…' : 'Generating…'}
          </span>
        ) : (
          <button
            onClick={onCancel}
            className="ml-auto p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {isLoading || isGenerating ? (
          <>
            <AiBubble
              text={
                isGenerating
                  ? "I'm now building the full Craft.js interface from your selected screens. This usually takes 20–40 seconds — sit tight!"
                  : "I've analysed your workflow and I'm building screen proposals now. You'll see them appear on the right as I work."
              }
            />
            <TypingIndicator />
          </>
        ) : (
          <>
            {messages.map((m, i) =>
              m.role === 'assistant'
                ? <AiBubble key={i} text={m.content} />
                : <UserBubble key={i} text={m.content} />
            )}
            {isRefining && <TypingIndicator />}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex-shrink-0">
        {isLoading || isGenerating ? (
          <>
            <div className="relative flex items-center gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2 opacity-50 select-none cursor-not-allowed">
              <input
                disabled
                placeholder={isGenerating ? 'Building your design…' : 'Chat available after generation…'}
                className="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground/60 cursor-not-allowed min-w-0"
              />
              <Loader2 size={13} className="animate-spin text-violet-500 flex-shrink-0" />
              <div className="w-6 h-6 rounded-lg bg-violet-500/40 text-white flex items-center justify-center flex-shrink-0">
                <Send size={10} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5 leading-tight">
              {isGenerating ? 'Design is being built…' : 'Chat unlocks when your screens are ready'}
            </p>
          </>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask to rename, revise, or skip screens…"
              rows={1}
              disabled={isRefining}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 text-xs rounded-xl border border-border bg-background px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-violet-500 min-h-[36px] max-h-24 disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isRefining}
              className="p-2 rounded-lg bg-muted hover:bg-accent text-muted-foreground disabled:opacity-40 transition-colors flex-shrink-0"
              aria-label="Send"
            >
              <Send size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ── Skeleton grid (concept-preview loading phase) ──────────────────────────
  const skeletonGrid = (
    <div className="grid grid-cols-3 gap-4">
      {[0, 150, 300, 450, 600, 750].map((delay, i) => (
        <SkeletonCard key={i} delay={delay} />
      ))}
    </div>
  );

  // ── Phase: loading — proposal API in flight ───────────────────────────────
  if (isLoading && !isGenerating) {
    return (
      <div className="h-full w-full flex overflow-hidden bg-background">
        {chatSidebar}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* Top bar */}
          <div className="h-12 border-b border-border flex items-center gap-3 px-5 flex-shrink-0">
            <span className="text-sm font-medium text-foreground">Generating UI concept previews</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin text-violet-500" />
              <span>Building screen concepts…</span>
            </div>
            <div className="ml-auto">
              <button
                disabled
                className="text-xs px-4 py-1.5 rounded-lg bg-violet-600 text-white opacity-40 cursor-not-allowed flex items-center gap-1.5"
              >
                <Sparkles size={12} />
                Generate UI
              </button>
            </div>
          </div>
          {/* Skeleton grid */}
          <div className="flex-1 overflow-auto p-5">
            {skeletonGrid}
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: generating — Craft.js UI being built ──────────────────────────
  if (isGenerating) {
    return (
      <div className="h-full w-full flex overflow-hidden bg-background">
        {chatSidebar}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div className="h-12 border-b border-border flex items-center gap-3 px-5 flex-shrink-0">
              <span className="text-sm font-medium text-foreground">Generating your UI</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin text-violet-500" />
                <span>Assembling the full interface…</span>
            </div>
          </div>
          <UiGenerationShimmer />
        </div>
      </div>
    );
  }

  // ── Phase: ready / refining — screen selection ────────────────────────────
  return (
    <div className="h-full w-full flex overflow-hidden bg-background">
      {chatSidebar}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <div className="h-12 border-b border-border flex items-center gap-3 px-5 flex-shrink-0">
          <span className="text-sm font-medium text-foreground">
            {selectedCount > 0
              ? `${selectedCount} screen${selectedCount !== 1 ? 's' : ''} selected`
              : 'Select screens to generate'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="text-xs px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              <Sparkles size={12} />
              Generate UI
            </button>
          </div>
        </div>

        {/* Screen grid */}
        <div className="flex-1 overflow-auto p-5">
          {screens.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">No screens to show.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {screens.map((screen) => (
                <button
                  key={screen.id}
                  onClick={() => toggleScreen(screen.id)}
                  className={`rounded-xl border-2 bg-card p-3 text-left transition-all ${
                    screen.selected
                      ? 'border-violet-500 shadow-sm'
                      : 'border-border opacity-55 hover:opacity-80'
                  }`}
                >
                  {/* SVG wireframe thumbnail */}
                  <div className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-muted mb-3">
                    <img
                      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(screen.svgWireframe)}`}
                      alt={screen.name}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={screen.selected}
                      onCheckedChange={() => toggleScreen(screen.id)}
                      className="mt-0.5 flex-shrink-0 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Include ${screen.name}`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{screen.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{screen.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
