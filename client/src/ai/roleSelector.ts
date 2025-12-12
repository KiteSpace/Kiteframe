export type KiteRole = 'pm' | 'designer' | 'hybrid';

export interface RoleContext {
  source?: 'figma' | 'workflow' | 'prd' | 'notes';
  target?: 'workflow' | 'prd';
  userIntent?: string;
}

export function selectKiteRole(context: RoleContext): KiteRole {
  if (context.source === 'figma' && context.target === 'workflow') {
    return 'hybrid';
  }

  if (context.target === 'prd' || context.userIntent?.toLowerCase().includes('requirement')) {
    return 'pm';
  }

  if (context.source === 'figma' || context.userIntent?.toLowerCase().includes('design')) {
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
