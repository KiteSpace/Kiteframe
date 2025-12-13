import type { KiteAIMode, KiteAIRole, ProjectContext, WorkflowContext, UIState } from './buildKiteAIContext';

export interface InferKiteAIRoleParams {
  mode: KiteAIMode;
  userMessage: string;
  projectContext?: ProjectContext;
  workflowContext?: WorkflowContext;
  uiContext?: {
    hasUploadedImages?: boolean;
    hasFigmaAttachment?: boolean;
    isEditingPRD?: boolean;
    isReviewingSpec?: boolean;
    hasHighlightedNodes?: boolean;
  };
}

const BRAINSTORM_KEYWORDS = [
  'idea', 'brainstorm', 'explore', 'what if', 'maybe', 'could',
  'option', 'alternative', 'possibility', 'thinking about',
  'not sure', 'help me think', 'how might', 'wonder', 'consider',
  'experiment', 'try', 'prototype', 'sketch', 'rough'
];

const DESIGNER_KEYWORDS = [
  'design', 'ux', 'ui', 'mockup', 'layout', 'visual', 'wireframe',
  'prototype', 'usability', 'interface', 'typography', 'spacing',
  'color', 'hierarchy', 'flow', 'interaction', 'user experience',
  'figma', 'screen', 'navigation', 'modal', 'button', 'component',
  'user sees', 'user clicks', 'transitions', 'animation', 'style',
  'responsive', 'mobile', 'desktop', 'tablet', 'accessibility'
];

const PM_KEYWORDS = [
  'requirement', 'spec', 'prd', 'acceptance', 'criteria', 'feature',
  'functionality', 'behavior', 'edge case', 'state', 'scope',
  'priority', 'deadline', 'stakeholder', 'user story', 'epic',
  'milestone', 'deliverable', 'constraint', 'assumption', 'risk',
  'complete', 'ready', 'ship', 'launch', 'release', 'validate'
];

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw)).length;
}

interface RoleScores {
  brainstorm: number;
  designer: number;
  pm: number;
}

/**
 * Infers the KiteAI role by aggregating signals from all sources
 * and resolving conflicts with priority: designer > pm > brainstorm.
 * 
 * Signal sources (weighted):
 * 1. Project stage - sets initial bias
 * 2. User intent - keywords in message
 * 3. Contextual artifacts - UI state
 * 
 * All signals aggregate into scores, then the highest score wins.
 * On ties: designer > pm > brainstorm
 */
export function inferKiteAIRole(params: InferKiteAIRoleParams): KiteAIRole {
  const { mode, userMessage, projectContext, workflowContext, uiContext } = params;

  // Pre-project mode: always brainstorm (no project context exists)
  if (mode === 'pre_project') {
    return 'brainstorm';
  }

  // Aggregate scores from all signal sources
  const scores: RoleScores = { brainstorm: 0, designer: 0, pm: 0 };

  // ========================================
  // PRIORITY 1: PROJECT STAGE SIGNALS
  // ========================================
  const hasPRD = Boolean(projectContext?.prdExcerpt);
  const hasWorkflows = projectContext?.nodes && projectContext.nodes.length > 0;

  if (hasPRD) {
    scores.pm += 3; // Strong PM bias when PRD exists
  }
  
  if (hasWorkflows) {
    scores.designer += 2; // Designer bias when workflows exist
  }

  // ========================================
  // PRIORITY 2: USER INTENT SIGNALS
  // ========================================
  const brainstormCount = countKeywords(userMessage, BRAINSTORM_KEYWORDS);
  const designerCount = countKeywords(userMessage, DESIGNER_KEYWORDS);
  const pmCount = countKeywords(userMessage, PM_KEYWORDS);

  scores.brainstorm += brainstormCount * 2;
  scores.designer += designerCount * 2;
  scores.pm += pmCount * 2;

  // ========================================
  // PRIORITY 3: CONTEXTUAL ARTIFACTS
  // ========================================
  if (uiContext?.isEditingPRD || uiContext?.isReviewingSpec) {
    scores.pm += 4; // Strong PM signal when actively editing PRD
  }

  if (uiContext?.hasFigmaAttachment || uiContext?.hasUploadedImages) {
    scores.designer += 3;
  }

  if (uiContext?.hasHighlightedNodes || workflowContext?.selectedNodeIds?.length) {
    scores.designer += 2;
  }

  // ========================================
  // RESOLVE: Highest score wins
  // On ties: designer > pm > brainstorm
  // ========================================
  const maxScore = Math.max(scores.brainstorm, scores.designer, scores.pm);

  // If all scores are 0, fallback to designer
  if (maxScore === 0) {
    return 'designer';
  }

  // Check in priority order: designer > pm > brainstorm
  if (scores.designer >= scores.pm && scores.designer >= scores.brainstorm) {
    return 'designer';
  }
  if (scores.pm >= scores.brainstorm) {
    return 'pm';
  }
  return 'brainstorm';
}

export function getRoleBadgeLabel(role: KiteAIRole): { label: string; show: boolean } {
  switch (role) {
    case 'brainstorm':
      return { label: 'Brainstorming', show: true };
    case 'designer':
      return { label: 'Design Review', show: true };
    case 'pm':
      return { label: 'Product Spec', show: true };
  }
}
