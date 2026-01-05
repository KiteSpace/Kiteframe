/**
 * Phase 6D: Semantic Completeness Configuration
 * 
 * Feature flags for semantic completeness enforcement.
 * By default, enforcement is OFF - only detection and warnings are active.
 */

/**
 * Enable semantic completeness enforcement
 * 
 * When ON:
 * - High-confidence mismatches for enforced claim types will block Accept
 * - Users must address structural gaps before proceeding
 * 
 * When OFF (default):
 * - Mismatches are detected and surfaced as warnings
 * - No blocking occurs
 * - All Phase 4 and Phase 5 behavior remains unchanged
 */
export const ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT = 
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_SEMANTIC_ENFORCEMENT === 'true';

/**
 * Claim types that are enforced when enforcement is enabled
 * 
 * Only these claim types will cause blocking when:
 * - Feature flag is ON
 * - Confidence >= 0.8
 * - Required structural elements are missing
 */
export const ENFORCED_CLAIM_TYPES: Array<import('./semanticClaims').SemanticClaimType> = [
  'repeated_failure',
  'retry_with_limit',
  'threshold_escalation',
];

/**
 * Minimum confidence threshold for enforcement
 */
export const ENFORCEMENT_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Log semantic completeness checks for debugging
 */
export const LOG_SEMANTIC_CHECKS = 
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOG_SEMANTIC_CHECKS === 'true';
