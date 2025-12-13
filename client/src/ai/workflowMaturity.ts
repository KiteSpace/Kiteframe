/**
 * Workflow Maturity System
 * 
 * Manages workflow maturity levels (draft/stable) and preview mode before project creation.
 * Per spec: draft workflows show "Beta" label and enable suggestion chips.
 */

export type WorkflowMaturity = 'draft' | 'stable';

export interface MaturityInput {
  nodeCount: number;
  edgeCount: number;
  hasDecisionNodes: boolean;
  hasInputs: boolean;
  hasOutputs: boolean;
  hasFailurePaths: boolean;
}

export interface WorkflowMaturityState {
  maturity: WorkflowMaturity;
  isPreview: boolean;
  showBetaLabel: boolean;
  enableSuggestionChips: boolean;
  userConfirmed: boolean;
}

export interface PreviewWorkflow {
  id: string;
  nodes: PreviewNode[];
  edges: PreviewEdge[];
  maturity: WorkflowMaturity;
  summary: string;
}

export interface PreviewNode {
  id: string;
  type: string;
  label: string;
  isGhost: boolean;
}

export interface PreviewEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  isGhost: boolean;
}

const DEFAULT_STATE: WorkflowMaturityState = {
  maturity: 'draft',
  isPreview: true,
  showBetaLabel: true,
  enableSuggestionChips: true,
  userConfirmed: false,
};

export function createInitialMaturityState(): WorkflowMaturityState {
  return { ...DEFAULT_STATE };
}

export function computeWorkflowMaturity(input: MaturityInput): WorkflowMaturity {
  if (
    input.nodeCount < 4 ||
    input.edgeCount < 3 ||
    !input.hasInputs ||
    !input.hasOutputs ||
    !input.hasDecisionNodes ||
    !input.hasFailurePaths
  ) {
    return 'draft';
  }

  return 'stable';
}

export function getMaturityLabel(maturity: WorkflowMaturity): string {
  return maturity === 'draft' ? 'Beta' : 'Stable';
}

export function shouldShowBetaLabel(state: WorkflowMaturityState): boolean {
  return state.maturity === 'draft' && state.showBetaLabel;
}

export function shouldEnableSuggestionChips(state: WorkflowMaturityState): boolean {
  return state.maturity === 'draft' && state.enableSuggestionChips;
}

export function canCommitWorkflow(state: WorkflowMaturityState): boolean {
  return state.userConfirmed && !state.isPreview;
}

export function transitionToStable(state: WorkflowMaturityState): WorkflowMaturityState {
  console.log('[KiteAI] Workflow maturity: draft → stable');
  return {
    ...state,
    maturity: 'stable',
    showBetaLabel: false,
    enableSuggestionChips: false,
  };
}

export function confirmWorkflow(state: WorkflowMaturityState): WorkflowMaturityState {
  console.log('[KiteAI] Workflow confirmed by user');
  return {
    ...state,
    userConfirmed: true,
    isPreview: false,
  };
}

export function createPreviewWorkflow(
  summary: string,
  suggestedNodes: { type: string; label: string }[]
): PreviewWorkflow {
  const nodes: PreviewNode[] = suggestedNodes.map((node, index) => ({
    id: `preview-${index}`,
    type: node.type,
    label: node.label,
    isGhost: true,
  }));

  const edges: PreviewEdge[] = nodes.slice(0, -1).map((node, index) => ({
    id: `preview-edge-${index}`,
    source: node.id,
    target: nodes[index + 1].id,
    isGhost: true,
  }));

  console.log(`[KiteAI] Preview workflow created with ${nodes.length} ghost nodes`);

  return {
    id: `preview-${Date.now()}`,
    nodes,
    edges,
    maturity: 'draft',
    summary,
  };
}

export function getMaturityStateFromInput(input: MaturityInput): WorkflowMaturityState {
  const maturity = computeWorkflowMaturity(input);
  return {
    maturity,
    isPreview: maturity === 'draft',
    showBetaLabel: maturity === 'draft',
    enableSuggestionChips: maturity === 'draft',
    userConfirmed: false,
  };
}
