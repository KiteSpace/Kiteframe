import type { Node, Edge } from '../lib/kiteframe/types';

export interface WorkflowGroup {
  id: string;
  label: string;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  nodeCount: number;
}

export function detectWorkflowGroups(nodes: Node[], edges: Edge[]): WorkflowGroup[] {
  if (nodes.length === 0) return [];

  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  const edgesByNode = new Map<string, string[]>();

  for (const edge of edges) {
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) {
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
      if (!edgesByNode.has(edge.source)) edgesByNode.set(edge.source, []);
      if (!edgesByNode.has(edge.target)) edgesByNode.set(edge.target, []);
      edgesByNode.get(edge.source)!.push(edge.id);
      edgesByNode.get(edge.target)!.push(edge.id);
    }
  }

  const visited = new Set<string>();
  const groups: WorkflowGroup[] = [];
  let groupIndex = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const component = new Set<string>();
    const queue = [node.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (component.has(current)) continue;
      component.add(current);
      visited.add(current);
      const neighbors = adjacency.get(current);
      if (neighbors) {
        for (const n of Array.from(neighbors)) {
          if (!component.has(n)) queue.push(n);
        }
      }
    }

    const groupEdgeIds = new Set<string>();
    for (const edge of edges) {
      if (component.has(edge.source) && component.has(edge.target)) {
        groupEdgeIds.add(edge.id);
      }
    }

    const incomingCount = new Map<string, number>();
    for (const nid of Array.from(component)) incomingCount.set(nid, 0);
    for (const edge of edges) {
      if (component.has(edge.target) && component.has(edge.source)) {
        incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
      }
    }

    let startNodeId: string | undefined;
    for (const [nid, count] of Array.from(incomingCount)) {
      if (count === 0) { startNodeId = nid; break; }
    }
    if (!startNodeId) startNodeId = Array.from(component)[0];

    const startNode = nodes.find(n => n.id === startNodeId);
    const label = (startNode?.data as any)?.label || `Workflow ${groupIndex + 1}`;

    groups.push({
      id: `group-${groupIndex}`,
      label,
      nodeIds: component,
      edgeIds: groupEdgeIds,
      nodeCount: component.size,
    });
    groupIndex++;
  }

  // A workflow requires at least 2 connected nodes. Single isolated nodes are
  // not workflows and should not appear as selectable chips in the UI.
  return groups.filter(g => g.nodeCount >= 2);
}
