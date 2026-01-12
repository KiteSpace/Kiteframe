/**
 * Merge-Safe Workflow Mutation Types
 * 
 * These types define the contract for chat-driven workflow mutations,
 * ensuring structural safety and preventing orphan nodes.
 */

import type { Node, Edge } from '@/lib/kiteframe/types';

export interface WorkflowMutationResult {
  success: boolean;
  reason?: string;
  mutatedNodes: Node[];
  mutatedEdges: Edge[];
  safetyReport: MutationSafetyReport;
}

export interface MutationSafetyReport {
  mergeEnforced: boolean;
  orphanPreventionTriggered: boolean;
  decisionRepairApplied: boolean;
  mutationAborted?: string;
  attachmentResolved: boolean;
  resolvedAttachmentNodeId?: string;
  validationErrors: MutationValidationError[];
}

export interface MutationValidationError {
  code: MutationErrorCode;
  message: string;
  affectedNodeIds?: string[];
  affectedEdgeIds?: string[];
}

export type MutationErrorCode = 
  | 'ORPHAN_NODE'
  | 'INVALID_SOURCE_ID'
  | 'INVALID_TARGET_ID'
  | 'NO_ATTACHMENT_TARGET'
  | 'MERGE_MODE_VIOLATION'
  | 'PARALLEL_WORKFLOW_BLOCKED'
  | 'MISSING_INCOMING_EDGE'
  | 'UNREACHABLE_NODES'
  | 'REPLACE_VALIDATION'
  | 'BRANCHING_NODE_OVERWRITE';

export interface ChatMutationIntent {
  newNodes: Node[];
  newEdges: Edge[];
  attachmentTarget?: string;
  isFollowUp: boolean;
  userMessage?: string;
}

export interface ExistingGraph {
  nodes: Node[];
  edges: Edge[];
}

export interface AttachmentResolution {
  success: boolean;
  targetNodeId?: string;
  reason?: string;
}

export type MutationIntent = 'PATCH' | 'REPLACE' | 'BRANCH' | 'ADVISE_ONLY';

export interface FullGraphDetectionResult {
  isFullGraph: boolean;
  confidence: number;
  matchedHeuristics: string[];
  suggestedIntent: MutationIntent;
}

export interface MutationPolicy {
  allowedIntents: MutationIntent[];
  requiresConfirmation: boolean;
  blockFullGraphMerge: boolean;
}

/**
 * Resolves AiMode + MergeBranchDecision into a unified MutationIntent.
 * This ensures full-graph policy checks work correctly across all AI modes.
 */
import type { AiMode } from '@/ai/types';
import type { MergeBranchDecision } from '@/ai/intent/mergeBranchDetector';

export function resolveMutationIntent(
  aiMode: AiMode,
  mergeBranchDecision: MergeBranchDecision,
  isFullGraph: boolean
): MutationIntent {
  // ADVISE mode always blocks mutations
  if (aiMode === 'ADVISE') {
    return 'ADVISE_ONLY';
  }
  
  // GENERATE mode on empty canvas is PATCH (initial creation)
  if (aiMode === 'GENERATE') {
    return isFullGraph ? 'REPLACE' : 'PATCH';
  }
  
  // EDIT mode: use merge/branch decision + full graph detection
  if (mergeBranchDecision.resolvedIntent === 'branch') {
    return 'BRANCH';
  }
  
  // Merge intent + full graph = REPLACE (requires confirmation)
  if (isFullGraph) {
    return 'REPLACE';
  }
  
  // Small patch to existing workflow
  return 'PATCH';
}
