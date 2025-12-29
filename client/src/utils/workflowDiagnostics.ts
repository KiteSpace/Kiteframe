/**
 * Workflow Diagnostics - Non-Blocking Quality Analysis
 * 
 * These diagnostics replace the blocking asserts from workflowGuards.ts and pmDepthGuards.ts.
 * They return issues instead of throwing, enabling first-pass generation while still
 * providing quality feedback for optional expansion.
 */

export type QuickActionType = 
  | 'HAPPY_PATH_ONLY' 
  | 'INCLUDE_EDGE_CASES' 
  | 'DISCUSS_EDGE_CASES' 
  | 'SELECT_EDGE_CASES';

export interface WorkflowDiagnosticIssue {
  code: 'LINEAR_ONLY' | 'NO_FAILURE_PATH' | 'NO_TERMINATION' | 'LOW_PM_DEPTH';
  message: string;
  severity: 'info' | 'warn' | 'blocker';
  suggestedQuickActions?: QuickActionType[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface AnalyzableWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

const DECISION_NODE_TYPES = ['condition', 'decision', 'branch', 'switch', 'gateway', 'if'];
const FAILURE_NODE_TYPES = ['error', 'failure', 'retry', 'reject', 'exit', 'exception', 'fail'];
const TERMINATION_NODE_TYPES = ['end', 'exit', 'terminate', 'complete', 'finish', 'output', 'done', 'success'];

const PM_DEPTH_KEYWORDS = {
  tradeoff: [
    'tradeoff', 'trade-off', 'trade off', ' vs ', ' versus ',
    'option a', 'option b', 'option 1', 'option 2',
    'speed vs', 'accuracy vs', 'cost vs', 'friction vs', 'conversion vs',
  ],
  risk: [
    'risk', 'failure', 'fail', 'mitigation', 'mitigate', 'fraud', 'abuse', 'churn',
    'error', 'exception', 'fallback', 'recovery', 'timeout', 'retry limit',
    'blocked', 'rejected', 'invalid', 'unauthorized', 'escalate',
  ],
  irreversible: [
    'create account', 'account creation', 'submit order', 'submit payment',
    'confirm purchase', 'confirm payment', 'process payment', 'charge card',
    'delete account', 'delete permanently', 'publish live', 'deploy',
    'sign contract', 'agree to terms', 'accept terms', 'enroll in', 'subscribe',
  ],
};

function hasNodeOfType(nodes: WorkflowNode[], types: string[]): boolean {
  return nodes.some(node => 
    types.some(type => 
      node.type.toLowerCase().includes(type) ||
      (node.label?.toLowerCase() || '').includes(type)
    )
  );
}

function hasMultipleOutgoingEdges(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
  const nodeOutgoingEdges = new Map<string, number>();
  edges.forEach(edge => {
    const count = nodeOutgoingEdges.get(edge.source) || 0;
    nodeOutgoingEdges.set(edge.source, count + 1);
  });
  return Array.from(nodeOutgoingEdges.values()).some(count => count > 1);
}

function extractAllText(workflow: AnalyzableWorkflow): string {
  const nodeTexts = workflow.nodes.map(n => 
    `${n.label || ''} ${n.type} ${JSON.stringify(n.data || {})}`
  );
  const edgeTexts = workflow.edges.map(e => e.label || '');
  return [...nodeTexts, ...edgeTexts].join(' ').toLowerCase();
}

function hasPMDepthSignals(workflow: AnalyzableWorkflow): boolean {
  const allText = extractAllText(workflow);
  
  const hasTradeoff = PM_DEPTH_KEYWORDS.tradeoff.some(k => allText.includes(k.toLowerCase()));
  const hasRisk = PM_DEPTH_KEYWORDS.risk.some(k => allText.includes(k.toLowerCase()));
  const hasIrreversible = PM_DEPTH_KEYWORDS.irreversible.some(k => allText.includes(k.toLowerCase()));
  
  return hasTradeoff || hasRisk || hasIrreversible;
}

/**
 * Analyze workflow and return non-blocking diagnostic issues.
 * This replaces the blocking assertWorkflowStructure and assertPMDepth functions.
 * 
 * @returns Array of diagnostic issues. Empty array means workflow is complete.
 */
export function analyzeWorkflowDiagnostics(workflow: AnalyzableWorkflow): WorkflowDiagnosticIssue[] {
  const issues: WorkflowDiagnosticIssue[] = [];
  const { nodes, edges } = workflow;

  if (!nodes || nodes.length === 0) {
    return issues;
  }

  const hasDecisionNode = hasNodeOfType(nodes, DECISION_NODE_TYPES);
  const hasBranchingEdges = hasMultipleOutgoingEdges(nodes, edges);
  const hasFailurePath = hasNodeOfType(nodes, FAILURE_NODE_TYPES);
  const hasTermination = hasNodeOfType(nodes, TERMINATION_NODE_TYPES);
  const hasPMDepth = hasPMDepthSignals(workflow);

  if (!hasDecisionNode && !hasBranchingEdges) {
    issues.push({
      code: 'LINEAR_ONLY',
      message: 'This workflow is a simple happy path. Most real workflows include at least one decision point.',
      severity: 'warn',
      suggestedQuickActions: ['HAPPY_PATH_ONLY', 'INCLUDE_EDGE_CASES', 'DISCUSS_EDGE_CASES'],
    });
  }

  if (!hasFailurePath) {
    issues.push({
      code: 'NO_FAILURE_PATH',
      message: 'No failure or retry paths detected. Consider adding common failure cases.',
      severity: 'warn',
      suggestedQuickActions: ['INCLUDE_EDGE_CASES', 'DISCUSS_EDGE_CASES'],
    });
  }

  if (!hasTermination) {
    issues.push({
      code: 'NO_TERMINATION',
      message: 'No clear termination or completion state detected.',
      severity: 'info',
    });
  }

  if (!hasPMDepth && (hasDecisionNode || hasBranchingEdges)) {
    issues.push({
      code: 'LOW_PM_DEPTH',
      message: 'This workflow may be missing tradeoffs or irreversible decision points.',
      severity: 'info',
    });
  }

  return issues;
}

/**
 * Check if a workflow is valid enough to enable Create Workflow button.
 * Only requires: nodes >= 2 and edges >= 1
 */
export function isWorkflowValidForCreation(workflow: AnalyzableWorkflow): boolean {
  return workflow.nodes.length >= 2 && workflow.edges.length >= 1;
}

/**
 * Get suggested quick actions based on diagnostic issues.
 * Returns unique set of actions that should be shown to user.
 */
export function getSuggestedQuickActions(issues: WorkflowDiagnosticIssue[]): QuickActionType[] {
  const actionsSet = new Set<QuickActionType>();
  
  for (const issue of issues) {
    if (issue.suggestedQuickActions) {
      issue.suggestedQuickActions.forEach(action => actionsSet.add(action));
    }
  }
  
  return Array.from(actionsSet);
}

/**
 * Check if workflow has any issues that suggest edge case expansion.
 */
export function shouldSuggestEdgeCaseExpansion(issues: WorkflowDiagnosticIssue[]): boolean {
  return issues.some(issue => 
    issue.code === 'LINEAR_ONLY' || issue.code === 'NO_FAILURE_PATH'
  );
}
