import type { AiClient, AiMessage } from '../types';
import type { ExperimentMode, ExperimentOption } from '../../lib/kiteframe/types';
import type { ExperimentContext } from '../../lib/kiteframe/utils/experimentContext';
import { formatContextForPrompt } from '../../lib/kiteframe/utils/experimentContext';

// Input mode can include legacy modes for backward compatibility
type GenerateOptionsMode = ExperimentMode | 'risk' | 'prompt';

export interface GenerateOptionsInput {
  mode: GenerateOptionsMode;
  context: ExperimentContext;
}

export interface GenerateOptionsResult {
  success: boolean;
  options?: ExperimentOption[];
  error?: string;
}

const WHAT_IF_PROMPT = `You are helping explore alternate paths in a workflow.

Context:
{{context}}

Task:
Generate 3 to 5 plausible what-if branches that represent edge cases or deviations.

Rules:
- Actionable
- No vague statements
- Do not restate existing flow

Return JSON array with objects containing: id (unique string), label (short title), description (1-2 sentences), confidence (low/medium/high).

Example format:
[
  {"id": "wif-1", "label": "What if approval is denied?", "description": "Explore the path when the request is rejected by stakeholders.", "confidence": "high"}
]

Return ONLY valid JSON array, no markdown or explanation.`;

const RISK_PROMPT = `You are identifying risks in a workflow.

Context:
{{context}}

Task:
Identify 3 to 5 meaningful risks that could cause delay, misalignment, or rework at this step.

Rules:
- Specific risks only
- No generic project risks
- Focus on this particular workflow step

Return JSON array with objects containing: id (unique string), label (short risk title), description (1-2 sentences explaining the risk), severity (low/medium/high).

Example format:
[
  {"id": "risk-1", "label": "Ownership unclear", "description": "No clear owner assigned for this decision step.", "severity": "medium"}
]

Return ONLY valid JSON array, no markdown or explanation.`;

const ENHANCEMENT_PROMPT = `You are suggesting improvements to a workflow.

Context:
{{context}}

Task:
Suggest 3 to 5 enhancements that improve speed, clarity, or alignment at this step.

Rules:
- No extra meetings
- No scope creep
- Focus on practical improvements

Return JSON array with objects containing: id (unique string), label (short enhancement title), description (1-2 sentences explaining the improvement), impact (low/medium/high).

Example format:
[
  {"id": "enh-1", "label": "Add async review", "description": "Replace synchronous approval with async review to reduce bottlenecks.", "impact": "high"}
]

Return ONLY valid JSON array, no markdown or explanation.`;

function getPromptForMode(mode: ExperimentMode | 'risk' | 'prompt'): string | null {
  switch (mode) {
    case 'whatif':
      return WHAT_IF_PROMPT;
    case 'enhancement':
      return ENHANCEMENT_PROMPT;
    case 'open_exploration':
      return null;
    // Legacy modes - kept for backward compatibility
    case 'risk':
      return WHAT_IF_PROMPT; // Map risk to whatif
    case 'prompt':
      return null; // Map prompt to open_exploration (no AI suggestions)
  }
}

function parseAiResponse(text: string, mode: ExperimentMode): ExperimentOption[] {
  try {
    let jsonStr = text.trim();
    
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsed)) {
      console.error('AI response is not an array:', parsed);
      return [];
    }
    
    return parsed.map((item, index) => ({
      id: item.id || `${mode}-${index + 1}`,
      label: item.label || item.title || 'Untitled',
      description: item.description || '',
      tags: item.severity ? [`severity:${item.severity}`] : 
            item.impact ? [`impact:${item.impact}`] :
            item.confidence ? [`confidence:${item.confidence}`] : undefined,
    }));
  } catch (error) {
    console.error('Failed to parse AI response:', error, text);
    return [];
  }
}

export async function generateExperimentOptions(
  ai: AiClient,
  input: GenerateOptionsInput
): Promise<GenerateOptionsResult> {
  const { mode, context } = input;
  
  // open_exploration and legacy 'prompt' mode don't get AI suggestions - user provides freeform input
  if (mode === 'open_exploration' || mode === 'prompt') {
    return { success: true, options: [] };
  }
  
  const promptTemplate = getPromptForMode(mode);
  if (!promptTemplate) {
    return { success: false, error: 'Invalid mode' };
  }
  
  const contextStr = formatContextForPrompt(context);
  const prompt = promptTemplate.replace('{{context}}', contextStr);
  
  const messages: AiMessage[] = [
    { role: 'user', content: prompt }
  ];
  
  try {
    const response = await ai.chat({
      messages,
    });
    
    const options = parseAiResponse(response.text, mode);
    
    if (options.length === 0) {
      return { 
        success: true, 
        options: [],
        error: 'No suggestions generated'
      };
    }
    
    return { success: true, options };
  } catch (error) {
    console.error('Error generating experiment options:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate options',
    };
  }
}
