export type KiteRole = 'pm' | 'designer' | 'hybrid';

export interface RoleContext {
  source?: 'figma' | 'workflow' | 'prd' | 'notes';
  target?: 'workflow' | 'prd';
  userIntent?: string;
}

const DESIGN_KEYWORDS = [
  'design', 'ux', 'ui', 'mockup', 'layout', 'visual', 'wireframe',
  'prototype', 'usability', 'interface', 'typography', 'spacing',
  'color', 'hierarchy', 'flow', 'interaction', 'user experience'
];

const PM_KEYWORDS = [
  'requirement', 'spec', 'prd', 'acceptance', 'criteria', 'feature',
  'functionality', 'behavior', 'edge case', 'state', 'transition'
];

function containsKeyword(text: string | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export function selectKiteRole(context: RoleContext): KiteRole {
  const hasDesignIntent = containsKeyword(context.userIntent, DESIGN_KEYWORDS);
  const hasPmIntent = containsKeyword(context.userIntent, PM_KEYWORDS);
  
  if (context.source === 'figma' && context.target === 'workflow') {
    return 'hybrid';
  }

  if (context.source === 'figma' && hasDesignIntent) {
    return 'hybrid';
  }

  if (context.target === 'prd' || hasPmIntent) {
    return 'pm';
  }

  if (context.source === 'figma' || hasDesignIntent) {
    return 'designer';
  }

  return 'pm';
}

export function getRoleLabel(role: KiteRole): { emoji: string; label: string } {
  switch (role) {
    case 'designer':
      return { emoji: '🎨', label: 'Design Review' };
    case 'hybrid':
      return { emoji: '🔀', label: 'Design → Product Translation' };
    case 'pm':
    default:
      return { emoji: '🧠', label: 'Product Reasoning' };
  }
}
