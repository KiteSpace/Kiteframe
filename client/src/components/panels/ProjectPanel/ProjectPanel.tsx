import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearch } from 'wouter';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ListTree, ClipboardList, ChevronLeft, ChevronRight, Sparkles, AlertTriangle, MessageCircle } from 'lucide-react';
import { KiteAITab } from './KiteAITab';
import { ProjectDocTab } from './ProjectDocTab';
import { LayersTab } from './LayersTab';
import { DiagnosticsTab } from './DiagnosticsTab';
import { CommentsTab } from './CommentsTab';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import type { SketchStroke } from '@/components/SketchCanvas';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';
import type { ApplyWorkflowPayload, ReplaceWorkflowPayload } from '@/components/KiteAIChat';
import { notifyRailGeometryChanged } from '@/stores/readerStore';

export type ProjectPanelTab = 'kite-ai' | 'project' | 'layers' | 'comments' | 'diagnostics';

const PANEL_COLLAPSED_KEY = 'kiteframe-project-panel-collapsed';
const PANEL_ACTIVE_TAB_KEY = 'kiteframe-project-panel-active-tab';
const PANEL_WIDTH_KEY = 'kiteframe-project-panel-width';

/** Query parameter that makes a panel directly linkable. */
const PANEL_QUERY_PARAM = 'panel';

const MIN_PANEL_WIDTH = 400;
const MAX_PANEL_WIDTH = 800;
const DEFAULT_PANEL_WIDTH = 600;
// Minimum canvas the rail must always leave visible to its left. Without this
// the rail is only clamped against constants, so a stored 800px width on a
// narrow window pushes the rail's right edge past the viewport.
const MIN_CANVAS_WIDTH = 320;

// Above this rail width every tab shows its label; below it only the active tab
// is labelled and the rest fall back to icons with tooltips. Measured against
// the rail itself rather than the window, because the rail is user-resizable
// and a media query would describe the wrong element entirely.
const WIDE_RAIL_BREAKPOINT = 480;

function clampPanelWidth(width: number): number {
  const fallback = Number.isFinite(width) ? width : DEFAULT_PANEL_WIDTH;
  const viewportCap =
    typeof window === 'undefined'
      ? MAX_PANEL_WIDTH
      : Math.max(MIN_PANEL_WIDTH, window.innerWidth - MIN_CANVAS_WIDTH);
  // MIN_PANEL_WIDTH is applied last so an extremely narrow window still yields
  // a usable rail rather than collapsing it to nothing.
  return Math.max(
    MIN_PANEL_WIDTH,
    Math.min(MAX_PANEL_WIDTH, Math.min(viewportCap, fallback)),
  );
}

interface ProjectPanelProps {
  nodes: Node[];
  edges: Edge[];
  frames?: any[];
  canvasObjects?: CanvasObject[];
  sketchStrokes?: SketchStroke[];
  projectId?: string;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
  onApplyWorkflow?: (workflow: ApplyWorkflowPayload) => void;
  onReplaceWorkflow?: (workflow: ReplaceWorkflowPayload) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
  isReadOnly?: boolean;
  shareUuid?: string;
  /** Project UUID used as the shared key for comments (editor + viewer). */
  commentWorkflowId?: string | null;
  /** Share UUID present in the view-only viewer; lets viewers post comments. */
  commentShareId?: string | null;
  cloudProjectId?: number | null;
  onShareCreated?: (shareUuid: string) => void;
  onStrokeSelect?: (index: number) => void;
  insights?: Insight[];
  insightsLoading?: boolean;
  insightsLastRunAt?: number | null;
  onRunTestFlight?: () => void;
  onDismissInsight?: (insightId: string) => void;
  onDismissAllInsights?: () => void;
  onMarkInsightViewed?: (insightId: string) => void;
  onMarkInsightExplored?: (insightId: string) => void;
  onDeferInsight?: (insightId: string) => void;
  onPromoteInsight?: (insightId: string) => void;
  onExploreInsight?: (insight: Insight) => void;
  onHoverInsight?: (insightId: string | null) => void;
  onInsightNavigateToNode?: (nodeId: string) => void;
  focusedInsightId?: string | null;
  forceTab?: ProjectPanelTab | null;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
  onOpenWorkflowImport?: () => void;
  // Propose Solution (Phase 2)
  onProposeSolution?: (insight: Insight) => void;
  hasActiveProposal?: boolean;
  generatingInsightId?: string | null;
  // Experiment (Phase 3)
  onStartExperiment?: (insight: Insight) => void;
  hasActiveExperiment?: boolean;
  generatingExperimentInsightId?: string | null;
  generationMode?: 'workflow' | 'design';
}

const tabConfig: { id: ProjectPanelTab; icon: typeof Sparkles; label: string; testId: string }[] = [
  { id: 'kite-ai', icon: Sparkles, label: 'KiteAI', testId: 'tab-kite-ai' },
  { id: 'project', icon: ClipboardList, label: 'Project', testId: 'tab-project' },
  { id: 'layers', icon: ListTree, label: 'Layers', testId: 'tab-layers' },
  { id: 'comments', icon: MessageCircle, label: 'Comments', testId: 'tab-comments' },
  { id: 'diagnostics', icon: AlertTriangle, label: 'Insights', testId: 'tab-insights' },
];

const DEFAULT_TAB: ProjectPanelTab = 'kite-ai';

function isPanelTab(value: string | null | undefined): value is ProjectPanelTab {
  return !!value && tabConfig.some(t => t.id === value);
}

/**
 * Notes used to be its own tab; it is now a section of the Project tab. Anyone
 * whose last session ended on Notes has 'notes' in localStorage, and an
 * unrecognised value would silently bounce them to KiteAI — so translate it to
 * where the content actually lives now.
 */
function migrateStoredTab(stored: string | null): ProjectPanelTab | null {
  if (stored === 'notes') return 'project';
  return isPanelTab(stored) ? stored : null;
}

export function ProjectPanel({ 
  nodes, 
  edges, 
  frames, 
  canvasObjects = [], 
  sketchStrokes,
  projectId,
  projectName,
  onProjectNameChange,
  onApplyWorkflow,
  onReplaceWorkflow,
  onPreviewWorkflow,
  isReadOnly = false,
  shareUuid,
  commentWorkflowId,
  commentShareId,
  cloudProjectId,
  onShareCreated,
  onStrokeSelect,
  insights = [],
  insightsLoading = false,
  insightsLastRunAt,
  onRunTestFlight,
  onDismissInsight,
  onDismissAllInsights,
  onMarkInsightViewed,
  onMarkInsightExplored,
  onDeferInsight,
  onPromoteInsight,
  onExploreInsight,
  onHoverInsight,
  onInsightNavigateToNode,
  focusedInsightId,
  forceTab,
  initialPrompt,
  onInitialPromptConsumed,
  onOpenWorkflowImport,
  onProposeSolution,
  hasActiveProposal = false,
  generatingInsightId = null,
  onStartExperiment,
  hasActiveExperiment = false,
  generatingExperimentInsightId = null,
  generationMode = 'workflow',
}: ProjectPanelProps) {
  const resizeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const search = useSearch();

  // A ?panel= link is an explicit instruction and outranks the tab the user
  // happened to leave open last time.
  const getInitialTab = (): ProjectPanelTab => {
    if (typeof window === 'undefined') return DEFAULT_TAB;
    try {
      const fromUrl = new URLSearchParams(search || window.location.search).get(PANEL_QUERY_PARAM);
      if (isPanelTab(fromUrl)) return fromUrl;
    } catch {}
    try {
      const stored = migrateStoredTab(localStorage.getItem(PANEL_ACTIVE_TAB_KEY));
      if (stored) return stored;
    } catch {}
    return DEFAULT_TAB;
  };

  const [activeTab, setActiveTab] = useState<ProjectPanelTab>(getInitialTab);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(PANEL_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
    try {
      const saved = localStorage.getItem(PANEL_WIDTH_KEY);
      const width = saved ? parseInt(saved) : DEFAULT_PANEL_WIDTH;
      return clampPanelWidth(width);
    } catch {
      return DEFAULT_PANEL_WIDTH;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isWide, setIsWide] = useState(() => DEFAULT_PANEL_WIDTH >= WIDE_RAIL_BREAKPOINT);

  /**
   * Panes stay mounted once visited, so returning to a tab restores its scroll
   * position and any half-typed message instead of rebuilding it from scratch.
   *
   * They are mounted lazily rather than all at once: Comments opens a websocket
   * and Layers spawns a worker on mount, and a pane mounted while hidden also
   * measures itself as zero-sized. Mounting on first visit avoids paying either
   * cost for tabs the user never opens.
   *
   * Project is seeded because it was already permanently mounted before this
   * rewrite (the view-only viewer seeds its storage and expects it present).
   */
  const [mountedTabs, setMountedTabs] = useState<Set<ProjectPanelTab>>(
    () => new Set<ProjectPanelTab>(['project', getInitialTab()]),
  );

  useEffect(() => {
    setMountedTabs(prev => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PANEL_COLLAPSED_KEY, String(isCollapsed));
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (!activeTab) return;
    try {
      localStorage.setItem(PANEL_ACTIVE_TAB_KEY, activeTab);
    } catch {}
  }, [activeTab]);

  /**
   * Mirror the open tab into ?panel= so the view can be linked and survives a
   * reload.
   *
   * The first render is deliberately skipped: the tab has not changed yet, and
   * writing on mount would race the editor's own startup replaceState (it
   * strips ?fromChat there). Existing parameters are preserved by rebuilding
   * from the live URL on every write rather than from a captured copy.
   */
  const hasSyncedUrl = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasSyncedUrl.current) {
      hasSyncedUrl.current = true;
      return;
    }
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(PANEL_QUERY_PARAM) === activeTab) return;
      url.searchParams.set(PANEL_QUERY_PARAM, activeTab);
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const newWidth = rect.left + rect.width - e.clientX;
      const clampedWidth = clampPanelWidth(newWidth);
      setPanelWidth(clampedWidth);
      if (typeof window !== 'undefined') {
        localStorage.setItem(PANEL_WIDTH_KEY, String(clampedWidth));
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Re-clamp on window resize. Clamping only on read and on drag leaves a
  // stored-wide rail hanging off the right edge as soon as the window narrows.
  //
  // The width itself is updated on every resize event so the rail tracks the
  // viewport, but the localStorage write is debounced to the end of the drag —
  // a continuous window resize fires this handler dozens of times a second and
  // a synchronous write per event is pure thrash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let persistHandle: number | undefined;
    const handleResize = () => {
      setPanelWidth(prev => clampPanelWidth(prev));
      window.clearTimeout(persistHandle);
      persistHandle = window.setTimeout(() => {
        setPanelWidth(current => {
          try {
            localStorage.setItem(PANEL_WIDTH_KEY, String(current));
          } catch {}
          return current;
        });
      }, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.clearTimeout(persistHandle);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // The reader pane shares the row with the rail and the canvas, and decides
  // whether to compress the canvas or overlay it from how much room is left.
  // A flex sibling resizing is not observable from the outside, so say it.
  useEffect(() => {
    notifyRailGeometryChanged();
  }, [panelWidth, isCollapsed]);

  /**
   * Decide label visibility from the rail's own measured width. Reading the
   * width state instead would miss the collapsed/expanded transition and any
   * width the rail takes from its container rather than from the drag handle.
   */
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      // A collapsed rail reports ~0 and must not flip the tab row to narrow
      // mode, or the labels visibly re-flow on every expand.
      if (width === 0) return;
      setIsWide(width >= WIDE_RAIL_BREAKPOINT);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isCollapsed]);

  useEffect(() => {
    if (forceTab) {
      setActiveTab(forceTab);
      if (isCollapsed) {
        setIsCollapsed(false);
      }
    }
  }, [forceTab]);

  const selectTab = useCallback((tab: ProjectPanelTab) => setActiveTab(tab), []);

  const newInsightCount = insights.filter(i => i.status === 'new').length;

  return (
    <>
      {isCollapsed && (
        <div
          className="h-full w-12 border-l border-border bg-background flex flex-col flex-shrink-0"
          data-testid="project-panel-collapsed"
        >
          <TooltipProvider delayDuration={100}>
            <div className="flex flex-col items-center pt-2 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsCollapsed(false)}
                    data-testid="button-expand-panel"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Expand Panel</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-col items-center gap-1 mt-2 border-t border-border pt-2">
              {tabConfig.map(({ id, icon: Icon, label }) => (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === id ? 'secondary' : 'ghost'}
                      size="icon"
                       className={`h-8 w-8 rounded-md data-[state=active]:bg-accent ${id === 'kite-ai' ? 'text-[color:var(--brand)]' : 'text-muted-foreground'}`}
                      onClick={() => {
                        selectTab(id);
                        setIsCollapsed(false);
                      }}
                      data-testid={`collapsed-tab-${id}`}
                    >
                      <Icon size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>
      )}
    <div 
      ref={panelRef}
       className={`kf-project-panel h-full border-l border-border bg-background flex flex-col flex-shrink-0 relative ${isWide ? 'is-wide' : ''} ${isCollapsed ? 'hidden' : ''}`}
      style={{ width: `${panelWidth}px` }}
      data-testid="project-panel"
      data-rail-wide={isWide ? 'true' : 'false'}
    >
      <div
        ref={resizeRef}
        onMouseDown={() => setIsResizing(true)}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize transition-colors group z-10"
        title="Drag to resize"
        data-testid="panel-resize-handle"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
      </div>
      <Tabs value={activeTab} onValueChange={(v) => selectTab(v as ProjectPanelTab)} className="flex flex-col h-full">
        <div className="h-[46px] border-b border-border flex items-center px-2 gap-[3px]">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-[22px] w-[22px] flex-shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setIsCollapsed(true)}
            data-testid="button-collapse-panel"
          >
            <ChevronRight size={16} />
          </Button>
          <ScrollArea className="flex-1">
            <TooltipProvider delayDuration={100}>
              <TabsList className="inline-flex h-full w-max min-w-full p-0 gap-[3px] bg-transparent">
                {tabConfig.map(({ id, icon: Icon, label, testId }) => {
                  const isActive = activeTab === id;
                  // The active tab always keeps its label so the rail never
                  // becomes an unlabelled row of icons at minimum width.
                  const showLabel = isWide || isActive;
                  const trigger = (
                    <TabsTrigger
                      value={id}
                      // Grey pill, never brand colour — the violet is reserved
                      // for the KiteAI icon so it reads as one accent, not as
                      // "this tab is selected".
                       className={`h-auto rounded-[7px] py-[5px] text-[12px] font-medium gap-[5px] relative data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:font-semibold ${showLabel ? 'px-[10px]' : 'px-2'}`}
                      data-testid={testId}
                      data-tip={showLabel ? undefined : label}
                      aria-label={label}
                    >
                       <Icon size={11} className={id === 'kite-ai' ? 'text-[color:var(--brand)]' : 'text-muted-foreground'} />
                      {showLabel && label}
                      {id === 'diagnostics' && newInsightCount > 0 && (
                         <span className="absolute -top-1 -right-1 min-w-4 h-4 px-[5px] text-[9px] font-bold leading-none rounded-full bg-info-soft text-info flex items-center justify-center">
                          {newInsightCount > 9 ? '9+' : newInsightCount}
                        </span>
                      )}
                    </TabsTrigger>
                  );

                  // Only unlabelled tabs need a tooltip to stay identifiable.
                  return showLabel ? (
                    <span key={id} className="contents">{trigger}</span>
                  ) : (
                    <Tooltip key={id}>
                      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                      <TooltipContent side="bottom">{label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </TabsList>
            </TooltipProvider>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>

        <TabsContent
          value="kite-ai"
          forceMount={mountedTabs.has('kite-ai') ? true : undefined}
          className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden"
        >
          <KiteAITab
            key={projectId || 'default'}
            projectId={projectId || 'default'}
            nodes={nodes}
            edges={edges}
            canvasObjects={canvasObjects}
            onApplyWorkflow={isReadOnly ? undefined : onApplyWorkflow}
            onReplaceWorkflow={isReadOnly ? undefined : onReplaceWorkflow}
            onPreviewWorkflow={isReadOnly ? undefined : onPreviewWorkflow}
            isReadOnly={isReadOnly}
            initialPrompt={initialPrompt}
            onInitialPromptConsumed={onInitialPromptConsumed}
            onOpenWorkflowImport={isReadOnly ? undefined : onOpenWorkflowImport}
            generationMode={generationMode}
          />
        </TabsContent>
        
        <TabsContent
          value="project"
          forceMount
          className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden"
        >
          <ProjectDocTab
            key={projectId || 'default'}
            projectId={projectId}
            projectName={projectName}
            nodes={nodes}
            edges={edges}
            canvasObjects={canvasObjects}
            onProjectNameChange={isReadOnly ? undefined : onProjectNameChange}
            isReadOnly={isReadOnly}
            shareUuid={shareUuid}
            cloudProjectId={cloudProjectId}
            onShareCreated={onShareCreated}
          />
        </TabsContent>
        
        <TabsContent
          value="layers"
          forceMount={mountedTabs.has('layers') ? true : undefined}
          className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden"
        >
          <LayersTab
            key={projectId || 'default'}
            nodes={nodes} 
            edges={edges} 
            frames={frames}
            canvasObjects={canvasObjects}
            sketchStrokes={sketchStrokes}
            projectId={projectId}
            isReadOnly={isReadOnly}
            onStrokeSelect={onStrokeSelect}
          />
        </TabsContent>
        
        <TabsContent
          value="comments"
          forceMount={mountedTabs.has('comments') ? true : undefined}
          className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden"
        >
          <CommentsTab
            key={commentWorkflowId || 'default'}
            workflowId={commentWorkflowId}
            shareId={commentShareId}
          />
        </TabsContent>

        <TabsContent
          value="diagnostics"
          forceMount={mountedTabs.has('diagnostics') ? true : undefined}
          className="flex-1 m-0 overflow-hidden data-[state=inactive]:hidden"
        >
          <DiagnosticsTab
            key={projectId || 'default'}
            insights={insights}
            isLoading={insightsLoading}
            edgeCount={edges.length}
            projectId={projectId}
            lastRunAt={insightsLastRunAt}
            onRunTestFlight={onRunTestFlight || (() => {})}
            onDismiss={onDismissInsight || (() => {})}
            onDismissAll={onDismissAllInsights || (() => {})}
            onMarkViewed={onMarkInsightViewed || (() => {})}
            onDefer={onDeferInsight || (() => {})}
            onPromote={onPromoteInsight || (() => {})}
            onExplore={onExploreInsight || (() => {})}
            onNavigateToNode={onInsightNavigateToNode}
            onHoverInsight={onHoverInsight}
            focusedInsightId={focusedInsightId}
            isReadOnly={isReadOnly}
            onProposeSolution={onProposeSolution}
            hasActiveProposal={hasActiveProposal}
            generatingInsightId={generatingInsightId}
            onStartExperiment={onStartExperiment}
            hasActiveExperiment={hasActiveExperiment}
            generatingExperimentInsightId={generatingExperimentInsightId}
          />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}

export default ProjectPanel;
