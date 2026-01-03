import type { Node, Edge } from '@/lib/kiteframe/types';
import type { ProposedWorkflow, ProposalVariant } from '@/hooks/useProposalState';
import type { AiClient } from '@/ai/types';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';

interface GenerateProposalOptions {
  insight: Insight;
  snapshotNodes: Node[];
  snapshotEdges: Edge[];
  aiClient: AiClient;
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
): Promise<ProposedWorkflow> {
  const { insight, snapshotNodes, snapshotEdges, aiClient } = options;
  
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

  const systemPrompt = `You are a workflow design assistant. Generate TWO DISTINCT surgical additions to address a specific insight.

CRITICAL RULES:
1. Generate ONLY NEW nodes and edges to add to the existing workflow
2. Do NOT recreate or replace existing nodes
3. Connect new nodes to existing origin nodes using their exact IDs
4. Both variants must be different approaches to solving the same insight
5. This is an addition, not a replacement

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
    ]
  }
}

Node types: input, process, condition, output
Edge "from" and "to" can be:
- An existing node ID (string) to connect to the origin workflow
- A 0-indexed number referencing your NEW nodes array for that variant

Each variant MUST include at least one edge connecting to an existing node.
The two variants should represent meaningfully different approaches.`;

  const originNodeList = affectedNodeContext.length > 0
    ? `Origin nodes (you should connect to these):\n${affectedNodeContext.map(n => 
        `- ID: "${n.id}" | Label: "${n.label}" | Type: ${n.type}`
      ).join('\n')}`
    : 'No specific origin nodes identified. Generate standalone improvement nodes.';

  const userPrompt = `INSIGHT TO ADDRESS:
Title: ${insight.title}
Description: ${insight.description}
Category: ${insight.category}

${originNodeList}

Generate TWO different surgical additions (1-4 new nodes each) that address this insight.
- "proposed": Your primary recommendation
- "alternative": A different valid approach

Both should connect to the existing origin nodes.`;

  const response = await aiClient.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.text || '';
  
  let parsed: ParsedDualProposal;
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1]?.trim() || content.trim();
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

    return {
      nodes: variantNodes,
      edges: variantEdges,
      title: parsedVariant.title || 'Proposed Addition',
      description: parsedVariant.description || `Addition to address: ${insight.title}`,
    };
  };

  const proposed = buildVariant(parsed.proposed, 'proposed', 0);
  const alternative = buildVariant(parsed.alternative, 'alternative', 0);

  return {
    insightId: insight.id,
    insightTitle: insight.title,
    affectedNodeIds,
    proposed,
    alternative,
    activeVariant: 'proposed',
    generatedAt: timestamp,
    snapshotNodes,
    snapshotEdges,
  };
}
