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
