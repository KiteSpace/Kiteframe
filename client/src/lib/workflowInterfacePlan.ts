import type { Node, Edge } from '@/lib/kiteframe/types';
import {
  planningWorkflowSchema, formatInterfaceSpecs, type PlanningWorkflow,
} from '@shared/interfacePlan';
import { loadProjectPRD, loadWorkflowPRD, listWorkflowPRDs } from '@/lib/kiteframe/utils/prdStorage';

export function workflowToPlanningInput(
  nodes: Node[], edges: Edge[], name = 'Untitled workflow', description = '', context = '',
): PlanningWorkflow {
  return planningWorkflowSchema.parse({
    name, description, context,
    nodes: nodes.map(n => ({
      id: n.id, label: n.data?.label || n.id, type: n.type || 'process',
      description: n.data?.description || '',
      actor: typeof n.data?.actor === 'string' ? n.data.actor
        : typeof n.data?.role === 'string' ? n.data.role : '',
    })),
    edges: edges.map((e, i) => ({
      id: e.id || `edge-${i}`, source: e.source, target: e.target, label: e.label || '',
    })),
  });
}

/** Include the current workflow's Specs, not unrelated workflow documents. */
export function collectWorkflowInterfaceContext(tab: {
  id: string; name: string; projectUuid?: string | null; cloudProjectId?: string | null;
  metadata?: { description?: string };
  nodes?: Array<{ data?: { label?: unknown } }>;
}): string {
  const keys = Array.from(new Set([tab.projectUuid, tab.cloudProjectId, tab.id].filter(Boolean))) as string[];
  let projectSpec: unknown = null;
  const workflowSpecs = new Map<string, any>();
  for (const key of keys) {
    projectSpec ||= loadProjectPRD(key);
    // A workflow tab can contain several disconnected workflow groups.
    // All Specs stored under this project's key are relevant context.
    for (const workflowId of listWorkflowPRDs(key)) {
      const spec = loadWorkflowPRD(key, workflowId);
      if (spec && !workflowSpecs.has(workflowId)) workflowSpecs.set(workflowId, spec);
    }
  }
  const nodeLabels = (tab.nodes || []).map((n) => (typeof n.data?.label === 'string' ? n.data.label : '')).filter(Boolean);
  return formatInterfaceSpecs(projectSpec, Array.from(workflowSpecs.values()), nodeLabels);
}
