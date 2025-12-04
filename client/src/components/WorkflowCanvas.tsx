import React, { useState, useCallback, useEffect, useRef } from 'react';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import type { Node, Edge, CanvasObject, ProFeaturesConfig, TextNodeData, ShapeNodeData, StickyNoteData } from '../lib/kiteframe/types';
import { VLStore } from '@/components/layers/visibilityLockStore';
import { AncestorsStore } from '@/components/layers/ancestorsStore';
import { isEffectivelyOn } from '@/components/layers/triStateUtils';
import { Undo, Redo, ZoomIn, Maximize2, LayoutGrid, ChevronRight } from 'lucide-react';
import { focusBus, type FocusEvent } from '@/stores/focusBus';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onCanvasObjectsChange?: (objects: CanvasObject[]) => void;
  onConnect: (connection: { source: string; target: string }) => void;
  onNodeClick?: (e: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (e: React.MouseEvent, node: Node, part?: 'header' | 'body') => void;
  onEdgeClick?: (edge: Edge) => void;
  onCanvasClick?: () => void;
  onNodeRightClick?: (e: React.MouseEvent, node: Node) => void;
  onCanvasObjectClick?: (e: React.MouseEvent, canvasObject: CanvasObject) => void;
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
  onSelectionChange?: (nodeIds: string[], edgeIds: string[]) => void;
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
  onNodeDoubleClick,
  onEdgeClick,
  onCanvasClick,
  onNodeRightClick,
  onCanvasObjectClick,
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
  onSelectionChange,
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
  useEffect(()=>{ return VLStore.subscribe(force); },[]);
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

  // Canvas container ref for accurate dimensions
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Focus and viewport utilities
  const fitToNodes = useCallback((nodeIds: string[], options: { padding?: number; animate?: boolean } = {}) => {
    if (nodeIds.length === 0) return;
    
    const { padding = 100, animate = true } = options;
    const targetNodes = nodes.filter(node => nodeIds.includes(node.id));
    
    if (targetNodes.length === 0) return;
    
    // Get actual canvas container dimensions
    const containerRect = canvasRef.current?.getBoundingClientRect();
    const containerWidth = containerRect?.width || window.innerWidth;
    const containerHeight = containerRect?.height || window.innerHeight;
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    targetNodes.forEach(node => {
      const { x, y } = node.position;
      const width = node.width || 200;
      const height = node.height || 100;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });
    
    // Ensure minimum bounding box to avoid division by zero
    const contentWidth = Math.max(maxX - minX, 100);
    const contentHeight = Math.max(maxY - minY, 100);
    
    // Calculate zoom to fit with padding
    const zoomX = (containerWidth - 2 * padding) / contentWidth;
    const zoomY = (containerHeight - 2 * padding) / contentHeight;
    const fitZoom = Math.min(zoomX, zoomY);
    const zoom = Math.max(0.1, Math.min(fitZoom, 2)); // Properly clamp between 0.1 and 2
    
    // Calculate center position
    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;
    
    // Calculate viewport position to center the content
    const x = containerWidth / 2 - centerX * zoom;
    const y = containerHeight / 2 - centerY * zoom;
    
    const targetViewport = { x, y, zoom };
    
    if (animate) {
      // Smooth animation to target viewport
      const startViewport = viewport;
      const startTime = Date.now();
      const duration = 300; // 300ms animation
      
      const animateStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const currentViewport = {
          x: startViewport.x + (targetViewport.x - startViewport.x) * eased,
          y: startViewport.y + (targetViewport.y - startViewport.y) * eased,
          zoom: startViewport.zoom + (targetViewport.zoom - startViewport.zoom) * eased
        };
        
        onViewportChange(currentViewport);
        
        if (progress < 1) {
          requestAnimationFrame(animateStep);
        }
      };
      
      animateStep();
    } else {
      onViewportChange(targetViewport);
    }
  }, [nodes, onViewportChange, viewport]);
  
  // Focus to a specific canvas object
  const fitToCanvasObject = useCallback((objectId: string, options: { padding?: number; animate?: boolean } = {}) => {
    const obj = canvasObjects.find(o => o.id === objectId);
    if (!obj || !canvasRef.current) return;
    
    const padding = options.padding || 100;
    const animate = options.animate !== false;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const objWidth = obj.width || obj.style?.width || 200;
    const objHeight = obj.height || obj.style?.height || 100;
    
    // Calculate bounding box including padding
    const minX = obj.position.x - padding;
    const minY = obj.position.y - padding;
    const maxX = obj.position.x + objWidth + padding;
    const maxY = obj.position.y + objHeight + padding;
    
    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;
    
    // Calculate zoom to fit
    const zoomX = rect.width / boundingWidth;
    const zoomY = rect.height / boundingHeight;
    const targetZoom = Math.min(zoomX, zoomY, 2); // Cap at 2x
    
    // Calculate center of object in world coordinates
    const objectCenterX = obj.position.x + objWidth / 2;
    const objectCenterY = obj.position.y + objHeight / 2;
    
    // Calculate viewport position to center the object
    // CSS transform: translate(viewport.x, viewport.y) scale(zoom)
    // So: screen = world * zoom + viewport
    // To center object: screenCenter = objectCenter * zoom + viewport
    // We want: rect.width/2 = objectCenterX * targetZoom + viewport.x
    // So: viewport.x = rect.width/2 - objectCenterX * targetZoom
    const targetViewport = {
      x: rect.width / 2 - objectCenterX * targetZoom,
      y: rect.height / 2 - objectCenterY * targetZoom,
      zoom: targetZoom
    };
    
    if (animate) {
      const startViewport = viewport;
      const startTime = Date.now();
      const duration = 300;
      
      const animateStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const currentViewport = {
          x: startViewport.x + (targetViewport.x - startViewport.x) * eased,
          y: startViewport.y + (targetViewport.y - startViewport.y) * eased,
          zoom: startViewport.zoom + (targetViewport.zoom - startViewport.zoom) * eased
        };
        
        onViewportChange(currentViewport);
        
        if (progress < 1) {
          requestAnimationFrame(animateStep);
        }
      };
      
      animateStep();
    } else {
      onViewportChange(targetViewport);
    }
  }, [canvasObjects, onViewportChange, viewport]);

  // FocusBus integration
  useEffect(() => {
    const handleFocusEvent = (event: FocusEvent) => {
      // Handle canvas object focus
      if (event.type === 'focus-canvas-object' && event.canvasObjectId) {
        fitToCanvasObject(event.canvasObjectId, {
          padding: event.padding || 100,
          animate: event.animate !== false
        });
        
        // Handle canvas object selection
        if (event.selectCanvasObject && onCanvasObjectsChange) {
          onCanvasObjectsChange(canvasObjects.map(obj => ({
            ...obj,
            selected: obj.id === event.selectCanvasObject
          })));
        }
        return;
      }
      
      let targetNodeIds: string[] = [];
      
      if (event.nodeIds && event.nodeIds.length > 0) {
        targetNodeIds = event.nodeIds;
      } else if (event.edgeIds && event.edgeIds.length > 0) {
        // For edge focus, find the endpoint nodes
        const edgeEndpoints = new Set<string>();
        event.edgeIds.forEach(edgeId => {
          const edge = edges.find(e => e.id === edgeId);
          if (edge) {
            edgeEndpoints.add(edge.source);
            edgeEndpoints.add(edge.target);
          }
        });
        targetNodeIds = Array.from(edgeEndpoints);
      }
      
      if (targetNodeIds.length > 0) {
        fitToNodes(targetNodeIds, { 
          padding: event.padding || 100, 
          animate: event.animate !== false 
        });
      }
      
      // Handle selection changes
      if (onSelectionChange) {
        const nodeIds = event.selectNodes || [];
        const edgeIds = event.selectEdges || [];
        onSelectionChange(nodeIds, edgeIds);
      }
    };
    
    const unsubscribe = focusBus.subscribe(handleFocusEvent);
    return unsubscribe;
  }, [fitToNodes, fitToCanvasObject, onSelectionChange, onCanvasObjectsChange, edges, canvasObjects]);
  

  // Minimap handlers removed for performance

  // Minimap event handlers removed for performance


  return (
    <div ref={canvasRef} className="relative w-full h-full">
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
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeClick={(e, edge) => onEdgeClick?.(edge)}
        onCanvasClick={onCanvasClick}
        onNodeRightClick={onNodeRightClick}
        onCanvasObjectClick={onCanvasObjectClick}
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
