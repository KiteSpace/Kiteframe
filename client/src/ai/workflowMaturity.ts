export type WorkflowMaturity = 'draft' | 'stable';

export interface MaturityInput {
  nodeCount: number;
  edgeCount: number;
  hasDecisionNodes: boolean;
  hasInputs: boolean;
  hasOutputs: boolean;
}

export function computeWorkflowMaturity(input: MaturityInput): WorkflowMaturity {
  if (
    input.nodeCount < 4 ||
    input.edgeCount < 3 ||
    !input.hasInputs ||
    !input.hasOutputs
  ) {
    return 'draft';
  }

  return 'stable';
}

export function getMaturityLabel(maturity: WorkflowMaturity): string {
  return maturity === 'draft' ? 'Draft' : 'Stable';
}
