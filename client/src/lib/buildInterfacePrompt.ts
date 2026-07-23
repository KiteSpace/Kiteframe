import type { Node, Edge } from '@/lib/kiteframe/types';

const PROMPT_CHAR_BUDGET = 7500;

/**
 * Converts the current workflow's nodes and edges into a plain-English
 * prompt describing the user flow, suitable for the /api/ai/design endpoint.
 *
 * For large workflows that would exceed the server's character limit, the node
 * list is trimmed: "input" and "output" typed nodes are always kept, then as
 * many remaining nodes as fit within the budget are appended, followed by a
 * condensed-count note.
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

  // Format a single node into a description line
  function formatNode(node: Node): string {
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
    return `[${type}] ${label}${description}${connections}`;
  }

  const nodeCount = nodes.length;
  const edgeCount = edges.filter((e) => e.source && e.target).length;

  const header =
    `Generate a UI interface design for a product called "${name}". ` +
    `This interface is based on a workflow with ${nodeCount} steps and ${edgeCount} connections. ` +
    `Design a clean, modern interface that visually represents these workflow steps as an interactive UI:\n\n`;

  const footer =
    `\n\nCreate a cohesive interface design that a user would see when interacting with this product. ` +
    `Use cards, sections, and appropriate Astryx components to represent each step. ` +
    `The design should feel polished and production-ready.`;

  // Build the full node lines list
  const allLines = nodes.map(formatNode);
  const fullBody = allLines.join('\n');

  // Fast path: fits within budget
  if (header.length + fullBody.length + footer.length <= PROMPT_CHAR_BUDGET) {
    return header + fullBody + footer;
  }

  // Trimming path: prioritise input/output nodes, then fill remaining budget
  const PRIORITY_TYPES = new Set(['input', 'output', 'condition']);
  const priorityNodes = nodes.filter((n) => PRIORITY_TYPES.has(n.type || ''));
  const otherNodes = nodes.filter((n) => !PRIORITY_TYPES.has(n.type || ''));

  const bodyBudget = PROMPT_CHAR_BUDGET - header.length - footer.length - 60; // 60 chars for the condensed note
  const keptLines: string[] = priorityNodes.map(formatNode);
  let used = keptLines.join('\n').length;

  for (const node of otherNodes) {
    const line = formatNode(node);
    const needed = (keptLines.length > 0 ? 1 : 0) + line.length; // +1 for '\n'
    if (used + needed > bodyBudget) break;
    keptLines.push(line);
    used += needed;
  }

  const condensedCount = nodeCount - keptLines.length;
  const condensedNote =
    condensedCount > 0 ? `\n(+ ${condensedCount} additional step${condensedCount === 1 ? '' : 's'} condensed)` : '';

  return header + keptLines.join('\n') + condensedNote + footer;
}
