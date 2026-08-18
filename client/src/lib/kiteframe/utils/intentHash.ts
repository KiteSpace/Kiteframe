import type { Node, Edge } from '../types';

export interface WorkflowSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export function computeIntentHash(snapshot: WorkflowSnapshot): string {
  const nodeSignatures = snapshot.nodes
    .map(node => ({
      id: node.id,
      type: node.type || 'default',
      label: node.data?.label || node.data?.title || '',
      content: node.data?.content || node.data?.description || '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const edgeSignatures = snapshot.edges
    .map(edge => ({
      source: edge.source,
      target: edge.target,
      label: edge.label || '',
    }))
    .sort((a, b) => `${a.source}-${a.target}`.localeCompare(`${b.source}-${b.target}`));

  const hashInput = JSON.stringify({ nodes: nodeSignatures, edges: edgeSignatures });
  return simpleHash(hashInput);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export type ChangeType = 'major' | 'minor' | 'none';

export interface ChangeAnalysis {
  type: ChangeType;
  reasons: string[];
}

export function analyzeChange(
  before: WorkflowSnapshot,
  after: WorkflowSnapshot
): ChangeAnalysis {
  const reasons: string[] = [];

  const beforeNodeIds = new Set(before.nodes.map(n => n.id));
  const afterNodeIds = new Set(after.nodes.map(n => n.id));

  const addedNodes = after.nodes.filter(n => !beforeNodeIds.has(n.id));
  const removedNodes = before.nodes.filter(n => !afterNodeIds.has(n.id));

  if (addedNodes.length > 0) {
    reasons.push(`${addedNodes.length} node(s) added`);
  }
  if (removedNodes.length > 0) {
    reasons.push(`${removedNodes.length} node(s) deleted`);
  }

  const beforeEdgeKeys = new Set(before.edges.map(e => `${e.source}->${e.target}`));
  const afterEdgeKeys = new Set(after.edges.map(e => `${e.source}->${e.target}`));

  const addedEdges = after.edges.filter(e => !beforeEdgeKeys.has(`${e.source}->${e.target}`));
  const removedEdges = before.edges.filter(e => !afterEdgeKeys.has(`${e.source}->${e.target}`));

  if (addedEdges.length > 0) {
    reasons.push(`${addedEdges.length} edge(s) added`);
  }
  if (removedEdges.length > 0) {
    reasons.push(`${removedEdges.length} edge(s) deleted`);
  }

  const commonNodeIds = before.nodes
    .filter(n => afterNodeIds.has(n.id))
    .map(n => n.id);

  for (const nodeId of commonNodeIds) {
    const beforeNode = before.nodes.find(n => n.id === nodeId)!;
    const afterNode = after.nodes.find(n => n.id === nodeId)!;

    if (beforeNode.type !== afterNode.type) {
      reasons.push(`Node "${nodeId}" type changed`);
    }

    const beforeLabel = beforeNode.data?.label || beforeNode.data?.title || '';
    const afterLabel = afterNode.data?.label || afterNode.data?.title || '';
    if (beforeLabel !== afterLabel) {
      reasons.push(`Node "${nodeId}" label changed`);
    }

    const beforeContent = beforeNode.data?.content || beforeNode.data?.description || '';
    const afterContent = afterNode.data?.content || afterNode.data?.description || '';
    if (beforeContent !== afterContent) {
      reasons.push(`Node "${nodeId}" content changed`);
    }
  }

  const beforeConnectedComponents = countConnectedComponents(before);
  const afterConnectedComponents = countConnectedComponents(after);
  if (beforeConnectedComponents !== afterConnectedComponents) {
    reasons.push(`Workflow split/merged (${beforeConnectedComponents} → ${afterConnectedComponents} components)`);
  }

  if (reasons.length > 0) {
    return { type: 'major', reasons };
  }

  const beforeHash = computeIntentHash(before);
  const afterHash = computeIntentHash(after);

  if (beforeHash !== afterHash) {
    return { type: 'minor', reasons: ['Minor structural changes detected'] };
  }

  return { type: 'none', reasons: [] };
}

function countConnectedComponents(snapshot: WorkflowSnapshot): number {
  if (snapshot.nodes.length === 0) return 0;

  const adjacency: Map<string, Set<string>> = new Map();
  
  for (const node of snapshot.nodes) {
    if (!adjacency.has(node.id)) {
      adjacency.set(node.id, new Set());
    }
  }

  for (const edge of snapshot.edges) {
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) {
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    }
  }

  const visited = new Set<string>();
  let components = 0;

  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const neighbors = adjacency.get(nodeId);
    if (neighbors) {
      Array.from(neighbors).forEach(neighbor => dfs(neighbor));
    }
  }

  snapshot.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      components++;
      dfs(node.id);
    }
  });

  return components;
}

export function isPositionOnlyChange(
  before: WorkflowSnapshot,
  after: WorkflowSnapshot
): boolean {
  if (before.nodes.length !== after.nodes.length) return false;
  if (before.edges.length !== after.edges.length) return false;

  const afterNodeMap = new Map(after.nodes.map(n => [n.id, n]));

  for (let i = 0; i < before.nodes.length; i++) {
    const beforeNode = before.nodes[i];
    const afterNode = afterNodeMap.get(beforeNode.id);
    if (!afterNode) return false;

    if (beforeNode.type !== afterNode.type) return false;
    if ((beforeNode.data?.label || '') !== (afterNode.data?.label || '')) return false;
    if ((beforeNode.data?.content || '') !== (afterNode.data?.content || '')) return false;
    if ((beforeNode.data?.title || '') !== (afterNode.data?.title || '')) return false;
  }

  const beforeEdgeSet = new Set(before.edges.map(e => `${e.source}->${e.target}:${e.label || ''}`));
  const afterEdgeSet = new Set(after.edges.map(e => `${e.source}->${e.target}:${e.label || ''}`));

  if (beforeEdgeSet.size !== afterEdgeSet.size) return false;
  const beforeEdgeArr = Array.from(beforeEdgeSet);
  for (let i = 0; i < beforeEdgeArr.length; i++) {
    if (!afterEdgeSet.has(beforeEdgeArr[i])) return false;
  }

  return true;
}
