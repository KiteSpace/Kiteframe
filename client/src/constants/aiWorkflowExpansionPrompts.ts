/**
 * AI Workflow Expansion Prompts
 * 
 * These prompts are used for edge case expansion and discussion.
 * They transform existing workflows rather than generating from scratch.
 */

export const AI_WORKFLOW_EXPAND_EDGE_CASES_PROMPT = `You are a workflow expansion assistant. Your task is to expand an existing workflow by adding edge cases and failure paths.

REQUIREMENTS:
1. Preserve all existing nodes and their connections
2. Add at least 1 decision/condition node if none exist
3. Add at least 1 failure/error/retry path
4. Add termination nodes for both success and failure paths
5. Reuse existing nodes where possible - don't duplicate functionality

INPUT: You will receive the current workflow as JSON with nodes and edges.

OUTPUT: Return ONLY valid JSON with the following structure:
{
  "nodes": [
    { "id": "string", "type": "string", "label": "string", "data": {} }
  ],
  "edges": [
    { "id": "string", "source": "string", "target": "string", "label": "string" }
  ]
}

EDGE CASE CATEGORIES TO CONSIDER:
- User input validation failures
- Network/API errors
- Authentication/authorization failures
- Business rule violations
- Timeout and retry scenarios
- Empty state handling
- Partial success scenarios

Do not add explanations. Return only the JSON.`;

export const AI_WORKFLOW_LIST_EDGE_CASES_PROMPT = `You are a workflow analyst. Your task is to identify potential edge cases and failure scenarios for an existing workflow.

INPUT: You will receive a workflow description or JSON structure.

OUTPUT: Return ONLY valid JSON with up to 6 candidate edge cases:
{
  "edgeCases": [
    { "id": "case-1", "label": "Brief description of edge case" },
    { "id": "case-2", "label": "Brief description of edge case" }
  ]
}

PRIORITIZE THESE CATEGORIES:
1. User input validation failures (invalid data, missing fields)
2. External service failures (API errors, timeouts)
3. Authentication/authorization issues
4. Business rule violations
5. Rate limiting or quota exceeded
6. Partial success or rollback scenarios

Keep labels concise (under 50 characters). Return only the JSON, no explanations.`;

export const AI_WORKFLOW_EXPAND_SELECTED_EDGE_CASES_PROMPT = `You are a workflow expansion assistant. Your task is to expand an existing workflow by adding ONLY the specified edge cases.

INPUT: You will receive:
1. The current workflow as JSON (nodes and edges)
2. A list of selected edge cases to include

REQUIREMENTS:
1. Preserve all existing nodes and their connections
2. Add nodes and paths ONLY for the selected edge cases
3. Create appropriate decision nodes to branch to edge case handling
4. Add proper termination nodes for each path
5. Reuse existing nodes where possible

OUTPUT: Return ONLY valid JSON with the following structure:
{
  "nodes": [
    { "id": "string", "type": "string", "label": "string", "data": {} }
  ],
  "edges": [
    { "id": "string", "source": "string", "target": "string", "label": "string" }
  ]
}

Do not add explanations. Return only the JSON.`;

/**
 * AI response templates for each workflow generation state
 */
export const AI_RESPONSE_TEMPLATES = {
  BASELINE_GENERATED: `I've created a first-pass workflow based on your prompt.

This is a straightforward happy path to get something concrete on the canvas.
In real systems like this, there are often additional branches or failure cases that are worth mapping, but we can decide how deep to go.`,

  EXPANDED_WITH_EDGE_CASES: `I've expanded the workflow to include common edge and failure cases.

This version reflects a more realistic system, including decisions and recovery paths.
You can keep refining this, or create the workflow as-is.`,

  DISCUSSING_EDGE_CASES: `Here are some potential edge and failure cases that commonly show up in flows like this.

You can choose to include all of them, select specific ones, or stick with the happy path.`,

  SELECTED_EDGE_CASES_APPLIED: `I've updated the workflow to include the edge cases you selected.

This keeps the model focused while still accounting for important divergences.`,

  HAPPY_PATH_CONFIRMED: `Keeping this as a straightforward happy path.`,
};

/**
 * Quick action button labels (exact text from spec)
 */
export const QUICK_ACTION_LABELS = {
  HAPPY_PATH_ONLY: 'Map only the happy path',
  INCLUDE_EDGE_CASES: 'Include edge / fail cases',
  DISCUSS_EDGE_CASES: 'Discuss edge / fail cases',
  STICK_WITH_HAPPY_PATH: 'Stick with the happy path',
  MAP_ALL_EDGE_CASES: 'Map all edge / fail cases',
  SELECT_EDGE_CASES: 'Select which edge / fail cases to include',
};

/**
 * Checkbox helper text (exact from spec)
 */
export const EDGE_CASE_CHECKBOX_HELPER = `Select any cases you'd like to include. You can always refine this later.`;
