/**
 * Phase 6D: Semantic Completeness Enforcement
 * 
 * Provides blocking logic for high-confidence semantic mismatches.
 * Only active when ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT is true.
 * 
 * Rules:
 * - No auto-regeneration
 * - No silent workflow modification
 * - User must explicitly address issues
 */

import type { Node, Edge } from '@/lib/kiteframe/types';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';
import type { SemanticClaim, ClaimDetectionResult } from './semanticClaims';
import type { StructuralSignature } from './analyzeStructure';
import type { SemanticMismatch } from '../explainability/types';
import type { SemanticCompletenessResult } from './semanticCompletenessCheck';

import { extractSemanticClaims } from './extractSemanticClaims';
import { analyzeStructure } from './analyzeStructure';
import { checkSemanticCompleteness, getBlockingMismatches } from './semanticCompletenessCheck';
import { 
  ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT,
  ENFORCED_CLAIM_TYPES,
  LOG_SEMANTIC_CHECKS,
} from './config';

/**
 * Result of enforcement check
 */
export interface EnforcementResult {
  /** Whether acceptance should be blocked */
  blocked: boolean;
  
  /** Reason for blocking (if blocked) */
  blockReason?: string;
  
  /** Blocking mismatches (if blocked) */
  blockingMismatches: SemanticMismatch[];
  
  /** All detected claims */
  claims: SemanticClaim[];
  
  /** All detected mismatches */
  mismatches: SemanticMismatch[];
  
  /** Structural signature */
  structuralSignature: StructuralSignature;
  
  /** Completeness result */
  completenessResult: SemanticCompletenessResult;
}

/**
 * Run full semantic completeness analysis
 * 
 * This is the main entry point for the semantic completeness pipeline.
 * It extracts claims, analyzes structure, and checks for mismatches.
 * 
 * Enforcement (blocking) only occurs if the feature flag is enabled.
 */
export function runSemanticCompletenessCheck(
  nodes: Node[],
  edges: Edge[],
  insights: Insight[] = []
): EnforcementResult {
  // Phase 6A: Extract semantic claims
  const claimResult = extractSemanticClaims(nodes, insights);
  
  // Phase 6B: Analyze structure
  const signature = analyzeStructure(nodes, edges);
  
  // Phase 6C: Check completeness
  const completenessResult = checkSemanticCompleteness(claimResult.claims, signature);
  
  // Phase 6D: Enforcement (only if flag is on)
  const blockingMismatches = ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT
    ? getBlockingMismatches(completenessResult.mismatches, ENFORCED_CLAIM_TYPES)
    : [];
  
  const blocked = blockingMismatches.length > 0;
  
  if (LOG_SEMANTIC_CHECKS) {
    console.log('[SemanticCompleteness] Check result:', {
      claimsDetected: claimResult.claims.length,
      mismatchesFound: completenessResult.mismatches.length,
      blockingMismatches: blockingMismatches.length,
      enforcementEnabled: ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT,
      blocked,
    });
  }
  
  return {
    blocked,
    blockReason: blocked 
      ? generateBlockReason(blockingMismatches) 
      : undefined,
    blockingMismatches,
    claims: claimResult.claims,
    mismatches: completenessResult.mismatches,
    structuralSignature: signature,
    completenessResult,
  };
}

/**
 * Generate human-readable block reason
 */
function generateBlockReason(mismatches: SemanticMismatch[]): string {
  if (mismatches.length === 0) return '';
  
  if (mismatches.length === 1) {
    return `This workflow describes behavior that is not structurally encoded: ${mismatches[0].message}`;
  }
  
  return `This workflow has ${mismatches.length} behaviors that are described but not structurally encoded. Please add the required structural elements before accepting.`;
}

/**
 * Check if a workflow should be blocked from acceptance
 * 
 * This is a convenience function for use in accept handlers.
 * Returns true only if:
 * - Enforcement is enabled
 * - There are high-confidence mismatches for enforced claim types
 */
export function shouldBlockAcceptance(
  nodes: Node[],
  edges: Edge[],
  insights: Insight[] = []
): { blocked: boolean; reason?: string; mismatches: SemanticMismatch[] } {
  if (!ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT) {
    return { blocked: false, mismatches: [] };
  }
  
  const result = runSemanticCompletenessCheck(nodes, edges, insights);
  
  return {
    blocked: result.blocked,
    reason: result.blockReason,
    mismatches: result.blockingMismatches,
  };
}

/**
 * Get claims and mismatches for a workflow (without enforcement)
 * 
 * This is for populating DecisionSnapshot fields.
 * It never blocks - just returns the analysis results.
 */
export function getSemanticAnalysis(
  nodes: Node[],
  edges: Edge[],
  insights: Insight[] = []
): { claims: SemanticClaim[]; mismatches: SemanticMismatch[] } {
  const result = runSemanticCompletenessCheck(nodes, edges, insights);
  
  return {
    claims: result.claims,
    mismatches: result.mismatches,
  };
}
