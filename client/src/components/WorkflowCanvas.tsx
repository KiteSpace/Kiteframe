import React, { useState, useCallback, useEffect, useRef } from 'react';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import type { Node, Edge, CanvasObject, ProFeaturesConfig, TextNodeData, ShapeNodeData, StickyNoteData } from '../lib/kiteframe/types';
import { VLStore } from '@/components/layers/visibilityLockStore';
import { AncestorsStore } from '@/components/layers/ancestorsStore';
import { isEffectivelyOn } from '@/components/layers/triStateUtils';
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
  onAutoLayout: (layoutType: string | { eventId: string; spacing: number }) => void;
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

  const ancestorsForId = useCallback((id:string) => {
    return AncestorsStore.get()[id] ?? [];
  }, []);

  const [, force] = React.useReducer(x=>x+1, 0);
  useEffect(()=>VLStore.subscribe(force),[]);
  const { hidden, locked } = VLStore.get();

  const hiddenNodeIds = new Set(
    nodes.filter((n:any) => isEffectivelyOn(n.id, ancestorsForId(n.id), hidden)).map((n:any)=>n.id)
  );
  const visibleNodes = nodes.filter((n:any) => !hiddenNodeIds.has(n.id));
  const visibleEdges = edges.filter((e:any) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target));

  const isLocked = (id:string) => isEffectivelyOn(id, ancestorsForId(id), locked);
  const onNodesChangeGuarded = useCallback((changes:any[])=>{
    const filtered = changes.filter(ch => !(ch.type==='position' && isLocked(ch.id)));
    onNodesChange?.(filtered);
  }, [onNodesChange, locked]);
  const onConnectGuarded = useCallback((conn:any)=>{
    if (isLocked(conn.source) || isLocked(conn.target)) return;
    onConnect?.(conn);
  }, [onConnect, locked]);
  

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
        nodes={visibleNodes}
        edges={visibleEdges}
        canvasObjects={canvasObjects}
        onNodesChange={onNodesChangeGuarded}
        onEdgesChange={onEdgesChange}
        onCanvasObjectsChange={onCanvasObjectsChange}
        onConnect={onConnectGuarded}
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
