import { memo, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Rocket, Info, Check, Eye, Focus, Filter, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Insight, InsightCategory } from '@/lib/kiteframe/utils/insights/types';

type ListFilterMode = 'new' | 'all';

interface DiagnosticsTabProps {
  insights: Insight[];
  isLoading: boolean;
  onRunTestFlight: () => void;
  onDismiss: (insightId: string) => void;
  onDismissAll: () => void;
  onMarkViewed: (insightId: string) => void;
  onNavigateToNode?: (nodeId: string) => void;
  focusedInsightId?: string | null;
}

const CATEGORY_STYLES: Record<InsightCategory, { bg: string; text: string; icon: typeof Info; label: string }> = {
  observation: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    icon: Eye,
    label: 'Observation',
  },
  suggestion: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    icon: Info,
    label: 'Suggestion',
  },
  note: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    icon: Info,
    label: 'Note',
  },
};

const CATEGORY_ORDER: InsightCategory[] = ['observation', 'suggestion', 'note'];

export const DiagnosticsTab = memo(function DiagnosticsTab({
  insights,
  isLoading,
  onRunTestFlight,
  onDismiss,
  onDismissAll,
  onMarkViewed,
  onNavigateToNode,
  focusedInsightId,
}: DiagnosticsTabProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRowRef = useRef<HTMLDivElement>(null);
  const [listFilterMode, setListFilterMode] = useState<ListFilterMode>('new');
  
  const activeInsights = insights.filter(i => i.status !== 'dismissed');
  const newInsights = activeInsights.filter(i => i.status === 'new');
  
  const filteredInsights = listFilterMode === 'new' 
    ? activeInsights.filter(i => i.status === 'new')
    : activeInsights;
  
  const sortedInsights = [...filteredInsights].sort((a, b) => {
    const statusOrder = { new: 0, viewed: 1, explored: 2, dismissed: 3 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    
    const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return categoryDiff;
  });
  
  useEffect(() => {
    if (focusedInsightId && focusedRowRef.current) {
      focusedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedInsightId]);
  
  if (activeInsights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
          <Rocket className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Ready for Test Flight
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          Analyze your workflow to discover observations and suggestions.
        </p>
        <Button
          variant="default"
          size="sm"
          onClick={onRunTestFlight}
          className="mt-4 bg-purple-600 hover:bg-purple-700"
          disabled={isLoading}
          data-testid="btn-test-flight-empty"
        >
          <Rocket className={cn('w-4 h-4 mr-2', isLoading && 'animate-bounce')} />
          {isLoading ? 'Analyzing...' : 'Test Flight'}
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Insights
          </h3>
          {newInsights.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              {newInsights.length} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismissAll}
            disabled={activeInsights.length === 0}
            className="h-7 text-xs"
            data-testid="btn-dismiss-all"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Clear All
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRunTestFlight}
            disabled={isLoading}
            className="h-7 w-7"
            data-testid="btn-test-flight"
          >
            <Rocket className={cn('w-3.5 h-3.5', isLoading && 'animate-bounce')} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                data-testid="dropdown-insights-filter"
              >
                <Filter className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setListFilterMode('new')}
                className="flex items-center justify-between"
                data-testid="filter-new"
              >
                <span>New Only</span>
                {listFilterMode === 'new' && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setListFilterMode('all')}
                className="flex items-center justify-between"
                data-testid="filter-all"
              >
                <span>All</span>
                {listFilterMode === 'all' && <Check className="w-4 h-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="divide-y divide-border">
          {sortedInsights.map((insight) => {
            const styles = CATEGORY_STYLES[insight.category];
            const Icon = styles.icon;
            const isViewed = insight.status === 'viewed' || insight.status === 'explored';
            const isFocused = focusedInsightId === insight.id;
            const primaryNodeId = insight.relatedNodeIds[0];
            
            return (
              <div
                key={insight.id}
                ref={isFocused ? focusedRowRef : undefined}
                className={cn(
                  'px-4 py-3 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  isViewed && 'opacity-60',
                  isFocused && 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-400',
                )}
                onClick={() => {
                  onMarkViewed(insight.id);
                  if (primaryNodeId) {
                    onNavigateToNode?.(primaryNodeId);
                  }
                }}
                data-testid={`insight-${insight.id}`}
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
                      {primaryNodeId && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Focus className="w-3 h-3" />
                          {primaryNodeId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {insight.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                      {insight.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss(insight.id);
                        }}
                        className="h-6 text-xs text-gray-500 hover:text-gray-700"
                        data-testid={`btn-dismiss-${insight.id}`}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Dismiss
                      </Button>
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
