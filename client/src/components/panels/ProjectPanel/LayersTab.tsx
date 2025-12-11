import LayersPanel from '@/components/layers/LayersPanel';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

interface LayersTabProps {
  nodes: Node[];
  edges: Edge[];
  frames?: any[];
  canvasObjects?: CanvasObject[];
  projectId?: string;
}

export function LayersTab({ nodes, edges, frames, canvasObjects, projectId }: LayersTabProps) {
  return (
    <div className="h-full overflow-hidden" data-testid="layers-tab">
      <LayersPanel 
        nodes={nodes} 
        edges={edges} 
        frames={frames} 
        canvasObjects={canvasObjects}
        projectId={projectId}
      />
    </div>
  );
}

export default LayersTab;
