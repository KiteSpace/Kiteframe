import type { Node, Edge, WildCardMode, WildCardNodeData } from '../../lib/kiteframe/types';
import type { AiClient, AiMessage } from '../types';
import { extractSemanticWorkflowModel } from '../../lib/kiteframe/utils/extractSemanticWorkflowModel';
import { generateNodeId } from '../../lib/kiteframe/factory/NodeFactory';

export interface WildCardGenerationInput {
  wildcardNode: Node;
  allNodes: Node[];
  allEdges: Edge[];
  workflowId: string;
  workflowName: string;
}

export interface GeneratedSpeculativeBranch {
  nodes: Node[];
  edges: Edge[];
  summary: string;
}

export interface WildCardGenerationResult {
  success: boolean;
  branch?: GeneratedSpeculativeBranch;
  error?: string;
}

const WILDCARD_SYSTEM_PROMPT = `You are a workflow analysis AI that generates speculative "what if" branches for workflow diagrams.

Given the current workflow context and a scenario/question, generate a plausible branch that explores the alternative path.

RULES:
1. Generate 2-5 nodes that represent the alternative scenario
2. Connect nodes logically with edges
3. Start from the wildcard node's position and extend outward
4. Use appropriate node types: 'process' for actions, 'condition' for decisions, 'output' for outcomes
5. Include at least one decision point if the scenario involves uncertainty
6. Label nodes and edges clearly and concisely

OUTPUT FORMAT (JSON only, no markdown):
{
  "nodes": [
    {
      "type": "process|condition|output",
      "label": "Node Label",
      "description": "Brief description of what this step does"
    }
  ],
  "edges": [
    {
      "sourceIndex": 0,
      "targetIndex": 1,
      "label": "Edge label (optional)"
    }
  ],
  "summary": "One sentence summary of the generated branch"
}

Where sourceIndex/targetIndex are 0-based indices into the nodes array.
Edge from sourceIndex -1 means connect from the wildcard node itself.`;

function generateEdgeId(): string {
  return `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function buildContextPrompt(input: WildCardGenerationInput): string {
  const { wildcardNode, allNodes, allEdges, workflowName } = input;
  const data = wildcardNode.data as WildCardNodeData;
  const mode = data.mode || 'whatif';
  
  const semanticModel = extractSemanticWorkflowModel(
    input.workflowId,
    workflowName,
    allNodes,
    allEdges,
    { includeSpeculative: false }
  );

  const nodesDesc = semanticModel.nodes.slice(0, 10).map(n => 
    `- ${n.label} (${n.type})${n.description ? `: ${n.description}` : ''}`
  ).join('\n');

  const incomingEdges = allEdges.filter(e => e.target === wildcardNode.id);
  const predecessors = incomingEdges.map(e => {
    const source = allNodes.find(n => n.id === e.source);
    return source?.data?.label || source?.type || 'Unknown';
  }).join(', ');

  let modePrompt = '';
  switch (mode) {
    case 'whatif':
      modePrompt = `SCENARIO: "${data.content || ''}"
CONSTRAINTS: ${data.constraints || 'None specified'}

Generate an alternative branch that explores this "what if" scenario. Consider:
- How would the workflow change if this scenario occurred?
- What additional steps or decisions would be needed?
- What outcomes are possible?`;
      break;
    case 'risk':
      modePrompt = `RISK: "${data.content || ''}"
IMPACT: ${data.impact || 'Unknown'}
MITIGATION: ${data.mitigation || 'None specified'}

Generate a risk mitigation branch that addresses this potential problem. Include:
- Detection or monitoring steps
- Response actions
- Recovery or fallback paths`;
      break;
    case 'enhancement':
      modePrompt = `ENHANCEMENT: "${data.content || ''}"
SUCCESS METRIC: ${data.metric || 'Not specified'}

Generate an enhancement branch that implements this improvement. Include:
- New process steps
- Any decision points
- Measurable outcomes`;
      break;
    case 'prompt':
      modePrompt = `FREEFORM PROMPT: "${data.content || ''}"

Generate a branch based on this prompt. Be creative but stay within workflow conventions.`;
      break;
  }

  return `CURRENT WORKFLOW: "${workflowName}"
EXISTING NODES (up to 10):
${nodesDesc || 'Empty workflow'}

WILDCARD NODE CONTEXT:
- Label: ${data.label || 'What If'}
- Connected after: ${predecessors || 'Not connected'}
- Position: (${wildcardNode.position.x}, ${wildcardNode.position.y})

${modePrompt}

Generate a speculative branch (2-5 nodes) exploring this scenario.`;
}

function parseGeneratedBranch(
  response: string,
  wildcardNode: Node
): GeneratedSpeculativeBranch | null {
  let cleanedResponse = response
    .replace(/^```json\s?|```$/g, '')
    .replace(/^[^{]*/, '')
    .trim();
  
  const lastBraceIndex = cleanedResponse.lastIndexOf('}');
  if (lastBraceIndex !== -1) {
    cleanedResponse = cleanedResponse.substring(0, lastBraceIndex + 1);
  }

  try {
    const parsed = JSON.parse(cleanedResponse);
    
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      console.error('[WildCard] No nodes in AI response');
      return null;
    }

    const baseX = wildcardNode.position.x + 300;
    const baseY = wildcardNode.position.y;
    const spacing = 200;
    
    const generationTimestamp = Date.now();

    const generatedNodes: Node[] = parsed.nodes.map((n: any, index: number) => {
      const nodeId = generateNodeId();
      return {
        id: nodeId,
        type: n.type || 'process',
        position: {
          x: baseX + (index * spacing),
          y: baseY + (index % 2 === 0 ? 0 : 100)
        },
        data: {
          label: n.label || `Step ${index + 1}`,
          description: n.description || '',
          colors: {
            headerBackground: '#6b7280',
            bodyBackground: '#f3f4f6',
          }
        },
        width: 180,
        height: 100,
        meta: {
          speculative: true,
          generatedFrom: { nodeId: wildcardNode.id, ts: generationTimestamp },
        }
      } as Node;
    });

    const generatedEdges: Edge[] = [];
    
    if (Array.isArray(parsed.edges)) {
      parsed.edges.forEach((e: any, edgeIndex: number) => {
        const sourceIndex = typeof e.sourceIndex === 'number' ? e.sourceIndex : -1;
        const targetIndex = typeof e.targetIndex === 'number' ? e.targetIndex : edgeIndex + 1;
        
        const sourceId = sourceIndex === -1 
          ? wildcardNode.id 
          : generatedNodes[sourceIndex]?.id;
        const targetId = generatedNodes[targetIndex]?.id;
        
        if (sourceId && targetId) {
          generatedEdges.push({
            id: generateEdgeId(),
            source: sourceId,
            target: targetId,
            label: e.label,
            markerEnd: true,
            style: {
              strokeDasharray: '5,5',
              strokeColor: '#9ca3af',
            },
            meta: {
              speculative: true,
              generatedFrom: { nodeId: wildcardNode.id, ts: generationTimestamp },
            }
          });
        }
      });
    }

    if (generatedEdges.length === 0 && generatedNodes.length > 0) {
      generatedEdges.push({
        id: generateEdgeId(),
        source: wildcardNode.id,
        target: generatedNodes[0].id,
        markerEnd: true,
        style: {
          strokeDasharray: '5,5',
          strokeColor: '#9ca3af',
        },
        meta: {
          speculative: true,
          generatedFrom: { nodeId: wildcardNode.id, ts: generationTimestamp },
        }
      });

      for (let i = 0; i < generatedNodes.length - 1; i++) {
        generatedEdges.push({
          id: generateEdgeId(),
          source: generatedNodes[i].id,
          target: generatedNodes[i + 1].id,
          markerEnd: true,
          style: {
            strokeDasharray: '5,5',
            strokeColor: '#9ca3af',
          },
          meta: {
            speculative: true,
            generatedFrom: { nodeId: wildcardNode.id, ts: generationTimestamp },
          }
        });
      }
    }

    return {
      nodes: generatedNodes,
      edges: generatedEdges,
      summary: parsed.summary || 'Generated speculative branch'
    };
  } catch (error) {
    console.error('[WildCard] Failed to parse AI response:', error);
    return null;
  }
}

export async function generateWildCardBranch(
  aiClient: AiClient,
  input: WildCardGenerationInput
): Promise<WildCardGenerationResult> {
  const { wildcardNode } = input;
  const data = wildcardNode.data as WildCardNodeData;
  
  if (!data.content || data.content.trim().length < 3) {
    return {
      success: false,
      error: 'Please provide a scenario description'
    };
  }

  try {
    const prompt = buildContextPrompt(input);
    
    const messages: AiMessage[] = [
      { role: 'system', content: WILDCARD_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ];

    const response = await aiClient.chat({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      maxTokens: 1500
    });

    const branch = parseGeneratedBranch(response.text, wildcardNode);
    
    if (!branch) {
      return {
        success: false,
        error: 'Failed to parse AI response into valid workflow structure'
      };
    }

    if (branch.nodes.length === 0) {
      return {
        success: false,
        error: 'AI generated an empty branch'
      };
    }

    return {
      success: true,
      branch
    };
  } catch (error) {
    console.error('[WildCard] Generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during generation'
    };
  }
}
