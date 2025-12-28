import type { Node, Edge, ExperimentNodeData } from '../types';

export function isSpeculativeNode(node: Node): boolean {
  if (node.meta?.speculative === true) {
    return true;
  }
  if (node.data?.ui?.preview === true) {
    return true;
  }
  if (node.type === 'experiment') {
    const data = node.data as ExperimentNodeData;
    return data?.ui?.preview === true;
  }
  return false;
}

export function isSpeculativeEdge(edge: Edge): boolean {
  if (edge.meta?.speculative === true) {
    return true;
  }
  return false;
}

export function filterOutSpeculative<T extends Node | Edge>(items: T[]): T[] {
  return items.filter(item => {
    if ('type' in item && (item as Node).type !== undefined) {
      return !isSpeculativeNode(item as Node);
    }
    if ('source' in item && 'target' in item) {
      return !isSpeculativeEdge(item as Edge);
    }
    return true;
  });
}

export function filterOutSpeculativeNodes(nodes: Node[]): Node[] {
  return nodes.filter(node => !isSpeculativeNode(node));
}

export function filterOutSpeculativeEdges(edges: Edge[]): Edge[] {
  return edges.filter(edge => !isSpeculativeEdge(edge));
}

export function getGeneratedNodeIds(experimentNode: Node): string[] {
  if (experimentNode.type !== 'experiment') return [];
  const data = experimentNode.data as ExperimentNodeData;
  return data?.generation?.generatedNodeIds || [];
}

export function getGeneratedEdgeIds(experimentNode: Node): string[] {
  if (experimentNode.type !== 'experiment') return [];
  const data = experimentNode.data as ExperimentNodeData;
  return data?.generation?.generatedEdgeIds || [];
}

export function collectSpeculativeContent(nodes: Node[], edges: Edge[]): {
  speculativeNodes: Node[];
  speculativeEdges: Edge[];
  experimentNodes: Node[];
} {
  const experimentNodes = nodes.filter(n => n.type === 'experiment');
  const speculativeNodes = nodes.filter(isSpeculativeNode);
  const speculativeEdges = edges.filter(isSpeculativeEdge);
  
  return {
    speculativeNodes,
    speculativeEdges,
    experimentNodes,
  };
}
