import type { AiClient, AiMessage } from '../types';
import type { ExperimentMode, ExperimentOption, ExperimentOrigin } from '../../lib/kiteframe/types';
import type { ExperimentContext } from '../../lib/kiteframe/utils/experimentContext';
import { formatContextForPrompt } from '../../lib/kiteframe/utils/experimentContext';
import { logGenerationInput, logRawAIOutput } from './experimentDebugLogger';

// Input mode can include legacy modes for backward compatibility
type GenerateOptionsMode = ExperimentMode | 'risk' | 'prompt';

export interface GenerateOptionsInput {
  mode: GenerateOptionsMode;
  context: ExperimentContext;
  origin?: ExperimentOrigin;
  issueTitle?: string;
  issueDescription?: string;
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

// EXPLORE prompt - system-led, solution-oriented, decisive
// Max 2 solutions, exactly 1 marked as recommended
const EXPLORE_PROMPT = `You are a senior product consultant proposing solutions to a workflow issue.

Issue: {{issueTitle}}
{{issueDescription}}

Current workflow context:
{{context}}

Task:
Propose exactly 1-2 concrete solutions that resolve this issue. One solution MUST be marked as recommended.

STRICT REQUIREMENTS:
1. Maximum 2 solutions total
2. Exactly 1 solution must have "recommended": true
3. Each solution MUST describe specific workflow changes (add nodes, add conditions, split branches, etc.)
4. Use assertive language - state what SHOULD happen, not what "could" or "might" happen
5. Be specific - name actual steps, conditions, or branches to add
6. Do NOT ask follow-up questions
7. Do NOT use abstract language like "improve UX" or "add validation"

Return JSON array:
[
  {"id": "sol-1", "label": "Add approval gate before deploy", "description": "Insert a condition node after 'Build Complete' that routes to manager approval. If approved, continue to deploy. If rejected, return to revision.", "recommended": true},
  {"id": "sol-2", "label": "Add automated checks before deploy", "description": "Insert a process node that runs security scan and test suite. Create a condition that blocks deploy if any check fails.", "recommended": false}
]

Return ONLY valid JSON array. No markdown, no explanation, no questions.`;

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

// Extended option type for Explore with recommended field
export interface ExploreOption extends ExperimentOption {
  recommended?: boolean;
}

function parseAiResponse(text: string, mode: ExperimentMode, isExplore: boolean = false): ExploreOption[] {
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
    
    let options: ExploreOption[] = parsed.map((item, index) => ({
      id: item.id || `${mode}-${index + 1}`,
      label: item.label || item.title || 'Untitled',
      description: item.description || '',
      tags: item.severity ? [`severity:${item.severity}`] : 
            item.impact ? [`impact:${item.impact}`] :
            item.confidence ? [`confidence:${item.confidence}`] : undefined,
      recommended: isExplore ? item.recommended === true : undefined,
    }));
    
    // For Explore: enforce max 2 options and EXACTLY 1 is recommended
    if (isExplore) {
      options = options.slice(0, 2);
      
      // Find first recommended option index, or default to first option
      let recommendedIdx = options.findIndex(o => o.recommended);
      if (recommendedIdx === -1 && options.length > 0) {
        recommendedIdx = 0;
      }
      
      // Enforce exactly one recommended - set all to false except the chosen one
      options = options.map((o, idx) => ({
        ...o,
        recommended: idx === recommendedIdx,
      }));
    }
    
    return options;
  } catch (error) {
    console.error('Failed to parse AI response:', error, text);
    return [];
  }
}

export async function generateExperimentOptions(
  ai: AiClient,
  input: GenerateOptionsInput
): Promise<GenerateOptionsResult> {
  const { mode, context, origin, issueTitle, issueDescription } = input;
  
  const isExplore = origin === 'explore';
  
  // For Explore: always generate solutions regardless of mode
  // For Experiment: open_exploration and legacy 'prompt' mode don't get AI suggestions
  if (!isExplore && (mode === 'open_exploration' || mode === 'prompt')) {
    return { success: true, options: [] };
  }
  
  let prompt: string;
  
  if (isExplore) {
    // Use Explore prompt with issue context
    const contextStr = formatContextForPrompt(context);
    prompt = EXPLORE_PROMPT
      .replace('{{issueTitle}}', issueTitle || 'Workflow issue')
      .replace('{{issueDescription}}', issueDescription ? `Details: ${issueDescription}` : '')
      .replace('{{context}}', contextStr);
  } else {
    // Use standard experiment prompts
    const promptTemplate = getPromptForMode(mode);
    if (!promptTemplate) {
      return { success: false, error: 'Invalid mode' };
    }
    const contextStr = formatContextForPrompt(context);
    prompt = promptTemplate.replace('{{context}}', contextStr);
  }
  
  const messages: AiMessage[] = [
    { role: 'user', content: prompt }
  ];
  
  try {
    logGenerationInput({
      triggerType: isExplore ? 'explore' : 'experiment',
      originNode: {
        id: context.anchorNodeId,
        type: context.anchorNodeType,
        header: context.anchorNodeLabel,
      },
      experimentNode: null,
      userSelectedMode: mode,
      systemDetectedIssue: isExplore ? (issueTitle || null) : null,
      workflowSnapshot: {
        nodeCount: (context.upstreamNodes?.length || 0) + (context.downstreamNodes?.length || 0) + 1,
        edgeCount: 0,
      },
    });
    
    const response = await ai.chat({
      messages,
    });
    
    logRawAIOutput({
      triggerType: isExplore ? 'explore' : 'experiment',
      rawText: response.text,
    });
    
    const normalizedMode: ExperimentMode = mode === 'risk' ? 'whatif' : mode === 'prompt' ? 'open_exploration' : mode as ExperimentMode;
    const options = parseAiResponse(response.text, normalizedMode, isExplore);
    
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
