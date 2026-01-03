import type { Node, Edge } from '@/lib/kiteframe/types';
import type { ProposedWorkflow } from '@/hooks/useProposalState';
import type { AiClient } from '@/ai/types';

interface GenerateProposalOptions {
  currentNodes: Node[];
  currentEdges: Edge[];
  insights?: Array<{ title: string; description: string }>;
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
    from: number;
    to: number;
    label?: string;
  }>;
}

/**
 * Generate a proposed workflow based on current context
 * 
 * Constraints:
 * - Single generation pass (no streaming regeneration)
 * - Results cached in component state for session duration
 * - Clone data immediately after generation
 * - Generate unique node and edge IDs
 * - Validate edge → node references before returning
 */
export async function generateProposedWorkflow(
  options: GenerateProposalOptions
): Promise<ProposedWorkflow> {
  const { currentNodes, currentEdges, insights = [], aiClient } = options;
  
  const currentWorkflowSummary = currentNodes.length > 0
    ? `Current workflow has ${currentNodes.length} nodes and ${currentEdges.length} connections.`
    : 'The canvas is currently empty.';
  
  const insightsSummary = insights.length > 0
    ? `Recent insights:\n${insights.map(i => `- ${i.title}: ${i.description}`).join('\n')}`
    : '';

  const systemPrompt = `You are a workflow design assistant. Generate a proposed workflow improvement.

Respond with valid JSON only, no markdown code blocks.

Schema:
{
  "title": "Short title for the proposed improvement",
  "description": "2-3 sentence explanation of the proposed workflow",
  "nodes": [
    { "label": "Node name", "description": "What this step does", "type": "process" }
  ],
  "edges": [
    { "from": 0, "to": 1, "label": "Connection label (optional)" }
  ]
}

Node types: input, process, condition, output
Edge "from" and "to" are 0-indexed references to the nodes array.`;

  const userPrompt = `${currentWorkflowSummary}

${insightsSummary}

Based on this context, propose an improved or enhanced workflow. Focus on:
1. Clear flow from input to output
2. Appropriate decision points
3. Error handling where relevant

Generate a workflow with 3-7 nodes.`;

  const response = await aiClient.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.text || '';
  
  // Parse the AI response
  let parsed: ParsedProposal;
  try {
    // Handle potential markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1]?.trim() || content.trim();
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Failed to parse AI response as valid workflow JSON');
  }

  // Generate unique IDs using timestamp
  const timestamp = Date.now();
  
  // Convert parsed nodes to workflow nodes with unique IDs
  const proposedNodes: Node[] = parsed.nodes.map((n, index) => ({
    id: `proposal-node-${timestamp}-${index}`,
    type: (n.type as 'input' | 'process' | 'condition' | 'output') || 'process',
    position: {
      x: 100 + (index % 3) * 250,
      y: 100 + Math.floor(index / 3) * 150,
    },
    data: {
      label: n.label,
      description: n.description || '',
    },
  }));

  // Convert parsed edges to workflow edges with validation
  const proposedEdges: Edge[] = [];
  for (let i = 0; i < parsed.edges.length; i++) {
    const e = parsed.edges[i];
    const sourceNode = proposedNodes[e.from];
    const targetNode = proposedNodes[e.to];
    
    // Validate edge references
    if (!sourceNode || !targetNode) {
      console.warn(`Skipping invalid edge: from=${e.from}, to=${e.to}`);
      continue;
    }
    
    proposedEdges.push({
      id: `proposal-edge-${timestamp}-${i}`,
      source: sourceNode.id,
      target: targetNode.id,
      data: {
        label: e.label || '',
      },
    });
  }

  return {
    nodes: proposedNodes,
    edges: proposedEdges,
    title: parsed.title || 'Proposed Workflow',
    description: parsed.description || 'An improved workflow based on your current context.',
    generatedAt: timestamp,
  };
}
