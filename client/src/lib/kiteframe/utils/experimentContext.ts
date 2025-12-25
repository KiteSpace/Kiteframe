import type { Node, Edge } from '../types';
import { isSpeculativeNode, isSpeculativeEdge } from './speculativeFilter';

export interface ExperimentContext {
  anchorNodeId: string;
  anchorNodeLabel: string;
  anchorNodeType: string;
  upstreamNodes: ContextNode[];
  downstreamNodes: ContextNode[];
  workflowName: string;
}

export interface ContextNode {
  id: string;
  label: string;
  type: string;
  description?: string;
}

export interface BuildExperimentContextInput {
  experimentNodeId: string;
  nodes: Node[];
  edges: Edge[];
  workflowName: string;
}

function findAnchorNode(experimentNodeId: string, nodes: Node[], edges: Edge[]): Node | null {
  const incomingEdges = edges.filter(e => 
    e.target === experimentNodeId && !isSpeculativeEdge(e)
  );
  
  if (incomingEdges.length === 0) return null;
  
  const anchorEdge = incomingEdges[0];
  const anchorNode = nodes.find(n => n.id === anchorEdge.source);
  
  if (!anchorNode || isSpeculativeNode(anchorNode)) return null;
  
  return anchorNode;
}

function getUpstreamNodes(
  startNodeId: string,
  nodes: Node[],
  edges: Edge[],
  maxHops: number
): ContextNode[] {
  const result: ContextNode[] = [];
  const visited = new Set<string>();
  const queue: { nodeId: string; hops: number }[] = [{ nodeId: startNodeId, hops: 0 }];
  
  while (queue.length > 0) {
    const { nodeId, hops } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    if (hops > maxHops) continue;
    
    const incomingEdges = edges.filter(e => 
      e.target === nodeId && !isSpeculativeEdge(e)
    );
    
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode || isSpeculativeNode(sourceNode)) continue;
      if (visited.has(sourceNode.id)) continue;
      
      if (sourceNode.type !== 'experiment' && sourceNode.type !== 'wildcard') {
        result.push({
          id: sourceNode.id,
          label: sourceNode.data?.label || sourceNode.type || 'Unknown',
          type: sourceNode.type || 'process',
          description: sourceNode.data?.description,
        });
      }
      
      if (hops + 1 < maxHops) {
        queue.push({ nodeId: sourceNode.id, hops: hops + 1 });
      }
    }
  }
  
  return result;
}

function getDownstreamNodes(
  startNodeId: string,
  nodes: Node[],
  edges: Edge[],
  maxHops: number
): ContextNode[] {
  const result: ContextNode[] = [];
  const visited = new Set<string>();
  const queue: { nodeId: string; hops: number }[] = [{ nodeId: startNodeId, hops: 0 }];
  
  while (queue.length > 0) {
    const { nodeId, hops } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    if (hops > maxHops) continue;
    
    const outgoingEdges = edges.filter(e => 
      e.source === nodeId && !isSpeculativeEdge(e)
    );
    
    for (const edge of outgoingEdges) {
      const targetNode = nodes.find(n => n.id === edge.target);
      if (!targetNode || isSpeculativeNode(targetNode)) continue;
      if (visited.has(targetNode.id)) continue;
      
      if (targetNode.type !== 'experiment' && targetNode.type !== 'wildcard') {
        result.push({
          id: targetNode.id,
          label: targetNode.data?.label || targetNode.type || 'Unknown',
          type: targetNode.type || 'process',
          description: targetNode.data?.description,
        });
      }
      
      if (hops + 1 < maxHops) {
        queue.push({ nodeId: targetNode.id, hops: hops + 1 });
      }
    }
  }
  
  return result;
}

export function buildExperimentContext(input: BuildExperimentContextInput): ExperimentContext | null {
  const { experimentNodeId, nodes, edges, workflowName } = input;
  
  const anchorNode = findAnchorNode(experimentNodeId, nodes, edges);
  if (!anchorNode) return null;
  
  const upstreamNodes = getUpstreamNodes(anchorNode.id, nodes, edges, 2);
  const downstreamNodes = getDownstreamNodes(anchorNode.id, nodes, edges, 1);
  
  return {
    anchorNodeId: anchorNode.id,
    anchorNodeLabel: anchorNode.data?.label || anchorNode.type || 'Unknown',
    anchorNodeType: anchorNode.type || 'process',
    upstreamNodes,
    downstreamNodes,
    workflowName,
  };
}

export function formatContextForPrompt(context: ExperimentContext): string {
  const upstreamSummary = context.upstreamNodes.length > 0
    ? context.upstreamNodes.map(n => `${n.label} (${n.type})`).join(' → ')
    : 'Start of workflow';
    
  const downstreamSummary = context.downstreamNodes.length > 0
    ? context.downstreamNodes.map(n => `${n.label} (${n.type})`).join(' → ')
    : 'End of workflow';
    
  return `Workflow: ${context.workflowName}
Current step: ${context.anchorNodeLabel} (${context.anchorNodeType})
Upstream: ${upstreamSummary}
Downstream: ${downstreamSummary}`;
}

export function getAnchorNodeId(experimentNodeId: string, nodes: Node[], edges: Edge[]): string | null {
  const anchorNode = findAnchorNode(experimentNodeId, nodes, edges);
  return anchorNode?.id || null;
}
