import { memo, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Info, XCircle, Check, ChevronRight, RefreshCw, CheckCheck, Focus, Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { DiagnosticIssue, DiagnosticSeverity } from '@/lib/kiteframe/utils/diagnostics/types';

type ListFilterMode = 'active' | 'all';

interface DiagnosticsTabProps {
  issues: DiagnosticIssue[];
  isLoading: boolean;
  onAcknowledge: (fingerprint: string) => void;
  onUnacknowledge: (fingerprint: string) => void;
  onAcknowledgeAll: () => void;
  onRefresh: () => void;
  onCreateExperiment?: (issue: DiagnosticIssue) => void;
  onNavigateToNode?: (nodeId: string) => void;
  focusedFingerprint?: string | null;
  showAcknowledgedBadges?: boolean;
  onToggleAcknowledgedBadges?: (show: boolean) => void;
}

const SEVERITY_STYLES: Record<DiagnosticSeverity, { bg: string; text: string; icon: typeof AlertTriangle; label: string }> = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    icon: XCircle,
    label: 'Critical',
  },
  risk: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-400',
    icon: AlertTriangle,
    label: 'Risk',
  },
  warn: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    icon: AlertCircle,
    label: 'Warning',
  },
  info: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    icon: Info,
    label: 'Info',
  },
};

const SEVERITY_ORDER: DiagnosticSeverity[] = ['critical', 'risk', 'warn', 'info'];

export const DiagnosticsTab = memo(function DiagnosticsTab({
  issues,
  isLoading,
  onAcknowledge,
  onUnacknowledge,
  onAcknowledgeAll,
  onRefresh,
  onCreateExperiment,
  onNavigateToNode,
  focusedFingerprint,
  showAcknowledgedBadges = false,
  onToggleAcknowledgedBadges,
}: DiagnosticsTabProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRowRef = useRef<HTMLDivElement>(null);
  const [listFilterMode, setListFilterMode] = useState<ListFilterMode>('active');
  
  const activeIssues = issues.filter(i => i.status !== 'resolved');
  const newIssues = activeIssues.filter(i => i.status === 'new');
  
  const filteredIssues = listFilterMode === 'active' 
    ? activeIssues.filter(i => i.status === 'new')
    : activeIssues;
  
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    const statusOrder = { new: 0, acknowledged: 1, resolved: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    
    const severityDiff = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    return severityDiff;
  });
  
  useEffect(() => {
    if (focusedFingerprint && focusedRowRef.current) {
      focusedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedFingerprint]);
  
  if (activeIssues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No Issues Found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          Your workflow looks good! All diagnostic checks passed.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="mt-4"
          disabled={isLoading}
          data-testid="diagnostics-refresh-empty"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Issues
          </h3>
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            {newIssues.length} new
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAcknowledgeAll}
            disabled={newIssues.length === 0}
            className="h-7 text-xs"
            data-testid="diagnostics-acknowledge-all"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Acknowledge All
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-7 w-7"
            data-testid="diagnostics-refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                data-testid="diagnostics-filter-dropdown"
              >
                <Filter className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setListFilterMode('active')}
                className="flex items-center justify-between"
                data-testid="filter-active"
              >
                <span>Active</span>
                {listFilterMode === 'active' && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setListFilterMode('all')}
                className="flex items-center justify-between"
                data-testid="filter-all"
              >
                <span>All</span>
                {listFilterMode === 'all' && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onToggleAcknowledgedBadges?.(!showAcknowledgedBadges)}
                className="flex items-center justify-between"
                data-testid="filter-show-acknowledged-badges"
              >
                <span>Show acknowledged badges</span>
                {showAcknowledgedBadges && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="divide-y divide-border">
          {sortedIssues.map((issue) => {
            const styles = SEVERITY_STYLES[issue.severity];
            const Icon = styles.icon;
            const isAcknowledged = issue.status === 'acknowledged';
            const isFocused = focusedFingerprint === issue.fingerprint;
            
            return (
              <div
                key={issue.fingerprint}
                ref={isFocused ? focusedRowRef : undefined}
                className={cn(
                  'px-4 py-3 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  isAcknowledged && 'opacity-60',
                  isFocused && 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-400',
                )}
                onClick={() => issue.nodeId && onNavigateToNode?.(issue.nodeId)}
                data-testid={`diagnostics-issue-${issue.fingerprint}`}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 p-1.5 rounded', styles.bg)}>
                    <Icon className={cn('w-4 h-4', styles.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs font-medium', styles.text)}>
                        {styles.label}
                      </span>
                      {issue.nodeId && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Focus className="w-3 h-3" />
                          Node: {issue.nodeId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {issue.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                      {issue.description}
                    </p>
                    <div className="flex items-center gap-2">
                      {isAcknowledged ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUnacknowledge(issue.fingerprint)}
                          className="h-6 text-xs text-gray-500"
                          data-testid={`unacknowledge-${issue.fingerprint}`}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Acknowledged
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAcknowledge(issue.fingerprint)}
                          className="h-6 text-xs text-blue-600 hover:text-blue-700"
                          data-testid={`acknowledge-${issue.fingerprint}`}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {issue.recommendedAction?.kind === 'create-experiment' && onCreateExperiment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCreateExperiment(issue)}
                          className="h-6 text-xs text-purple-600 hover:text-purple-700"
                          data-testid={`experiment-${issue.fingerprint}`}
                        >
                          <ChevronRight className="w-3 h-3 mr-1" />
                          Explore Fix
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
});
