import type { Node, Edge } from '@/lib/kiteframe/types';
import type { ProposedWorkflow, ProposalVariant, NodeUpdate } from '@/hooks/useProposalState';
import type { AiClient } from '@/ai/types';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';
import type { RouterMetadata } from '@/ai/router/types';
import { getRouter, extractJSON } from '@/ai/router';
import { 
  getPatternGuidance, 
  getScopeGuidance, 
  getNodeCountConstraints,
  validateProposalOutput,
  sanitizeOutput,
  getHeuristicBias,
  ENABLE_PHASE_4_HEURISTICS,
} from '@/ai/heuristics';

interface GenerateProposalOptions {
  insight: Insight;
  snapshotNodes: Node[];
  snapshotEdges: Edge[];
  aiClient?: AiClient;
  sessionId?: string;
}

export interface GenerateProposalResult {
  proposal: ProposedWorkflow;
  routerMetadata?: RouterMetadata;
}

interface ParsedVariant {
  title: string;
  description: string;
  nodes: Array<{
    label: string;
    description?: string;
    type?: string;
  }>;
  edges: Array<{
    from: number | string;
    to: number | string;
    label?: string;
  }>;
  nodeUpdates?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
}

interface ParsedDualProposal {
  proposed: ParsedVariant;
  alternative: ParsedVariant;
}

/**
 * Generate dual surgical proposals to address a specific Insight
 * 
 * Phase 2 Constraints:
 * - Scoped to a single Insight
 * - Returns BOTH proposed and alternative variants in one call
 * - Both variants are cached together
 * - No regeneration on variant toggle
 * - Returns only NEW nodes/edges (surgical additions)
 * - Does not replace or duplicate existing nodes
 */
export async function generateProposedWorkflow(
  options: GenerateProposalOptions
): Promise<GenerateProposalResult> {
  const { insight, snapshotNodes, snapshotEdges, sessionId } = options;
  
  const affectedNodeIds = insight.relatedNodeIds.length > 0 
    ? insight.relatedNodeIds 
    : [];
  
  const affectedNodes = snapshotNodes.filter(n => affectedNodeIds.includes(n.id));
  
  const affectedNodeContext = affectedNodes.length > 0
    ? affectedNodes.map(n => ({
        id: n.id,
        label: n.data?.label || n.id,
        type: n.type,
        description: n.data?.description || '',
      }))
    : [];

  const patternGuidance = ENABLE_PHASE_4_HEURISTICS ? getPatternGuidance(insight) : '';
  const scopeGuidance = ENABLE_PHASE_4_HEURISTICS ? getScopeGuidance(insight, affectedNodes.length) : '';
  const nodeConstraints = ENABLE_PHASE_4_HEURISTICS 
    ? getNodeCountConstraints(insight, affectedNodes.length) 
    : { min: 1, max: 4 };
  const heuristicBias = ENABLE_PHASE_4_HEURISTICS 
    ? getHeuristicBias() 
    : { preferAlternative: false, reduceScope: false, increaseValidation: false };

  const systemPrompt = `You are a workflow design assistant. Generate TWO DISTINCT surgical additions to address a specific insight.

CRITICAL RULES:
1. Generate ONLY NEW nodes and edges to add to the existing workflow
2. Do NOT recreate or replace existing nodes
3. Connect new nodes to existing origin nodes using their exact IDs
4. Both variants must be different approaches to solving the same insight
5. This is an addition, not a replacement
6. If any origin node is marked as UNNAMED/GENERIC, you MUST include a nodeUpdates entry for it with a meaningful label and description based on the insight and workflow context

Respond with valid JSON only, no markdown code blocks.

Schema:
{
  "proposed": {
    "title": "Short title for primary recommendation",
    "description": "2-3 sentence explanation",
    "nodes": [
      { "label": "New Node Name", "description": "What this step does", "type": "process" }
    ],
    "edges": [
      { "from": "existing-node-id-or-index", "to": 0, "label": "optional" }
    ],
    "nodeUpdates": [
      { "id": "existing-node-id", "label": "Meaningful Name", "description": "What this step does" }
    ]
  },
  "alternative": {
    "title": "Short title for alternative approach",
    "description": "2-3 sentence explanation of different approach",
    "nodes": [
      { "label": "New Node Name", "description": "What this step does", "type": "process" }
    ],
    "edges": [
      { "from": "existing-node-id-or-index", "to": 0, "label": "optional" }
    ],
    "nodeUpdates": [
      { "id": "existing-node-id", "label": "Meaningful Name", "description": "What this step does" }
    ]
  }
}

nodeUpdates is OPTIONAL and only used when an origin node needs to be named/described.
Node types: input, process, condition, output
Edge "from" and "to" can be:
- An existing node ID (string) to connect to the origin workflow
- A 0-indexed number referencing your NEW nodes array for that variant

Each variant MUST include at least one edge connecting to an existing node.
The two variants should represent meaningfully different approaches.`;

  function isGenericLabel(label: string, nodeId: string): boolean {
    if (!label || label.trim() === '') return true;
    if (label === nodeId) return true;
    if (label.trim().length <= 3) return true;
    const lower = label.toLowerCase().trim();
    if (['new process', 'process', 'new node', 'node', 'untitled', 'step'].includes(lower)) return true;
    if (/^node[-_]?[a-z0-9]{4,}$/i.test(label)) return true;
    return false;
  }

  const genericNodeIds = new Set(
    affectedNodeContext
      .filter(n => isGenericLabel(n.label, n.id))
      .map(n => n.id)
  );

  const originNodeList = affectedNodeContext.length > 0
    ? `Origin nodes (you should connect to these):\n${affectedNodeContext.map(n => {
        const tag = genericNodeIds.has(n.id) ? ' [UNNAMED/GENERIC — add a nodeUpdates entry for this node]' : '';
        return `- ID: "${n.id}" | Label: "${n.label}" | Type: ${n.type}${tag}`;
      }).join('\n')}`
    : 'No specific origin nodes identified. Generate standalone improvement nodes.';

  const biasNote = heuristicBias.preferAlternative 
    ? 'Note: The "alternative" approach may be better suited based on previous interactions.'
    : '';
  
  const scopeNote = heuristicBias.reduceScope
    ? 'Keep proposals minimal and focused - smaller is better.'
    : '';

  const heuristicSection = ENABLE_PHASE_4_HEURISTICS && (patternGuidance || scopeGuidance || biasNote || scopeNote)
    ? `
HEURISTIC GUIDANCE (follow these constraints):
${patternGuidance}
${scopeGuidance}
${biasNote}
${scopeNote}
`
    : '';

  const nodeCountInstruction = ENABLE_PHASE_4_HEURISTICS
    ? `Generate TWO different surgical additions (${nodeConstraints.min}-${nodeConstraints.max} new nodes each) that address this insight.`
    : `Generate TWO different surgical additions (1-4 new nodes each) that address this insight.`;

  const userPrompt = `INSIGHT TO ADDRESS:
Title: ${insight.title}
Description: ${insight.description}
Category: ${insight.category}

${originNodeList}
${heuristicSection}
${nodeCountInstruction}
- "proposed": Your primary recommendation
- "alternative": A meaningfully different approach (not just rewording)

Both MUST connect to existing origin nodes and differ in structure/approach.`;

  const router = getRouter();
  const response = await router.chat({
    taskType: 'workflow_reasoning',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    sessionId,
  });

  const routerMetadata = response.metadata;
  const content = response.text || '';
  
  let parsed: ParsedDualProposal;
  try {
    const jsonStr = extractJSON(content);
    if (!jsonStr) {
      throw new Error('No valid JSON found in response');
    }
    parsed = JSON.parse(jsonStr);
    
    if (!parsed.proposed || !parsed.alternative) {
      throw new Error('Response missing proposed or alternative variant');
    }
  } catch (e) {
    throw new Error('Failed to parse AI response as valid dual-variant workflow JSON');
  }

  const timestamp = Date.now();
  
  const anchorPosition = affectedNodes.length > 0
    ? {
        x: Math.max(...affectedNodes.map(n => n.position.x)) + 300,
        y: affectedNodes.reduce((sum, n) => sum + n.position.y, 0) / affectedNodes.length,
      }
    : { x: 200, y: 200 };

  const buildVariant = (
    parsedVariant: ParsedVariant,
    variantPrefix: string,
    xOffset: number
  ): ProposalVariant => {
    const variantNodes: Node[] = parsedVariant.nodes.map((n, index) => ({
      id: `${variantPrefix}-node-${timestamp}-${index}`,
      type: (n.type as 'input' | 'process' | 'condition' | 'output') || 'process',
      position: {
        x: anchorPosition.x + xOffset + (index % 2) * 250,
        y: anchorPosition.y + Math.floor(index / 2) * 150,
      },
      data: {
        label: n.label,
        description: n.description || '',
      },
    }));

    const variantEdges: Edge[] = [];
    for (let i = 0; i < parsedVariant.edges.length; i++) {
      const e = parsedVariant.edges[i];
      
      let sourceId: string;
      let targetId: string;
      
      if (typeof e.from === 'string') {
        const existingNode = snapshotNodes.find(n => n.id === e.from);
        if (!existingNode) {
          console.warn(`Skipping edge: origin node "${e.from}" not found`);
          continue;
        }
        sourceId = e.from;
      } else {
        const sourceNode = variantNodes[e.from];
        if (!sourceNode) {
          console.warn(`Skipping edge: ${variantPrefix} node index ${e.from} out of range`);
          continue;
        }
        sourceId = sourceNode.id;
      }
      
      if (typeof e.to === 'string') {
        const existingNode = snapshotNodes.find(n => n.id === e.to);
        if (!existingNode) {
          console.warn(`Skipping edge: origin node "${e.to}" not found`);
          continue;
        }
        targetId = e.to;
      } else {
        const targetNode = variantNodes[e.to];
        if (!targetNode) {
          console.warn(`Skipping edge: ${variantPrefix} node index ${e.to} out of range`);
          continue;
        }
        targetId = targetNode.id;
      }
      
      variantEdges.push({
        id: `${variantPrefix}-edge-${timestamp}-${i}`,
        source: sourceId,
        target: targetId,
        data: {
          label: e.label || '',
        },
      });
    }

    const variantNodeUpdates: NodeUpdate[] = [];
    if (Array.isArray(parsedVariant.nodeUpdates)) {
      for (const u of parsedVariant.nodeUpdates) {
        if (
          typeof u.id === 'string' &&
          u.id.trim() &&
          typeof u.label === 'string' &&
          u.label.trim() &&
          affectedNodeIds.includes(u.id)
        ) {
          variantNodeUpdates.push({
            id: u.id,
            label: u.label.trim(),
            description: typeof u.description === 'string' ? u.description.trim() : '',
          });
        }
      }
    }

    return {
      nodes: variantNodes,
      edges: variantEdges,
      title: parsedVariant.title || 'Proposed Addition',
      description: parsedVariant.description || `Addition to address: ${insight.title}`,
      nodeUpdates: variantNodeUpdates.length > 0 ? variantNodeUpdates : undefined,
    };
  };

  let proposed = buildVariant(parsed.proposed, 'proposed', 0);
  let alternative = buildVariant(parsed.alternative, 'alternative', 0);

  const proposedValidation = validateProposalOutput(proposed.nodes, proposed.edges, snapshotNodes);
  const alternativeValidation = validateProposalOutput(alternative.nodes, alternative.edges, snapshotNodes);

  if (!proposedValidation.isValid) {
    console.warn('[Proposal] Proposed variant validation issues:', proposedValidation.errors);
    proposed = sanitizeOutput(proposed, snapshotNodes);
  }
  
  if (!alternativeValidation.isValid) {
    console.warn('[Proposal] Alternative variant validation issues:', alternativeValidation.errors);
    alternative = sanitizeOutput(alternative, snapshotNodes);
  }

  if (proposedValidation.warnings.length > 0) {
    console.warn('[Proposal] Proposed warnings:', proposedValidation.warnings);
  }
  
  if (alternativeValidation.warnings.length > 0) {
    console.warn('[Proposal] Alternative warnings:', alternativeValidation.warnings);
  }

  const finalProposedValidation = validateProposalOutput(proposed.nodes, proposed.edges, snapshotNodes);
  const finalAlternativeValidation = validateProposalOutput(alternative.nodes, alternative.edges, snapshotNodes);
  
  if (!finalProposedValidation.isValid && !finalAlternativeValidation.isValid) {
    throw new Error('Both proposal variants failed validation after sanitization');
  }

  return {
    proposal: {
      insightId: insight.id,
      insightTitle: insight.title,
      affectedNodeIds,
      proposed,
      alternative,
      activeVariant: 'proposed',
      generatedAt: timestamp,
      snapshotNodes,
      snapshotEdges,
    },
    routerMetadata,
  };
}
