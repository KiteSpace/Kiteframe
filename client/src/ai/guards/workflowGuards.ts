/**
 * Workflow Guards - Generator-Level Constraints
 * 
 * These guards MUST be checked in code before workflow generation.
 * They enforce quality standards that cannot be bypassed by prompts.
 */

import { ActionabilityResult } from '../actionability';
import { assertPMDepth, PMDepthResult, RoleContext, SemanticWorkflow } from './pmDepthGuards';

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

export interface WorkflowStructure {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface GuardResult {
  passed: boolean;
  reason: string;
  details?: string[];
}

export interface PromptActionabilityResult extends GuardResult {
  missingDimensions?: string[];
  confidence: number;
}

export interface WorkflowStructureResult extends GuardResult {
  hasDecisionNode: boolean;
  hasAlternativePath: boolean;
  hasFailurePath: boolean;
  hasTermination: boolean;
  edgeCount: number;
}

export interface GenerationState {
  userConfirmed: boolean;
  assumptionsAccepted: boolean;
  clarificationComplete: boolean;
}

export type IntentMaturity = 'draft' | 'reviewed' | 'stable';

export interface MaturityGatingResult extends GuardResult {
  maturity: IntentMaturity;
  canAutoExecute: boolean;
  canFastAction: boolean;
}

// DEPRECATED: Confidence no longer blocks generation. Set to 0 for non-blocking behavior.
// Confidence is now used only to determine quick action suggestions.
const CONFIDENCE_THRESHOLD_BLOCK = 0;

const DECISION_NODE_TYPES = ['condition', 'decision', 'branch', 'switch', 'gateway'];
const FAILURE_NODE_TYPES = ['error', 'failure', 'retry', 'reject', 'exit', 'exception'];
const TERMINATION_NODE_TYPES = ['end', 'exit', 'terminate', 'complete', 'finish', 'output'];

/**
 * Guard 1: Assert Prompt is Actionable
 * 
 * Blocks generation if confidence < 0.70
 * Returns missing dimensions for clarification
 */
export function assertPromptActionable(
  prompt: string,
  actionability: ActionabilityResult
): PromptActionabilityResult {
  const { confidence, score, missing, isActionable } = actionability;

  if (confidence < CONFIDENCE_THRESHOLD_BLOCK) {
    console.log(`[KiteAI Guard] BLOCKED: Confidence ${confidence} < ${CONFIDENCE_THRESHOLD_BLOCK}`);
    
    const missingDescriptions = missing.map(dim => {
      switch (dim) {
        case 'actor': return 'Who will use this workflow (user/actor)';
        case 'trigger': return 'What triggers the workflow (context/event)';
        case 'goal': return 'What the successful outcome looks like (goal/intent)';
        case 'scope': return 'What is included or excluded (boundaries/constraints)';
        case 'flowSignal': return 'The steps or sequence involved (flow/process)';
        default: return dim;
      }
    });

    return {
      passed: false,
      reason: `Insufficient actionability (confidence: ${Math.round(confidence * 100)}%, score: ${score}/5)`,
      missingDimensions: missingDescriptions,
      confidence,
      details: [
        `Prompt needs more specificity in: ${missing.join(', ')}`,
        'Ask clarifying questions before proceeding',
      ],
    };
  }

  if (score < 3) {
    console.log(`[KiteAI Guard] BLOCKED: Score ${score} < 3`);
    return {
      passed: false,
      reason: `Actionability score too low (${score}/5)`,
      missingDimensions: missing,
      confidence,
      details: [
        'Prompt must satisfy at least 3 of 5 dimensions',
        `Missing: ${missing.join(', ')}`,
      ],
    };
  }

  console.log(`[KiteAI Guard] PASSED: Prompt actionable (confidence: ${confidence}, score: ${score})`);
  return {
    passed: true,
    reason: 'Prompt meets actionability threshold',
    confidence,
    missingDimensions: [],
  };
}

/**
 * Guard 2: Assert Workflow Structure
 * 
 * Validates that a workflow meets minimum viability:
 * - ≥ 1 decision point (branch)
 * - ≥ 1 non-happy-path (error, retry, rejection, exit)
 * - ≥ 1 loop OR explicit termination
 * - ≥ 2 edges
 */
export function assertWorkflowStructure(workflow: WorkflowStructure): WorkflowStructureResult {
  const { nodes, edges } = workflow;
  
  const hasDecisionNode = nodes.some(node => 
    DECISION_NODE_TYPES.some(type => 
      node.type.toLowerCase().includes(type) ||
      (node.label?.toLowerCase() || '').includes(type)
    )
  );

  const hasFailurePath = nodes.some(node =>
    FAILURE_NODE_TYPES.some(type =>
      node.type.toLowerCase().includes(type) ||
      (node.label?.toLowerCase() || '').includes(type)
    )
  );

  const hasTermination = nodes.some(node =>
    TERMINATION_NODE_TYPES.some(type =>
      node.type.toLowerCase().includes(type) ||
      (node.label?.toLowerCase() || '').includes(type)
    )
  );

  const nodeOutgoingEdges = new Map<string, number>();
  edges.forEach(edge => {
    const count = nodeOutgoingEdges.get(edge.source) || 0;
    nodeOutgoingEdges.set(edge.source, count + 1);
  });
  const hasMultipleOutgoingEdges = Array.from(nodeOutgoingEdges.values()).some(count => count > 1);

  const hasAlternativePath = hasDecisionNode || hasMultipleOutgoingEdges;

  const edgeCount = edges.length;
  const failures: string[] = [];

  if (!hasDecisionNode) {
    failures.push('No decision/branch node found - workflow is purely linear');
  }
  if (!hasAlternativePath) {
    failures.push('No alternative paths - all flows are happy-path only');
  }
  if (!hasFailurePath) {
    failures.push('No failure/error/retry handling - missing non-happy-path');
  }
  if (!hasTermination) {
    failures.push('No explicit termination node - workflow has no clear end state');
  }
  if (edgeCount < 2) {
    failures.push(`Only ${edgeCount} edge(s) - minimum 2 required for valid workflow`);
  }

  const isLinearOnly = !hasDecisionNode && !hasAlternativePath && edgeCount <= nodes.length;
  if (isLinearOnly) {
    failures.push('Workflow is a linear checklist, not a proper workflow with decisions');
  }

  const passed = failures.length === 0;

  if (!passed) {
    console.log(`[KiteAI Guard] BLOCKED: Workflow structure invalid`, failures);
  } else {
    console.log(`[KiteAI Guard] PASSED: Workflow structure valid`);
  }

  return {
    passed,
    reason: passed 
      ? 'Workflow meets minimum viability requirements'
      : 'Workflow structure does not meet minimum requirements',
    details: failures,
    hasDecisionNode,
    hasAlternativePath,
    hasFailurePath,
    hasTermination,
    edgeCount,
  };
}

/**
 * Guard 3: Assert User Confirmed Generation
 * 
 * Project creation ONLY allowed after:
 * - User confirms readiness, OR
 * - User accepts AI-proposed assumptions
 */
export function assertUserConfirmedGeneration(state: GenerationState): GuardResult {
  // CHANGED: Removed clarification blocking. Generation should always proceed.
  // Clarification is now optional - first-pass generation happens immediately.
  // Quick actions suggest refinement options instead of blocking.
  const { userConfirmed, assumptionsAccepted } = state;

  // Always pass - we generate on first turn regardless of confirmation state
  // The Create Workflow button is only gated by having a valid graph (nodes >= 2, edges >= 1)
  console.log(`[KiteAI Guard] PASSED: Generation allowed (no blocking gates)`);
  
  return {
    passed: true,
    reason: 'Generation allowed - assertive first-turn generation enabled',
  };
}

/**
 * Guard 4: Assert Workflow Maturity Level
 * 
 * Checks if the workflow's intent maturity allows the requested action:
 * - Draft: AI suggestions only, no auto-execute
 * - Reviewed: Intent confirmed, still requires user confirmation
 * - Stable: Fast actions allowed, no confirmation needed
 */
export function assertWorkflowMaturity(
  maturity: IntentMaturity,
  action: 'auto-execute' | 'fast-action' | 'suggest-only'
): MaturityGatingResult {
  const gatingRules = {
    draft: { canAutoExecute: false, canFastAction: false },
    reviewed: { canAutoExecute: false, canFastAction: false },
    stable: { canAutoExecute: true, canFastAction: true },
  };

  const rules = gatingRules[maturity];
  
  if (action === 'auto-execute' && !rules.canAutoExecute) {
    console.log(`[KiteAI Guard] BLOCKED: Cannot auto-execute on ${maturity} workflow`);
    return {
      passed: false,
      reason: `Auto-execution not allowed for ${maturity} workflows`,
      details: [
        maturity === 'draft' 
          ? 'Confirm the workflow intent and add failure paths to enable execution'
          : 'Promote workflow to Stable status to enable auto-execution',
      ],
      maturity,
      canAutoExecute: rules.canAutoExecute,
      canFastAction: rules.canFastAction,
    };
  }

  if (action === 'fast-action' && !rules.canFastAction) {
    console.log(`[KiteAI Guard] BLOCKED: Cannot fast-action on ${maturity} workflow`);
    return {
      passed: false,
      reason: `Fast actions not allowed for ${maturity} workflows`,
      details: ['Promote workflow to Stable status to enable fast actions'],
      maturity,
      canAutoExecute: rules.canAutoExecute,
      canFastAction: rules.canFastAction,
    };
  }

  console.log(`[KiteAI Guard] PASSED: Maturity ${maturity} allows ${action}`);
  return {
    passed: true,
    reason: `${maturity} workflow allows ${action}`,
    maturity,
    canAutoExecute: rules.canAutoExecute,
    canFastAction: rules.canFastAction,
  };
}

/**
 * Combined guard check - runs all guards and returns aggregated result
 */
export function runAllGuards(
  prompt: string,
  actionability: ActionabilityResult,
  workflow: WorkflowStructure | null,
  generationState: GenerationState,
  roleContext?: RoleContext
): {
  canProceed: boolean;
  failures: GuardResult[];
  promptResult: PromptActionabilityResult;
  workflowResult: WorkflowStructureResult | null;
  pmDepthResult: PMDepthResult | null;
  confirmationResult: GuardResult;
} {
  const promptResult = assertPromptActionable(prompt, actionability);
  
  const workflowResult = workflow 
    ? assertWorkflowStructure(workflow)
    : null;
  
  const pmDepthResult = workflow
    ? assertPMDepth(workflow as SemanticWorkflow, roleContext)
    : null;
  
  const confirmationResult = assertUserConfirmedGeneration(generationState);

  const failures: GuardResult[] = [];
  
  if (!promptResult.passed) failures.push(promptResult);
  if (workflowResult && !workflowResult.passed) failures.push(workflowResult);
  if (pmDepthResult && !pmDepthResult.passed) failures.push(pmDepthResult);
  if (!confirmationResult.passed) failures.push(confirmationResult);

  const canProceed = failures.length === 0;

  if (!canProceed) {
    console.log(`[KiteAI Guard] ALL GUARDS: ${failures.length} failure(s) - blocking project creation`);
  } else {
    console.log(`[KiteAI Guard] ALL GUARDS: All passed - project creation allowed`);
  }

  return {
    canProceed,
    failures,
    promptResult,
    workflowResult,
    pmDepthResult,
    confirmationResult,
  };
}

export { assertPMDepth, type PMDepthResult, type RoleContext, type SemanticWorkflow } from './pmDepthGuards';
