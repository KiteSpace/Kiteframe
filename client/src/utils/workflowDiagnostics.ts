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

export type DiagnosticsContext = 'HOME_PROPOSAL' | 'IN_PROJECT';

/**
 * Part 5: Test Flight Intent Mode
 * 
 * - 'validate': Full diagnostics (manual Test Flight)
 * - 'educate': Only blocking issues (AI-initiated flows)
 */
export type DiagnosticsMode = 'validate' | 'educate';

const HOME_PROPOSAL_REQUIRED_ACTIONS: QuickActionType[] = [
  'HAPPY_PATH_ONLY',
  'INCLUDE_EDGE_CASES', 
  'DISCUSS_EDGE_CASES'
];

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
 * Get suggested quick actions based on diagnostic issues and context.
 * 
 * @param issues - Diagnostic issues from analyzeWorkflowDiagnostics
 * @param context - Phase context: 'HOME_PROPOSAL' always shows edge/fail actions,
 *                  'IN_PROJECT' uses diagnostics-driven visibility
 * @returns Unique set of actions that should be shown to user
 */
export function getSuggestedQuickActions(
  issues: WorkflowDiagnosticIssue[],
  context: DiagnosticsContext = 'IN_PROJECT'
): QuickActionType[] {
  const actionsSet = new Set<QuickActionType>();
  
  if (context === 'HOME_PROPOSAL') {
    HOME_PROPOSAL_REQUIRED_ACTIONS.forEach(action => actionsSet.add(action));
  }
  
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

/**
 * Diagnostic Baseline Snapshot
 * 
 * Captures the current state of diagnostics before AI makes changes.
 * Used to compute "net new" issues after AI proposals.
 */
export interface DiagnosticBaseline {
  capturedAt: number;
  issues: WorkflowDiagnosticIssue[];
  issueCodes: Set<string>;
  nodeCount: number;
  edgeCount: number;
  /**
   * The exact graph these diagnostics were measured over.
   *
   * Kept on the snapshot so later comparisons can project "what the canvas
   * would look like once this proposal is applied" against the same graph the
   * baseline was taken from. Re-deriving the graph at comparison time is unsafe:
   * generation takes tens of seconds, during which the canvas can change, which
   * would silently compare two different worlds.
   */
  workflow: AnalyzableWorkflow;
}

/**
 * Capture a diagnostic baseline snapshot for delta comparison.
 * Call this BEFORE AI generates or modifies a workflow.
 */
export function captureDiagnosticBaseline(workflow: AnalyzableWorkflow): DiagnosticBaseline {
  const issues = analyzeWorkflowDiagnostics(workflow);
  return {
    capturedAt: Date.now(),
    issues,
    issueCodes: new Set(issues.map(i => i.code)),
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    // Defensive copy: the caller's arrays are live canvas state.
    workflow: { nodes: [...workflow.nodes], edges: [...workflow.edges] },
  };
}

/**
 * Diagnostic Delta Result
 * 
 * Represents the difference between baseline and post-proposal diagnostics.
 */
export interface DiagnosticDelta {
  baselineIssueCount: number;
  postProposalIssueCount: number;
  newlyIntroducedIssues: WorkflowDiagnosticIssue[];
  resolvedIssues: WorkflowDiagnosticIssue[];
  hasNewIssues: boolean;
  /**
   * NOT a gate. This says "the proposal, measured on its own, carries findings
   * the baseline did not" — which is only meaningful when `proposedWorkflow` is
   * the *projected applied* graph (see `assessProposal`). Passing a bare
   * proposal here compares a new workflow against a whole canvas and will
   * report regressions for work that damages nothing.
   *
   * Do not reintroduce a rejection based on this field. Applying is additive,
   * so a proposal cannot remove coverage the canvas already has.
   */
  hasRegressions: boolean;
}

/**
 * Compute the diagnostic delta between baseline and proposed workflow.
 * 
 * This is the core of "Diagnostic Delta Gating" - only surfaces NEWLY INTRODUCED
 * issues, not issues that existed before AI made changes.
 * 
 * @param baseline - Captured baseline from captureDiagnosticBaseline()
 * @param proposedWorkflow - The workflow after AI proposal
 * @returns Delta showing only net-new issues
 */
export function computeDiagnosticDelta(
  baseline: DiagnosticBaseline,
  proposedWorkflow: AnalyzableWorkflow
): DiagnosticDelta {
  const postProposalIssues = analyzeWorkflowDiagnostics(proposedWorkflow);
  const postProposalCodes = new Set(postProposalIssues.map(i => i.code));
  
  const newlyIntroducedIssues = postProposalIssues.filter(
    issue => !baseline.issueCodes.has(issue.code)
  );
  
  const resolvedIssues = baseline.issues.filter(
    issue => !postProposalCodes.has(issue.code)
  );
  
  return {
    baselineIssueCount: baseline.issues.length,
    postProposalIssueCount: postProposalIssues.length,
    newlyIntroducedIssues,
    resolvedIssues,
    hasNewIssues: newlyIntroducedIssues.length > 0,
    hasRegressions: newlyIntroducedIssues.some(i => i.severity === 'blocker' || i.severity === 'warn'),
  };
}

/**
 * @deprecated Non-gating. Retained for the regression tests that pin down why
 * the old proposal-time veto was wrong; see `DiagnosticDelta.hasRegressions`.
 * Use `assessProposal`, which reports advisories and never rejects.
 */
export function shouldFlagProposalForNewIssues(delta: DiagnosticDelta): boolean {
  return delta.hasRegressions;
}

/**
 * Project the graph that would exist once a proposal is applied to the canvas.
 *
 * Diagnosing the proposal on its own is not a like-for-like comparison against a
 * baseline taken from the existing canvas: a brand-new workflow gets judged as
 * if the rest of the canvas had ceased to exist, so anything the canvas already
 * covered counts against it. Comparing the baseline to the *projected result* is
 * what makes "did this change anything for the worse?" a meaningful question.
 *
 * Applying a draft is purely additive. Every accept path either appends the
 * proposal or adds it as a separate copy with freshly generated node ids, so
 * nothing already on the canvas is dropped or overwritten — which is why this is
 * a plain concatenation rather than a merge.
 */
export function projectAppliedWorkflow(
  existing: AnalyzableWorkflow,
  proposed: AnalyzableWorkflow
): AnalyzableWorkflow {
  return {
    nodes: [...existing.nodes, ...proposed.nodes],
    edges: [...existing.edges, ...proposed.edges],
  };
}

/**
 * The result of judging a proposal against the baseline captured before it.
 */
export interface ProposalAssessment {
  /** Baseline compared against the canvas as it would be after applying. */
  delta: DiagnosticDelta;
  /** The graph as it would be once the proposal is applied. */
  appliedWorkflow: AnalyzableWorkflow;
  /**
   * Quality feedback about the proposal itself — incompleteness, not damage.
   *
   * There is deliberately no "regression" counterpart. Applying only ever adds
   * to the canvas, so a proposal cannot remove a decision point or failure path
   * that already exists; every finding here is about the new work being an early
   * draft. Surface these as suggestions the user can act on, never as a reason
   * to withhold the proposal. Genuinely destructive replacement is guarded at
   * the point the user chooses it, not here.
   */
  advisories: WorkflowDiagnosticIssue[];
}

/**
 * Judge an AI proposal against the baseline captured before generation.
 */
export function assessProposal(
  baseline: DiagnosticBaseline,
  proposedWorkflow: AnalyzableWorkflow
): ProposalAssessment {
  const appliedWorkflow = projectAppliedWorkflow(baseline.workflow, proposedWorkflow);

  return {
    delta: computeDiagnosticDelta(baseline, appliedWorkflow),
    appliedWorkflow,
    advisories: analyzeWorkflowDiagnostics(proposedWorkflow),
  };
}

/**
 * Render diagnostic issues as a single human-readable sentence fragment.
 * Used so messages name the actual finding instead of saying "new issues".
 */
export function describeDiagnosticIssues(issues: WorkflowDiagnosticIssue[]): string {
  return issues.map(i => i.message).join(' ');
}

/**
 * Part 5: Filter diagnostics based on intent mode.
 * 
 * - 'validate': Returns all issues (manual Test Flight)
 * - 'educate': Returns only blocking issues (AI-initiated flows)
 * 
 * This prevents Test Flight from feeling like an "error generator"
 * during AI flows by suppressing advisory issues.
 */
export function filterDiagnosticsByMode(
  issues: WorkflowDiagnosticIssue[],
  mode: DiagnosticsMode
): WorkflowDiagnosticIssue[] {
  if (mode === 'validate') {
    return issues;
  }
  
  return issues.filter(issue => issue.severity === 'blocker');
}
