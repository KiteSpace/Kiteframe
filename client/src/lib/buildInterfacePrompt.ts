import type { Node, Edge } from '@/lib/kiteframe/types';

/**
 * Converts the current workflow's nodes and edges into a plain-English
 * prompt describing the user flow, suitable for the /api/ai/design endpoint.
 */
export function buildInterfacePromptFromWorkflow(
  nodes: Node[],
  edges: Edge[],
  workflowName?: string
): string {
  const name = workflowName?.trim() || 'Untitled Workflow';

  // Build adjacency map: sourceId → [targetId, edgeLabel?]
  const adjacency = new Map<string, { targetId: string; label?: string }[]>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const list = adjacency.get(edge.source) ?? [];
    list.push({ targetId: edge.target, label: edge.label as string | undefined });
    adjacency.set(edge.source, list);
  }

  // Build a node lookup
  const nodeById = new Map<string, Node>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
  }

  // Format each node into a description line
  const lines: string[] = [];
  for (const node of nodes) {
    const label = node.data?.label || node.id;
    const description = node.data?.description ? ` — ${node.data.description}` : '';
    const type = node.type || 'process';
    const targets = adjacency.get(node.id) ?? [];
    const connections =
      targets.length === 0
        ? ''
        : ' → ' +
          targets
            .map(({ targetId, label: edgeLabel }) => {
              const targetNode = nodeById.get(targetId);
              const targetLabel = targetNode?.data?.label || targetId;
              return edgeLabel ? `${targetLabel} (${edgeLabel})` : targetLabel;
            })
            .join(', ');

    lines.push(`[${type}] ${label}${description}${connections}`);
  }

  const nodeCount = nodes.length;
  const edgeCount = edges.filter((e) => e.source && e.target).length;

  return (
    `Generate a UI interface design for a product called "${name}". ` +
    `This interface is based on a workflow with ${nodeCount} steps and ${edgeCount} connections. ` +
    `Design a clean, modern interface that visually represents these workflow steps as an interactive UI:\n\n` +
    lines.join('\n') +
    `\n\nCreate a cohesive interface design that a user would see when interacting with this product. ` +
    `Use cards, sections, and appropriate Astryx components to represent each step. ` +
    `The design should feel polished and production-ready.`
  );
}
