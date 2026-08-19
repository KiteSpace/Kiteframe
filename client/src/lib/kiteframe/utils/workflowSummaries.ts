/**
 * Detected workflows on the canvas, with the names the user gave them.
 *
 * Both the Project tab and the reader pane need to resolve "workflow-prd:<id>"
 * back to a concrete set of nodes, edges and a display name. Keeping the
 * detection in one place means the reader can never disagree with the rail
 * about which flow an id refers to or what it is called.
 */

import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { FlowDetection } from '@/lib/kiteframe/utils/FlowDetection';

export interface WorkflowSummary {
  id: string;
  name: string;
  nodeIds: string[];
  edgeIds: string[];
  nodeCount: number;
  edgeCount: number;
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
}

export interface StandaloneNodeSummary {
  nodeId: string;
  label: string;
}

const WORKFLOW_NAMES_KEY_PREFIX = 'kiteframe-workflow-names-';

export function getWorkflowName(
  projectId: string | undefined,
  workflowId: string,
  index: number,
): string {
  if (!projectId) return `Workflow ${index + 1}`;

  try {
    const saved = localStorage.getItem(`${WORKFLOW_NAMES_KEY_PREFIX}${projectId}`);
    if (saved) {
      const names = JSON.parse(saved);
      if (names[workflowId]) return names[workflowId];
    }
  } catch {}

  return `Workflow ${index + 1}`;
}

/**
 * Split the canvas into workflows (2+ connected nodes) and loose nodes.
 *
 * The 2-node/1-edge floor is what makes a flow a *workflow* rather than a
 * sticky note: a single unconnected node has no sequence to write a spec about.
 */
export function detectWorkflowSummaries(
  nodes: Node[],
  edges: Edge[],
  projectId?: string,
): { workflowSummaries: WorkflowSummary[]; standaloneNodes: StandaloneNodeSummary[] } {
  if (nodes.length === 0) {
    return { workflowSummaries: [], standaloneNodes: [] };
  }

  const flows = FlowDetection.detectFlows(nodes, edges);
  const workflows: WorkflowSummary[] = [];
  const standalone: StandaloneNodeSummary[] = [];

  flows.forEach(flow => {
    const nodeCount = flow.nodes.length;
    const edgeCount = flow.edges.length;

    if (nodeCount >= 2 && edgeCount >= 1) {
      workflows.push({
        id: flow.id,
        name: getWorkflowName(projectId, flow.id, workflows.length),
        nodeIds: flow.nodes.map(n => n.id),
        edgeIds: flow.edges.map(e => e.id),
        nodeCount,
        edgeCount,
        nodes: flow.nodes,
        edges: flow.edges,
      });
    } else {
      flow.nodes.forEach(node => {
        standalone.push({
          nodeId: node.id,
          label: node.data?.label || node.type || 'Node',
        });
      });
    }
  });

  return { workflowSummaries: workflows, standaloneNodes: standalone };
}
