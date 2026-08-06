import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InterfaceProposalView } from '../InterfaceProposalView';

vi.mock('@/lib/buildInterfacePrompt', () => ({
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