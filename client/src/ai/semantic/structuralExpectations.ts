/**
 * Phase 6B: Structural Expectations
 * 
 * Maps semantic claim types to expected structural elements.
 * These are EXPECTATIONS, not requirements - used for mismatch detection.
 * 
 * No enforcement occurs here - this is purely descriptive.
 */

import type { SemanticClaimType } from './semanticClaims';

/**
 * Types of structural elements that may be expected
 */
export type StructuralElement =
  | 'decision_node'          // A condition/branch node
  | 'loop_edge'              // Edge that creates a cycle/re-entry
  | 'escalation_path'        // Path to error/escalation terminal
  | 'terminal_node'          // End state node
  | 'monitoring_step'        // Process node for tracking/monitoring
  | 'counter_state'          // State tracking for counts (future)
  | 'timer_state'            // State tracking for time (future)
  | 'human_handoff';         // Output to human/manual process

/**
 * Structural expectation for a semantic claim type
 */
export interface StructuralExpectation {
  /** Required: at least one of these should be present */
  requiredAny: StructuralElement[];
  
  /** Recommended: ideally present but not strictly required */
  recommended: StructuralElement[];
  
  /** Human-readable description of what we expect to see */
  description: string;
}

/**
 * Mapping of claim types to structural expectations
 * 
 * These are detection heuristics, not hard requirements.
 * A mismatch means "we found a claim but didn't find expected structure."
 */
export const STRUCTURAL_EXPECTATIONS: Record<SemanticClaimType, StructuralExpectation> = {
  repeated_failure: {
    requiredAny: ['decision_node', 'escalation_path'],
    recommended: ['loop_edge', 'terminal_node'],
    description: 'Repeated failure handling typically requires a decision node to evaluate failure count, with an escalation path when the threshold is exceeded.',
  },
  
  retry_with_limit: {
    requiredAny: ['decision_node', 'loop_edge'],
    recommended: ['terminal_node', 'escalation_path'],
    description: 'Retry with limit requires a decision point to check retry count and a loop edge for re-entry, with an exit path when limit is reached.',
  },
  
  threshold_escalation: {
    requiredAny: ['decision_node', 'escalation_path'],
    recommended: ['monitoring_step'],
    description: 'Threshold escalation needs a decision node to check the threshold and an escalation path when exceeded.',
  },
  
  time_based_escalation: {
    requiredAny: ['decision_node', 'monitoring_step'],
    recommended: ['escalation_path', 'terminal_node'],
    description: 'Time-based escalation typically includes a monitoring step and a decision point to check elapsed time.',
  },
  
  quota_limit: {
    requiredAny: ['decision_node'],
    recommended: ['terminal_node', 'escalation_path'],
    description: 'Quota limit enforcement requires a decision node to check current usage against the limit.',
  },
  
  manual_intervention_required: {
    requiredAny: ['human_handoff', 'terminal_node'],
    recommended: ['escalation_path'],
    description: 'Manual intervention requires an explicit handoff to human review or a terminal state awaiting human action.',
  },
};

/**
 * Get the structural expectation for a claim type
 */
export function getExpectation(claimType: SemanticClaimType): StructuralExpectation {
  return STRUCTURAL_EXPECTATIONS[claimType];
}

/**
 * Get human-readable name for a structural element
 */
export function getElementName(element: StructuralElement): string {
  const names: Record<StructuralElement, string> = {
    decision_node: 'Decision/Condition Node',
    loop_edge: 'Loop/Re-entry Edge',
    escalation_path: 'Escalation Path',
    terminal_node: 'Terminal/End Node',
    monitoring_step: 'Monitoring Step',
    counter_state: 'Counter State',
    timer_state: 'Timer State',
    human_handoff: 'Human Handoff',
  };
  return names[element] || element;
}

/**
 * Check if an expectation is satisfied by a structural signature
 */
export function isExpectationSatisfied(
  expectation: StructuralExpectation,
  hasElement: (element: StructuralElement) => boolean
): { satisfied: boolean; missing: StructuralElement[] } {
  const missing: StructuralElement[] = [];
  
  // Check if at least one required element is present
  const hasAnyRequired = expectation.requiredAny.some(hasElement);
  
  if (!hasAnyRequired) {
    // All required elements are missing
    missing.push(...expectation.requiredAny);
  }
  
  return {
    satisfied: hasAnyRequired,
    missing,
  };
}
