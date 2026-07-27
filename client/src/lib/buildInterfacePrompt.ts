import type { Node, Edge } from '@/lib/kiteframe/types';

const PROMPT_CHAR_BUDGET = 7500;

// ─── Screen-cluster detection ─────────────────────────────────────────────────
//
// Analyses the workflow graph to find logical groups of nodes that belong to
// the same UI screen.  The heuristic:
//   • Any `input`-type node is treated as a screen entry-point (new screen start).
//   • A BFS from each entry-point collects all reachable nodes, stopping when it
//     would cross into another entry-point's territory.
//   • If the workflow has fewer than 2 input nodes we don't try to segment — the
//     single-artboard path is safer than making up boundaries.
//
// Returns an array of { name, nodes } clusters, one per detected screen.
// Returns null when multi-screen detection is not applicable (use single artboard).
//
function detectScreenClusters(
  nodes: Node[],
  edges: Edge[],
): Array<{ name: string; nodes: Node[] }> | null {
  if (nodes.length === 0) return null;

  // Build forward adjacency map
  const forward = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    const list = forward.get(edge.source) ?? [];
    list.push(edge.target);
    forward.set(edge.source, list);
  }

  const nodeById = new Map<string, Node>();
  for (const node of nodes) nodeById.set(node.id, node);

  // Find input-type nodes — these are the natural screen entry points
  const inputNodes = nodes.filter((n) => n.type === 'input');

  // Need at least 2 input nodes to produce a meaningful multi-screen layout.
  // With 0 or 1, fall back to single-screen.
  if (inputNodes.length < 2) return null;

  const entryIds = new Set(inputNodes.map((n) => n.id));
  const assigned = new Set<string>();
  const clusters: Array<{ name: string; nodeIds: string[] }> = [];

  // BFS from each entry point, stopping at other entry points
  for (const entry of inputNodes) {
    const clusterIds: string[] = [];
    const queue: string[] = [entry.id];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      // Stop if this node is another screen's entry point (but still enter our own)
      if (entryIds.has(curr) && curr !== entry.id) continue;

      // Skip nodes already claimed by an earlier screen
      if (assigned.has(curr)) continue;

      clusterIds.push(curr);
      assigned.add(curr);

      for (const nextId of forward.get(curr) ?? []) {
        if (!visited.has(nextId)) {
          // Only expand through non-entry nodes (entries stop the BFS)
          if (!entryIds.has(nextId)) {
            queue.push(nextId);
          }
        }
      }
    }

    const name = entry.data?.label || entry.id;
    clusters.push({ name, nodeIds: clusterIds });
  }

  // Assign any nodes that were never reached (e.g. isolated sub-graphs) to the
  // last cluster so they still appear somewhere in the output
  const lastCluster = clusters[clusters.length - 1];
  if (lastCluster) {
    for (const node of nodes) {
      if (!assigned.has(node.id)) {
        lastCluster.nodeIds.push(node.id);
      }
    }
  }

  // Convert nodeIds → Node objects, drop empty clusters
  const result = clusters
    .map((c) => ({
      name: c.name,
      nodes: c.nodeIds.map((id) => nodeById.get(id)!).filter(Boolean),
    }))
    .filter((c) => c.nodes.length > 0);

  // If clustering collapsed everything into 1 group, treat as single-screen
  return result.length >= 2 ? result : null;
}

/**
 * Converts the current workflow's nodes and edges into a plain-English prompt
 * describing the user flow, suitable for the /api/ai/design endpoint.
 *
 * When the workflow has 2+ `input`-type nodes the function runs a
 * screen-clustering pass and emits an explicit SCREEN MAPPING section that
 * instructs the AI to generate one AstryxArtboard per screen.  Single-screen
 * (or ambiguous) workflows fall back to a single-artboard instruction.
 *
 * For large workflows that would exceed the server's character limit the node
 * list is trimmed: "input", "output", and "condition" typed nodes are always
 * kept, then as many remaining nodes as fit within the budget are appended.
 */
export function buildInterfacePromptFromWorkflow(
  nodes: Node[],
  edges: Edge[],
  workflowName?: string,
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

  // Detect screen clusters
  const clusters = detectScreenClusters(nodes, edges);
  const isMultiScreen = clusters !== null && clusters.length >= 2;

  const nodeCount = nodes.length;
  const edgeCount = edges.filter((e) => e.source && e.target).length;

  // ── Header ────────────────────────────────────────────────────────────────
  const header = isMultiScreen
    ? `Generate a multi-screen UI interface design for a product called "${name}". ` +
      `This workflow has ${nodeCount} steps across ${clusters!.length} distinct screens. ` +
      `Generate one AstryxArtboard per screen as specified in the SCREEN MAPPING below.\n\n`
    : `Generate a UI interface design for a product called "${name}". ` +
      `This interface is based on a workflow with ${nodeCount} steps and ${edgeCount} connections. ` +
      `Design a clean, modern interface that visually represents these workflow steps as an interactive UI:\n\n`;

  // ── Screen Mapping section (multi-screen only) ────────────────────────────
  const screenMappingSection = isMultiScreen
    ? `SCREEN MAPPING:\n` +
      clusters!
        .map(
          (c) =>
            `Screen "${c.name}": ${c.nodes
              .map((n) => n.data?.label || n.id)
              .join(', ')}`,
        )
        .join('\n') +
      `\n\nWorkflow steps:\n`
    : '';

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = isMultiScreen
    ? `\n\nGenerate one AstryxArtboard for each screen in the SCREEN MAPPING above:\n` +
      `• Name each artboard exactly as listed (e.g. "${clusters![0].name}", "${clusters![1].name}")\n` +
      `• Place only that screen's relevant UI components inside its artboard\n` +
      `• Keep each artboard to 4–12 nodes — apply this cap per artboard, not across the whole design\n` +
      `• Show navigation context: where screen A leads to screen B, include a Button in screen A ` +
      `whose label implies the transition (e.g. "Sign In", "Go to ${clusters![1].name}", "Continue")\n` +
      `• The design should feel polished and production-ready`
    : `\n\nCreate a clean, polished interface design that a user would see when interacting with this product. ` +
      `Use cards, sections, and appropriate Astryx components to represent each step. ` +
      `The design should feel production-ready.`;

  // ── Build node lines ──────────────────────────────────────────────────────
  const allLines = nodes.map(formatNode);
  const fullBody = allLines.join('\n');

  // Fast path: fits within budget
  if (
    header.length +
      screenMappingSection.length +
      fullBody.length +
      footer.length <=
    PROMPT_CHAR_BUDGET
  ) {
    return header + screenMappingSection + fullBody + footer;
  }

  // Trimming path: prioritise input/output/condition nodes, then fill remaining budget
  const PRIORITY_TYPES = new Set(['input', 'output', 'condition']);
  const priorityNodes = nodes.filter((n) => PRIORITY_TYPES.has(n.type || ''));
  const otherNodes = nodes.filter((n) => !PRIORITY_TYPES.has(n.type || ''));

  const overhead = header.length + screenMappingSection.length + footer.length + 60;
  const bodyBudget = PROMPT_CHAR_BUDGET - overhead;
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
    condensedCount > 0
      ? `\n(+ ${condensedCount} additional step${condensedCount === 1 ? '' : 's'} condensed)`
      : '';

  return (
    header +
    screenMappingSection +
    keptLines.join('\n') +
    condensedNote +
    footer
  );
}
