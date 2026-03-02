/**
 * Phase 5: Decision Capture
 * 
 * Captures decision reasoning at accept time.
 * Snapshots are immutable and never recomputed.
 */

import type { 
  DecisionSnapshot, 
  AppliedHeuristics, 
  UncertaintyLevel,
  ValidationWarning,
  ModelProvenance,
  SemanticMismatch,
  MergeBranchDecision,
  MutationSafety
} from './types';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';
import type { SemanticClaim } from '../semantic/semanticClaims';
import { getSessionSignals, getHeuristicBias } from '../heuristics/sessionSignals';
import { createFallbackProvenance } from '../router/provenanceHelper';

/**
 * Ensures model provenance is always present.
 * Uses provided provenance if available, otherwise creates a fallback.
 */
function ensureProvenance(
  provenance: ModelProvenance | undefined,
  taskType: ModelProvenance['routerTaskType']
): ModelProvenance {
  if (provenance) return provenance;
  console.warn(`[DecisionCapture] Missing model provenance for ${taskType}, using fallback`);
  return createFallbackProvenance('anthropic', 'claude-3-haiku-20240307', taskType);
}

let snapshotIdCounter = 0;

function generateSnapshotId(): string {
  return `snapshot_${Date.now()}_${++snapshotIdCounter}`;
}

export interface CaptureProposalDecisionParams {
  insight: Insight;
  variantChosen: 'proposed' | 'alternative';
  affectedNodeIds: string[];
  createdNodeIds: string[];
  createdEdgeIds: string[];
  heuristics: AppliedHeuristics;
  scopeCalibration: {
    affectedNodeCount: number;
    cancelCountForInsight: number;
    reducedScope: boolean;
  };
  uncertaintyLevel: UncertaintyLevel;
  validationWarnings: ValidationWarning[];
  heuristicsEnabled: boolean;
  modelProvenance?: ModelProvenance;
  // Phase 6: Semantic completeness
  semanticClaims?: SemanticClaim[];
  semanticMismatches?: SemanticMismatch[];
  // Phase 6.5: Merge vs Branch decision
  mergeBranchDecision?: MergeBranchDecision;
  // Phase 8: Mutation safety report
  mutationSafety?: MutationSafety;
}

export interface CaptureExperimentDecisionParams {
  insight: Insight;
  experimentIndex: number;
  experimentLabel: string;
  affectedNodeIds: string[];
  createdNodeIds: string[];
  createdEdgeIds: string[];
  heuristics: AppliedHeuristics;
  scopeCalibration: {
    affectedNodeCount: number;
    cancelCountForInsight: number;
    reducedScope: boolean;
  };
  uncertaintyLevel: UncertaintyLevel;
  validationWarnings: ValidationWarning[];
  heuristicsEnabled: boolean;
  modelProvenance?: ModelProvenance;
  // Phase 6: Semantic completeness
  semanticClaims?: SemanticClaim[];
  semanticMismatches?: SemanticMismatch[];
  // Phase 6.5: Merge vs Branch decision
  mergeBranchDecision?: MergeBranchDecision;
  // Phase 8: Mutation safety report
  mutationSafety?: MutationSafety;
}

/**
 * Capture a proposal decision snapshot at accept time
 */
export function captureProposalDecision(
  params: CaptureProposalDecisionParams
): DecisionSnapshot {
  const signals = getSessionSignals();
  const bias = getHeuristicBias();
  
  return {
    id: generateSnapshotId(),
    timestamp: Date.now(),
    actionType: 'proposal',
    variantChosen: params.variantChosen,
    insightId: params.insight.id,
    insightTitle: params.insight.title,
    insightCategory: params.insight.category,
    affectedNodeIds: params.affectedNodeIds,
    createdNodeIds: params.createdNodeIds,
    createdEdgeIds: params.createdEdgeIds,
    heuristicsApplied: params.heuristics,
    scopeCalibration: params.scopeCalibration,
    sessionContext: {
      totalAccepts: signals.acceptedProposals.length + signals.acceptedExperiments.length,
      totalCancels: signals.canceledProposals.length + signals.discardedExperiments.length,
      preferAlternative: bias.preferAlternative,
    },
    uncertaintyLevel: params.uncertaintyLevel,
    validationWarnings: params.validationWarnings,
    heuristicsEnabled: params.heuristicsEnabled,
    modelProvenance: ensureProvenance(params.modelProvenance, 'workflow_reasoning'),
    // Phase 6: Semantic completeness
    semanticClaims: params.semanticClaims,
    semanticMismatches: params.semanticMismatches,
    // Phase 6.5: Merge vs Branch decision
    mergeBranchDecision: params.mergeBranchDecision,
    // Phase 8: Mutation safety report
    mutationSafety: params.mutationSafety,
  };
}

/**
 * Capture an experiment decision snapshot at accept time
 */
export function captureExperimentDecision(
  params: CaptureExperimentDecisionParams
): DecisionSnapshot {
  const signals = getSessionSignals();
  const bias = getHeuristicBias();
  
  return {
    id: generateSnapshotId(),
    timestamp: Date.now(),
    actionType: 'experiment',
    experimentIndex: params.experimentIndex,
    experimentLabel: params.experimentLabel,
    insightId: params.insight.id,
    insightTitle: params.insight.title,
    insightCategory: params.insight.category,
    affectedNodeIds: params.affectedNodeIds,
    createdNodeIds: params.createdNodeIds,
    createdEdgeIds: params.createdEdgeIds,
    heuristicsApplied: params.heuristics,
    scopeCalibration: params.scopeCalibration,
    sessionContext: {
      totalAccepts: signals.acceptedProposals.length + signals.acceptedExperiments.length,
      totalCancels: signals.canceledProposals.length + signals.discardedExperiments.length,
      preferAlternative: bias.preferAlternative,
    },
    uncertaintyLevel: params.uncertaintyLevel,
    validationWarnings: params.validationWarnings,
    heuristicsEnabled: params.heuristicsEnabled,
    modelProvenance: ensureProvenance(params.modelProvenance, 'workflow_experiments'),
    // Phase 6: Semantic completeness
    semanticClaims: params.semanticClaims,
    semanticMismatches: params.semanticMismatches,
    // Phase 6.5: Merge vs Branch decision
    mergeBranchDecision: params.mergeBranchDecision,
    // Phase 8: Mutation safety report
    mutationSafety: params.mutationSafety,
  };
}
