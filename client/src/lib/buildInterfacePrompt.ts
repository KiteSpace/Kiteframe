import type { Node, Edge } from '@/lib/kiteframe/types';

const PROMPT_CHAR_BUDGET = 7500;

// ─── Screen-cluster detection ─────────────────────────────────────────────────
//
// Groups workflow nodes into logical UI screens using a type-agnostic approach:
//   1. Topological sort (Kahn's algorithm) orders nodes by dependency.
//   2. The sorted list is divided into equal-sized chunks.
//   3. targetScreenCount = clamp(ceil(N / 4), 2, 5) keeps groups meaningful.
//   4. Each chunk becomes a screen named after its first node's label.
//   5. Returns null for workflows with fewer than 6 nodes — use single artboard.
//
// This deliberately avoids any node.type checks because nodes are content-agnostic
// (no 'input' / 'output' / 'ai' semantics exist on real workflow nodes).
//
function detectScreenClusters(
  nodes: Node[],
  edges: Edge[],
): Array<{ name: string; nodes: Node[] }> | null {
  if (nodes.length < 6) return null;

  const nodeSet = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const children = new Map<string, string[]>();

  for (const e of edges) {
    if (!e.source || !e.target) continue;
    if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) continue;
    const ch = children.get(e.source) ?? [];
    ch.push(e.target);
    children.set(e.source, ch);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  // Kahn's topological sort — seed queue with all zero-in-degree nodes
  const queue: string[] = [];
  for (const n of nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) queue.push(n.id);
  }
  const sorted: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    sorted.push(curr);
    for (const child of children.get(curr) ?? []) {
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0 && !visited.has(child)) queue.push(child);
    }
  }

  // Append any nodes not reached (cycles, disconnected sub-graphs)
  for (const n of nodes) {
    if (!visited.has(n.id)) sorted.push(n.id);
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const N = sorted.length;
  const targetScreenCount = Math.min(5, Math.max(2, Math.ceil(N / 4)));
  const chunkSize = Math.ceil(N / targetScreenCount);

  const clusters: Array<{ name: string; nodes: Node[] }> = [];
  for (let i = 0; i < sorted.length; i += chunkSize) {
    const chunk = sorted
      .slice(i, i + chunkSize)
      .map((id) => nodeById.get(id))
      .filter((n): n is Node => n !== undefined);
    if (chunk.length === 0) continue;
    const firstName = chunk[0].data?.label || chunk[0].id;
    clusters.push({ name: firstName, nodes: chunk });
  }

  return clusters.length >= 2 ? clusters : null;
}

/**
 * Returns the auto-detected screen clusters for a workflow without building
 * a full prompt string. The generation flow calls this first to decide whether
 * a screen-picker modal is needed before the API call.
 *
 * Returns null when the workflow is too small for multi-screen detection.
 */
export function analyzeWorkflowScreens(
  nodes: Node[],
  edges: Edge[],
): Array<{ name: string; nodes: Node[] }> | null {
  return detectScreenClusters(nodes, edges);
}

/**
 * Converts the current workflow's nodes and edges into a plain-English prompt
 * describing the user flow, suitable for the /api/ai/design endpoint.
 *
 * When the workflow has enough nodes (≥ 6) the function runs a screen-clustering
 * pass and emits an explicit SCREEN MAPPING section that instructs the AI to
 * generate one AstryxArtboard per screen. Small workflows fall back to a
 * single-artboard instruction.
 *
 * Pass `selectedClusters` to override auto-detection with a user-chosen subset
 * of screens (e.g. from the InterfaceScreenPickerModal). Pass `null` to force
 * the single-screen path. Omit (undefined) to auto-detect.
 *
 * For large workflows that would exceed the server's character limit the node
 * list is trimmed from the end, preserving topological order.
 */
export function buildInterfacePromptFromWorkflow(
  nodes: Node[],
  edges: Edge[],
  workflowName?: string,
  selectedClusters?: Array<{ name: string; nodes: Node[] }> | null,
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

  // Resolve clusters: explicit override → auto-detect → null (single-screen)
  const clusters =
    selectedClusters !== undefined
      ? selectedClusters
      : detectScreenClusters(nodes, edges);

  const isMultiScreen = clusters !== null && clusters.length >= 2;

  // Effective nodes for the body: restrict to cluster nodes when multi-screen
  // so the prompt only references the selected screens
  const effectiveNodes = isMultiScreen ? clusters!.flatMap((c) => c.nodes) : nodes;

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
  const allLines = effectiveNodes.map(formatNode);
  const fullBody = allLines.join('\n');

  // Fast path: fits within budget
  if (
    header.length + screenMappingSection.length + fullBody.length + footer.length <=
    PROMPT_CHAR_BUDGET
  ) {
    return header + screenMappingSection + fullBody + footer;
  }

  // Trimming path: preserve topological order, trim from the end
  const overhead = header.length + screenMappingSection.length + footer.length + 60;
  const bodyBudget = PROMPT_CHAR_BUDGET - overhead;
  const keptLines: string[] = [];
  let used = 0;

  for (const node of effectiveNodes) {
    const line = formatNode(node);
    const needed = (keptLines.length > 0 ? 1 : 0) + line.length;
    if (used + needed > bodyBudget) break;
    keptLines.push(line);
    used += needed;
  }

  const condensedCount = effectiveNodes.length - keptLines.length;
  const condensedNote =
    condensedCount > 0
      ? `\n(+ ${condensedCount} additional step${condensedCount === 1 ? '' : 's'} condensed)`
      : '';

  return header + screenMappingSection + keptLines.join('\n') + condensedNote + footer;
}
