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
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
  onViewportChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo
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

      {/* Undo/Redo Controls */}
      <div className="absolute bottom-5 left-5 flex flex-col gap-2">
        <button
          className={`w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center transition-colors shadow-lg ${
            canUndo ? 'hover:bg-accent text-foreground' : 'opacity-50 cursor-not-allowed text-muted-foreground'
          }`}
          onClick={canUndo ? onUndo : undefined}
          disabled={!canUndo}
          data-testid="button-undo"
          title="Undo (Cmd+Z)"
        >
          <i className="fas fa-undo text-sm" />
        </button>
        <button
          className={`w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center transition-colors shadow-lg ${
            canRedo ? 'hover:bg-accent text-foreground' : 'opacity-50 cursor-not-allowed text-muted-foreground'
          }`}
          onClick={canRedo ? onRedo : undefined}
          disabled={!canRedo}
          data-testid="button-redo"
          title="Redo (Cmd+Shift+Z)"
        >
          <i className="fas fa-redo text-sm" />
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
