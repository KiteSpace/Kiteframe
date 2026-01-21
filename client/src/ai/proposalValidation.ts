/**
 * AI Proposal Validation - Gold-Standard Guardrails
 * 
 * Implements:
 * - Part 2: Fix-Scope Locking (prevents AI from introducing unrelated complexity)
 * - Part 3: Proposal Structure Contract (enforces complete response schema)
 * - Part 4: Edit-First Heuristic (rejects over-construction)
 */

import type { AnalyzableWorkflow, WorkflowNode, WorkflowEdge } from '../utils/workflowDiagnostics';

/**
 * Part 2: Fix-Scope metadata sent with AI requests
 * 
 * Constrains what the AI is allowed to create/modify
 * when fixing a specific issue.
 */
export interface FixScope {
  allowedNodeTypes: string[];
  allowedEdgeTypes: string[];
  forbidNewDecisionNodes: boolean;
  forbidNewFailurePaths: boolean;
  originalIssueCode?: string;
}

/**
 * Part 3: Proposal Structure Contract
 * 
 * AI must return this schema. Incomplete responses are rejected.
 */
export interface ProposalResponse {
  summary: string;
  rootCause: string;
  changes: {
    nodesAdded: number;
    nodesModified: number;
    edgesAdded: number;
    edgesRemoved: number;
  };
  whyThisResolvesIt: string;
  risksIntroduced: string[];
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

/**
 * Part 2 & 4: Proposal Validation Result
 */
export interface ProposalValidationResult {
  valid: boolean;
  rejectionReason?: 'scope_violation' | 'over_construction' | 'incomplete_schema' | 'new_decision_forbidden';
  details?: string;
}

const DECISION_NODE_TYPES = ['condition', 'decision', 'branch', 'switch', 'gateway', 'if'];
const FAILURE_NODE_TYPES = ['error', 'failure', 'retry', 'reject', 'exit', 'exception', 'fail'];

/**
 * Extract node types from a workflow for scope comparison.
 */
export function extractNodeTypes(workflow: AnalyzableWorkflow): Set<string> {
  return new Set(workflow.nodes.map(n => n.type.toLowerCase()));
}

/**
 * Extract edge types from a workflow for scope comparison.
 */
export function extractEdgeTypes(workflow: AnalyzableWorkflow): Set<string> {
  return new Set(workflow.edges.map(e => (e.type || 'default').toLowerCase()));
}

/**
 * Check if a node is a decision node type.
 */
function isDecisionNode(node: WorkflowNode): boolean {
  return DECISION_NODE_TYPES.some(type => 
    node.type.toLowerCase().includes(type) ||
    (node.label?.toLowerCase() || '').includes(type)
  );
}

/**
 * Check if a node is a failure path node.
 */
function isFailureNode(node: WorkflowNode): boolean {
  return FAILURE_NODE_TYPES.some(type => 
    node.type.toLowerCase().includes(type) ||
    (node.label?.toLowerCase() || '').includes(type)
  );
}

/**
 * Part 2: Generate fix-scope from the original issue context.
 * 
 * Call this before sending a fix request to AI.
 */
export function createFixScope(
  baselineWorkflow: AnalyzableWorkflow,
  issueCode?: string
): FixScope {
  const existingNodeTypes = extractNodeTypes(baselineWorkflow);
  const existingEdgeTypes = extractEdgeTypes(baselineWorkflow);
  const hasExistingDecision = baselineWorkflow.nodes.some(isDecisionNode);
  const hasExistingFailure = baselineWorkflow.nodes.some(isFailureNode);
  
  return {
    allowedNodeTypes: Array.from(existingNodeTypes),
    allowedEdgeTypes: Array.from(existingEdgeTypes),
    forbidNewDecisionNodes: !hasExistingDecision,
    forbidNewFailurePaths: !hasExistingFailure,
    originalIssueCode: issueCode,
  };
}

/**
 * Part 2: Validate that AI proposal doesn't violate fix-scope constraints.
 * 
 * This validates both:
 * - NEW nodes (not in baseline)
 * - EXISTING nodes that had their TYPE changed
 */
export function validateFixScope(
  scope: FixScope,
  baselineWorkflow: AnalyzableWorkflow,
  proposedWorkflow: AnalyzableWorkflow
): ProposalValidationResult {
  const baselineNodeMap = new Map(baselineWorkflow.nodes.map(n => [n.id, n]));
  const baselineEdgeMap = new Map(baselineWorkflow.edges.map(e => [e.id, e]));
  
  const newNodes = proposedWorkflow.nodes.filter(n => !baselineNodeMap.has(n.id));
  const modifiedNodes = proposedWorkflow.nodes.filter(n => {
    const baseline = baselineNodeMap.get(n.id);
    return baseline && baseline.type.toLowerCase() !== n.type.toLowerCase();
  });
  
  if (scope.forbidNewDecisionNodes) {
    const newDecisionNodes = newNodes.filter(isDecisionNode);
    if (newDecisionNodes.length > 0) {
      return {
        valid: false,
        rejectionReason: 'new_decision_forbidden',
        details: `Proposal adds ${newDecisionNodes.length} new decision node(s) when none existed before.`,
      };
    }
    
    const convertedToDecision = modifiedNodes.filter(isDecisionNode);
    if (convertedToDecision.length > 0) {
      return {
        valid: false,
        rejectionReason: 'new_decision_forbidden',
        details: `Proposal converts ${convertedToDecision.length} existing node(s) to decision type when none existed before.`,
      };
    }
  }
  
  if (scope.forbidNewFailurePaths) {
    const newFailureNodes = newNodes.filter(isFailureNode);
    if (newFailureNodes.length > 0) {
      return {
        valid: false,
        rejectionReason: 'scope_violation',
        details: `Proposal adds ${newFailureNodes.length} new failure path(s) when none existed before.`,
      };
    }
    
    const convertedToFailure = modifiedNodes.filter(isFailureNode);
    if (convertedToFailure.length > 0) {
      return {
        valid: false,
        rejectionReason: 'scope_violation',
        details: `Proposal converts ${convertedToFailure.length} existing node(s) to failure type when none existed before.`,
      };
    }
  }
  
  const allowedTypesSet = new Set(scope.allowedNodeTypes.map(t => t.toLowerCase()));
  allowedTypesSet.add('process');
  allowedTypesSet.add('start');
  allowedTypesSet.add('end');
  
  const disallowedNodes = newNodes.filter(n => 
    !allowedTypesSet.has(n.type.toLowerCase())
  );
  
  if (disallowedNodes.length > 0) {
    const disallowedTypes = Array.from(new Set(disallowedNodes.map(n => n.type)));
    return {
      valid: false,
      rejectionReason: 'scope_violation',
      details: `Proposal introduces node types not in baseline: ${disallowedTypes.join(', ')}`,
    };
  }
  
  const newEdges = proposedWorkflow.edges.filter(e => !baselineEdgeMap.has(e.id));
  const allowedEdgeTypesSet = new Set(scope.allowedEdgeTypes.map(t => t.toLowerCase()));
  
  // Always allow standard React Flow edge types - these are visual styling, not structural changes
  const STANDARD_EDGE_TYPES = ['default', 'bezier', 'smoothstep', 'step', 'straight'];
  STANDARD_EDGE_TYPES.forEach(t => allowedEdgeTypesSet.add(t));
  
  const disallowedEdges = newEdges.filter(e => {
    const edgeType = (e.type || 'default').toLowerCase();
    return !allowedEdgeTypesSet.has(edgeType);
  });
  
  if (disallowedEdges.length > 0) {
    const disallowedEdgeTypes = Array.from(new Set(disallowedEdges.map(e => e.type || 'unknown')));
    return {
      valid: false,
      rejectionReason: 'scope_violation',
      details: `Proposal introduces edge types not in baseline: ${disallowedEdgeTypes.join(', ')}`,
    };
  }
  
  return { valid: true };
}

/**
 * Part 3: Validate that AI response has complete proposal schema.
 */
export function validateProposalSchema(response: Partial<ProposalResponse>): ProposalValidationResult {
  const requiredFields: (keyof ProposalResponse)[] = [
    'summary',
    'rootCause', 
    'changes',
    'whyThisResolvesIt',
    'risksIntroduced',
  ];
  
  const missingFields = requiredFields.filter(field => {
    const value = response[field];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
  });
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      rejectionReason: 'incomplete_schema',
      details: `Missing required fields: ${missingFields.join(', ')}`,
    };
  }
  
  if (response.changes) {
    const changes = response.changes;
    const changeFields = ['nodesAdded', 'nodesModified', 'edgesAdded', 'edgesRemoved'] as const;
    const missingChangeFields = changeFields.filter(f => typeof changes[f] !== 'number');
    
    if (missingChangeFields.length > 0) {
      return {
        valid: false,
        rejectionReason: 'incomplete_schema',
        details: `Missing change counts: ${missingChangeFields.join(', ')}`,
      };
    }
  }
  
  if (!Array.isArray(response.risksIntroduced)) {
    return {
      valid: false,
      rejectionReason: 'incomplete_schema',
      details: 'risksIntroduced must be an array',
    };
  }
  
  return { valid: true };
}

/**
 * Part 4: Detect over-construction (too many new nodes vs modifications).
 * 
 * Rejects proposals where nodesAdded > nodesModified * 2
 */
export function validateEditFirstHeuristic(
  changes: ProposalResponse['changes']
): ProposalValidationResult {
  const { nodesAdded, nodesModified } = changes;
  
  if (nodesModified === 0 && nodesAdded > 0) {
    return { valid: true };
  }
  
  if (nodesAdded > nodesModified * 2) {
    return {
      valid: false,
      rejectionReason: 'over_construction',
      details: `Proposal adds ${nodesAdded} nodes but only modifies ${nodesModified}. Prefer editing existing nodes.`,
    };
  }
  
  return { valid: true };
}

/**
 * Combined validation for AI proposals.
 * 
 * Runs all guardrails in sequence and returns first failure.
 */
export function validateProposal(
  response: Partial<ProposalResponse>,
  scope: FixScope | null,
  baselineWorkflow: AnalyzableWorkflow,
  proposedWorkflow: AnalyzableWorkflow
): ProposalValidationResult {
  const schemaResult = validateProposalSchema(response);
  if (!schemaResult.valid) return schemaResult;
  
  if (scope) {
    const scopeResult = validateFixScope(scope, baselineWorkflow, proposedWorkflow);
    if (!scopeResult.valid) return scopeResult;
  }
  
  if (response.changes) {
    const editFirstResult = validateEditFirstHeuristic(response.changes);
    if (!editFirstResult.valid) return editFirstResult;
  }
  
  return { valid: true };
}
