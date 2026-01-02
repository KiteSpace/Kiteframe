import type { AiClient, AiMessage } from '../types';
import type { Node, Edge, ExperimentMode, ExperimentOrigin } from '../../lib/kiteframe/types';
import type { ExperimentContext } from '../../lib/kiteframe/utils/experimentContext';
import { formatContextForPrompt } from '../../lib/kiteframe/utils/experimentContext';

export interface GenerateBranchInput {
  mode: ExperimentMode;
  context: ExperimentContext;
  origin: ExperimentOrigin;
  selectedOptionLabel: string;
  selectedOptionDescription: string;
  userPrompt?: string;
  anchorNodeId: string;
  anchorNodeLabel: string;
  anchorNodePosition: { x: number; y: number };
}

export interface GeneratedBranch {
  nodes: Partial<Node>[];
  edges: Partial<Edge>[];
}

export interface GenerateBranchResult {
  success: boolean;
  branch?: GeneratedBranch;
  error?: string;
}

const BRANCH_GENERATION_PROMPT = `You are a workflow automation expert generating concrete workflow branches.

TASK: Generate workflow nodes and edges that implement this change:
{{description}}

ANCHOR NODE:
- ID: {{anchorNodeId}}
- Label: {{anchorNodeLabel}}
- Position: x={{anchorX}}, y={{anchorY}}

CURRENT WORKFLOW CONTEXT:
{{context}}

STRICT REQUIREMENTS:
1. Generate 1-3 new nodes that implement the described change
2. Generate edges connecting the new nodes to each other and to the anchor node
3. Position new nodes to the RIGHT of the anchor node (x + 250 for each subsequent node)
4. Use concrete, actionable node labels (not vague descriptions)
5. Node types must be one of: process, condition, input, output

NODE STRUCTURE:
{
  "id": "gen-{unique-suffix}",
  "type": "process" | "condition" | "input" | "output",
  "position": { "x": number, "y": number },
  "data": { "label": "Concrete action description" }
}

EDGE STRUCTURE:
{
  "id": "edge-{unique-suffix}",
  "source": "source-node-id",
  "target": "target-node-id",
  "label": "optional edge label for conditions"
}

POSITIONING RULES:
- First new node: x = anchorX + 250, y = anchorY
- Subsequent nodes in sequence: x += 250
- Branching nodes (for conditions): offset y by ±100

Return ONLY valid JSON object with this structure:
{
  "nodes": [...],
  "edges": [...]
}

No markdown, no explanation, just the JSON object.`;

const EXPLORE_BRANCH_PROMPT = `You are implementing a specific solution to a workflow issue.

SOLUTION TO IMPLEMENT:
{{description}}

ANCHOR NODE (where to attach the solution):
- ID: {{anchorNodeId}}
- Label: {{anchorNodeLabel}}
- Position: x={{anchorX}}, y={{anchorY}}

CURRENT WORKFLOW:
{{context}}

IMPLEMENTATION REQUIREMENTS:
1. Generate the minimal set of nodes needed to implement this solution (1-4 nodes)
2. Each node must represent a concrete, actionable step
3. Connect nodes logically with edges
4. For conditions: create appropriate branching paths
5. Position nodes to the RIGHT of the anchor, offset by 250px horizontally

NODE TYPES:
- "process": Action steps (e.g., "Run security scan", "Send notification")
- "condition": Decision points (e.g., "Approval granted?", "Tests passed?")
- "output": End states or results

Return ONLY valid JSON:
{
  "nodes": [
    {"id": "gen-1", "type": "process", "position": {"x": 500, "y": 200}, "data": {"label": "Specific action"}}
  ],
  "edges": [
    {"id": "edge-1", "source": "anchor-id", "target": "gen-1"}
  ]
}`;

function parseAiBranchResponse(text: string): GeneratedBranch | null {
  try {
    let jsonStr = text.trim();
    
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonStr);
    
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      console.error('AI response missing nodes array:', parsed);
      return null;
    }
    
    if (!parsed.edges || !Array.isArray(parsed.edges)) {
      parsed.edges = [];
    }
    
    const nodes: Partial<Node>[] = parsed.nodes.map((node: any, index: number) => ({
      id: node.id || `gen-${Date.now()}-${index}`,
      type: ['process', 'condition', 'input', 'output'].includes(node.type) ? node.type : 'process',
      position: {
        x: typeof node.position?.x === 'number' ? node.position.x : 500 + (index * 250),
        y: typeof node.position?.y === 'number' ? node.position.y : 200,
      },
      data: {
        label: node.data?.label || node.label || 'New Step',
      },
    }));
    
    const edges: Partial<Edge>[] = parsed.edges.map((edge: any, index: number) => ({
      id: edge.id || `edge-${Date.now()}-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
    }));
    
    return { nodes, edges };
  } catch (error) {
    console.error('Failed to parse AI branch response:', error, text);
    return null;
  }
}

export async function generateExperimentBranch(
  ai: AiClient,
  input: GenerateBranchInput
): Promise<GenerateBranchResult> {
  const {
    mode,
    context,
    origin,
    selectedOptionLabel,
    selectedOptionDescription,
    userPrompt,
    anchorNodeId,
    anchorNodeLabel,
    anchorNodePosition,
  } = input;
  
  const isExplore = origin === 'explore';
  const description = userPrompt || `${selectedOptionLabel}: ${selectedOptionDescription}`;
  const contextStr = formatContextForPrompt(context);
  
  const promptTemplate = isExplore ? EXPLORE_BRANCH_PROMPT : BRANCH_GENERATION_PROMPT;
  
  const prompt = promptTemplate
    .replace('{{description}}', description)
    .replace('{{anchorNodeId}}', anchorNodeId)
    .replace('{{anchorNodeLabel}}', anchorNodeLabel)
    .replace('{{anchorX}}', String(anchorNodePosition.x))
    .replace('{{anchorY}}', String(anchorNodePosition.y))
    .replace('{{context}}', contextStr);
  
  const messages: AiMessage[] = [
    { role: 'user', content: prompt }
  ];
  
  try {
    console.log('[generateExperimentBranch] Calling AI with prompt for:', description.substring(0, 100));
    
    const response = await ai.chat({
      messages,
    });
    
    console.log('[generateExperimentBranch] AI response received, parsing...');
    
    const branch = parseAiBranchResponse(response.text);
    
    if (!branch || branch.nodes.length === 0) {
      return {
        success: false,
        error: 'AI did not generate valid workflow nodes',
      };
    }
    
    const anchorX = anchorNodePosition.x;
    const anchorY = anchorNodePosition.y;
    branch.nodes = branch.nodes.map((node, index) => ({
      ...node,
      position: {
        x: anchorX + 250 + (index * 250),
        y: anchorY + (node.type === 'condition' && index > 0 ? (index % 2 === 0 ? -100 : 100) : 0),
      },
    }));
    
    const nodeIds = branch.nodes.map(n => n.id!);
    branch.edges = branch.edges.filter(edge => {
      const sourceValid = edge.source === anchorNodeId || nodeIds.includes(edge.source!);
      const targetValid = nodeIds.includes(edge.target!);
      return sourceValid && targetValid;
    });
    
    if (branch.edges.length === 0 && branch.nodes.length > 0) {
      branch.edges.push({
        id: `edge-anchor-${Date.now()}`,
        source: anchorNodeId,
        target: branch.nodes[0].id!,
        type: 'smoothstep',
      });
      
      for (let i = 0; i < branch.nodes.length - 1; i++) {
        branch.edges.push({
          id: `edge-seq-${Date.now()}-${i}`,
          source: branch.nodes[i].id!,
          target: branch.nodes[i + 1].id!,
          type: 'smoothstep',
        });
      }
    }
    
    console.log('[generateExperimentBranch] Generated branch:', {
      nodeCount: branch.nodes.length,
      edgeCount: branch.edges.length,
    });
    
    return {
      success: true,
      branch,
    };
  } catch (error) {
    console.error('[generateExperimentBranch] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate branch',
    };
  }
}
