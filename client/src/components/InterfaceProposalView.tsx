import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { analyzeWorkflowScreens } from '@/lib/buildInterfacePrompt';
import type { Node, Edge } from '@/lib/kiteframe/types';
import {
  Loader2,
  Sparkles,
  Send,
  MonitorSmartphone,
  X,
} from 'lucide-react';

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

/** Build the initial screen list sent to the proposal API from workflow clusters. */
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
  // Small workflow (< 6 nodes) — single screen
  return [
    {
      id: 'screen-0',
      name: workflowName || 'Main Screen',
      nodeLabels: nodes.map((n) => n.data?.label || n.id).slice(0, 10),
      nodeIds: nodes.map((n) => n.id),
    },
  ];
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
      body: JSON.stringify({
        workflowName: workflowName || '',
        screens: screenInputs,
      }),
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
        setStatus('ready');
        setMessages([
          {
            role: 'assistant',
            content: `I've analysed your workflow and proposed ${proposed.length} screen${proposed.length !== 1 ? 's' : ''}. Uncheck any you don't need, type a message to refine, or hit Generate to create the full interface.`,
          },
        ]);
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
        body: JSON.stringify({
          workflowName: workflowName || '',
          screens,
          userMessage: msg,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);

      // Preserve user-set selection state when merging updated screens
      const updatedScreens: ProposedScreen[] = (data.screens as ProposedScreen[]).map((s) => {
        const prev = screens.find((p) => p.id === s.id);
        return { ...s, nodeIds: prev?.nodeIds ?? [], selected: prev?.selected ?? true };
      });
      setScreens(updatedScreens);
      setMessages([...newMessages, { role: 'assistant', content: data.aiMessage }]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: "Sorry, I couldn't process that request. Please try again.",
        },
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
    // If no node IDs were found (e.g. small single-screen fallback), pass empty = single-screen path
    const hasNodes = clusters.some((c) => c.nodes.length > 0);
    onConfirm(hasNodes ? clusters : []);
  }, [screens, nodes, onConfirm]);

  const toggleScreen = useCallback((id: string) => {
    setScreens((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
    );
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <MonitorSmartphone size={20} className="text-blue-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Create Interface
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {status === 'loading'
                ? 'Analysing your workflow…'
                : `Review and refine before generating`}
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Screen proposals ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {status === 'loading' ? (
          /* Loading skeleton */
          <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 animate-pulse"
              >
                <div className="w-full aspect-[4/3] bg-gray-200 dark:bg-gray-700 rounded-lg mb-3" />
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6">
            {screens.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                No screens to show.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {screens.map((screen) => (
                  <div
                    key={screen.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={screen.selected}
                    onClick={() => toggleScreen(screen.id)}
                    onKeyDown={(e) => e.key === 'Enter' && toggleScreen(screen.id)}
                    className={`rounded-xl border-2 bg-white dark:bg-gray-800 p-3 cursor-pointer transition-all ${
                      screen.selected
                        ? 'border-blue-500 dark:border-blue-400 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 opacity-55'
                    }`}
                  >
                    {/* SVG thumbnail (rendered as img data URL to avoid XSS) */}
                    <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-700 mb-3">
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
                        onCheckedChange={(v) =>
                          setScreens((prev) =>
                            prev.map((s) =>
                              s.id === screen.id ? { ...s, selected: !!v } : s,
                            ),
                          )
                        }
                        className="mt-0.5 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Include ${screen.name}`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {screen.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {screen.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Chat messages ────────────────────────────────────────────────── */}
        {messages.length > 0 && (
          <div className="px-6 pb-4 max-w-2xl space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-sm px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {status === 'refining' && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <Loader2 size={12} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex items-end gap-3">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask to rename, revise, or skip screens…"
          className="flex-1 min-h-[36px] max-h-24 text-xs resize-none py-2"
          rows={1}
          disabled={status !== 'ready'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || status !== 'ready'}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 transition-colors flex-shrink-0"
          aria-label="Send"
        >
          <Send size={14} />
        </button>
        <Button
          onClick={handleConfirm}
          disabled={selectedCount === 0 || status !== 'ready' || isGenerating}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-xs px-4 flex-shrink-0"
        >
          {isGenerating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {isGenerating ? 'Generating…' : 'Generate UI'}
        </Button>
      </div>
    </div>
  );
}
