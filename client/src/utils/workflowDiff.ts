/**
 * Workflow Diff Utilities
 * 
 * Helpers for computing node/edge deltas between workflow states.
 */

export interface WorkflowSnapshot {
  nodes: unknown[];
  edges: unknown[];
}

export interface WorkflowDelta {
  nodeDelta?: number;
  edgeDelta?: number;
}

export function computeWorkflowDelta(
  before?: WorkflowSnapshot | null,
  after?: WorkflowSnapshot | null
): WorkflowDelta {
  if (!before || !after) return {};
  return {
    nodeDelta: after.nodes.length - before.nodes.length,
    edgeDelta: after.edges.length - before.edges.length,
  };
}

export interface WorkflowNode {
  id: string;
  type?: string;
  data?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  data?: Record<string, unknown>;
}

export interface DetailedWorkflowDelta {
  nodesAdded: number;
  nodesModified: number;
  nodesRemoved: number;
  edgesAdded: number;
  edgesModified: number;
  edgesRemoved: number;
}

function hashNode(node: WorkflowNode): string {
  return JSON.stringify({
    id: node.id,
    type: node.type || 'process',
    label: (node.data as any)?.label || '',
  });
}

function hashEdge(edge: WorkflowEdge): string {
  return JSON.stringify({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: (edge.data as any)?.label || '',
  });
}

export function computeDetailedWorkflowDelta(
  before: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  after: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }
): DetailedWorkflowDelta {
  const beforeNodeIds = new Set(before.nodes.map(n => n.id));
  const afterNodeIds = new Set(after.nodes.map(n => n.id));
  const beforeEdgeKeys = new Map<string, string>();
  const afterEdgeKeys = new Map<string, string>();
  
  for (const e of before.edges) {
    beforeEdgeKeys.set(`${e.source}→${e.target}`, hashEdge(e));
  }
  for (const e of after.edges) {
    afterEdgeKeys.set(`${e.source}→${e.target}`, hashEdge(e));
  }
  
  let nodesAdded = 0;
  let nodesModified = 0;
  let nodesRemoved = 0;
  
  for (const node of after.nodes) {
    if (!beforeNodeIds.has(node.id)) {
      nodesAdded++;
    } else {
      const beforeNode = before.nodes.find(n => n.id === node.id);
      if (beforeNode && hashNode(beforeNode) !== hashNode(node)) {
        nodesModified++;
      }
    }
  }
  
  for (const node of before.nodes) {
    if (!afterNodeIds.has(node.id)) {
      nodesRemoved++;
    }
  }
  
  let edgesAdded = 0;
  let edgesModified = 0;
  let edgesRemoved = 0;
  
  Array.from(afterEdgeKeys.entries()).forEach(([key, hash]) => {
    if (!beforeEdgeKeys.has(key)) {
      edgesAdded++;
    } else if (beforeEdgeKeys.get(key) !== hash) {
      edgesModified++;
    }
  });
  
  Array.from(beforeEdgeKeys.keys()).forEach(key => {
    if (!afterEdgeKeys.has(key)) {
      edgesRemoved++;
    }
  });
  
  return {
    nodesAdded,
    nodesModified,
    nodesRemoved,
    edgesAdded,
    edgesModified,
    edgesRemoved,
  };
}
