import type { Node, Edge } from '@/lib/kiteframe/types';

export interface GraphStructureStats {
  nodeCount: number;
  edgeCount: number;
  branchingPoints: number;
  decisionNodes: number;
  labeledDecisionEdges: number;
}

export interface StructuralRegressionResult {
  hasRegression: boolean;
  regressionType: 'branchingPoints' | 'decisionNodes' | 'labeledDecisionEdges' | null;
  existing: GraphStructureStats;
  proposed: GraphStructureStats;
  message: string;
}

export function getGraphStructureStats(nodes: Node[], edges: Edge[]): GraphStructureStats {
  const nodeOutDegree: Record<string, number> = {};
  const labeledEdgesFromBranching: Set<string> = new Set();
  
  for (const node of nodes) {
    nodeOutDegree[node.id] = 0;
  }
  
  for (const edge of edges) {
    if (nodeOutDegree[edge.source] !== undefined) {
      nodeOutDegree[edge.source]++;
    }
  }
  
  let branchingPoints = 0;
  let decisionNodes = 0;
  
  for (const node of nodes) {
    const outDegree = nodeOutDegree[node.id] || 0;
    const nodeType = node.type?.toLowerCase() || '';
    const isDecisionType = ['condition', 'decision', 'gateway', 'branch'].some(t => nodeType.includes(t));
    
    if (outDegree >= 2) {
      branchingPoints++;
    }
    
    if (isDecisionType || outDegree >= 2) {
      decisionNodes++;
    }
  }
  
  for (const edge of edges) {
    const sourceOutDegree = nodeOutDegree[edge.source] || 0;
    if (sourceOutDegree >= 2) {
      const label = (edge.label || edge.data?.label || '').toString().trim();
      if (label.length > 0) {
        labeledEdgesFromBranching.add(edge.id);
      }
    }
  }
  
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    branchingPoints,
    decisionNodes,
    labeledDecisionEdges: labeledEdgesFromBranching.size,
  };
}

export function detectStructuralRegression(
  existingNodes: Node[],
  existingEdges: Edge[],
  proposedNodes: Node[],
  proposedEdges: Edge[]
): StructuralRegressionResult {
  const existing = getGraphStructureStats(existingNodes, existingEdges);
  const proposed = getGraphStructureStats(proposedNodes, proposedEdges);
  
  if (proposed.branchingPoints < existing.branchingPoints && existing.branchingPoints > 0) {
    return {
      hasRegression: true,
      regressionType: 'branchingPoints',
      existing,
      proposed,
      message: `This replacement reduces branching points from ${existing.branchingPoints} to ${proposed.branchingPoints}. Decision paths may be lost.`,
    };
  }
  
  if (proposed.decisionNodes < existing.decisionNodes && existing.decisionNodes > 0) {
    return {
      hasRegression: true,
      regressionType: 'decisionNodes',
      existing,
      proposed,
      message: `This replacement reduces decision nodes from ${existing.decisionNodes} to ${proposed.decisionNodes}. Decision logic may be lost.`,
    };
  }
  
  if (proposed.labeledDecisionEdges < existing.labeledDecisionEdges && existing.labeledDecisionEdges > 0) {
    return {
      hasRegression: true,
      regressionType: 'labeledDecisionEdges',
      existing,
      proposed,
      message: `This replacement reduces labeled decision edges from ${existing.labeledDecisionEdges} to ${proposed.labeledDecisionEdges}. Branch labels may be lost.`,
    };
  }
  
  return {
    hasRegression: false,
    regressionType: null,
    existing,
    proposed,
    message: '',
  };
}
