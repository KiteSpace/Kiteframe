import { useState, useCallback } from 'react';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import type { Node, Edge } from '../lib/kiteframe/types';
import { Undo, Redo, ZoomIn, Maximize2 } from 'lucide-react';

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
  const [isDraggingMinimap, setIsDraggingMinimap] = useState(false);

  const handleMinimapMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDraggingMinimap(true);
    // Calculate position within minimap and update viewport
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2000 - 200;
    const y = ((e.clientY - rect.top) / rect.height) * 1500 - 150;
    onViewportChange({ ...viewport, x: Math.max(0, Math.min(1800, x)), y: Math.max(0, Math.min(1350, y)) });
  }, [viewport, onViewportChange]);

  const handleMinimapMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingMinimap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2000 - 200;
    const y = ((e.clientY - rect.top) / rect.height) * 1500 - 150;
    onViewportChange({ ...viewport, x: Math.max(0, Math.min(1800, x)), y: Math.max(0, Math.min(1350, y)) });
  }, [isDraggingMinimap, viewport, onViewportChange]);

  const handleMinimapMouseUp = useCallback(() => {
    setIsDraggingMinimap(false);
  }, []);

  const handleMinimapWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, viewport.zoom * zoomDelta));
    onViewportChange({ ...viewport, zoom: newZoom });
  }, [viewport, onViewportChange]);
  return (
    <div className="relative w-full h-full">
      {/* Grid Background */}
      <div className="kiteframe-grid absolute inset-0" />
      
      <KiteFrameCanvas
        nodes={nodes}
        edges={edges}
        viewport={viewport}
        onViewportChange={onViewportChange}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onCanvasClick={onCanvasClick}
        onNodeRightClick={onNodeRightClick}
        gridType="dots"
        minZoom={0.1}
        maxZoom={3}
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
          <Undo size={16} />
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
          <Redo size={16} />
        </button>
        <button
          className="w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center hover:bg-accent transition-colors shadow-lg"
          onClick={() => onViewportChange({ x: 100, y: 100, zoom: 1 })}
          data-testid="button-zoom-fit"
          title="Fit to View"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Interactive Mini-map */}
      <div className="absolute bottom-5 right-5 w-52 h-40 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
        <div 
          className="w-full h-full bg-muted/20 relative cursor-pointer select-none"
          onMouseDown={handleMinimapMouseDown}
          onMouseMove={handleMinimapMouseMove}
          onMouseUp={handleMinimapMouseUp}
          onMouseLeave={handleMinimapMouseUp}
          onWheel={handleMinimapWheel}
        >
          <div className="absolute inset-2 border border-primary/30 rounded bg-background">
            {/* Mini nodes with actual positions */}
            {nodes.map((node) => {
              const scaledX = (node.position.x / 2000) * 100;
              const scaledY = (node.position.y / 1500) * 100;
              return (
                <div
                  key={node.id}
                  className={`absolute w-2 h-2 rounded-sm ${
                    node.type === 'input' ? 'bg-blue-400' :
                    node.type === 'ai' ? 'bg-purple-400' :
                    node.type === 'condition' ? 'bg-yellow-400' :
                    node.type === 'output' ? 'bg-red-400' :
                    node.type === 'process' ? 'bg-green-400' :
                    node.type === 'image' ? 'bg-indigo-400' : 'bg-gray-400'
                  } ${node.selected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  style={{
                    left: `${Math.max(0, Math.min(95, scaledX))}%`,
                    top: `${Math.max(0, Math.min(95, scaledY))}%`
                  }}
                />
              );
            })}
            {/* Interactive Viewport indicator */}
            <div
              className={`absolute border-2 border-primary rounded cursor-move ${
                isDraggingMinimap ? 'bg-primary/20' : 'bg-primary/10'
              } transition-colors`}
              style={{
                left: `${(viewport.x / 2000) * 100}%`,
                top: `${(viewport.y / 1500) * 100}%`,
                width: `${Math.min(40, (800 / viewport.zoom / 2000) * 100)}%`,
                height: `${Math.min(60, (600 / viewport.zoom / 1500) * 100)}%`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
