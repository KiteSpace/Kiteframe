/**
 * Phase 6A: Semantic Claim Types
 * 
 * These types represent behavioral claims detected in workflow descriptions.
 * Claims indicate stateful behavior that may require structural encoding.
 * 
 * This is READ-ONLY detection - no enforcement, no blocking.
 */

/**
 * Types of semantic claims that imply stateful behavior
 */
export type SemanticClaimType =
  | 'repeated_failure'      // Multiple failures before escalation
  | 'retry_with_limit'      // Retry N times before giving up
  | 'threshold_escalation'  // After N occurrences, escalate
  | 'time_based_escalation' // After time period, escalate
  | 'quota_limit'           // Usage limit with enforcement
  | 'manual_intervention_required'; // Requires human review/approval

/**
 * Evidence location for explainability
 */
export type EvidenceLocation = 
  | 'node_label'
  | 'node_description'
  | 'insight_title'
  | 'insight_description'
  | 'edge_label';

/**
 * A semantic claim extracted from workflow content
 * 
 * Claims are analytical only - they do not modify the workflow
 * or assert correctness. They indicate "this text implies X behavior."
 */
export interface SemanticClaim {
  /** Type of stateful behavior claimed */
  type: SemanticClaimType;
  
  /** Node ID where claim was detected (if applicable) */
  sourceNodeId?: string;
  
  /** Insight ID where claim was detected (if applicable) */
  sourceInsightId?: string;
  
  /** 
   * Confidence score 0-1
   * 
   * Confidence is based on:
   * - Phrase explicitness (0.3-0.5 for vague, 0.7-0.9 for explicit)
   * - Multiple indicators boost confidence
   * - Location specificity (node description > insight > edge)
   */
  confidence: number;
  
  /** The actual text that triggered this claim (for explainability) */
  evidenceText: string;
  
  /** Where the evidence was found */
  evidenceLocation: EvidenceLocation;
  
  /** Optional: extracted numeric threshold if present (e.g., "3 attempts" -> 3) */
  extractedThreshold?: number;
  
  /** Optional: extracted time value if present (e.g., "24 hours" -> "24 hours") */
  extractedTimeValue?: string;
}

/**
 * Phrase patterns for detecting semantic claims
 * Each pattern has a base confidence score
 */
export interface ClaimPattern {
  type: SemanticClaimType;
  patterns: RegExp[];
  baseConfidence: number;
  extractThreshold?: boolean;
  extractTime?: boolean;
}

/**
 * Detection result from scanning content
 */
export interface ClaimDetectionResult {
  claims: SemanticClaim[];
  scannedNodes: number;
  scannedInsights: number;
}
