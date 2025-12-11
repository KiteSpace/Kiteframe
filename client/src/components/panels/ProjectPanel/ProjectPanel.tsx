import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ListTree, FileText, FolderOpen } from 'lucide-react';
import { LayersTab } from './LayersTab';
import { NotesTab } from './NotesTab';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

export type ProjectPanelTab = 'layers' | 'notes';

interface ProjectPanelProps {
  nodes: Node[];
  edges: Edge[];
  frames?: any[];
  canvasObjects?: CanvasObject[];
  projectId?: string;
}

export function ProjectPanel({ nodes, edges, frames, canvasObjects, projectId }: ProjectPanelProps) {
  const [activeTab, setActiveTab] = useState<ProjectPanelTab>('layers');

  return (
    <div 
      className="h-full w-[360px] border-l border-border bg-card flex flex-col"
      data-testid="project-panel"
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProjectPanelTab)} className="flex flex-col h-full">
        <div className="border-b border-border px-2 pt-2">
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="layers" className="text-xs gap-1.5" data-testid="tab-layers">
              <ListTree size={14} />
              Layers
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1.5" data-testid="tab-notes">
              <FileText size={14} />
              Notes
            </TabsTrigger>
          </TabsList>
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
      </Tabs>
    </div>
  );
}

export default ProjectPanel;
