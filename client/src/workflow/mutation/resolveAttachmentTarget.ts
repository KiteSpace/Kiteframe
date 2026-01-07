/**
 * TASK 2: Resolve Attachment Target
 * 
 * Ensures follow-up mutations reference an existing node ID.
 * Labels (e.g., "Verification Failed") are INVALID references.
 * Returns null if no valid attachment target is found.
 */

import type { Node, Edge } from '@/lib/kiteframe/types';
import type { AttachmentResolution, ExistingGraph, ChatMutationIntent } from './types';

function findNodeByLabel(nodes: Node[], label: string): Node | undefined {
  const normalizedLabel = label.toLowerCase().trim();
  return nodes.find(node => {
    const nodeLabel = (node.data?.label || '').toLowerCase().trim();
    return nodeLabel === normalizedLabel;
  });
}

function isValidNodeId(nodeId: string, nodes: Node[]): boolean {
  return nodes.some(node => node.id === nodeId);
}

function findBestAttachmentPoint(graph: ExistingGraph): string | undefined {
  const { nodes, edges } = graph;
  
  if (nodes.length === 0) return undefined;
  
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  
  for (const node of nodes) {
    incomingCount.set(node.id, 0);
    outgoingCount.set(node.id, 0);
  }
  
  for (const edge of edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) || 0) + 1);
  }
  
  const leafNodes = nodes.filter(node => {
    const outgoing = outgoingCount.get(node.id) || 0;
    const nodeType = (node.type || '').toLowerCase();
    const isTerminal = ['end', 'output', 'exit', 'terminate'].some(t => nodeType.includes(t));
    return outgoing === 0 && !isTerminal;
  });
  
  if (leafNodes.length === 1) {
    return leafNodes[0].id;
  }
  
  const processNodes = nodes.filter(node => {
    const nodeType = (node.type || '').toLowerCase();
    return nodeType.includes('process') || nodeType === '';
  });
  
  if (processNodes.length > 0) {
    const lastProcess = processNodes.reduce((latest, node) => {
      const latestPos = latest.position?.x || 0;
      const nodePos = node.position?.x || 0;
      return nodePos > latestPos ? node : latest;
    });
    return lastProcess.id;
  }
  
  return nodes[nodes.length - 1]?.id;
}

export function resolveAttachmentTarget(
  graph: ExistingGraph,
  intent: ChatMutationIntent
): AttachmentResolution {
  const { nodes } = graph;
  const { attachmentTarget, newEdges, isFollowUp } = intent;
  
  if (!isFollowUp && nodes.length === 0) {
    return {
      success: true,
      reason: 'New workflow - no attachment needed',
    };
  }
  
  if (attachmentTarget) {
    if (isValidNodeId(attachmentTarget, nodes)) {
      return {
        success: true,
        targetNodeId: attachmentTarget,
        reason: 'Explicit valid attachment target',
      };
    }
    
    const matchedNode = findNodeByLabel(nodes, attachmentTarget);
    if (matchedNode) {
      return {
        success: true,
        targetNodeId: matchedNode.id,
        reason: 'Matched attachment target by label',
      };
    }
    
    return {
      success: false,
      reason: `Invalid attachment target: "${attachmentTarget}" is not a valid node ID or label`,
    };
  }
  
  const edgesReferencingExisting = newEdges.filter(edge => 
    isValidNodeId(edge.source, nodes) || isValidNodeId(edge.target, nodes)
  );
  
  if (edgesReferencingExisting.length > 0) {
    const targetNodeId = edgesReferencingExisting[0].source;
    if (isValidNodeId(targetNodeId, nodes)) {
      return {
        success: true,
        targetNodeId,
        reason: 'Inferred from new edges referencing existing node',
      };
    }
  }
  
  if (isFollowUp && nodes.length > 0) {
    const bestAttachment = findBestAttachmentPoint(graph);
    if (bestAttachment) {
      return {
        success: true,
        targetNodeId: bestAttachment,
        reason: 'Auto-resolved to best attachment point for follow-up',
      };
    }
    
    return {
      success: false,
      reason: 'Follow-up mutation requires explicit attachment target - none could be inferred',
    };
  }
  
  return {
    success: true,
    reason: 'New workflow creation - no attachment required',
  };
}

export function validateEdgeReferences(
  existingNodes: Node[],
  newNodes: Node[],
  edges: Edge[]
): { valid: boolean; invalidEdges: Array<{ edgeId: string; reason: string; errorType: 'source' | 'target' }> } {
  const allNodeIds = new Set([
    ...existingNodes.map(n => n.id),
    ...newNodes.map(n => n.id),
  ]);
  
  const invalidEdges: Array<{ edgeId: string; reason: string; errorType: 'source' | 'target' }> = [];
  
  for (const edge of edges) {
    if (!allNodeIds.has(edge.source)) {
      invalidEdges.push({
        edgeId: edge.id,
        reason: `Invalid source ID: ${edge.source}`,
        errorType: 'source',
      });
    }
    if (!allNodeIds.has(edge.target)) {
      invalidEdges.push({
        edgeId: edge.id,
        reason: `Invalid target ID: ${edge.target}`,
        errorType: 'target',
      });
    }
  }
  
  return {
    valid: invalidEdges.length === 0,
    invalidEdges,
  };
}
