import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info, XCircle, Check, ChevronRight, ExternalLink } from 'lucide-react';
import type { DiagnosticIssue, DiagnosticSeverity } from '../utils/diagnostics/types';
import { getHighestSeverity } from '../utils/diagnostics/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DiagnosticBadgeProps {
  issues: DiagnosticIssue[];
  onAcknowledge?: (fingerprint: string) => void;
  onUnacknowledge?: (fingerprint: string) => void;
  onCreateExperiment?: (issue: DiagnosticIssue) => void;
  onViewInPanel?: (issue: DiagnosticIssue) => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

const SEVERITY_STYLES: Record<DiagnosticSeverity, { bg: string; text: string; border: string; icon: typeof AlertTriangle }> = {
  critical: {
    bg: 'bg-red-500',
    text: 'text-white',
    border: 'border-red-600',
    icon: XCircle,
  },
  risk: {
    bg: 'bg-orange-500',
    text: 'text-white',
    border: 'border-orange-600',
    icon: AlertTriangle,
  },
  warn: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-900',
    border: 'border-yellow-600',
    icon: AlertCircle,
  },
  info: {
    bg: 'bg-gray-400',
    text: 'text-white',
    border: 'border-gray-500',
    icon: Info,
  },
};

const POSITION_STYLES: Record<NonNullable<DiagnosticBadgeProps['position']>, string> = {
  'top-left': '-top-2 -left-2',
  'top-right': '-top-2 -right-2',
  'bottom-left': '-bottom-2 -left-2',
  'bottom-right': '-bottom-2 -right-2',
};

export const DiagnosticBadge = memo(function DiagnosticBadge({
  issues,
  onAcknowledge,
  onUnacknowledge,
  onCreateExperiment,
  onViewInPanel,
  position = 'top-right',
  className,
}: DiagnosticBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const activeIssues = issues.filter(i => i.status !== 'resolved');
  const newIssues = activeIssues.filter(i => i.status === 'new');
  
  if (activeIssues.length === 0) return null;
  
  const highestSeverity = getHighestSeverity(newIssues) || getHighestSeverity(activeIssues) || 'info';
  const styles = SEVERITY_STYLES[highestSeverity];
  const Icon = styles.icon;
  
  const allAcknowledged = newIssues.length === 0;
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'absolute z-50 flex items-center justify-center',
            'w-5 h-5 rounded-full border shadow-sm',
            'transition-all duration-200 hover:scale-110',
            allAcknowledged ? 'opacity-60' : 'animate-pulse',
            styles.bg,
            styles.text,
            styles.border,
            POSITION_STYLES[position],
            className,
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          data-testid="diagnostic-badge"
          title={`${activeIssues.length} issue${activeIssues.length !== 1 ? 's' : ''}`}
        >
          {activeIssues.length > 1 ? (
            <span className="text-[10px] font-bold">{activeIssues.length}</span>
          ) : (
            <Icon size={12} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 shadow-lg"
        side="right"
        align="start"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <DiagnosticPopover
          issues={activeIssues}
          onAcknowledge={onAcknowledge}
          onUnacknowledge={onUnacknowledge}
          onCreateExperiment={onCreateExperiment}
          onViewInPanel={onViewInPanel}
          onClose={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
});

interface DiagnosticPopoverProps {
  issues: DiagnosticIssue[];
  onAcknowledge?: (fingerprint: string) => void;
  onUnacknowledge?: (fingerprint: string) => void;
  onCreateExperiment?: (issue: DiagnosticIssue) => void;
  onViewInPanel?: (issue: DiagnosticIssue) => void;
  onClose?: () => void;
}

function DiagnosticPopover({
  issues,
  onAcknowledge,
  onUnacknowledge,
  onCreateExperiment,
  onViewInPanel,
  onClose,
}: DiagnosticPopoverProps) {
  const sortedIssues = [...issues].sort((a, b) => {
    if (a.status === 'new' && b.status !== 'new') return -1;
    if (a.status !== 'new' && b.status === 'new') return 1;
    const severityOrder: Record<DiagnosticSeverity, number> = { critical: 3, risk: 2, warn: 1, info: 0 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
  
  return (
    <div className="max-h-80 overflow-y-auto" data-testid="diagnostic-popover">
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Workflow Issues ({issues.length})
        </h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {sortedIssues.map((issue) => (
          <DiagnosticIssueRow
            key={issue.fingerprint}
            issue={issue}
            onAcknowledge={onAcknowledge}
            onUnacknowledge={onUnacknowledge}
            onCreateExperiment={onCreateExperiment}
            onViewInPanel={onViewInPanel}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  );
}

interface DiagnosticIssueRowProps {
  issue: DiagnosticIssue;
  onAcknowledge?: (fingerprint: string) => void;
  onUnacknowledge?: (fingerprint: string) => void;
  onCreateExperiment?: (issue: DiagnosticIssue) => void;
  onViewInPanel?: (issue: DiagnosticIssue) => void;
  onClose?: () => void;
}

function DiagnosticIssueRow({
  issue,
  onAcknowledge,
  onUnacknowledge,
  onCreateExperiment,
  onViewInPanel,
  onClose,
}: DiagnosticIssueRowProps) {
  const styles = SEVERITY_STYLES[issue.severity];
  const Icon = styles.icon;
  const isAcknowledged = issue.status === 'acknowledged';
  
  const handleAcknowledge = () => {
    onAcknowledge?.(issue.fingerprint);
  };
  
  const handleUnacknowledge = () => {
    onUnacknowledge?.(issue.fingerprint);
  };
  
  const handleCreateExperiment = () => {
    onCreateExperiment?.(issue);
    onClose?.();
  };
  
  const handleViewInPanel = () => {
    onViewInPanel?.(issue);
    onClose?.();
  };
  
  return (
    <div
      className={cn(
        'px-3 py-2',
        isAcknowledged && 'opacity-60 bg-gray-50 dark:bg-gray-900/50',
      )}
      data-testid={`diagnostic-issue-${issue.fingerprint}`}
    >
      <div className="flex items-start gap-2">
        <div className={cn('mt-0.5 p-1 rounded', styles.bg)}>
          <Icon size={12} className={styles.text} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {issue.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {issue.description}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {isAcknowledged ? (
              <button
                onClick={handleUnacknowledge}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                data-testid="unacknowledge-btn"
              >
                <Check size={12} />
                <span>Acknowledged</span>
              </button>
            ) : (
              <button
                onClick={handleAcknowledge}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                data-testid="acknowledge-btn"
              >
                <Check size={12} />
                <span>Acknowledge</span>
              </button>
            )}
            {issue.recommendedAction?.kind === 'create-experiment' && (
              <button
                onClick={handleCreateExperiment}
                className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1"
                data-testid="create-experiment-btn"
              >
                <ChevronRight size={12} />
                <span>Explore Fix</span>
              </button>
            )}
            <button
              onClick={handleViewInPanel}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
              data-testid="view-in-panel-btn"
            >
              <ExternalLink size={12} />
              <span>View in Panel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiagnosticBadge;
