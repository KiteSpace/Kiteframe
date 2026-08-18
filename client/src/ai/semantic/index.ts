/**
 * Phase 6: Semantic Completeness Module
 * 
 * This module detects mismatches between described behavior and workflow structure.
 * It is READ-ONLY by default - enforcement requires explicit feature flag.
 */

// Phase 6A: Semantic Claim Types and Extraction
export type { 
  SemanticClaimType, 
  SemanticClaim, 
  EvidenceLocation,
  ClaimPattern,
  ClaimDetectionResult,
} from './semanticClaims';

export { 
  extractSemanticClaims,
  extractClaimsFromNodes,
  extractClaimsFromInsights,
  filterByConfidence,
  getClaimTypeDescription,
} from './extractSemanticClaims';

// Phase 6B: Structural Expectations and Analysis
export type { 
  StructuralElement, 
  StructuralExpectation,
} from './structuralExpectations';

export {
  STRUCTURAL_EXPECTATIONS,
  getExpectation,
  getElementName,
  isExpectationSatisfied,
} from './structuralExpectations';

export type { 
  StructuralSignature,
} from './analyzeStructure';

export {
  analyzeStructure,
  hasStructuralElement,
} from './analyzeStructure';

// Phase 6C: Semantic Completeness Check
export type { 
  SemanticCompletenessResult,
} from './semanticCompletenessCheck';

export {
  checkSemanticCompleteness,
  filterMismatchesBySeverity,
  getBlockingMismatches,
  generateCompletenessSummary,
} from './semanticCompletenessCheck';

// Phase 6D: Configuration
export {
  ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT,
  ENFORCED_CLAIM_TYPES,
  ENFORCEMENT_CONFIDENCE_THRESHOLD,
  LOG_SEMANTIC_CHECKS,
} from './config';

// Phase 6D: Enforcement
export type {
  EnforcementResult,
} from './enforcement';

export {
  runSemanticCompletenessCheck,
  shouldBlockAcceptance,
  getSemanticAnalysis,
} from './enforcement';
