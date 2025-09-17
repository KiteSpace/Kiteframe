import { useState, useCallback, useEffect, useRef } from 'react';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { FloatingToolbar } from './FloatingToolbar';
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
  workflowMetadata?: any;
  onWorkflowMetadataChange?: (metadata: any) => void;
  onEdgeReconnect?: (edgeId: string, newSource: string, newTarget: string) => void;
  connectionAnimationConfig?: any;
  connectionPreview?: { source: string; target: string } | null;
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
  workflowMetadata,
  onWorkflowMetadataChange,
  onEdgeReconnect,
  connectionAnimationConfig,
  connectionPreview
}: WorkflowCanvasProps) {
  // Minimap state removed for performance
  
  // Get selected canvas objects for styling panel
  const selectedCanvasObjects = canvasObjects.filter(obj => obj.selected);
  

  // Minimap handlers removed for performance

  // Minimap event handlers removed for performance


  return (
    <div className="relative w-full h-full">
      {/* Fixed Grid Overlay - doesn't scale with zoom */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(148, 163, 184, 0.6) 1px, transparent 1px)',
          backgroundSize: `${10 * viewport.zoom}px ${10 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x % (10 * viewport.zoom)}px ${viewport.y % (10 * viewport.zoom)}px`,
          opacity: Math.max(0.2, Math.min(0.8, viewport.zoom * 0.7))
        }}
      />
      
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
        gridType="none"
        minZoom={0.1}
        maxZoom={3}
        enablePlugins={enablePlugins}
        proFeatures={proFeatures}
        onQuickAdd={onQuickAdd}
        workflowName={workflowName}
        onWorkflowNameChange={onWorkflowNameChange}
        workflowMetadata={workflowMetadata}
        onWorkflowMetadataChange={onWorkflowMetadataChange}
        onEdgeReconnect={onEdgeReconnect}
        connectionAnimationConfig={connectionAnimationConfig}
        connectionPreview={connectionPreview}
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


      {/* Minimap removed to improve performance */}
    </div>
  );
}
