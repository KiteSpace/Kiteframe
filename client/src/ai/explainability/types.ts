/**
 * Phase 5: Explainability Types
 * Phase 6: Semantic Completeness Types
 * 
 * These types support auditability and trust by capturing decision reasoning
 * at accept time. All data is structured signals only - no raw prompts or 
 * model outputs are stored.
 */

import type { SemanticClaim } from '../semantic/semanticClaims';

/**
 * Uncertainty level for generated content
 * Indicates system confidence at generation time
 */
export type UncertaintyLevel = 'low' | 'medium' | 'high';

/**
 * Validation warning captured during generation
 */
export interface ValidationWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Heuristics applied during generation (Phase 4 signals)
 */
export interface AppliedHeuristics {
  patternDetected?: string;
  structureBias?: 'linear' | 'branching' | 'loopback' | 'terminal';
  scopeConstrained?: boolean;
  maxNodes?: number;
  diversityEnforced?: boolean;
  diversityDimensions?: string[];
}

/**
 * Model provenance metadata for GPT-5 migration
 * Captures which model was used for generation
 */
export interface ModelProvenance {
  providerUsed: string;
  modelUsed: string;
  routerTaskType: 'workflow_reasoning' | 'workflow_experiments' | 'prd_generation' | 'vision_ingestion' | 'general_chat';
  usedFallback: boolean;
  fallbackModelUsed?: string;
  sessionId?: string;
}

/**
 * Decision snapshot captured at accept time
 * This is immutable and never recomputed after creation
 */
export interface DecisionSnapshot {
  id: string;
  timestamp: number;
  
  // What type of action was accepted
  actionType: 'proposal' | 'experiment';
  
  // Which variant was chosen (for proposals: 'proposed' | 'alternative')
  variantChosen?: 'proposed' | 'alternative';
  
  // For experiments: which experiment option (0-3)
  experimentIndex?: number;
  experimentLabel?: string;
  
  // Source insight that triggered this generation
  insightId: string;
  insightTitle: string;
  insightCategory: string;
  
  // Nodes affected by this decision
  affectedNodeIds: string[];
  
  // Nodes and edges created
  createdNodeIds: string[];
  createdEdgeIds: string[];
  
  // Phase 4 heuristics that influenced generation
  heuristicsApplied: AppliedHeuristics;
  
  // Scope calibration signals
  scopeCalibration: {
    affectedNodeCount: number;
    cancelCountForInsight: number;
    reducedScope: boolean;
  };
  
  // Session signals at decision time
  sessionContext: {
    totalAccepts: number;
    totalCancels: number;
    preferAlternative: boolean;
  };
  
  // Uncertainty and validation state
  uncertaintyLevel: UncertaintyLevel;
  validationWarnings: ValidationWarning[];
  
  // Whether Phase 4 heuristics were enabled
  heuristicsEnabled: boolean;
  
  // Model provenance (GPT-5 migration)
  modelProvenance?: ModelProvenance;
  
  // Phase 6: Semantic claims detected in generated content
  semanticClaims?: SemanticClaim[];
  
  // Phase 6: Structural mismatches between claims and graph
  semanticMismatches?: SemanticMismatch[];
  
  // Phase 6.5: Merge vs Branch decision
  mergeBranchDecision?: MergeBranchDecision;
}

/**
 * Phase 6.5: Merge vs Branch Decision
 * Captures whether the system decided to modify existing workflow or create new
 */
export interface MergeBranchDecision {
  intent: 'merge' | 'branch' | 'ambiguous';
  confidence: number;
  detectedSignals: string[];
  /** Resolved intent - ambiguous always resolves to 'merge' for safety */
  resolvedIntent: 'merge' | 'branch';
}

/**
 * Phase 6: Semantic Mismatch
 * Indicates a claim exists but the required structure is missing
 */
export interface SemanticMismatch {
  claimType: SemanticClaim['type'];
  claim: SemanticClaim;
  missing: string[];
  severity: 'info' | 'warning' | 'error';
  message: string;
}

/**
 * Timeline event for structural change tracking
 */
export type TimelineEventType = 
  | 'accept_proposal'
  | 'accept_experiment'
  | 'undo'
  | 'redo';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  eventType: TimelineEventType;
  
  // Related decision snapshot (for accept events)
  decisionSnapshotId?: string;
  
  // Related insight
  insightId?: string;
  insightTitle?: string;
  
  // Nodes affected
  nodeIds: string[];
  edgeIds: string[];
  
  // For undo/redo: what was the undone/redone action
  undoneEventId?: string;
}

/**
 * Audit export data structure
 * Complete workflow history for enterprise/regulated environments
 */
export interface AuditExport {
  exportedAt: number;
  exportVersion: '1.0';
  
  // Workflow structure (sanitized)
  workflow: {
    nodeCount: number;
    edgeCount: number;
    nodeTypes: Record<string, number>;
  };
  
  // Node provenance data
  nodeProvenance: Array<{
    nodeId: string;
    nodeType: string;
    createdFromInsightId?: string;
    createdFromProposalId?: string;
    createdFromExperimentId?: string;
    createdAt?: number;
    modelProvenance?: ModelProvenance;
  }>;
  
  // Edge provenance data
  edgeProvenance: Array<{
    edgeId: string;
    createdFromInsightId?: string;
    createdFromProposalId?: string;
    createdFromExperimentId?: string;
    createdAt?: number;
    modelProvenance?: ModelProvenance;
  }>;
  
  // Decision history
  decisionSnapshots: DecisionSnapshot[];
  
  // Structural change timeline
  timeline: TimelineEvent[];
}

/**
 * Enterprise guardrail configuration
 * Config-level hooks for enterprise deployment
 */
export interface EnterpriseGuardrails {
  // Completely disable AI actions
  aiActionsDisabled: boolean;
  
  // Read-only mode for workflows (no edits allowed)
  readOnlyMode: boolean;
  
  // Audit-only access (can view but not modify)
  auditOnlyAccess: boolean;
}

/**
 * Default enterprise guardrails (all features enabled)
 */
export const DEFAULT_ENTERPRISE_GUARDRAILS: EnterpriseGuardrails = {
  aiActionsDisabled: false,
  readOnlyMode: false,
  auditOnlyAccess: false,
};
