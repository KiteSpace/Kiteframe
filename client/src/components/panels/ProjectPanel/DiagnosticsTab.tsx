import { memo, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Rocket, Info, Check, Eye, Focus, Filter, X, Clock, FileText, Compass, Lightbulb } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Insight, InsightCategory, InsightStatus } from '@/lib/kiteframe/utils/insights/types';
import { isFeatureEnabled } from '@/config/featureFlags';

type ListFilterMode = 'new' | 'all';

interface DiagnosticsTabProps {
  insights: Insight[];
  isLoading: boolean;
  edgeCount: number;
  projectId?: string;
  lastRunAt?: number | null;
  onRunTestFlight: () => void;
  onDismiss: (insightId: string) => void;
  onDismissAll: () => void;
  onMarkViewed: (insightId: string) => void;
  onDefer: (insightId: string) => void;
  onPromote: (insightId: string) => void;
  onExplore: (insight: Insight) => void;
  onNavigateToNode?: (nodeId: string) => void;
  onHoverInsight?: (insightId: string | null) => void;
  focusedInsightId?: string | null;
  // Propose Solution (Phase 1)
  onProposeSolution?: (insight: Insight) => void;
  hasActiveProposal?: boolean;
  isProposalGenerating?: boolean;
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

const STATUS_ORDER: Record<InsightStatus, number> = {
  new: 0,
  viewed: 1,
  deferred: 2,
  explored: 3,
  promoted: 4,
  dismissed: 5,
};

const MIN_EDGES_FOR_TEST_FLIGHT = 2;

export const DiagnosticsTab = memo(function DiagnosticsTab({
  insights,
  isLoading,
  edgeCount,
  projectId,
  lastRunAt,
  onRunTestFlight,
  onDismiss,
  onDismissAll,
  onMarkViewed,
  onDefer,
  onPromote,
  onExplore,
  onNavigateToNode,
  onHoverInsight,
  focusedInsightId,
  onProposeSolution,
  hasActiveProposal = false,
  isProposalGenerating = false,
}: DiagnosticsTabProps) {
  const showProposeSolution = isFeatureEnabled('PROPOSE_SOLUTION_PREVIEW') && !hasActiveProposal;
  const canRunTestFlight = edgeCount >= MIN_EDGES_FOR_TEST_FLIGHT;
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedRowRef = useRef<HTMLDivElement>(null);
  const [listFilterMode, setListFilterMode] = useState<ListFilterMode>('new');
  
  const handleTestFlightClick = () => {
    console.log('[DiagnosticsTab] Test Flight button clicked', {
      projectId,
      edgeCount,
      minRequired: MIN_EDGES_FOR_TEST_FLIGHT,
      canRunTestFlight,
      isLoading,
    });
    onRunTestFlight();
  };
  
  const hasRunTestFlight = lastRunAt !== null && lastRunAt !== undefined;
  const [categoryFilter, setCategoryFilter] = useState<Set<InsightCategory>>(new Set<InsightCategory>(['observation', 'suggestion', 'note']));
  
  const toggleCategory = (category: InsightCategory) => {
    setCategoryFilter(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        if (next.size > 1) {
          next.delete(category);
        }
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  const activeInsights = insights.filter(i => i.status !== 'dismissed');
  const newInsights = activeInsights.filter(i => i.status === 'new');
  
  const filteredInsights = (listFilterMode === 'new' 
    ? activeInsights.filter(i => i.status === 'new')
    : activeInsights
  ).filter(i => categoryFilter.has(i.category));
  
  const sortedInsights = [...filteredInsights].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
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
    if (hasRunTestFlight) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Test Flight Successful
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
            No issues detected. Your workflow looks good!
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Last run: {new Date(lastRunAt!).toLocaleTimeString()}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestFlightClick}
            className="mt-4"
            disabled={isLoading}
            data-testid="btn-rerun-test-flight"
          >
            <Rocket className={cn('w-4 h-4 mr-2', isLoading && 'animate-bounce')} />
            {isLoading ? 'Analyzing...' : 'Re-run Test Flight'}
          </Button>
        </div>
      );
    }
    
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
        {!canRunTestFlight && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 max-w-xs">
            Add at least 3 connected nodes to the canvas to run insight analysis
          </p>
        )}
        <Button
          variant="default"
          size="sm"
          onClick={handleTestFlightClick}
          className="mt-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={isLoading || !canRunTestFlight}
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
      <div className="flex flex-col border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
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
              onClick={handleTestFlightClick}
              disabled={isLoading || !canRunTestFlight}
              className="h-7 w-7"
              data-testid="btn-test-flight"
              title={!canRunTestFlight ? 'Add at least 3 connected nodes to run insight analysis' : 'Run Test Flight'}
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
                <DropdownMenuLabel className="text-xs text-gray-500">Status</DropdownMenuLabel>
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
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-gray-500">Categories</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={categoryFilter.has('observation')}
                  onCheckedChange={() => toggleCategory('observation')}
                  data-testid="filter-observation"
                >
                  <Eye className="w-3.5 h-3.5 mr-2 text-purple-500" />
                  Observations
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={categoryFilter.has('suggestion')}
                  onCheckedChange={() => toggleCategory('suggestion')}
                  data-testid="filter-suggestion"
                >
                  <Info className="w-3.5 h-3.5 mr-2 text-blue-500" />
                  Suggestions
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={categoryFilter.has('note')}
                  onCheckedChange={() => toggleCategory('note')}
                  data-testid="filter-note"
                >
                  <Info className="w-3.5 h-3.5 mr-2 text-gray-500" />
                  Notes
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {!canRunTestFlight && (
          <p className="px-4 pb-3 text-xs text-amber-600 dark:text-amber-400">
            Add at least 3 connected nodes to the canvas to run insight analysis
          </p>
        )}
      </div>
      
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="divide-y divide-border">
          {sortedInsights.map((insight) => {
            const styles = CATEGORY_STYLES[insight.category];
            const Icon = styles.icon;
            const isViewed = insight.status === 'viewed' || insight.status === 'explored' || insight.status === 'deferred';
            const isPromoted = insight.status === 'promoted';
            const isDeferred = insight.status === 'deferred';
            const isFocused = focusedInsightId === insight.id;
            const primaryNodeId = insight.relatedNodeIds[0];
            const hasExplorationContext = !!insight.explorationContext;
            
            return (
              <div
                key={insight.id}
                ref={isFocused ? focusedRowRef : undefined}
                className={cn(
                  'px-4 py-3 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  isViewed && !isPromoted && 'opacity-60',
                  isPromoted && 'bg-green-50 dark:bg-green-900/10 border-l-2 border-green-500',
                  isDeferred && 'bg-yellow-50 dark:bg-yellow-900/10 border-l-2 border-yellow-500',
                  isFocused && 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-400',
                )}
                onClick={() => {
                  if (primaryNodeId) {
                    onNavigateToNode?.(primaryNodeId);
                  }
                }}
                onMouseEnter={() => onHoverInsight?.(insight.id)}
                onMouseLeave={() => onHoverInsight?.(null)}
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
                      {isPromoted && (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          In PRD
                        </span>
                      )}
                      {isDeferred && (
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Deferred
                        </span>
                      )}
                      {primaryNodeId && !isPromoted && !isDeferred && (
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
                    <div className="flex items-center gap-1 flex-wrap">
                      {showProposeSolution && insight.relatedNodeIds.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onProposeSolution?.(insight);
                          }}
                          disabled={isProposalGenerating}
                          className="h-6 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          data-testid={`btn-propose-${insight.id}`}
                        >
                          <Lightbulb className={cn('w-3 h-3 mr-1', isProposalGenerating && 'animate-pulse')} />
                          {isProposalGenerating ? 'Generating...' : 'Propose'}
                        </Button>
                      )}
                      {hasExplorationContext && insight.status !== 'explored' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onExplore(insight);
                          }}
                          className="h-6 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          data-testid={`btn-explore-${insight.id}`}
                        >
                          <Compass className="w-3 h-3 mr-1" />
                          Explore
                        </Button>
                      )}
                      {!isPromoted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPromote(insight.id);
                          }}
                          className="h-6 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          data-testid={`btn-promote-${insight.id}`}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Add to PRD
                        </Button>
                      )}
                      {!isDeferred && insight.status !== 'explored' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDefer(insight.id);
                          }}
                          className="h-6 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          data-testid={`btn-defer-${insight.id}`}
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Defer
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss(insight.id);
                        }}
                        className="h-6 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
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
