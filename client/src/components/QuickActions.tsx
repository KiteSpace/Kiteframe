/**
 * QuickActions Component
 * 
 * Replit-style pill buttons for workflow expansion options.
 * These appear below AI responses when diagnostics suggest edge case expansion.
 */

import { Button } from '@/components/ui/button';
import { QUICK_ACTION_LABELS } from '@/constants/aiWorkflowExpansionPrompts';
import type { QuickActionType } from '@/utils/workflowDiagnostics';

export interface QuickActionsProps {
  actions: QuickActionType[];
  onAction: (action: QuickActionType) => void;
  disabled?: boolean;
  variant?: 'default' | 'discussion';
}

const ACTION_ORDER: QuickActionType[] = [
  'HAPPY_PATH_ONLY',
  'INCLUDE_EDGE_CASES',
  'DISCUSS_EDGE_CASES',
  'SELECT_EDGE_CASES',
];

export function QuickActions({ 
  actions, 
  onAction, 
  disabled = false,
  variant = 'default' 
}: QuickActionsProps) {
  if (!actions || actions.length === 0) {
    return null;
  }

  const sortedActions = [...actions].sort(
    (a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b)
  );

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {sortedActions.map(action => (
        <Button
          key={action}
          size="sm"
          variant="outline"
          onClick={() => onAction(action)}
          disabled={disabled}
          className="h-8 px-3 text-xs rounded-full border-muted-foreground/30 hover:bg-muted hover:border-primary/50 transition-colors"
          data-testid={`quick-action-${action.toLowerCase().replace(/_/g, '-')}`}
        >
          {getActionLabel(action, variant)}
        </Button>
      ))}
    </div>
  );
}

function getActionLabel(action: QuickActionType, variant: 'default' | 'discussion'): string {
  if (variant === 'discussion') {
    switch (action) {
      case 'HAPPY_PATH_ONLY':
        return QUICK_ACTION_LABELS.STICK_WITH_HAPPY_PATH;
      case 'INCLUDE_EDGE_CASES':
        return QUICK_ACTION_LABELS.MAP_ALL_EDGE_CASES;
      case 'SELECT_EDGE_CASES':
        return QUICK_ACTION_LABELS.SELECT_EDGE_CASES;
      default:
        return QUICK_ACTION_LABELS[action] || action;
    }
  }
  return QUICK_ACTION_LABELS[action] || action;
}

/**
 * Discussion mode quick actions - shown after edge cases are listed
 */
export interface DiscussionQuickActionsProps {
  onStickWithHappyPath: () => void;
  onMapAllEdgeCases: () => void;
  onSelectEdgeCases: () => void;
  disabled?: boolean;
}

export function DiscussionQuickActions({
  onStickWithHappyPath,
  onMapAllEdgeCases,
  onSelectEdgeCases,
  disabled = false,
}: DiscussionQuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button
        size="sm"
        variant="outline"
        onClick={onStickWithHappyPath}
        disabled={disabled}
        className="h-8 px-3 text-xs rounded-full border-muted-foreground/30 hover:bg-muted hover:border-primary/50"
        data-testid="quick-action-stick-with-happy-path"
      >
        {QUICK_ACTION_LABELS.STICK_WITH_HAPPY_PATH}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onMapAllEdgeCases}
        disabled={disabled}
        className="h-8 px-3 text-xs rounded-full border-muted-foreground/30 hover:bg-muted hover:border-primary/50"
        data-testid="quick-action-map-all-edge-cases"
      >
        {QUICK_ACTION_LABELS.MAP_ALL_EDGE_CASES}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onSelectEdgeCases}
        disabled={disabled}
        className="h-8 px-3 text-xs rounded-full border-muted-foreground/30 hover:bg-muted hover:border-primary/50"
        data-testid="quick-action-select-edge-cases"
      >
        {QUICK_ACTION_LABELS.SELECT_EDGE_CASES}
      </Button>
    </div>
  );
}
