import { useState, useCallback, useEffect } from 'react';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import { ObjectStylingPanel } from '../lib/kiteframe/components/styling/ObjectStylingPanel';
import type { Node, Edge, CanvasObject, ProFeaturesConfig, TextNodeData, ShapeNodeData, StickyNoteData } from '../lib/kiteframe/types';
import { Undo, Redo, ZoomIn, Maximize2, LayoutGrid, ChevronRight } from 'lucide-react';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onCanvasObjectsChange?: (objects: CanvasObject[]) => void;
  onConnect: (connection: { source: string; target: string }) => void;
  onNodeClick?: (e: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (edge: Edge) => void;
  onCanvasClick?: () => void;
  onNodeRightClick?: (e: React.MouseEvent, node: Node) => void;
  onCanvasObjectRightClick?: (e: React.MouseEvent, canvasObject: CanvasObject) => void;
  onImageButtonClick?: (nodeId: string) => void;
  viewport: { x: number; y: number; zoom: number };
  onViewportChange: (viewport: { x: number; y: number; zoom: number }) => void;
  onFitView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAutoLayout: (layoutType: string) => void;
  selectedNodeIds?: string[];
  enablePlugins?: boolean;
  proFeatures?: ProFeaturesConfig;
  onQuickAdd?: (sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left') => void;
  workflowName?: string;
  onWorkflowNameChange?: (name: string) => void;
  onEdgeReconnect?: (edgeId: string, newSource: string, newTarget: string) => void;
  connectionAnimationConfig?: any;
}

export function WorkflowCanvas({
  nodes,
  edges,
  canvasObjects = [],
  onNodesChange,
  onEdgesChange,
  onCanvasObjectsChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onCanvasClick,
  onNodeRightClick,
  onCanvasObjectRightClick,
  onImageButtonClick,
  viewport,
  onViewportChange,
  onFitView,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAutoLayout,
  selectedNodeIds,
  enablePlugins,
  proFeatures,
  onQuickAdd,
  workflowName,
  onWorkflowNameChange,
  onEdgeReconnect,
  connectionAnimationConfig
}: WorkflowCanvasProps) {
  const [isDraggingMinimap, setIsDraggingMinimap] = useState(false);
  
  // Get selected canvas objects for styling panel
  const selectedCanvasObjects = canvasObjects.filter(obj => obj.selected);
  
  // Handler for updating object styling
  const handleUpdateObjectStyling = useCallback((objectId: string, updates: Partial<TextNodeData | ShapeNodeData | StickyNoteData>) => {
    const updatedObjects = canvasObjects.map(obj =>
      obj.id === objectId
        ? { ...obj, data: { ...obj.data, ...updates } }
        : obj
    );
    onCanvasObjectsChange?.(updatedObjects);
  }, [canvasObjects, onCanvasObjectsChange]);

  const handleMinimapMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDraggingMinimap(true);
    e.preventDefault();
    
    // Get minimap click position relative to minimap bounds
    const rect = e.currentTarget.getBoundingClientRect();
    const minimapClickX = e.clientX - rect.left;
    const minimapClickY = e.clientY - rect.top;
    
    // Account for the 8px padding in the minimap (inset-2)
    const contentWidth = rect.width - 16; // 8px padding on each side
    const contentHeight = rect.height - 16;
    const contentOffsetX = 8;
    const contentOffsetY = 8;
    
    // Calculate relative position within the content area
    const relativeX = Math.max(0, Math.min(1, (minimapClickX - contentOffsetX) / contentWidth));
    const relativeY = Math.max(0, Math.min(1, (minimapClickY - contentOffsetY) / contentHeight));
    
    // Map to world coordinates (assuming 2000x1500 world space)
    const worldWidth = 2000;
    const worldHeight = 1500;
    const worldClickX = relativeX * worldWidth;
    const worldClickY = relativeY * worldHeight;
    
    // Calculate canvas dimensions
    const canvasWidth = 800;
    const canvasHeight = 600;
    
    // Calculate new viewport to center the clicked world position on screen
    const newViewportX = (canvasWidth / 2) - (worldClickX * viewport.zoom);
    const newViewportY = (canvasHeight / 2) - (worldClickY * viewport.zoom);
    
    console.log('🗺️ MINIMAP CLICK:', {
      click: { x: minimapClickX, y: minimapClickY },
      relative: { x: relativeX, y: relativeY },
      worldClick: { x: worldClickX, y: worldClickY },
      viewport: { x: newViewportX, y: newViewportY, zoom: viewport.zoom }
    });
    
    onViewportChange({ 
      x: newViewportX,
      y: newViewportY,
      zoom: viewport.zoom
    });
  }, [viewport, onViewportChange]);

  const handleMinimapMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingMinimap) return;
    e.preventDefault();
    
    // Get minimap click position relative to minimap bounds
    const rect = e.currentTarget.getBoundingClientRect();
    const minimapClickX = e.clientX - rect.left;
    const minimapClickY = e.clientY - rect.top;
    
    // Account for the 8px padding in the minimap (inset-2)
    const contentWidth = rect.width - 16; // 8px padding on each side
    const contentHeight = rect.height - 16;
    const contentOffsetX = 8;
    const contentOffsetY = 8;
    
    // Calculate relative position within the content area
    const relativeX = Math.max(0, Math.min(1, (minimapClickX - contentOffsetX) / contentWidth));
    const relativeY = Math.max(0, Math.min(1, (minimapClickY - contentOffsetY) / contentHeight));
    
    // Map to world coordinates (assuming 2000x1500 world space)
    const worldWidth = 2000;
    const worldHeight = 1500;
    const worldClickX = relativeX * worldWidth;
    const worldClickY = relativeY * worldHeight;
    
    // Calculate canvas dimensions
    const canvasWidth = 800;
    const canvasHeight = 600;
    
    // Calculate new viewport to center the clicked world position on screen
    const newViewportX = (canvasWidth / 2) - (worldClickX * viewport.zoom);
    const newViewportY = (canvasHeight / 2) - (worldClickY * viewport.zoom);
    
    onViewportChange({ 
      x: newViewportX,
      y: newViewportY,
      zoom: viewport.zoom
    });
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
        canvasObjects={canvasObjects}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onCanvasObjectsChange={onCanvasObjectsChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={(e, edge) => onEdgeClick?.(edge)}
        onCanvasClick={onCanvasClick}
        onNodeRightClick={onNodeRightClick}
        onCanvasObjectRightClick={onCanvasObjectRightClick}
        onImageButtonClick={onImageButtonClick}
        viewport={viewport}
        onViewportChange={onViewportChange}
        selectedNodes={selectedNodeIds || []}
        gridType="dots"
        minZoom={0.1}
        maxZoom={3}
        enablePlugins={enablePlugins}
        proFeatures={proFeatures}
        onQuickAdd={onQuickAdd}
        workflowName={workflowName}
        onWorkflowNameChange={onWorkflowNameChange}
        onEdgeReconnect={onEdgeReconnect}
        connectionAnimationConfig={connectionAnimationConfig}
        className="w-full h-full"
        data-testid="workflow-canvas"
      />

      {/* Floating Toolbar */}
      <FloatingToolbar
        onUndo={onUndo}
        onRedo={onRedo}
        onFitView={onFitView}
        onAutoLayout={onAutoLayout}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Object Styling Panel */}
      {selectedCanvasObjects.length > 0 && (
        <div className="absolute top-16 right-4 z-50">
          <ObjectStylingPanel
            selectedObjects={selectedCanvasObjects}
            onUpdateStyling={handleUpdateObjectStyling}
          />
        </div>
      )}

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
                // Calculate viewport rectangle position in minimap
                // Viewport shows the world area from -viewport.x/zoom to (-viewport.x + canvasWidth)/zoom
                left: `${Math.max(0, Math.min(95, ((-viewport.x / viewport.zoom) / 2000) * 100))}%`,
                top: `${Math.max(0, Math.min(95, ((-viewport.y / viewport.zoom) / 1500) * 100))}%`,
                width: `${Math.min(95, Math.max(5, (800 / viewport.zoom / 2000) * 100))}%`,
                height: `${Math.min(95, Math.max(5, (600 / viewport.zoom / 1500) * 100))}%`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
