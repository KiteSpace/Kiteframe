/**
 * TASK 1 & 3: Merge-Safe Chat Workflow Mutation
 * 
 * Enforces structural safety for all chat-driven workflow mutations:
 * - All new nodes must have at least one valid incoming edge
 * - All edges must reference valid source + target IDs
 * - Follow-up mutations must merge into existing workflows
 * - Orphan nodes are strictly prevented
 */

import type { Node, Edge } from '@/lib/kiteframe/types';
import type { 
  WorkflowMutationResult, 
  MutationSafetyReport, 
  MutationValidationError,
  ChatMutationIntent,
  ExistingGraph 
} from './types';
import { resolveAttachmentTarget, validateEdgeReferences } from './resolveAttachmentTarget';
import { detectMergeBranchIntent, type MergeBranchDecision } from '@/ai/intent/mergeBranchDetector';
import { runWorkflowRepairs, type WorkflowRepairResult } from '@/workflow/lifecycle/runWorkflowRepairs';
import type { MutationSafety } from '@/ai/explainability/types';
import type { RepairInfo } from '@/lib/kiteframe/utils/diagnostics/types';

function createAbortedResult(
  reason: string,
  safetyReport: Partial<MutationSafetyReport>
): WorkflowMutationResult {
  console.error('[MutationContract] Mutation aborted:', reason);
  return {
    success: false,
    reason,
    mutatedNodes: [],
    mutatedEdges: [],
    safetyReport: {
      mergeEnforced: false,
      orphanPreventionTriggered: false,
      decisionRepairApplied: false,
      mutationAborted: reason,
      attachmentResolved: false,
      validationErrors: [],
      ...safetyReport,
    },
  };
}

function findOrphanNodes(
  newNodes: Node[],
  existingNodes: Node[],
  allEdges: Edge[]
): Node[] {
  const existingNodeIds = new Set(existingNodes.map(n => n.id));
  const newNodeIds = new Set(newNodes.map(n => n.id));
  const orphans: Node[] = [];
  
  for (const node of newNodes) {
    const hasIncomingEdgeFromExisting = allEdges.some(edge => 
      edge.target === node.id && existingNodeIds.has(edge.source)
    );
    const hasIncomingEdgeFromNewNode = allEdges.some(edge => 
      edge.target === node.id && newNodeIds.has(edge.source)
    );
    const isRootNode = !existingNodes.length && newNodes.indexOf(node) === 0;
    
    if (!hasIncomingEdgeFromExisting && !hasIncomingEdgeFromNewNode && !isRootNode && !existingNodeIds.has(node.id)) {
      orphans.push(node);
    }
  }
  
  return orphans;
}

function detectFloatingIsland(
  existingGraph: ExistingGraph,
  newNodes: Node[],
  newEdges: Edge[],
  existingEdges: Edge[]
): boolean {
  if (existingGraph.nodes.length === 0 || newNodes.length === 0) return false;
  
  const existingNodeIds = new Set(existingGraph.nodes.map(n => n.id));
  const newNodeIds = new Set(newNodes.map(n => n.id));
  const allEdges = [...existingEdges, ...newEdges];
  
  const hasConnectionToExisting = allEdges.some(edge => {
    const sourceIsExisting = existingNodeIds.has(edge.source);
    const targetIsExisting = existingNodeIds.has(edge.target);
    const sourceIsNew = newNodeIds.has(edge.source);
    const targetIsNew = newNodeIds.has(edge.target);
    
    return (sourceIsExisting && targetIsNew) || (sourceIsNew && targetIsExisting);
  });
  
  return !hasConnectionToExisting;
}

function verifyNewNodesReachable(
  existingGraph: ExistingGraph,
  newNodes: Node[],
  allEdges: Edge[],
  attachmentNodeId?: string
): { reachable: boolean; unreachableNodeIds: string[] } {
  if (existingGraph.nodes.length === 0 || newNodes.length === 0) {
    return { reachable: true, unreachableNodeIds: [] };
  }
  
  const existingNodeIds = new Set(existingGraph.nodes.map(n => n.id));
  const newNodeIds = new Set(newNodes.map(n => n.id));
  
  // Build DIRECTED adjacency list (source -> target)
  // A new node is reachable if there's a directed path FROM an existing node TO it
  const outgoingEdges = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, new Set());
    }
    outgoingEdges.get(edge.source)!.add(edge.target);
  }
  
  // BFS from existing nodes following directed edges
  const reachableFromExisting = new Set<string>();
  const existingNodeIdArray = Array.from(existingNodeIds);
  
  // Initialize with all existing nodes as reachable
  for (const id of existingNodeIdArray) {
    reachableFromExisting.add(id);
  }
  
  // Start BFS from attachment node if specified, otherwise from all existing
  const queue: string[] = attachmentNodeId && existingNodeIds.has(attachmentNodeId)
    ? [attachmentNodeId]
    : [...existingNodeIdArray];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const targets = outgoingEdges.get(current);
    
    if (targets) {
      const targetArray = Array.from(targets);
      for (const target of targetArray) {
        if (!reachableFromExisting.has(target)) {
          reachableFromExisting.add(target);
          queue.push(target);
        }
      }
    }
  }
  
  // Check which new nodes are NOT reachable via directed path
  const unreachableNodeIds: string[] = [];
  const newNodeIdArray = Array.from(newNodeIds);
  for (const newNodeId of newNodeIdArray) {
    if (!reachableFromExisting.has(newNodeId)) {
      unreachableNodeIds.push(newNodeId);
    }
  }
  
  return {
    reachable: unreachableNodeIds.length === 0,
    unreachableNodeIds,
  };
}

function detectParallelWorkflowCreation(
  existingGraph: ExistingGraph,
  newNodes: Node[],
  newEdges: Edge[]
): boolean {
  if (existingGraph.nodes.length === 0) return false;
  
  const existingNodeIds = new Set(existingGraph.nodes.map(n => n.id));
  
  const newEdgesConnectingToExisting = newEdges.filter(edge => 
    existingNodeIds.has(edge.source) || existingNodeIds.has(edge.target)
  );
  
  if (newNodes.length > 0 && newEdgesConnectingToExisting.length === 0) {
    const inputNodes = newNodes.filter(node => {
      const nodeType = (node.type || '').toLowerCase();
      const nodeLabel = (node.data?.label || '').toLowerCase();
      return nodeType.includes('input') || nodeType.includes('start') || 
             nodeLabel.includes('start') || nodeLabel.includes('begin');
    });
    
    if (inputNodes.length > 0) {
      return true;
    }
  }
  
  return false;
}

export function applyChatWorkflowMutation(
  existingGraph: ExistingGraph,
  intent: ChatMutationIntent,
  mergeBranchDecision?: MergeBranchDecision
): WorkflowMutationResult {
  const validationErrors: MutationValidationError[] = [];
  const safetyReport: MutationSafetyReport = {
    mergeEnforced: false,
    orphanPreventionTriggered: false,
    decisionRepairApplied: false,
    attachmentResolved: false,
    validationErrors: [],
  };
  
  const effectiveDecision = mergeBranchDecision ?? (
    intent.userMessage ? detectMergeBranchIntent({
      userMessage: intent.userMessage,
      hasExistingWorkflow: existingGraph.nodes.length > 0,
    }) : null
  );
  
  const resolvedIntent = effectiveDecision?.resolvedIntent ?? 'merge';
  
  const wasBranchIntentResolvedToMerge = effectiveDecision?.intent === 'ambiguous' && resolvedIntent === 'merge';
  if (wasBranchIntentResolvedToMerge && intent.isFollowUp) {
    safetyReport.mergeEnforced = true;
  }
  
  const attachmentResolution = resolveAttachmentTarget(existingGraph, intent);
  safetyReport.attachmentResolved = attachmentResolution.success;
  safetyReport.resolvedAttachmentNodeId = attachmentResolution.targetNodeId;
  
  if (!attachmentResolution.success && intent.isFollowUp) {
    validationErrors.push({
      code: 'NO_ATTACHMENT_TARGET',
      message: attachmentResolution.reason || 'Failed to resolve attachment target',
    });
    safetyReport.validationErrors = validationErrors;
    return createAbortedResult(
      `Attachment resolution failed: ${attachmentResolution.reason}`,
      safetyReport
    );
  }
  
  const edgeValidation = validateEdgeReferences(
    existingGraph.nodes,
    intent.newNodes,
    intent.newEdges
  );
  
  if (!edgeValidation.valid) {
    for (const invalid of edgeValidation.invalidEdges) {
      validationErrors.push({
        code: invalid.errorType === 'source' ? 'INVALID_SOURCE_ID' : 'INVALID_TARGET_ID',
        message: invalid.reason,
        affectedEdgeIds: [invalid.edgeId],
      });
    }
    safetyReport.validationErrors = validationErrors;
    return createAbortedResult(
      `Invalid edge references: ${edgeValidation.invalidEdges.map(e => e.reason).join('; ')}`,
      safetyReport
    );
  }
  
  const allEdges = [...existingGraph.edges, ...intent.newEdges];
  const orphanNodes = findOrphanNodes(intent.newNodes, existingGraph.nodes, allEdges);
  
  if (orphanNodes.length > 0) {
    safetyReport.orphanPreventionTriggered = true;
    
    const orphanIds = orphanNodes.map(n => n.id);
    validationErrors.push({
      code: 'ORPHAN_NODE',
      message: `Orphan nodes detected: ${orphanIds.join(', ')}`,
      affectedNodeIds: orphanIds,
    });
    safetyReport.validationErrors = validationErrors;
    return createAbortedResult(
      `Orphan node prevented: ${orphanIds.length} node(s) would have no incoming edges`,
      safetyReport
    );
  }
  
  if (resolvedIntent === 'merge' && intent.isFollowUp) {
    const isParallelCreation = detectParallelWorkflowCreation(
      existingGraph,
      intent.newNodes,
      intent.newEdges
    );
    
    if (isParallelCreation) {
      validationErrors.push({
        code: 'PARALLEL_WORKFLOW_BLOCKED',
        message: 'Merge mode does not allow creating parallel workflows',
      });
      safetyReport.validationErrors = validationErrors;
      return createAbortedResult(
        'Parallel workflow creation blocked in merge mode',
        safetyReport
      );
    }
    
    const isFloatingIsland = detectFloatingIsland(
      existingGraph,
      intent.newNodes,
      intent.newEdges,
      existingGraph.edges
    );
    
    if (isFloatingIsland) {
      validationErrors.push({
        code: 'MERGE_MODE_VIOLATION',
        message: 'New nodes must connect to existing workflow in merge mode',
      });
      safetyReport.validationErrors = validationErrors;
      return createAbortedResult(
        'Floating island blocked: new nodes have no edges connecting to existing workflow',
        safetyReport
      );
    }
    
    const reachabilityCheck = verifyNewNodesReachable(
      existingGraph,
      intent.newNodes,
      allEdges,
      safetyReport.resolvedAttachmentNodeId
    );
    
    if (!reachabilityCheck.reachable) {
      validationErrors.push({
        code: 'UNREACHABLE_NODES',
        message: `Nodes not reachable from existing workflow: ${reachabilityCheck.unreachableNodeIds.join(', ')}`,
        affectedNodeIds: reachabilityCheck.unreachableNodeIds,
      });
      safetyReport.validationErrors = validationErrors;
      return createAbortedResult(
        `Unreachable nodes blocked: ${reachabilityCheck.unreachableNodeIds.length} node(s) not connected to existing workflow`,
        safetyReport
      );
    }
  }
  
  const mutatedNodes = [...existingGraph.nodes, ...intent.newNodes];
  const mutatedEdges = [...existingGraph.edges, ...intent.newEdges];
  
  safetyReport.validationErrors = validationErrors;
  
  console.log('[MutationContract] Mutation applied successfully', {
    nodesAdded: intent.newNodes.length,
    edgesAdded: intent.newEdges.length,
    mergeEnforced: safetyReport.mergeEnforced,
    attachmentTarget: safetyReport.resolvedAttachmentNodeId,
  });
  
  return {
    success: true,
    mutatedNodes,
    mutatedEdges,
    safetyReport,
  };
}

export function validateMutationPreFlight(
  existingGraph: ExistingGraph,
  intent: ChatMutationIntent
): { valid: boolean; errors: MutationValidationError[] } {
  const errors: MutationValidationError[] = [];
  
  const attachmentResolution = resolveAttachmentTarget(existingGraph, intent);
  if (!attachmentResolution.success && intent.isFollowUp) {
    errors.push({
      code: 'NO_ATTACHMENT_TARGET',
      message: attachmentResolution.reason || 'No valid attachment target',
    });
  }
  
  const edgeValidation = validateEdgeReferences(
    existingGraph.nodes,
    intent.newNodes,
    intent.newEdges
  );
  
  if (!edgeValidation.valid) {
    for (const invalid of edgeValidation.invalidEdges) {
      errors.push({
        code: 'INVALID_SOURCE_ID',
        message: invalid.reason,
        affectedEdgeIds: [invalid.edgeId],
      });
    }
  }
  
  const allEdges = [...existingGraph.edges, ...intent.newEdges];
  const orphanNodes = findOrphanNodes(intent.newNodes, existingGraph.nodes, allEdges);
  
  if (orphanNodes.length > 0) {
    errors.push({
      code: 'ORPHAN_NODE',
      message: `${orphanNodes.length} node(s) would have no incoming edges`,
      affectedNodeIds: orphanNodes.map(n => n.id),
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface OrchestrateMutationResult extends WorkflowMutationResult {
  repairInfo: RepairInfo;
  combinedMutationSafety: MutationSafety;
}

/**
 * Orchestrates the full mutation pipeline:
 * 1. Runs workflow repairs (decision repair) on the combined graph
 * 2. Applies chat workflow mutation with safety checks using repaired graph
 * 3. Combines mutationSafety from both steps into the safetyReport
 * 
 * This is the recommended entry point for chat-driven workflow edits.
 */
export function orchestrateChatWorkflowMutation(
  existingGraph: ExistingGraph,
  intent: ChatMutationIntent,
  mergeBranchDecision?: MergeBranchDecision
): OrchestrateMutationResult {
  const existingNodeIds = new Set(existingGraph.nodes.map(n => n.id));
  const existingEdgeIds = new Set(existingGraph.edges.map(e => e.id));
  
  const combinedNodes = [...existingGraph.nodes, ...intent.newNodes];
  const combinedEdges = [...existingGraph.edges, ...intent.newEdges];
  
  const repairResult = runWorkflowRepairs(combinedNodes, combinedEdges);
  
  const repairSafety = repairResult.mutationSafety;
  
  const repairedExistingNodes = repairResult.nodes.filter(n => existingNodeIds.has(n.id));
  const repairedExistingEdges = repairResult.edges.filter(e => existingEdgeIds.has(e.id));
  
  const repairedNewNodes = repairResult.nodes.filter(n => !existingNodeIds.has(n.id));
  const repairedNewEdges = repairResult.edges.filter(e => !existingEdgeIds.has(e.id));
  
  const repairedExistingGraph: ExistingGraph = {
    nodes: repairedExistingNodes,
    edges: repairedExistingEdges,
  };
  
  const repairedIntent: ChatMutationIntent = {
    ...intent,
    newNodes: repairedNewNodes,
    newEdges: repairedNewEdges,
  };
  
  const mutationResult = applyChatWorkflowMutation(
    repairedExistingGraph,
    repairedIntent,
    mergeBranchDecision
  );
  
  const decisionRepairApplied = repairSafety.decisionRepairApplied || false;
  
  mutationResult.safetyReport.decisionRepairApplied = decisionRepairApplied;
  
  const combinedMutationSafety: MutationSafety = {
    ...mutationResult.safetyReport,
    decisionRepairApplied,
  };
  
  return {
    ...mutationResult,
    repairInfo: repairResult.repairInfo,
    combinedMutationSafety,
  };
}
