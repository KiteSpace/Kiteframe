import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ListTree, FileText, Palette, Link2, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { LayersTab } from './LayersTab';
import { NotesTab } from './NotesTab';
import { SpecsTab } from './SpecsTab';
import { SourcesTab } from './SourcesTab';
import { ProjectDetailsTab } from './ProjectDetailsTab';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

export type ProjectPanelTab = 'layers' | 'notes' | 'specs' | 'sources' | 'details';

const PANEL_COLLAPSED_KEY = 'kiteframe-project-panel-collapsed';

interface ProjectPanelProps {
  nodes: Node[];
  edges: Edge[];
  frames?: any[];
  canvasObjects?: CanvasObject[];
  projectId?: string;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
}

const tabIcons = {
  layers: ListTree,
  notes: FileText,
  specs: Palette,
  sources: Link2,
  details: FolderOpen
};

const tabLabels = {
  layers: 'Layers',
  notes: 'Notes',
  specs: 'Specs',
  sources: 'Sources',
  details: 'Details'
};

export function ProjectPanel({ 
  nodes, 
  edges, 
  frames, 
  canvasObjects, 
  projectId,
  projectName,
  onProjectNameChange 
}: ProjectPanelProps) {
  const [activeTab, setActiveTab] = useState<ProjectPanelTab>('layers');
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(PANEL_COLLAPSED_KEY);
    return saved === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PANEL_COLLAPSED_KEY, String(isCollapsed));
    }
  }, [isCollapsed]);

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
            {(Object.keys(tabIcons) as ProjectPanelTab[]).map(tab => {
              const Icon = tabIcons[tab];
              return (
                <Tooltip key={tab}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === tab ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setActiveTab(tab);
                        setIsCollapsed(false);
                      }}
                      data-testid={`collapsed-tab-${tab}`}
                    >
                      <Icon size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{tabLabels[tab]}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div 
      className="h-full w-[360px] border-l border-border bg-card flex flex-col flex-shrink-0"
      data-testid="project-panel"
    >
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
            <TabsList className="inline-flex h-10 w-max min-w-full p-1 gap-1">
              <TabsTrigger 
                value="layers" 
                className="text-xs px-3 gap-1.5 data-[state=active]:bg-background" 
                data-testid="tab-layers"
              >
                <ListTree size={14} />
                Layers
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="text-xs px-3 gap-1.5 data-[state=active]:bg-background" 
                data-testid="tab-notes"
              >
                <FileText size={14} />
                Notes
              </TabsTrigger>
              <TabsTrigger 
                value="specs" 
                className="text-xs px-3 gap-1.5 data-[state=active]:bg-background" 
                data-testid="tab-specs"
              >
                <Palette size={14} />
                Specs
              </TabsTrigger>
              <TabsTrigger 
                value="sources" 
                className="text-xs px-3 gap-1.5 data-[state=active]:bg-background" 
                data-testid="tab-sources"
              >
                <Link2 size={14} />
                Sources
              </TabsTrigger>
              <TabsTrigger 
                value="details" 
                className="text-xs px-3 gap-1.5 data-[state=active]:bg-background" 
                data-testid="tab-details"
              >
                <FolderOpen size={14} />
                Details
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>
        
        <TabsContent value="layers" className="flex-1 m-0 overflow-hidden">
          <LayersTab 
            nodes={nodes} 
            edges={edges} 
            frames={frames} 
            canvasObjects={canvasObjects}
            projectId={projectId}
          />
        </TabsContent>
        
        <TabsContent value="notes" className="flex-1 m-0 overflow-hidden">
          <NotesTab projectId={projectId} />
        </TabsContent>
        
        <TabsContent value="specs" className="flex-1 m-0 overflow-hidden">
          <SpecsTab nodes={nodes} edges={edges} canvasObjects={canvasObjects} projectId={projectId} />
        </TabsContent>
        
        <TabsContent value="sources" className="flex-1 m-0 overflow-hidden">
          <SourcesTab projectId={projectId} />
        </TabsContent>
        
        <TabsContent value="details" className="flex-1 m-0 overflow-hidden">
          <ProjectDetailsTab 
            projectId={projectId} 
            projectName={projectName}
            onProjectNameChange={onProjectNameChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectPanel;
