/**
 * Phase 6C: Semantic Completeness Check
 * 
 * Compares semantic claims against structural signature to detect mismatches.
 * A mismatch indicates "this behavior was described but not structurally encoded."
 * 
 * This is READ-ONLY - no enforcement, no blocking (unless feature flag enabled).
 * Mismatches are surfaced as warnings for explainability.
 */

import type { SemanticClaim, SemanticClaimType } from './semanticClaims';
import type { StructuralSignature } from './analyzeStructure';
import type { StructuralElement } from './structuralExpectations';
import type { SemanticMismatch } from '../explainability/types';
import { 
  getExpectation, 
  isExpectationSatisfied, 
  getElementName,
} from './structuralExpectations';
import { hasStructuralElement } from './analyzeStructure';
import { getClaimTypeDescription } from './extractSemanticClaims';

/**
 * Result of semantic completeness analysis
 */
export interface SemanticCompletenessResult {
  /** All detected mismatches */
  mismatches: SemanticMismatch[];
  
  /** Claims that were fully satisfied by structure */
  satisfiedClaims: SemanticClaim[];
  
  /** Summary statistics */
  stats: {
    totalClaims: number;
    satisfiedCount: number;
    mismatchCount: number;
    highConfidenceMismatchCount: number;
  };
}

/**
 * Severity thresholds for mismatches
 */
const SEVERITY_THRESHOLDS = {
  error: 0.8,    // High confidence claims become errors
  warning: 0.5,  // Medium confidence claims become warnings
  info: 0.0,     // Low confidence claims are informational
};

/**
 * Get severity level based on claim confidence
 */
function getSeverity(confidence: number): 'info' | 'warning' | 'error' {
  if (confidence >= SEVERITY_THRESHOLDS.error) return 'error';
  if (confidence >= SEVERITY_THRESHOLDS.warning) return 'warning';
  return 'info';
}

/**
 * Generate human-readable mismatch message
 */
function generateMismatchMessage(
  claim: SemanticClaim,
  missing: StructuralElement[]
): string {
  const claimDesc = getClaimTypeDescription(claim.type);
  const missingNames = missing.map(getElementName).join(', ');
  
  return `This workflow describes "${claimDesc}" (evidence: "${claim.evidenceText}") but is missing: ${missingNames}`;
}

/**
 * Check a single claim against the structural signature
 */
function checkClaim(
  claim: SemanticClaim,
  signature: StructuralSignature
): SemanticMismatch | null {
  const expectation = getExpectation(claim.type);
  
  const { satisfied, missing } = isExpectationSatisfied(
    expectation,
    (element) => hasStructuralElement(signature, element)
  );
  
  if (satisfied) {
    return null; // No mismatch
  }
  
  return {
    claimType: claim.type,
    claim,
    missing: missing.map(getElementName),
    severity: getSeverity(claim.confidence),
    message: generateMismatchMessage(claim, missing),
  };
}

/**
 * Perform semantic completeness analysis
 * 
 * Compares extracted semantic claims against the workflow's structural signature.
 * Returns mismatches where claims exist but expected structure is missing.
 * 
 * This is the main entry point for Phase 6C.
 */
export function checkSemanticCompleteness(
  claims: SemanticClaim[],
  signature: StructuralSignature
): SemanticCompletenessResult {
  const mismatches: SemanticMismatch[] = [];
  const satisfiedClaims: SemanticClaim[] = [];
  
  for (const claim of claims) {
    const mismatch = checkClaim(claim, signature);
    
    if (mismatch) {
      mismatches.push(mismatch);
    } else {
      satisfiedClaims.push(claim);
    }
  }
  
  const highConfidenceMismatches = mismatches.filter(
    m => m.severity === 'error'
  );
  
  return {
    mismatches,
    satisfiedClaims,
    stats: {
      totalClaims: claims.length,
      satisfiedCount: satisfiedClaims.length,
      mismatchCount: mismatches.length,
      highConfidenceMismatchCount: highConfidenceMismatches.length,
    },
  };
}

/**
 * Filter mismatches by minimum severity
 */
export function filterMismatchesBySeverity(
  mismatches: SemanticMismatch[],
  minSeverity: 'info' | 'warning' | 'error'
): SemanticMismatch[] {
  const severityOrder: Record<string, number> = {
    'info': 0,
    'warning': 1,
    'error': 2,
  };
  
  const minLevel = severityOrder[minSeverity];
  
  return mismatches.filter(m => severityOrder[m.severity] >= minLevel);
}

/**
 * Get blocking mismatches (for enforcement mode)
 * 
 * Returns only mismatches that should block acceptance when enforcement is enabled.
 * Criteria:
 * - Severity is 'error' (high confidence)
 * - Claim type is in the enforced set
 */
export function getBlockingMismatches(
  mismatches: SemanticMismatch[],
  enforcedTypes: SemanticClaimType[] = [
    'repeated_failure',
    'retry_with_limit',
    'threshold_escalation',
  ]
): SemanticMismatch[] {
  return mismatches.filter(m => 
    m.severity === 'error' && 
    enforcedTypes.includes(m.claimType)
  );
}

/**
 * Generate summary text for completeness result
 */
export function generateCompletenessSummary(
  result: SemanticCompletenessResult
): string {
  const { stats } = result;
  
  if (stats.totalClaims === 0) {
    return 'No stateful behavior claims detected.';
  }
  
  if (stats.mismatchCount === 0) {
    return `All ${stats.totalClaims} detected behaviors are structurally encoded.`;
  }
  
  const parts: string[] = [];
  parts.push(`${stats.mismatchCount} of ${stats.totalClaims} detected behaviors lack structural encoding.`);
  
  if (stats.highConfidenceMismatchCount > 0) {
    parts.push(`${stats.highConfidenceMismatchCount} high-confidence mismatch(es) require attention.`);
  }
  
  return parts.join(' ');
}
