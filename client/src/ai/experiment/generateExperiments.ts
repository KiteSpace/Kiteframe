import type { Node, Edge } from '@/lib/kiteframe/types';
import type { Experiment, ExperimentSession } from '@/hooks/useExperimentState';
import type { AiClient } from '@/ai/types';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';
import {
  getExperimentDiversityGuidance,
  validateExperimentDiversity,
  validateExperimentOutput,
  sanitizeOutput,
  ENABLE_PHASE_4_HEURISTICS,
} from '@/ai/heuristics';

interface GenerateExperimentsOptions {
  insight: Insight;
  snapshotNodes: Node[];
  snapshotEdges: Edge[];
  aiClient: AiClient;
}

interface ParsedExperiment {
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

interface ParsedExperimentsResponse {
  experiments: ParsedExperiment[];
}

/**
 * Generate 4 experiments to pressure-test assumptions
 * 
 * Phase 3 Constraints:
 * - Single AI call returning exactly 4 experiments
 * - All experiments generated together and cached
 * - Returns only NEW nodes/edges (surgical additions)
 * - Does not replace or duplicate existing nodes
 * - Experiments are provocations, not solutions
 */
export async function generateExperiments(
  options: GenerateExperimentsOptions
): Promise<ExperimentSession> {
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

  const systemPrompt = `You are a workflow design assistant. Generate FOUR distinct experiments to pressure-test a specific insight.

CRITICAL RULES:
1. Generate exactly 4 experiments
2. Experiments are provocations to reveal risks, edge cases, or opportunities
3. Generate ONLY NEW nodes and edges to add
4. Do NOT recreate or replace existing nodes
5. Connect new nodes to existing origin nodes using their exact IDs
6. Each experiment should challenge assumptions differently

Respond with valid JSON only, no markdown code blocks.

Schema:
{
  "experiments": [
    {
      "title": "Short experiment title",
      "description": "1-2 sentence explanation of what this tests",
      "nodes": [
        { "label": "Node Name", "description": "What this tests", "type": "process" }
      ],
      "edges": [
        { "from": "existing-node-id-or-index", "to": 0, "label": "optional" }
      ]
    }
  ]
}

Node types: input, process, condition, output
Edge "from" and "to" can be:
- An existing node ID (string) to connect to the origin workflow
- A 0-indexed number referencing your NEW nodes array for that experiment

Each experiment MUST connect to an existing origin node.
Generate exactly 4 experiments with different approaches.`;

  const originNodeList = affectedNodeContext.length > 0
    ? `Origin nodes (connect to these):\n${affectedNodeContext.map(n => 
        `- ID: "${n.id}" | Label: "${n.label}" | Type: ${n.type}`
      ).join('\n')}`
    : 'No specific origin nodes identified. Generate standalone experiment nodes.';

  const diversityGuidance = ENABLE_PHASE_4_HEURISTICS 
    ? getExperimentDiversityGuidance(insight) 
    : '';

  const userPrompt = `INSIGHT TO EXPERIMENT WITH:
Title: ${insight.title}
Description: ${insight.description}
Category: ${insight.category}

${originNodeList}

${diversityGuidance}

Generate FOUR experiments (1-3 new nodes each) where each experiment tests a DIFFERENT risk.
These are what-if explorations, not recommendations.`;

  const response = await aiClient.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.text || '';
  
  let parsed: ParsedExperimentsResponse;
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1]?.trim() || content.trim();
    parsed = JSON.parse(jsonStr);
    
    if (!parsed.experiments || !Array.isArray(parsed.experiments)) {
      throw new Error('Response missing experiments array');
    }
    
    // Ensure exactly 4 experiments
    if (parsed.experiments.length < 4) {
      // Pad with placeholder experiments if needed
      while (parsed.experiments.length < 4) {
        parsed.experiments.push({
          title: `Experiment ${parsed.experiments.length + 1}`,
          description: 'Additional exploration of this insight',
          nodes: [],
          edges: [],
        });
      }
    } else if (parsed.experiments.length > 4) {
      parsed.experiments = parsed.experiments.slice(0, 4);
    }
  } catch (e) {
    throw new Error('Failed to parse AI response as valid experiments JSON');
  }

  const timestamp = Date.now();
  
  const anchorPosition = affectedNodes.length > 0
    ? {
        x: Math.max(...affectedNodes.map(n => n.position.x)) + 300,
        y: affectedNodes.reduce((sum, n) => sum + n.position.y, 0) / affectedNodes.length,
      }
    : { x: 200, y: 200 };

  const experiments: Experiment[] = parsed.experiments.map((exp, expIndex) => {
    const experimentId = `exp-${timestamp}-${expIndex}`;
    
    const variantNodes: Node[] = exp.nodes.map((n, nodeIndex) => ({
      id: `${experimentId}-node-${nodeIndex}`,
      type: (n.type as 'input' | 'process' | 'condition' | 'output') || 'process',
      position: {
        x: anchorPosition.x + (nodeIndex % 2) * 250,
        y: anchorPosition.y + expIndex * 50 + Math.floor(nodeIndex / 2) * 150,
      },
      data: {
        label: n.label,
        description: n.description || '',
      },
    }));

    const variantEdges: Edge[] = [];
    
    for (const edge of exp.edges) {
      let sourceId: string;
      let targetId: string;
      
      // Resolve source
      if (typeof edge.from === 'number') {
        if (edge.from >= 0 && edge.from < variantNodes.length) {
          sourceId = variantNodes[edge.from].id;
        } else {
          continue;
        }
      } else {
        sourceId = edge.from;
      }
      
      // Resolve target
      if (typeof edge.to === 'number') {
        if (edge.to >= 0 && edge.to < variantNodes.length) {
          targetId = variantNodes[edge.to].id;
        } else {
          continue;
        }
      } else {
        targetId = edge.to;
      }
      
      variantEdges.push({
        id: `${experimentId}-edge-${variantEdges.length}`,
        source: sourceId,
        target: targetId,
        type: 'bezier',
        data: edge.label ? { label: edge.label } : undefined,
      });
    }

    return {
      id: experimentId,
      insightId: insight.id,
      affectedNodeIds,
      title: exp.title,
      description: exp.description,
      variant: {
        nodes: variantNodes,
        edges: variantEdges,
      },
    };
  });

  if (ENABLE_PHASE_4_HEURISTICS) {
    const diversityValidation = validateExperimentDiversity(
      experiments.map(e => ({ title: e.title, description: e.description }))
    );
    
    if (!diversityValidation.isValid) {
      console.warn('[Experiment] Diversity validation issues:', diversityValidation.issues);
    }
  }

  const outputValidation = validateExperimentOutput(
    experiments.map(e => ({
      id: e.id,
      title: e.title,
      nodes: e.variant.nodes,
      edges: e.variant.edges,
    })),
    snapshotNodes
  );

  if (!outputValidation.isValid) {
    console.warn('[Experiment] Output validation errors:', outputValidation.errors);
  }
  
  if (outputValidation.warnings.length > 0) {
    console.warn('[Experiment] Output warnings:', outputValidation.warnings);
  }

  const sanitizedExperiments = experiments.map(exp => ({
    ...exp,
    variant: sanitizeOutput(exp.variant, snapshotNodes),
  }));

  return {
    insightId: insight.id,
    insightTitle: insight.title,
    affectedNodeIds,
    experiments: sanitizedExperiments,
    activeExperimentId: null,
    generatedAt: timestamp,
    snapshotNodes,
    snapshotEdges,
  };
}
