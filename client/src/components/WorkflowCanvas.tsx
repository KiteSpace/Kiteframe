import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import type { Node, Edge } from '../lib/kiteframe/types';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onConnect: (connection: { source: string; target: string }) => void;
  onNodeClick?: (e: React.MouseEvent, node: Node) => void;
  onCanvasClick?: () => void;
  onNodeRightClick?: (e: React.MouseEvent, node: Node) => void;
  viewport: { x: number; y: number; zoom: number };
  onViewportChange: (viewport: { x: number; y: number; zoom: number }) => void;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onCanvasClick,
  onNodeRightClick,
  viewport,
  onViewportChange
}: WorkflowCanvasProps) {
  return (
    <div className="relative w-full h-full">
      {/* Grid Background */}
      <div className="kiteframe-grid absolute inset-0" />
      
      <KiteFrameCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onCanvasClick={onCanvasClick}
        onNodeRightClick={onNodeRightClick}
        className="w-full h-full"
        data-testid="workflow-canvas"
      />

      {/* Zoom Controls */}
      <div className="absolute bottom-5 left-5 flex flex-col gap-2">
        <button
          className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center hover:bg-accent transition-colors shadow-lg"
          onClick={() => onViewportChange({ ...viewport, zoom: Math.min(3, viewport.zoom * 1.2) })}
          data-testid="button-zoom-in"
          title="Zoom In"
        >
          <i className="fas fa-plus text-sm" />
        </button>
        <button
          className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center hover:bg-accent transition-colors shadow-lg"
          onClick={() => onViewportChange({ ...viewport, zoom: Math.max(0.1, viewport.zoom * 0.8) })}
          data-testid="button-zoom-out"
          title="Zoom Out"
        >
          <i className="fas fa-minus text-sm" />
        </button>
        <button
          className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center hover:bg-accent transition-colors shadow-lg"
          onClick={() => onViewportChange({ x: 100, y: 100, zoom: 1 })}
          data-testid="button-zoom-fit"
          title="Fit to View"
        >
          <i className="fas fa-expand-arrows-alt text-sm" />
        </button>
      </div>

      {/* Mini-map */}
      <div className="absolute bottom-5 right-5 w-52 h-40 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
        <div className="w-full h-full bg-muted/20 relative">
          <div className="absolute inset-2 border border-primary/30 rounded bg-background">
            {/* Mini nodes */}
            {nodes.map((node, index) => (
              <div
                key={node.id}
                className={`absolute w-3 h-2 rounded-sm ${
                  node.type === 'input' ? 'bg-blue-400' :
                  node.type === 'ai' ? 'bg-purple-400' :
                  node.type === 'condition' ? 'bg-yellow-400' :
                  node.type === 'output' ? 'bg-red-400' : 'bg-gray-400'
                }`}
                style={{
                  left: `${20 + (index % 2) * 30}%`,
                  top: `${30 + Math.floor(index / 2) * 40}%`
                }}
              />
            ))}
            {/* Viewport indicator */}
            <div
              className="absolute border-2 border-primary rounded"
              style={{
                left: '10%',
                top: '10%',
                width: '40%',
                height: '60%',
                background: 'hsla(221.2, 83.2%, 53.3%, 0.1)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
