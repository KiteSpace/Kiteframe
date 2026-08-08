import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterfaceProposalView } from '../InterfaceProposalView';
import { analyzeWorkflowScreens } from '@/lib/buildInterfacePrompt';

vi.mock('@/lib/buildInterfacePrompt', async () => ({
  ...(await vi.importActual('@/lib/buildInterfacePrompt')),
  analyzeWorkflowScreens: vi.fn(() => []),
}));

function renderProposal(isGenerating = false) {
  return render(
    <InterfaceProposalView
      workflowName="Analytics"
      nodes={[]}
      edges={[]}
      isGenerating={isGenerating}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  global.fetch = vi.fn(() => new Promise<Response>(() => {})) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InterfaceProposalView loading phases', () => {
  it('labels the concept-preview phase and keeps the generic skeleton cards', () => {
    renderProposal();

    expect(screen.getByText('Generating UI concept previews')).toBeInTheDocument();
    expect(screen.getByText('Building screen concepts…')).toBeInTheDocument();
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(6);
    expect(screen.queryByTestId('ui-generation-shimmer')).not.toBeInTheDocument();
  });

  it('shows the large shimmer canvas after Generate UI starts', () => {
    renderProposal(true);

    expect(screen.getByTestId('ui-generation-shimmer')).toBeInTheDocument();
    expect(screen.getByText('Generating your UI')).toBeInTheDocument();
    expect(screen.getByText('Assembling the full interface…')).toBeInTheDocument();
    expect(screen.getByText('Assembling your interface from the selected screens…')).toBeInTheDocument();
    expect(document.querySelectorAll('.ui-shimmer-block').length).toBeGreaterThan(10);
  });
});

describe('InterfaceProposalView large workflow selection', () => {
  it('shows all preview candidates but limits final selection to six', async () => {
    const user = userEvent.setup();
    const candidateNodes = Array.from({ length: 10 }, (_, index) => ({
      id: `node-${index}`,
      type: 'process',
      position: { x: 0, y: 0 },
      data: { label: `Step ${index + 1}` },
    }));
    vi.mocked(analyzeWorkflowScreens).mockReturnValue(
      Array.from({ length: 10 }, (_, index) => ({
        name: `Candidate ${index + 1}`,
        nodes: [candidateNodes[index] as any],
      })),
    );
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      screens: Array.from({ length: 10 }, (_, index) => ({
        id: `screen-${index}`,
        name: `Candidate ${index + 1}`,
        description: `Description ${index + 1}`,
        svgWireframe: '<svg />',
      })),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))) as typeof fetch;
    const onConfirm = vi.fn();

    render(
      <InterfaceProposalView
        workflowName="Large workflow"
        nodes={candidateNodes as any}
        edges={[]}
        isGenerating={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Candidate 10')).toBeInTheDocument());
    expect(screen.getAllByRole('checkbox')).toHaveLength(10);
    expect(screen.getByText(/Pick a maximum of 6 screens/i)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.slice(0, 6).every((checkbox) => checkbox.getAttribute('data-state') === 'checked')).toBe(true);
    expect(checkboxes.slice(6).every((checkbox) => checkbox.getAttribute('data-state') !== 'checked')).toBe(true);

    await user.click(checkboxes[0]);
    await user.click(checkboxes[6]);
    await user.click(screen.getByRole('button', { name: /Generate UI/i }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0][0]).toHaveLength(6);
    expect(onConfirm.mock.calls[0][0].map((cluster: { name: string }) => cluster.name)).toEqual([
      'Candidate 2',
      'Candidate 3',
      'Candidate 4',
      'Candidate 5',
      'Candidate 6',
      'Candidate 7',
    ]);
  });
});