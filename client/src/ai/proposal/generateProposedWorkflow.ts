import type { Node, Edge } from '@/lib/kiteframe/types';
import type { ProposedWorkflow } from '@/hooks/useProposalState';
import type { AiClient } from '@/ai/types';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';

interface GenerateProposalOptions {
  insight: Insight;
  snapshotNodes: Node[];
  snapshotEdges: Edge[];
  aiClient: AiClient;
}

interface ParsedProposal {
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

/**
 * Generate a surgical proposal to address a specific Insight
 * 
 * Constraints:
 * - Scoped to a single Insight
 * - Returns only NEW nodes/edges (surgical additions)
 * - Does not replace or duplicate existing nodes
 * - Includes attachment points to existing workflow
 * - Validates edge → node references
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

  const systemPrompt = `You are a workflow design assistant. Generate a SURGICAL addition to address a specific insight.

CRITICAL RULES:
1. Generate ONLY NEW nodes and edges to add to the existing workflow
2. Do NOT recreate or replace existing nodes
3. Connect new nodes to existing origin nodes using their exact IDs
4. This is an addition, not a replacement

Respond with valid JSON only, no markdown code blocks.

Schema:
{
  "title": "Short title describing what you're adding",
  "description": "2-3 sentence explanation of the addition",
  "nodes": [
    { "label": "New Node Name", "description": "What this new step does", "type": "process" }
  ],
  "edges": [
    { "from": "existing-node-id-or-index", "to": 0, "label": "Connection label (optional)" },
    { "from": 0, "to": 1 }
  ]
}

Node types: input, process, condition, output
Edge "from" and "to" can be:
- An existing node ID (string) to connect to the origin workflow
- A 0-indexed number referencing your NEW nodes array

You MUST include at least one edge connecting to an existing node to anchor the addition.`;

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

Generate a surgical addition (1-4 new nodes) that addresses this insight.
Connect your new nodes to the existing origin nodes to show how they integrate.`;

  const response = await aiClient.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.text || '';
  
  let parsed: ParsedProposal;
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1]?.trim() || content.trim();
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Failed to parse AI response as valid workflow JSON');
  }

  const timestamp = Date.now();
  
  const anchorPosition = affectedNodes.length > 0
    ? {
        x: Math.max(...affectedNodes.map(n => n.position.x)) + 300,
        y: affectedNodes.reduce((sum, n) => sum + n.position.y, 0) / affectedNodes.length,
      }
    : { x: 200, y: 200 };
  
  const proposedNodes: Node[] = parsed.nodes.map((n, index) => ({
    id: `proposal-node-${timestamp}-${index}`,
    type: (n.type as 'input' | 'process' | 'condition' | 'output') || 'process',
    position: {
      x: anchorPosition.x + (index % 2) * 250,
      y: anchorPosition.y + Math.floor(index / 2) * 150,
    },
    data: {
      label: n.label,
      description: n.description || '',
    },
  }));

  const proposedEdges: Edge[] = [];
  for (let i = 0; i < parsed.edges.length; i++) {
    const e = parsed.edges[i];
    
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
      const sourceNode = proposedNodes[e.from];
      if (!sourceNode) {
        console.warn(`Skipping edge: proposed node index ${e.from} out of range`);
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
      const targetNode = proposedNodes[e.to];
      if (!targetNode) {
        console.warn(`Skipping edge: proposed node index ${e.to} out of range`);
        continue;
      }
      targetId = targetNode.id;
    }
    
    proposedEdges.push({
      id: `proposal-edge-${timestamp}-${i}`,
      source: sourceId,
      target: targetId,
      data: {
        label: e.label || '',
      },
    });
  }

  return {
    insightId: insight.id,
    insightTitle: insight.title,
    affectedNodeIds,
    proposedNodes,
    proposedEdges,
    title: parsed.title || 'Proposed Addition',
    description: parsed.description || `Addition to address: ${insight.title}`,
    generatedAt: timestamp,
    snapshotNodes,
    snapshotEdges,
  };
}
