import type { AiClient, AiMessage } from './types';
import type { SemanticWorkflowModel } from '../lib/kiteframe/utils/extractSemanticWorkflowModel';
import type { WorkflowPRD } from './prdEngine';

export interface PRDSuggestion {
  sectionId: string;
  type: 'improvement' | 'missing' | 'stale';
  title: string;
  description: string;
  suggestedContent?: string;
}

export interface PRDReviewResult {
  suggestions: PRDSuggestion[];
  summary: string;
  reviewedAt: number;
}

function buildReviewPrompt(
  model: SemanticWorkflowModel,
  prd: WorkflowPRD
): string {
  const nodesDesc = model.nodes.map(n => 
    `- ${n.label || n.type} (${n.type})${n.description ? `: ${n.description}` : ''}`
  ).join('\n');
  
  const edgesDesc = model.edges.map(e => {
    const sourceNode = model.nodes.find(n => n.id === e.source);
    const targetNode = model.nodes.find(n => n.id === e.target);
    return `- ${sourceNode?.label || 'Node'} → ${targetNode?.label || 'Node'}${e.label ? ` (${e.label})` : ''}`;
  }).join('\n');

  const sectionsDesc = prd.sections.map(s => 
    `### ${s.title}\n${s.content || '(empty)'}`
  ).join('\n\n');

  return `
Review the following PRD against the workflow model and suggest improvements.

WORKFLOW MODEL:
Name: ${model.name}
Nodes:
${nodesDesc}

Connections:
${edgesDesc}

Entry Points: ${model.entryPoints.join(', ') || 'None'}
Exit Points: ${model.exitPoints.join(', ') || 'None'}
Forms: ${model.forms.map(f => f.nodeName).join(', ') || 'None'}
Screens: ${model.screens.map(s => s.name).join(', ') || 'None'}
Primary Actions: ${model.primaryActions.join(', ') || 'None'}
Error Paths: ${model.errorPaths.join(', ') || 'None'}

CURRENT PRD:
${sectionsDesc}

INSTRUCTIONS:
1. Compare the PRD content against the workflow model
2. Identify sections that could be improved
3. Identify missing requirements or details
4. Identify stale content that doesn't match the workflow

Return ONLY valid JSON in this exact format:
{
  "summary": "Brief overall assessment of the PRD quality",
  "suggestions": [
    {
      "sectionId": "section-id like overview, requirements, user-flow, inputs-outputs, acceptance-criteria",
      "type": "improvement|missing|stale",
      "title": "Short title for the suggestion",
      "description": "Explanation of what should be improved",
      "suggestedContent": "Optional: improved text for the section"
    }
  ]
}

Keep suggestions actionable and specific. Maximum 5 suggestions.
`;
}

function parseReviewResponse(text: string): { summary: string; suggestions: PRDSuggestion[] } {
  let cleanedResponse = text
    .replace(/^```json\s?|```$/g, '')
    .replace(/^[^{]*/, '')
    .trim();
  
  const lastBraceIndex = cleanedResponse.lastIndexOf('}');
  if (lastBraceIndex !== -1) {
    cleanedResponse = cleanedResponse.substring(0, lastBraceIndex + 1);
  }
  
  try {
    const parsed = JSON.parse(cleanedResponse);
    return {
      summary: parsed.summary || 'Review complete.',
      suggestions: (parsed.suggestions || []).map((s: Record<string, unknown>) => ({
        sectionId: String(s.sectionId || ''),
        type: (['improvement', 'missing', 'stale'].includes(String(s.type)) ? s.type : 'improvement') as PRDSuggestion['type'],
        title: String(s.title || 'Suggestion'),
        description: String(s.description || ''),
        suggestedContent: s.suggestedContent ? String(s.suggestedContent) : undefined
      }))
    };
  } catch {
    return {
      summary: 'Unable to parse review results.',
      suggestions: []
    };
  }
}

export async function reviewPRD(
  aiClient: AiClient,
  model: SemanticWorkflowModel,
  prd: WorkflowPRD
): Promise<PRDReviewResult> {
  const prompt = buildReviewPrompt(model, prd);
  
  const messages: AiMessage[] = [
    { 
      role: 'system', 
      content: 'You are a technical reviewer analyzing PRDs against workflow diagrams. Suggest improvements without rewriting. Be specific and actionable. Output only valid JSON.' 
    },
    { role: 'user', content: prompt }
  ];
  
  const response = await aiClient.chat({
    messages,
    temperature: 0.3,
    maxTokens: 1500
  });
  
  const { summary, suggestions } = parseReviewResponse(response.text);
  
  return {
    suggestions,
    summary,
    reviewedAt: Date.now()
  };
}
