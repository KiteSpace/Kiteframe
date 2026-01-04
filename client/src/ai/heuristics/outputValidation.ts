import type { Node, Edge } from '@/lib/kiteframe/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateProposalOutput(
  nodes: Node[],
  edges: Edge[],
  snapshotNodes: Node[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (nodes.length === 0) {
    errors.push('Proposal contains no nodes');
  }
  
  const nodeIds = new Set(nodes.map(n => n.id));
  const duplicateCheck = new Set<string>();
  
  for (const node of nodes) {
    if (duplicateCheck.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    duplicateCheck.add(node.id);
  }
  
  const snapshotNodeIds = new Set(snapshotNodes.map(n => n.id));
  const allValidNodeIds = new Set(Array.from(nodeIds).concat(Array.from(snapshotNodeIds)));
  
  for (const edge of edges) {
    if (!allValidNodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references invalid source: ${edge.source}`);
    }
    if (!allValidNodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references invalid target: ${edge.target}`);
    }
    
    if (edge.source === edge.target) {
      errors.push(`Edge ${edge.id} is a self-loop`);
    }
  }
  
  const connectedToSnapshot = edges.some(
    e => snapshotNodeIds.has(e.source) || snapshotNodeIds.has(e.target)
  );
  
  if (!connectedToSnapshot && nodes.length > 0) {
    errors.push('Proposal nodes are not connected to the existing workflow');
  }
  
  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();
  
  for (const edge of edges) {
    hasOutgoing.add(edge.source);
    hasIncoming.add(edge.target);
  }
  
  for (const node of nodes) {
    const isConnected = hasIncoming.has(node.id) || hasOutgoing.has(node.id) ||
      snapshotNodeIds.has(node.id);
    if (!isConnected && nodes.length > 1) {
      warnings.push(`Node ${node.id} (${node.data?.label}) is orphaned`);
    }
  }
  
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source)!.push(edge.target);
  }
  
  const newNodeIds = Array.from(nodeIds);
  for (const startId of newNodeIds) {
    const visited = new Set<string>();
    const stack = [startId];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      
      if (visited.has(current)) {
        if (nodeIds.has(current)) {
          warnings.push(`Potential cycle detected involving new nodes`);
          break;
        }
        continue;
      }
      
      visited.add(current);
      
      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        if (nodeIds.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateExperimentOutput(
  experiments: Array<{
    id: string;
    title: string;
    nodes: Node[];
    edges: Edge[];
  }>,
  snapshotNodes: Node[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (experiments.length !== 4) {
    errors.push(`Expected exactly 4 experiments, got ${experiments.length}`);
  }
  
  const emptyExperiments = experiments.filter(e => e.nodes.length === 0);
  if (emptyExperiments.length > 2) {
    errors.push(`${emptyExperiments.length} experiments have no nodes`);
  }
  
  for (const exp of experiments) {
    const result = validateProposalOutput(exp.nodes, exp.edges, snapshotNodes);
    
    for (const error of result.errors) {
      errors.push(`[${exp.title}] ${error}`);
    }
    
    for (const warning of result.warnings) {
      warnings.push(`[${exp.title}] ${warning}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function sanitizeOutput<T extends { nodes: Node[]; edges: Edge[] }>(
  output: T,
  snapshotNodes: Node[]
): T {
  const validNodeIds = new Set([
    ...output.nodes.map(n => n.id),
    ...snapshotNodes.map(n => n.id),
  ]);
  
  const uniqueNodeIds = new Set<string>();
  const deduplicatedNodes = output.nodes.filter(node => {
    if (uniqueNodeIds.has(node.id)) {
      return false;
    }
    uniqueNodeIds.add(node.id);
    return true;
  });
  
  const validEdges = output.edges.filter(edge => {
    if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) {
      console.warn(`Removing invalid edge: ${edge.source} -> ${edge.target}`);
      return false;
    }
    if (edge.source === edge.target) {
      console.warn(`Removing self-loop edge: ${edge.id}`);
      return false;
    }
    return true;
  });
  
  return {
    ...output,
    nodes: deduplicatedNodes,
    edges: validEdges,
  };
}
