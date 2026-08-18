/**
 * useChatMutation Hook
 * 
 * Shared entry point for all chat-driven workflow mutations.
 * Enforces merge-safe validation and decision repair for all paths:
 * - Project Chat (KiteAITab)
 * - Home Chat (HomeScreen, FullScreenChat)
 * 
 * CRITICAL: Chat is NEVER allowed to write to canvas without passing merge-safe validation.
 */

import { useCallback } from 'react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import {
  orchestrateChatWorkflowMutation,
  type OrchestrateMutationResult,
} from '@/workflow/mutation/applyChatWorkflowMutation';
import type { ChatMutationIntent, ExistingGraph, FullGraphDetectionResult, MutationIntent } from '@/workflow/mutation/types';
import { resolveMutationIntent } from '@/workflow/mutation/types';
import {
  detectMergeBranchIntent,
  type MergeBranchDecision,
} from '@/ai/intent/mergeBranchDetector';
import { detectFullGraphPayload, shouldBlockMerge, requiresReplaceConfirmation } from '@/workflow/mutation/fullGraphDetector';
import type { AiMode } from '@/ai/types';
import type { RepairInfo } from '@/lib/kiteframe/utils/diagnostics/types';
import type { MutationSafety } from '@/ai/explainability/types';

export type MutationMode = 'PATCH' | 'REPLACE';

export interface ChatMutationInput {
  existingNodes: Node[];
  existingEdges: Edge[];
  newNodes: Node[];
  newEdges: Edge[];
  userMessage: string;
  previousMessages?: string[];
  attachmentTargetId?: string;
  aiMode?: AiMode;
  bypassConfirmation?: boolean;
  mode?: MutationMode;
}

export interface ReplaceValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateReplacePayload(nodes: Node[], edges: Edge[]): ReplaceValidationResult {
  const errors: string[] = [];
  
  if (nodes.length < 2) {
    errors.push(`REPLACE requires at least 2 nodes, got ${nodes.length}`);
  }
  
  if (edges.length < 1) {
    errors.push(`REPLACE requires at least 1 edge, got ${edges.length}`);
  }
  
  const nodeIds = new Set(nodes.map(n => n.id));
  const duplicateIds = nodes.filter((n, i) => 
    nodes.findIndex(other => other.id === n.id) !== i
  );
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate node IDs in payload: ${duplicateIds.map(n => n.id).join(', ')}`);
  }
  
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} source "${edge.source}" does not exist in nodes`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} target "${edge.target}" does not exist in nodes`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface ChatMutationResult {
  success: boolean;
  reason?: string;
  mutatedNodes: Node[];
  mutatedEdges: Node[];
  safetyReport: OrchestrateMutationResult['safetyReport'];
  repairInfo: RepairInfo;
  mergeBranchDecision: MergeBranchDecision;
  mutationSafety: MutationSafety;
  fullGraphDetection?: FullGraphDetectionResult;
  requiresConfirmation?: boolean;
}

/**
 * Applies a chat-driven workflow mutation with full merge-safe validation.
 * 
 * This is the ONLY approved path for chat to modify the canvas.
 * Direct setNodes/setEdges calls from chat are forbidden.
 * 
 * @param input - The mutation input with existing and new workflow elements
 * @returns Result with success/failure, mutated graph, and safety info
 */
export function applyChatMutation(input: ChatMutationInput): ChatMutationResult {
  const {
    existingNodes,
    existingEdges,
    newNodes,
    newEdges,
    userMessage,
    previousMessages = [],
    attachmentTargetId,
    aiMode = 'EDIT',
    bypassConfirmation = false,
    mode = 'PATCH',
  } = input;

  const hasExistingWorkflow = existingNodes.length > 0;
  const isFollowUp = hasExistingWorkflow;

  const mergeBranchDecision = detectMergeBranchIntent({
    userMessage,
    hasExistingWorkflow,
    previousUserMessages: previousMessages,
  });

  // REPLACE MODE: Validate structure only, return unchanged, skip all repair/mutation logic
  if (mode === 'REPLACE') {
    console.log('[ChatMutation] REPLACE mode - structure validation only, no repair');
    
    const validation = validateReplacePayload(newNodes, newEdges);
    
    if (!validation.valid) {
      console.warn('[ChatMutation] REPLACE validation failed:', validation.errors);
      return {
        success: false,
        reason: `REPLACE validation failed: ${validation.errors.join('; ')}`,
        mutatedNodes: existingNodes,
        mutatedEdges: existingEdges as any,
        safetyReport: {
          mergeEnforced: false,
          orphanPreventionTriggered: false,
          decisionRepairApplied: false,
          attachmentResolved: false,
          validationErrors: validation.errors.map(e => ({ code: 'REPLACE_VALIDATION', message: e })),
          mutationAborted: 'REPLACE validation failed'
        },
        repairInfo: { repairedNodeIds: [], repairedIssueTypes: [] },
        mergeBranchDecision,
        mutationSafety: { 
          decisionRepairApplied: false,
          mergeEnforced: false,
          orphanPreventionTriggered: false,
        },
        requiresConfirmation: false,
      };
    }
    
    console.log('[ChatMutation] REPLACE validation passed - returning unchanged payload:', {
      nodeCount: newNodes.length,
      edgeCount: newEdges.length,
    });
    
    return {
      success: true,
      mutatedNodes: newNodes,
      mutatedEdges: newEdges as any,
      safetyReport: {
        mergeEnforced: false,
        orphanPreventionTriggered: false,
        decisionRepairApplied: false,
        attachmentResolved: false,
        validationErrors: [],
      },
      repairInfo: { repairedNodeIds: [], repairedIssueTypes: [] },
      mergeBranchDecision,
      mutationSafety: { 
        decisionRepairApplied: false,
        mergeEnforced: false,
        orphanPreventionTriggered: false,
      },
      requiresConfirmation: false,
    };
  }

  // PATCH MODE: Existing behavior with merge-safe validation and repair
  
  // RUNTIME ASSERTION: REPLACE mode must never reach merge/repair logic
  // This guard prevents silent regressions if early-return is accidentally removed
  // TypeScript knows mode is 'PATCH' here, but we cast to string for runtime safety
  if ((mode as string) === 'REPLACE') {
    const errorMsg = '[ChatMutation] CRITICAL: REPLACE mode reached merge/repair path - this is a bug';
    console.error(errorMsg);
    if (process.env.NODE_ENV === 'development') {
      throw new Error(errorMsg);
    }
    // In production, abort safely rather than corrupt workflow
    return {
      success: false,
      reason: 'REPLACE mode internal error',
      mutatedNodes: existingNodes,
      mutatedEdges: existingEdges as any,
      safetyReport: {
        mergeEnforced: false,
        orphanPreventionTriggered: false,
        decisionRepairApplied: false,
        attachmentResolved: false,
        validationErrors: [{ code: 'REPLACE_VALIDATION', message: 'REPLACE mode reached merge path' }],
        mutationAborted: 'REPLACE mode internal error'
      },
      repairInfo: { repairedNodeIds: [], repairedIssueTypes: [] },
      mergeBranchDecision,
      mutationSafety: { 
        decisionRepairApplied: false,
        mergeEnforced: false,
        orphanPreventionTriggered: false,
      },
      requiresConfirmation: false,
    };
  }

  // Phase 2.2: Full Graph Payload detection
  const fullGraphDetection = detectFullGraphPayload(
    existingNodes,
    existingEdges,
    newNodes,
    newEdges
  );
  
  // Phase 2.1: Resolve unified MutationIntent from AiMode + merge/branch + full graph
  const resolvedIntent = resolveMutationIntent(
    aiMode,
    mergeBranchDecision,
    fullGraphDetection.isFullGraph
  );
  
  // Phase 2.3: Block mutations in ADVISE mode
  if (resolvedIntent === 'ADVISE_ONLY') {
    console.log('[ChatMutation] ADVISE mode - blocking mutation pipeline');
    return {
      success: false,
      reason: 'Suggest mode is active. Switch to Apply mode to make changes.',
      mutatedNodes: existingNodes,
      mutatedEdges: existingEdges as any,
      safetyReport: {
        mergeEnforced: false,
        orphanPreventionTriggered: false,
        decisionRepairApplied: false,
        attachmentResolved: false,
        validationErrors: [],
        mutationAborted: 'ADVISE mode - mutations blocked'
      },
      repairInfo: { repairedNodeIds: [], repairedIssueTypes: [] },
      mergeBranchDecision,
      mutationSafety: { 
        decisionRepairApplied: false,
        mergeEnforced: false,
        orphanPreventionTriggered: false,
      },
      fullGraphDetection,
      requiresConfirmation: false,
    };
  }
  
  // Phase 2.3: Block full graph with REPLACE intent - require confirmation (unless bypassed)
  const needsConfirmation = resolvedIntent === 'REPLACE' && hasExistingWorkflow && !bypassConfirmation;
  
  // Phase 0.2: High-signal logging for debugging mutation issues
  console.log('[ChatMutation] Intent resolution:', {
    aiMode,
    mergeBranchIntent: mergeBranchDecision.resolvedIntent,
    resolvedMutationIntent: resolvedIntent,
    confidence: mergeBranchDecision.confidence,
    signals: mergeBranchDecision.detectedSignals,
    fullGraphDetection: {
      isFullGraph: fullGraphDetection.isFullGraph,
      confidence: fullGraphDetection.confidence,
      matchedHeuristics: fullGraphDetection.matchedHeuristics,
      suggestedIntent: fullGraphDetection.suggestedIntent,
    },
    needsConfirmation,
    existingNodeCount: existingNodes.length,
    newNodeCount: newNodes.length,
    newEdgeCount: newEdges.length,
    userMessage: userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''),
  });
  
  // Phase 2.3: Block mutation if full graph detected and would default to merge
  if (needsConfirmation) {
    console.warn('[ChatMutation] Full graph payload detected - blocking merge, requires REPLACE confirmation');
    return {
      success: false,
      reason: 'Full graph detected. This would replace the existing workflow. Please confirm to proceed.',
      mutatedNodes: existingNodes,
      mutatedEdges: existingEdges as any,
      safetyReport: {
        mergeEnforced: false,
        orphanPreventionTriggered: false,
        decisionRepairApplied: false,
        attachmentResolved: false,
        validationErrors: [{
          code: 'PARALLEL_WORKFLOW_BLOCKED',
          message: 'Full graph payload would create duplicate workflow. Confirm REPLACE to proceed.'
        }],
        mutationAborted: 'Full graph detected - awaiting REPLACE confirmation'
      },
      repairInfo: { repairedNodeIds: [], repairedIssueTypes: [] },
      mergeBranchDecision,
      mutationSafety: { 
        decisionRepairApplied: false,
        mergeEnforced: false,
        orphanPreventionTriggered: false,
      },
      fullGraphDetection,
      requiresConfirmation: true,
    };
  }

  const existingGraph: ExistingGraph = {
    nodes: existingNodes,
    edges: existingEdges,
  };

  const intent: ChatMutationIntent = {
    newNodes,
    newEdges,
    attachmentTarget: attachmentTargetId,
    isFollowUp,
    userMessage,
  };

  const result = orchestrateChatWorkflowMutation(
    existingGraph,
    intent,
    mergeBranchDecision
  );

  if (!result.success) {
    console.warn('[ChatMutation] Mutation blocked:', {
      reason: result.reason,
      validationErrors: result.safetyReport.validationErrors,
    });
  } else {
    console.log('[ChatMutation] Mutation applied successfully:', {
      nodesCount: result.mutatedNodes.length,
      edgesCount: result.mutatedEdges.length,
      decisionRepairApplied: result.safetyReport.decisionRepairApplied,
    });
  }

  return {
    success: result.success,
    reason: result.reason,
    mutatedNodes: result.mutatedNodes,
    mutatedEdges: result.mutatedEdges as any,
    safetyReport: result.safetyReport,
    repairInfo: result.repairInfo,
    mergeBranchDecision,
    mutationSafety: result.combinedMutationSafety,
  };
}

export interface UseChatMutationOptions {
  onMutationFailure?: (reason: string, safetyReport: OrchestrateMutationResult['safetyReport']) => void;
  onRepairApplied?: (repairInfo: RepairInfo) => void;
}

export interface UseChatMutationResult {
  applyMutation: (input: ChatMutationInput) => ChatMutationResult;
  applyWorkflowSafely: (
    existingNodes: Node[],
    existingEdges: Edge[],
    proposedNodes: Node[],
    proposedEdges: Edge[],
    userMessage: string,
    aiMode?: AiMode,
    mode?: MutationMode
  ) => { 
    success: boolean; 
    nodes: Node[]; 
    edges: Edge[]; 
    mergeBranchDecision?: MergeBranchDecision;
    repairInfo?: RepairInfo;
    requiresConfirmation?: boolean;
    fullGraphDetection?: FullGraphDetectionResult;
  };
}

/**
 * Hook for chat-driven workflow mutations with merge-safe validation.
 * 
 * Usage:
 * ```tsx
 * const { applyWorkflowSafely } = useChatMutation({
 *   onMutationFailure: (reason, report) => {
 *     // Record in DecisionSnapshot.unresolvedConcerns
 *   },
 *   onRepairApplied: (repairInfo) => {
 *     // Update DiagnosticsEngine with repairInfo
 *   },
 * });
 * 
 * // When AI generates a workflow:
 * const result = applyWorkflowSafely(
 *   currentNodes, currentEdges,
 *   aiNodes, aiEdges,
 *   userMessage
 * );
 * 
 * if (result.success) {
 *   // Safe to apply to canvas
 *   setNodes(result.nodes);
 *   setEdges(result.edges);
 * }
 * // If failed, canvas remains unchanged
 * ```
 */
export function useChatMutation(options: UseChatMutationOptions = {}): UseChatMutationResult {
  const { onMutationFailure, onRepairApplied } = options;

  const applyMutation = useCallback((input: ChatMutationInput): ChatMutationResult => {
    const result = applyChatMutation(input);

    if (!result.success && onMutationFailure) {
      onMutationFailure(result.reason || 'Unknown failure', result.safetyReport);
    }

    if (result.repairInfo.repairedNodeIds.length > 0 && onRepairApplied) {
      onRepairApplied(result.repairInfo);
    }

    return result;
  }, [onMutationFailure, onRepairApplied]);

  const applyWorkflowSafely = useCallback((
    existingNodes: Node[],
    existingEdges: Edge[],
    proposedNodes: Node[],
    proposedEdges: Edge[],
    userMessage: string,
    aiMode: AiMode = 'EDIT',
    mode: MutationMode = 'PATCH'
  ) => {
    // For REPLACE mode, pass ALL proposed nodes/edges (no filtering)
    // For PATCH mode, filter to only new nodes/edges
    const newNodes = mode === 'REPLACE' 
      ? proposedNodes 
      : proposedNodes.filter(pn => !existingNodes.some(en => en.id === pn.id));
    const newEdges = mode === 'REPLACE'
      ? proposedEdges
      : proposedEdges.filter(pe => !existingEdges.some(ee => ee.id === pe.id));

    const result = applyMutation({
      existingNodes,
      existingEdges,
      newNodes,
      newEdges,
      userMessage,
      aiMode,
      mode,
    });

    if (!result.success) {
      return {
        success: false,
        nodes: existingNodes,
        edges: existingEdges,
        requiresConfirmation: result.requiresConfirmation,
        fullGraphDetection: result.fullGraphDetection,
      };
    }

    return {
      success: true,
      nodes: result.mutatedNodes,
      edges: result.mutatedEdges as unknown as Edge[],
      mergeBranchDecision: result.mergeBranchDecision,
      repairInfo: result.repairInfo,
    };
  }, [applyMutation]);

  return {
    applyMutation,
    applyWorkflowSafely,
  };
}

/**
 * Standalone function for non-hook contexts (e.g., event handlers, callbacks).
 * Use this when you need merge-safe mutation outside of React component lifecycle.
 */
export { applyChatMutation as applyMergeSafeChatMutation };
