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
  | 'UNREACHABLE_NODES';

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
