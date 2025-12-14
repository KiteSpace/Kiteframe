import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ListTree, ClipboardList, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { KiteAITab } from './KiteAITab';
import { ProjectDocTab } from './ProjectDocTab';
import { LayersTab } from './LayersTab';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

export type ProjectPanelTab = 'kite-ai' | 'project' | 'layers';

const PANEL_COLLAPSED_KEY = 'kiteframe-project-panel-collapsed';
const PANEL_ACTIVE_TAB_KEY = 'kiteframe-project-panel-active-tab';

interface ProjectPanelProps {
  nodes: Node[];
  edges: Edge[];
  frames?: any[];
  canvasObjects?: CanvasObject[];
  projectId?: string;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
  onApplyWorkflow?: (workflow: { nodes: Node[]; edges: Edge[]; canvasObjects?: CanvasObject[] }) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
}

const tabConfig: { id: ProjectPanelTab; icon: typeof Sparkles; label: string }[] = [
  { id: 'kite-ai', icon: Sparkles, label: 'KiteAI' },
  { id: 'project', icon: ClipboardList, label: 'Project' },
  { id: 'layers', icon: ListTree, label: 'Layers' }
];

export function ProjectPanel({ 
  nodes, 
  edges, 
  frames, 
  canvasObjects = [], 
  projectId,
  projectName,
  onProjectNameChange,
  onApplyWorkflow,
  onPreviewWorkflow
}: ProjectPanelProps) {
  const resizeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const getStoredTab = (): ProjectPanelTab => {
    if (typeof window === 'undefined') return 'kite-ai';
    try {
      const saved = localStorage.getItem(PANEL_ACTIVE_TAB_KEY);
      if (saved && tabConfig.some(t => t.id === saved)) {
        return saved as ProjectPanelTab;
      }
    } catch {}
    return 'kite-ai';
  };

  const [activeTab, setActiveTab] = useState<ProjectPanelTab>(() => getStoredTab());
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(PANEL_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 600;
    try {
      const saved = localStorage.getItem('kiteframe-project-panel-width');
      const width = saved ? parseInt(saved) : 600;
      return Math.max(400, Math.min(800, width));
    } catch {
      return 600;
    }
  });
  const [isResizing, setIsResizing] = useState(false);

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

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const newWidth = rect.left + rect.width - e.clientX;
      const clampedWidth = Math.max(400, Math.min(800, newWidth));
      setPanelWidth(clampedWidth);
      if (typeof window !== 'undefined') {
        localStorage.setItem('kiteframe-project-panel-width', String(clampedWidth));
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

  if (isCollapsed) {
    return (
      <div 
        className="h-full w-12 border-l border-border bg-card flex flex-col flex-shrink-0"
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
                    className={`h-8 w-8 ${id === 'kite-ai' ? 'text-purple-500' : ''}`}
                    onClick={() => {
                      setActiveTab(id);
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
    );
  }

  return (
    <div 
      ref={panelRef}
      className="h-full border-l border-border bg-card flex flex-col flex-shrink-0 relative"
      style={{ width: `${panelWidth}px` }}
      data-testid="project-panel"
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProjectPanelTab)} className="flex flex-col h-full">
        <div className="border-b border-border flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-8 flex-shrink-0"
            onClick={() => setIsCollapsed(true)}
            data-testid="button-collapse-panel"
          >
            <ChevronRight size={16} />
          </Button>
          <ScrollArea className="flex-1">
            <TabsList className="inline-flex h-10 w-max min-w-full p-1 gap-1 bg-transparent">
              <TabsTrigger 
                value="kite-ai" 
                className="text-xs px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-purple-500" 
                data-testid="tab-kite-ai"
              >
                <Sparkles size={14} className="text-purple-500" />
                KiteAI
              </TabsTrigger>
              <TabsTrigger 
                value="project" 
                className="text-xs px-3 gap-1.5 data-[state=active]:bg-background" 
                data-testid="tab-project"
              >
                <ClipboardList size={14} />
                Project
              </TabsTrigger>
              <TabsTrigger 
                value="layers" 
                className="text-xs px-3 gap-1.5 data-[state=active]:bg-background" 
                data-testid="tab-layers"
              >
                <ListTree size={14} />
                Layers
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>
        
        <TabsContent value="kite-ai" className="flex-1 m-0 overflow-hidden">
          <KiteAITab
            key={projectId || 'default'}
            projectId={projectId || 'default'}
            nodes={nodes}
            edges={edges}
            canvasObjects={canvasObjects}
            onApplyWorkflow={onApplyWorkflow}
            onPreviewWorkflow={onPreviewWorkflow}
          />
        </TabsContent>
        
        <TabsContent value="project" className="flex-1 m-0 overflow-hidden">
          <ProjectDocTab
            key={projectId || 'default'}
            projectId={projectId}
            projectName={projectName}
            nodes={nodes}
            edges={edges}
            canvasObjects={canvasObjects}
            onProjectNameChange={onProjectNameChange}
          />
        </TabsContent>
        
        <TabsContent value="layers" className="flex-1 m-0 overflow-hidden">
          <LayersTab
            key={projectId || 'default'}
            nodes={nodes} 
            edges={edges} 
            frames={frames}
            canvasObjects={canvasObjects}
            projectId={projectId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectPanel;
