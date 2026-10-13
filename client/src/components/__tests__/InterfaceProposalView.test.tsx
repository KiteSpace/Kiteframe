import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { setOperationOwner } from '@/ai/backgroundOperations';
import userEvent from '@testing-library/user-event';
import { InterfaceProposalView } from '../InterfaceProposalView';
import type { InterfacePlan } from '@shared/interfacePlan';

function makePlan(pageCount = 1, extraPages: InterfacePlan['screens'] = []): InterfacePlan {
  const pages = Array.from({ length: pageCount }, (_, index) => ({
    id: `page-${index + 1}`,
    name: `Page ${index + 1}`,
    kind: 'page' as const,
    parentScreenId: '',
    actor: 'Analyst',
    goal: 'Review the work',
    description: `Page description ${index + 1}`,
    rationale: `Because source step ${index + 1} needs review`,
    nodeIds: index === 0 ? ['step-a'] : [],
    origin: index === 0 ? 'workflow' as const : 'user' as const,
    dataRequirements: [{ label: `Metric ${index + 1}`, kind: 'display' as const, required: true, origin: 'spec' as const }],
    actions: [{ label: 'Continue', targetScreenId: '', edgeIds: ['transition-a'], origin: 'workflow' as const }],
    states: [{ name: 'Ready', kind: 'success' as const, description: 'Results are ready', nodeIds: ['step-a'], edgeIds: ['transition-a'] }],
    selected: index < 6,
  }));
  return {
    version: 1,
    workflow: {
      name: 'Analytics',
      description: 'A detailed workflow overview',
      context: 'Use the product specification for terminology.',
      nodes: [{ id: 'step-a', label: 'Load report', description: 'Retrieve the report details', type: 'process', actor: 'Analyst' }],
      edges: [{ id: 'transition-a', source: 'step-a', target: 'step-a', label: 'Report loaded' }],
    },
    summary: 'Inspect report status and key metrics.',
    screens: [...pages, ...extraPages],
    backgroundSteps: [],
    assumptions: [{
      text: 'The report is already available to the analyst.',
      question: 'Should unavailable reports be selectable here?',
      nodeIds: ['step-a'],
    }],
  };
}

const nodes = [{
  id: 'step-a',
  label: 'Load report',
  type: 'process',
  position: { x: 0, y: 0 },
  data: { label: 'Load report', description: 'Retrieve the report details', actor: 'Analyst' },
}] as any;
const edges = [{ id: 'transition-a', source: 'step-a', target: 'step-a', label: 'Report loaded' }] as any;
const previewResponse = (plan = makePlan(), extra: Record<string, unknown> = {}) => new Response(JSON.stringify({
  plan,
  previews: plan.screens.filter((surface) => surface.kind === 'page').map((page) => ({ id: page.id, svgWireframe: '<svg />' })),
  warnings: [],
  ...extra,
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

function renderProposal(overrides: Partial<React.ComponentProps<typeof InterfaceProposalView>> = {}) {
  const onConfirm = vi.fn();
  const view = render(<InterfaceProposalView
    workflowName="Analytics"
    workflowDescription="Detailed workflow description"
    context="Specs: reporting overview"
    nodes={nodes}
    edges={edges}
    isGenerating={false}
    onConfirm={onConfirm}
    onCancel={vi.fn()}
    {...overrides}
  />);
  return { ...view, onConfirm };
}

beforeEach(() => {
  setOperationOwner(null, true);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  global.fetch = vi.fn(() => new Promise<Response>(() => {})) as typeof fetch;
});

afterEach(() => vi.restoreAllMocks());

describe('InterfaceProposalView proposal review', () => {
  it('defaults to mocks and keeps all analysis sections in the Analysis tab', async () => {
    global.fetch = vi.fn().mockResolvedValue(previewResponse()) as typeof fetch;
    renderProposal();
    await screen.findByText('Page 1');
    expect(screen.getByRole('tab', { name: 'UI Mocks' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('heading', { name: 'Proposal Summary' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    for (const name of ['Proposal Summary', 'Assumptions to Review', 'Handled Outside the Interface']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Add ${name} to chat` })).toBeEnabled();
    }
    expect(screen.queryByRole('checkbox', { name: 'Include Page 1' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'UI Mocks' }));
    expect(screen.getByRole('checkbox', { name: 'Include Page 1' })).toBeChecked();
  });

  it('attaches findings without sending, preserves the draft and sends context with the question', async () => {
    const plan = makePlan();
    plan.backgroundSteps = [{ nodeIds: ['step-a'], reason: 'Sync reports automatically.' }];
    global.fetch = vi.fn().mockResolvedValueOnce(previewResponse(plan))
      .mockResolvedValueOnce(previewResponse(plan, { aiMessage: 'Revised with your findings.' })) as typeof fetch;
    const user = userEvent.setup();
    renderProposal();
    await screen.findByText('Page 1');
    const input = screen.getByRole('textbox', { name: 'Proposal discussion' });
    await user.type(input, 'Make unavailable reports visible');
    await user.click(screen.getByRole('tab', { name: 'Analysis' }));
    for (const name of ['Proposal Summary', 'Assumptions to Review', 'Handled Outside the Interface', 'Proposal Summary']) {
      await user.click(screen.getByRole('button', { name: `Add ${name} to chat` }));
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Make unavailable reports visible');
    expect(within(screen.getByRole('region', { name: 'Analysis added to chat' })).getAllByText('Proposal Summary')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Revised with your findings.');
    const body = JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string);
    expect(body.userMessage).toContain('Make unavailable reports visible');
    expect(body.userMessage).toContain(plan.summary);
    expect(body.userMessage).toContain(plan.assumptions[0].question);
    expect(body.userMessage).toContain('Related steps: Load report');
    expect(body.userMessage).toContain('Sync reports automatically.');
    expect(screen.queryByRole('region', { name: 'Analysis added to chat' })).not.toBeInTheDocument();
  });

  it('allows removing an attached section before sending', async () => {
    global.fetch = vi.fn().mockResolvedValue(previewResponse()) as typeof fetch;
    renderProposal();
    await screen.findByText('Page 1');
    await userEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Proposal Summary to chat' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Proposal Summary from chat' }));
    expect(screen.queryByRole('region', { name: 'Analysis added to chat' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves full workflow descriptions, actors, ids, and labeled transitions in initial request', async () => {
    global.fetch = vi.fn().mockResolvedValue(previewResponse()) as typeof fetch;
    renderProposal();
    await screen.findByText('Page 1');
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/ai/interface-proposal');
    expect(body.workflow).toMatchObject({
      name: 'Analytics',
      description: 'Detailed workflow description',
      context: 'Specs: reporting overview',
      nodes: [{ id: 'step-a', label: 'Load report', description: 'Retrieve the report details', actor: 'Analyst' }],
      edges: [{ id: 'transition-a', source: 'step-a', target: 'step-a', label: 'Report loaded' }],
    });
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('renders inspectable rationale, mapped names, transitions, assumptions and questions', async () => {
    global.fetch = vi.fn().mockResolvedValue(previewResponse()) as typeof fetch;
    renderProposal();
    await screen.findByText('Page 1');
    await userEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    expect(screen.getByText('The report is already available to the analyst.')).toBeInTheDocument();
    expect(screen.getByText('Question: Should unavailable reports be selectable here?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'UI Mocks' }));
    await userEvent.click(screen.getByText('Inspect rationale, sources & requirements'));
    expect(screen.getByText('Because source step 1 needs review')).toBeInTheDocument();
    expect(screen.getByText('Load report')).toBeInTheDocument();
    expect(screen.getByText(/Continue.*Report loaded/)).toBeInTheDocument();
  });

  it('sends the authoritative refined plan to onConfirm, including a node-less user page', async () => {
    const userPage = {
      ...makePlan().screens[0],
      id: 'user-dashboard',
      name: 'User dashboard',
      nodeIds: [],
      origin: 'user' as const,
      rationale: 'Requested directly by the designer',
      selected: true,
    };
    const refined = makePlan(1, [userPage]);
    global.fetch = vi.fn()
      .mockResolvedValueOnce(previewResponse())
      .mockResolvedValueOnce(previewResponse(refined, { aiMessage: 'Added the requested page.' })) as typeof fetch;
    const user = userEvent.setup();
    const { onConfirm } = renderProposal();
    await screen.findByText('Page 1');
    await user.type(screen.getByPlaceholderText('Ask to revise the proposal…'), 'Add a dashboard page');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Added the requested page.');
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/ai/interface-proposal-refine');
    const refineBody = JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string);
    expect(refineBody.plan.screens[0].id).toBe('page-1');
    await user.click(screen.getByRole('button', { name: /Generate UI/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
    const confirmed = onConfirm.mock.calls[0][0] as InterfacePlan;
    expect(confirmed.screens.find((surface) => surface.id === 'user-dashboard')).toMatchObject({
      name: 'User dashboard', origin: 'user', nodeIds: [], selected: true,
    });
  });

  it('allows choosing among more than six pages while never selecting over six', async () => {
    const sixPages = makePlan(8);
    global.fetch = vi.fn().mockResolvedValue(previewResponse(sixPages)) as typeof fetch;
    const user = userEvent.setup();
    renderProposal();
    await screen.findByText('Page 8');
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
    await user.click(screen.getByRole('checkbox', { name: 'Include Page 1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include Page 7' }));
    expect(screen.getByText('6 pages selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include Page 8' })).toBeDisabled();
  });

  it('keeps the proposal open on request failure and retries successfully', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Temporary upstream outage' }), { status: 503 }))
      .mockResolvedValueOnce(previewResponse()) as typeof fetch;
    const user = userEvent.setup();
    renderProposal();
    expect(await screen.findByText('Temporary upstream outage')).toBeInTheDocument();
    const retry = within(screen.getByRole('heading', { name: 'Proposal could not be loaded' }).closest('section')!).getByRole('button', { name: 'Retry' });
    expect(retry).toBeInTheDocument();
    await user.click(retry);
    expect(await screen.findByText('Page 1')).toBeInTheDocument();
  });

  it('retains the existing loading shimmer presentation', () => {
    renderProposal({ isGenerating: true });
    expect(screen.getByTestId('ui-generation-shimmer')).toBeInTheDocument();
    expect(screen.getByText('Assembling your interface from the selected screens…')).toBeInTheDocument();
  });

  it('exposes the excerpt coverage notice and retains the excerpt in context', async () => {
    const excerpt = '[CONTEXT EXCERPT: Specs exceed the context budget. This is an excerpt.]\n{"spec":"included excerpt"}';
    const plan = makePlan();
    plan.workflow.context = excerpt;
    global.fetch = vi.fn().mockResolvedValue(previewResponse(plan)) as typeof fetch;
    renderProposal({ context: excerpt });
    expect(await screen.findByRole('note', { name: 'Specs context excerpt warning' })).toBeInTheDocument();
    expect(screen.getByText(/Specs context was excerpted to fit the planning budget/)).toBeInTheDocument();
    const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(request.workflow.context).toBe(excerpt);
  });
});
