import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ListTree, FileText, Palette, Link2, FolderOpen } from 'lucide-react';
import { LayersTab } from './LayersTab';
import { NotesTab } from './NotesTab';
import { SpecsTab } from './SpecsTab';
import { SourcesTab } from './SourcesTab';
import { ProjectDetailsTab } from './ProjectDetailsTab';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

export type ProjectPanelTab = 'layers' | 'notes' | 'specs' | 'sources' | 'details';

interface ProjectPanelProps {
  nodes: Node[];
  edges: Edge[];
  frames?: any[];
  canvasObjects?: CanvasObject[];
  projectId?: string;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
}

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

  return (
    <div 
      className="h-full w-[360px] border-l border-border bg-card flex flex-col flex-shrink-0"
      data-testid="project-panel"
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProjectPanelTab)} className="flex flex-col h-full">
        <div className="border-b border-border">
          <ScrollArea className="w-full">
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
          />
        </TabsContent>
        
        <TabsContent value="notes" className="flex-1 m-0 overflow-hidden">
          <NotesTab projectId={projectId} />
        </TabsContent>
        
        <TabsContent value="specs" className="flex-1 m-0 overflow-hidden">
          <SpecsTab nodes={nodes} edges={edges} canvasObjects={canvasObjects} />
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
