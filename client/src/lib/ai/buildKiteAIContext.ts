import type { Node, Edge, CanvasObject } from '../kiteframe/types';
import { LARGE_WORKFLOW_WARNING_THRESHOLD } from '../constants';

export type KiteAIMode = 'pre_project' | 'in_project';
export type KiteAIRole = 'brainstorm' | 'designer' | 'pm';

export interface ProjectContext {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  projectName?: string;
  prdExcerpt?: string;
}

export interface WorkflowContext {
  activeWorkflowId?: string;
  workflowName?: string;
  selectedNodeIds?: string[];
}

export interface UIState {
  hasUploadedFiles?: boolean;
  turnCount?: number;
  recentUserActions?: string[];
}

export interface KiteAIContext {
  systemPrompt: string;
  mode: KiteAIMode;
  role: KiteAIRole;
  allowedActions: string[];
  toolAvailability: {
    canAccessCanvas: boolean;
    canModifyWorkflow: boolean;
    canGeneratePRD: boolean;
    canCreateProject: boolean;
  };
  responseStyle: {
    maxClarifyingQuestions: number;
    biasTowardAction: boolean;
    verbosity: 'concise' | 'detailed';
  };
}

const BASE_PERSONA = `You are KiteAI, a decisive product design and workflow assistant.

Core traits:
- Direct, confident, and collaborative
- Bias toward synthesis and action over endless questioning
- Explain reasoning only when it helps the user
- Never act "assistant-y" or overly deferential
- Push toward decisions, not loops`;

const PRE_PROJECT_CONSTRAINTS = `
MODE: Pre-Project
You do NOT have access to:
- Canvas nodes or edges
- Project data or workflows
- Persistent state

Your goals:
- Clarify the user's intent
- Explore ideas briefly
- Decide when enough information exists to start
- Push toward project creation when possible

Rules:
- Do NOT reference specific nodes or workflows (they don't exist yet)
- Do NOT over-engineer solutions
- Ask at most 1-2 clarifying questions, then present a decision
- After 2 question turns, you MUST summarize and offer to create the project
- Present decision actions: "Ready to start the project" or "Keep brainstorming"`;

const IN_PROJECT_CONSTRAINTS = `
MODE: In-Project
You have full access to:
- Current workflow nodes and edges
- PRD/spec excerpts (if available)
- Selected nodes (if any)

Your goals:
- Refine existing workflows
- Improve specifications
- Answer implementation questions
- Suggest improvements and identify gaps

Rules:
- Do NOT suggest "Create Project" (one already exists)
- Do NOT ask foundational questions like "What are you building?"
- Focus on execution, quality, and alignment
- Reference specific nodes and edges when relevant`;

const ROLE_BEHAVIORS: Record<KiteAIRole, string> = {
  brainstorm: `
ROLE: Brainstorm Mode
- Open-ended and exploratory
- Encourage alternatives and "what if" thinking
- Avoid premature commitment
- Generate multiple options before converging`,

  designer: `
ROLE: Designer Mode
- Flow-oriented and user-journey focused
- Think in screens, states, and transitions
- Anchor ideas to visuals and interactions
- Focus on usability and user experience`,

  pm: `
ROLE: Product Manager Mode
- Structured and outcome-driven
- Think in requirements and acceptance criteria
- Flag assumptions and edge cases
- Focus on correctness, completeness, and feasibility`
};

function buildCanvasContext(project?: ProjectContext): string {
  if (!project || project.nodes.length === 0) {
    return '';
  }

  const nodeTypes = project.nodes.reduce((acc, node) => {
    const type = node.type || 'process';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const nodeLabels = project.nodes
    .map(n => n.data?.label || 'Unnamed')
    .join(', ');
  
  let context = `\n\nCURRENT CANVAS:
- ${project.nodes.length} nodes (${Object.entries(nodeTypes).map(([t, c]) => `${c} ${t}`).join(', ')})
- ${project.edges.length} connections
- Node labels: ${nodeLabels}`;

  if (project.nodes.length > LARGE_WORKFLOW_WARNING_THRESHOLD) {
    context += '\nThis workflow is large — focus optimization on high-connectivity nodes and main paths.';
  }

  if (project.prdExcerpt) {
    context += `\n\nPRD EXCERPT:\n${project.prdExcerpt}`;
  }

  if (project.projectName) {
    context += `\nProject: "${project.projectName}"`;
  }

  return context;
}

function buildSelectedNodesContext(workflow?: WorkflowContext, project?: ProjectContext): string {
  if (!workflow?.selectedNodeIds?.length || !project?.nodes.length) {
    return '';
  }

  const selectedNodes = project.nodes.filter(n => 
    workflow.selectedNodeIds?.includes(n.id)
  );

  if (selectedNodes.length === 0) return '';

  const nodeDetails = selectedNodes.map(n => 
    `- ${n.data?.label || 'Unnamed'} (${n.type || 'process'}): ${n.data?.description || 'No description'}`
  ).join('\n');

  return `\n\nSELECTED NODES:\n${nodeDetails}`;
}

export function buildKiteAIContext(
  mode: KiteAIMode,
  role: KiteAIRole,
  projectContext?: ProjectContext,
  workflowContext?: WorkflowContext,
  uiState?: UIState
): KiteAIContext {
  const modeConstraints = mode === 'pre_project' 
    ? PRE_PROJECT_CONSTRAINTS 
    : IN_PROJECT_CONSTRAINTS;

  const roleGuidance = ROLE_BEHAVIORS[role];
  
  let systemPrompt = `${BASE_PERSONA}\n\n${modeConstraints}\n\n${roleGuidance}`;

  if (mode === 'in_project') {
    systemPrompt += buildCanvasContext(projectContext);
    systemPrompt += buildSelectedNodesContext(workflowContext, projectContext);

    systemPrompt += `\n\nWORKFLOW GENERATION RULES (when asked to CREATE or MODIFY a workflow):
1. Respond with valid JSON: {"nodes":[...],"edges":[...]}
2. Node types: input, process, output, condition, ai, image
3. Position nodes with x starting at 300, spacing 250px apart. y around 200-400.
4. Each node needs: id, type, position: {x, y}, data: {label, description, icon, iconColor}, width: 200, height: 100
5. Each edge needs: id, source, target, type: "bezier", style: {strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2}, markers: {type: "arrow", position: "end"}

For CONVERSATIONS, respond naturally without JSON.`;
  } else {
    systemPrompt += `\n\nWORKFLOW GENERATION RULES (when generating a workflow to illustrate what we'd build):
1. Output ONLY the JSON object — no prose, no markdown fences, no commentary before or after
2. Format: {"nodes":[...],"edges":[...]}
3. Node types: input, process, output, condition, ai, image
4. Position nodes with x starting at 300, spacing 250px apart. y around 200-400.
5. Each node needs: id, type, position: {x, y}, data: {label, description, icon, iconColor}, width: 200, height: 100
6. Each edge needs: id, source, target, type: "bezier", style: {strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2}, markers: {type: "arrow", position: "end"}

For CONVERSATIONS (clarifying, exploring, asking questions), respond naturally without JSON.
When you output JSON, the Kiteframe UI automatically shows a "Create Project" button — do NOT tell the user to import, copy, paste, or manually create a project.`;
  }

  const allowedActions = mode === 'pre_project'
    ? ['clarify_intent', 'suggest_direction', 'create_project', 'continue_brainstorm']
    : ['refine_workflow', 'generate_prd', 'answer_questions', 'suggest_improvements'];

  const toolAvailability = {
    canAccessCanvas: mode === 'in_project',
    canModifyWorkflow: mode === 'in_project',
    canGeneratePRD: mode === 'in_project',
    canCreateProject: mode === 'pre_project'
  };

  const responseStyle = {
    maxClarifyingQuestions: mode === 'pre_project' ? 2 : 3,
    biasTowardAction: true,
    verbosity: (role === 'pm' ? 'detailed' : 'concise') as 'concise' | 'detailed'
  };

  return {
    systemPrompt,
    mode,
    role,
    allowedActions,
    toolAvailability,
    responseStyle
  };
}

export function inferRoleFromIntent(userIntent: string, hasVisualInput: boolean = false): KiteAIRole {
  const lower = userIntent.toLowerCase();

  const pmKeywords = [
    'requirement', 'spec', 'prd', 'acceptance', 'criteria', 'feature',
    'functionality', 'behavior', 'edge case', 'state', 'transition',
    'scope', 'priority', 'deadline', 'stakeholder'
  ];

  const designerKeywords = [
    'design', 'ux', 'ui', 'mockup', 'layout', 'visual', 'wireframe',
    'prototype', 'usability', 'interface', 'typography', 'spacing',
    'color', 'hierarchy', 'flow', 'interaction', 'user experience',
    'figma', 'screen', 'navigation', 'modal', 'button'
  ];

  const brainstormKeywords = [
    'idea', 'brainstorm', 'explore', 'what if', 'maybe', 'could',
    'option', 'alternative', 'possibility', 'thinking about',
    'not sure', 'help me think', 'how might', 'wonder'
  ];

  const hasPmIntent = pmKeywords.some(kw => lower.includes(kw));
  const hasDesignerIntent = designerKeywords.some(kw => lower.includes(kw));
  const hasBrainstormIntent = brainstormKeywords.some(kw => lower.includes(kw));

  if (hasBrainstormIntent && !hasPmIntent && !hasDesignerIntent) {
    return 'brainstorm';
  }

  if (hasVisualInput || hasDesignerIntent) {
    return 'designer';
  }

  if (hasPmIntent) {
    return 'pm';
  }

  return 'brainstorm';
}

export function getRoleDisplayInfo(role: KiteAIRole): { emoji: string; label: string; description: string } {
  switch (role) {
    case 'brainstorm':
      return { 
        emoji: '💡', 
        label: 'Brainstorm', 
        description: 'Explore ideas and alternatives' 
      };
    case 'designer':
      return { 
        emoji: '🎨', 
        label: 'Designer', 
        description: 'Focus on flows and user experience' 
      };
    case 'pm':
      return { 
        emoji: '📋', 
        label: 'Product Manager', 
        description: 'Structure requirements and specs' 
      };
  }
}
