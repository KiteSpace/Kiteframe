import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBackgroundCallback, useRetainedAiState, BackgroundOperationStatus, failOperation } from '@/ai/useBackgroundOperation';
import { getOperations } from '@/ai/backgroundOperations';
import { fetchBackgroundAi } from '@/ai/OpenAICompatClient';
import { Checkbox } from '@/components/ui/checkbox';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import {
  interfacePlanSchema,
  inspectInterfacePlan,
  selectInterfacePages,
  MAX_INTERFACE_PAGES,
  type InterfacePlan,
  type InterfaceSurface,
} from '@shared/interfacePlan';
import { workflowToPlanningInput } from '@/lib/workflowInterfacePlan';
import { SkeletonCard, UiGenerationShimmer } from './InterfaceProposalLoading';

type ProposalPreview = { id: string; svgWireframe: string };
type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface InterfaceProposalViewProps {
  workflowName?: string;
  workflowDescription?: string;
  sourceProjectId?: string;
  operationTargetId?: string;
  context?: string;
  nodes: Node[];
  edges: Edge[];
  isGenerating: boolean;
  generationFeedback?: string[];
  onConfirm: (plan: InterfacePlan) => void;
  onCancel: () => void;
}

function readProposal(data: any) {
  if (!data || typeof data !== 'object') throw new Error('The proposal service returned an empty response.');
  if (data.error) throw new Error(String(data.error));
  const parsed = interfacePlanSchema.safeParse(data.plan);
  if (!parsed.success) {
    throw new Error(`The proposal response was invalid. ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  }
  const inspection = inspectInterfacePlan(parsed.data);
  if (inspection.errors.length) throw new Error(inspection.errors.join(' '));
  return {
    plan: parsed.data,
    previews: (Array.isArray(data.previews) ? data.previews : [])
      .filter((item: any) => item && typeof item.id === 'string' && typeof item.svgWireframe === 'string') as ProposalPreview[],
    warnings: (Array.isArray(data.warnings) ? data.warnings : []).filter((item: unknown): item is string => typeof item === 'string'),
    aiMessage: typeof data.aiMessage === 'string' ? data.aiMessage : '',
  };
}

function idFor(plan: InterfacePlan, ids: string[], kind: 'node' | 'edge'): string[] {
  const labels = kind === 'node'
    ? new Map(plan.workflow.nodes.map((item) => [item.id, item.label]))
    : new Map(plan.workflow.edges.map((item) => [item.id, item.label || `${item.source} → ${item.target}`]));
  return ids.map((id) => labels.get(id) ?? id);
}

function Details({ surface, plan }: { surface: InterfaceSurface; plan: InterfacePlan }) {
  const children = plan.screens.filter((item) => item.kind !== 'page' && item.parentScreenId === surface.id);
  return (
    <details className="mt-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs" onClick={(event) => event.stopPropagation()}>
      <summary className="cursor-pointer select-none font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
        Inspect rationale, sources & requirements
      </summary>
      <div className="mt-3 space-y-3 text-muted-foreground">
        <section><h4 className="font-semibold text-foreground">Why this page</h4><p>{surface.rationale}</p><p className="mt-1">Actor: {surface.actor}</p><p className="mt-1">{surface.goal}</p></section>
        {surface.description && <p>{surface.description}</p>}
        <section><h4 className="font-semibold text-foreground">Source workflow steps</h4>
          <p>{idFor(plan, surface.nodeIds, 'node').join(', ') || 'No mapped workflow steps (user-created or inferred).'}</p>
        </section>
        {!!surface.dataRequirements.length && <section><h4 className="font-semibold text-foreground">Fields</h4>
          <ul className="list-disc pl-4">{surface.dataRequirements.map((field, index) => <li key={`${field.label}-${index}`}>{field.label} · {field.kind}{field.required ? ' · required' : ''} · {field.origin}</li>)}</ul>
        </section>}
        {!!surface.actions.length && <section><h4 className="font-semibold text-foreground">Actions & transitions</h4>
          <ul className="list-disc pl-4">{surface.actions.map((action, index) => {
            const target = plan.screens.find((item) => item.id === action.targetScreenId);
            return <li key={`${action.label}-${index}`}>{action.label}{target ? ` → ${target.name}` : ''}{action.edgeIds.length ? ` · ${idFor(plan, action.edgeIds, 'edge').join(', ')}` : ''}</li>;
          })}</ul>
        </section>}
        {!!surface.states.length && <section><h4 className="font-semibold text-foreground">States</h4>
          <ul className="list-disc pl-4">{surface.states.map((state, index) => <li key={`${state.name}-${index}`}>{state.name} · {state.kind}: {state.description}{state.nodeIds.length ? ` · steps: ${idFor(plan, state.nodeIds, 'node').join(', ')}` : ''}{state.edgeIds.length ? ` · transitions: ${idFor(plan, state.edgeIds, 'edge').join(', ')}` : ''}</li>)}</ul>
        </section>}
        {!!children.length && <section><h4 className="font-semibold text-foreground">Dialogs & inline requirements</h4>
          <ul className="space-y-2">{children.map((child) => <li key={child.id} className="rounded-md bg-muted/50 p-2">
            <strong className="text-foreground">{child.kind}: {child.name}</strong> — {child.goal}<p>{child.rationale} · Actor: {child.actor}</p>
            {!!child.dataRequirements.length && <p>Fields: {child.dataRequirements.map((field) => field.label).join(', ')}</p>}
            {!!child.actions.length && <p>Actions: {child.actions.map((action) => {
              const target = plan.screens.find((item) => item.id === action.targetScreenId);
              return `${action.label}${target ? ` → ${target.name}` : ''}${action.edgeIds.length ? ` (${idFor(plan, action.edgeIds, 'edge').join(', ')})` : ''}`;
            }).join('; ')}</p>}
            {!!child.states.length && <p>States: {child.states.map((state) => `${state.name} (${state.kind}: ${state.description})`).join('; ')}</p>}
            {!!child.nodeIds.length && <p>Steps: {idFor(plan, child.nodeIds, 'node').join(', ')}</p>}
          </li>)}</ul>
        </section>}
      </div>
    </details>
  );
}

function AiBubble({ text }: { text: string }) {
  return <div className="flex gap-2 items-start"><div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600"><Sparkles size={10} className="text-white" /></div><div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs leading-snug text-foreground">{text}</div></div>;
}

function UserBubble({ text }: { text: string }) {
  return <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600 px-3 py-2 text-xs leading-snug text-white">{text}</div></div>;
}

export function InterfaceProposalReview({
  workflowName, workflowDescription = '', sourceProjectId, operationTargetId, context = '', nodes, edges, isGenerating,
  generationFeedback = [], onConfirm, onCancel,
}: InterfaceProposalViewProps) {
  const operationScope = `interface-plan:${operationTargetId || sourceProjectId || workflowName}:${nodes.map(node => node.id).sort().join(',')}`;
  const [status, setStatus] = useRetainedAiState<'loading' | 'ready' | 'refining' | 'error'>(operationScope, 'status', 'loading');
  const [plan, setPlan] = useRetainedAiState<InterfacePlan | null>(operationScope, 'plan', null);
  const [previews, setPreviews] = useRetainedAiState<ProposalPreview[]>(operationScope, 'previews', []);
  const [apiWarnings, setApiWarnings] = useRetainedAiState<string[]>(operationScope, 'warnings', []);
  const [error, setError] = useRetainedAiState(operationScope, 'error', '');
  const [messages, setMessages] = useRetainedAiState<ChatMessage[]>(operationScope, 'messages', []);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const workflowResult = useMemo(() => {
    try {
      return { workflow: workflowToPlanningInput(nodes, edges, workflowName || 'Workflow', workflowDescription, context), error: '' };
    } catch (err) {
      return { workflow: null, error: `Workflow exceeds proposal size limits or is invalid. ${err instanceof Error ? err.message : 'Workflow cannot be validated.'}` };
    }
  }, [nodes, edges, workflowName, workflowDescription, context]);

  const requestInitial = useBackgroundCallback(operationScope, 'Interpreting workflow screens', async (signal) => {
    setError('');
    setStatus('loading');
    if (!workflowResult.workflow) {
      setError(workflowResult.error);
      setStatus('error');
      return;
    }
    try {
      const response = await fetchBackgroundAi('/api/ai/interface-proposal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        signal, body: JSON.stringify({ workflow: workflowResult.workflow, sourceProjectId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Proposal request failed (${response.status}).`);
      const result = readProposal(data);
      if (signal.aborted) return;
      const pageIds = result.plan.screens.filter((surface) => surface.kind === 'page' && surface.selected).map((surface) => surface.id);
      const initialSelection = pageIds.slice(0, MAX_INTERFACE_PAGES);
      setPlan(selectInterfacePages(result.plan, initialSelection.length ? initialSelection : [result.plan.screens.find((surface) => surface.kind === 'page')!.id]));
      setPreviews(result.previews);
      setApiWarnings(result.warnings);
      setMessages([{ role: 'assistant', content: result.aiMessage || `I've mapped ${result.plan.screens.filter((item) => item.kind === 'page').length} pages from the workflow. Inspect the reasoning, adjust selection, or refine the proposal in chat.` }]);
      setStatus('ready');
    } catch (err) {
      if (signal.aborted) return;
      failOperation(operationScope, err);
      setError(err instanceof Error ? err.message : 'Could not generate a proposal.');
      setStatus('error');
    }
  }, [workflowResult, sourceProjectId]);

  useEffect(() => {
    if (!getOperations().some(op => op.key === operationScope)) void requestInitial();
  }, [requestInitial, operationScope]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, status]);

  const sendMessage = useBackgroundCallback(operationScope, 'Refining workflow screens', async (signal, retryText?: string) => {
    const text = retryText ?? inputValue.trim();
    if (!text || status !== 'ready' || !plan) return;
    const nextMessages = [...messages, { role: 'user' as const, content: text }];
    setInputValue('');
    setMessages(nextMessages);
    setStatus('refining');
    setError('');
    try {
      const response = await fetchBackgroundAi('/api/ai/interface-proposal-refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        signal, body: JSON.stringify({ plan, userMessage: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Refinement failed (${response.status}).`);
      if (signal.aborted) return;
      const result = readProposal(data);
      // Preserve user intent for surviving pages; never copy mappings from an old version.
      const oldPages = new Map(plan.screens.filter((surface) => surface.kind === 'page').map((surface) => [surface.id, surface.selected]));
      let nextPlan = { ...result.plan, screens: result.plan.screens.map((surface) => surface.kind === 'page' && oldPages.has(surface.id)
        ? { ...surface, selected: oldPages.get(surface.id)! }
        : surface) };
      const serverSelected = nextPlan.screens.filter((surface) => surface.kind === 'page' && surface.selected).map((surface) => surface.id);
      const previouslySelected = serverSelected.filter((id) => oldPages.get(id) === true);
      const newlySelected = serverSelected.filter((id) => !oldPages.has(id));
      const selectedIds = [...previouslySelected, ...newlySelected].slice(0, MAX_INTERFACE_PAGES);
      nextPlan = selectInterfacePages(nextPlan, selectedIds.length ? selectedIds : [nextPlan.screens.find((surface) => surface.kind === 'page')!.id]);
      setPlan(nextPlan);
      setPreviews(result.previews);
      setApiWarnings(result.warnings);
      setMessages([...nextMessages, { role: 'assistant', content: result.aiMessage || 'Proposal updated. Review the revised mapping and requirements.' }]);
      setStatus('ready');
    } catch (err) {
      if (signal.aborted) return;
      failOperation(operationScope, err);
      setError(err instanceof Error ? err.message : 'Could not refine the proposal.');
      setStatus('ready');
    }
  }, [inputValue, status, plan, messages]);

  const togglePage = useCallback((pageId: string) => {
    setPlan((current) => {
      if (!current) return current;
      const pages = current.screens.filter((surface) => surface.kind === 'page');
      const page = pages.find((surface) => surface.id === pageId);
      if (!page) return current;
      const selectedIds = pages.filter((item) => item.selected).map((item) => item.id);
      const nextIds = page.selected ? selectedIds.filter((id) => id !== pageId) : [...selectedIds, pageId];
      if (nextIds.length > MAX_INTERFACE_PAGES || nextIds.length === 0) return current;
      return selectInterfacePages(current, nextIds);
    });
  }, []);
  const selectedPages = plan?.screens.filter((surface) => surface.kind === 'page' && surface.selected) ?? [];

  if (isGenerating) return <div className="h-full w-full flex overflow-hidden bg-background"><aside className="w-72 border-r border-border bg-card p-4"><h2 className="text-sm font-semibold">KiteAI</h2></aside><div className="flex min-w-0 flex-1 flex-col"><header className="flex h-12 items-center gap-3 border-b border-border px-5 text-sm font-medium">Generating your UI</header><UiGenerationShimmer /></div></div>;

  return (
    <div className="h-full w-full flex overflow-hidden bg-background">
      <aside className="flex h-full w-72 flex-shrink-0 flex-col border-r border-border bg-card">
        <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600"><Sparkles size={12} className="text-white" /></div>
          <span className="text-sm font-semibold">KiteAI</span>
          <button onClick={onCancel} aria-label="Close" className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"><X size={14} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
          <BackgroundOperationStatus scope={operationScope} />
          {messages.map((message, index) => message.role === 'assistant' ? <AiBubble key={index} text={message.content} /> : <UserBubble key={index} text={message.content} />)}
          {status === 'refining' && <div role="status" className="text-xs text-muted-foreground">Updating the proposal…</div>}
          <div ref={chatEndRef} />
        </div>
        <form className="flex flex-shrink-0 items-end gap-2 border-t border-border p-3" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <textarea value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="Ask to revise the proposal…" rows={1} disabled={status !== 'ready'} className="min-h-9 max-h-24 min-w-0 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50" />
          <button type="submit" aria-label="Send" disabled={!inputValue.trim() || status !== 'ready'} className="flex-shrink-0 rounded-lg bg-muted p-2 text-muted-foreground hover:bg-accent disabled:opacity-40"><Send size={13} /></button>
        </form>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-12 flex-shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-2">
          <span className="text-sm font-medium">{status === 'loading' ? 'Generating UI concept previews' : `${selectedPages.length} page${selectedPages.length === 1 ? '' : 's'} selected`}</span>
          {plan && plan.screens.filter((surface) => surface.kind === 'page').length > MAX_INTERFACE_PAGES && <span className="text-[11px] text-muted-foreground">Choose up to {MAX_INTERFACE_PAGES} pages · dialogs and inline surfaces follow their parent</span>}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onCancel} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
            <button onClick={() => plan && onConfirm(selectInterfacePages(plan, selectedPages.map((surface) => surface.id)))} disabled={!plan || !selectedPages.length || status !== 'ready'} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={12} />Generate UI</button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-5">
          {status === 'loading' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 150, 300, 450, 600, 750].map((delay) => <SkeletonCard key={delay} delay={delay} />)}</div>}
          {status === 'error' && <section role="alert" className="mx-auto max-w-xl rounded-xl border border-destructive/40 bg-card p-5"><h2 className="text-sm font-semibold text-foreground">Proposal could not be loaded</h2><p className="mt-2 text-sm text-muted-foreground">{error}</p><button onClick={() => void requestInitial()} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-xs text-white">Retry</button></section>}
          {status !== 'loading' && status !== 'error' && plan && <>
            {!!error && <div role="alert" className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-sm"><p className="flex-1 text-destructive">{error}</p><button onClick={() => { const last = messages.filter((item) => item.role === 'user').at(-1)?.content; if (last) void sendMessage(last); }} className="rounded border border-border px-3 py-1 text-xs">Retry refinement</button></div>}
            {(plan?.workflow.context || context).startsWith('[CONTEXT EXCERPT') && <section role="note" aria-label="Specs context excerpt warning" className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
              <p className="font-semibold">Specs context was excerpted to fit the planning budget. Missing details may affect coverage; assumptions are not verified requirements.</p>
              <details className="mt-2"><summary className="cursor-pointer select-none">Inspect the context excerpt sent</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans">{plan?.workflow.context || context}</pre></details>
            </section>}
            {(generationFeedback.length > 0 || apiWarnings.length > 0 || inspectInterfacePlan(plan).warnings.length > 0) && <section aria-label="Coverage warnings" className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"><h2 className="mb-1 font-semibold">Review notes</h2><ul className="list-disc space-y-1 pl-4">{[...generationFeedback, ...apiWarnings, ...inspectInterfacePlan(plan).warnings].map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></section>}
            <div className="mb-4 rounded-xl border border-border bg-card p-4"><h2 className="text-sm font-semibold">Proposal summary</h2><p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p></div>
            {!!plan.assumptions.length && <section aria-label="Assumptions and questions" className="mb-4 rounded-xl border border-amber-300/70 bg-amber-50/50 p-4 dark:bg-amber-950/15"><h2 className="text-sm font-semibold">Assumptions to review</h2><ul className="mt-2 space-y-2 text-xs text-muted-foreground">{plan.assumptions.map((assumption, index) => <li key={`${assumption.text}-${index}`}><p className="font-medium text-foreground">{assumption.text}</p>{assumption.question && <p className="mt-0.5">Question: {assumption.question}</p>}{!!assumption.nodeIds.length && <p className="mt-0.5">Related steps: {idFor(plan, assumption.nodeIds, 'node').join(', ')}</p>}</li>)}</ul></section>}
            {!plan.assumptions.length && <p className="mb-3 text-xs text-muted-foreground">No open assumptions. Advisory coverage notes do not block generation.</p>}
            {!!plan.backgroundSteps.length && <section aria-label="Background workflow steps" className="mb-4 rounded-xl border border-border bg-card p-4"><h2 className="text-sm font-semibold">Handled outside the interface</h2><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{plan.backgroundSteps.map((step, index) => <li key={`${step.nodeIds.join('-')}-${index}`}><span className="font-medium text-foreground">{idFor(plan, step.nodeIds, 'node').join(', ')}</span> — {step.reason}</li>)}</ul></section>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plan.screens.filter((surface) => surface.kind === 'page').map((page) => {
                const preview = previews.find((item) => item.id === page.id);
                const pageDisabled = !page.selected && selectedPages.length >= MAX_INTERFACE_PAGES;
                return <article key={page.id} className={`rounded-xl border-2 bg-card p-3 transition-colors ${page.selected ? 'border-violet-500 shadow-sm' : 'border-border opacity-75'}`}>
                  <div className="mb-3 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {preview ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svgWireframe)}`} alt={`${page.name} wireframe preview`} className="h-full w-full object-contain" draggable={false} /> : <div className="max-w-[85%] text-center"><p className="text-sm font-medium text-foreground">{page.name}</p><p className="mt-1 text-xs text-muted-foreground">Editable page requirements</p></div>}
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox checked={page.selected} disabled={pageDisabled} onCheckedChange={() => togglePage(page.id)} className="mt-0.5 flex-shrink-0 data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600" aria-label={`Include ${page.name}`} />
                    <div className="min-w-0 flex-1"><h3 className="truncate text-xs font-semibold text-foreground">{page.name}</h3><p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{page.description}</p><p className="mt-1 text-[10px] text-muted-foreground">Actor: {page.actor} · {page.origin}</p></div>
                  </div>
                  <Details surface={page} plan={plan} />
                </article>;
              })}
            </div>
          </>}
        </div>
      </main>
    </div>
  );
}
