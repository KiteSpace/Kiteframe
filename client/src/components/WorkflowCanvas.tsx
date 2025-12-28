import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { FloatingToolbar } from './FloatingToolbar';
import type { Node, Edge, CanvasObject, ProFeaturesConfig, TextNodeData, ShapeNodeData, StickyNoteData, DataTable, SavedCompoundTemplate } from '../lib/kiteframe/types';
import type { FlowSettings, FlowSettingsMap } from '../lib/kiteframe/utils/FlowDetection';
import type { WorkflowTheme } from '../lib/themes';
import { VLStore } from '@/stores/layersStateManager';
import { AncestorsStore } from '@/components/layers/ancestorsStore';
import { isEffectivelyOn } from '@/components/layers/triStateUtils';
import { Undo, Redo, ZoomIn, Maximize2, LayoutGrid, ChevronRight } from 'lucide-react';
import { focusBus, type FocusEvent } from '@/stores/focusBus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  onEdgeDoubleClick?: (edge: Edge) => void;
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
  inlineEditing?: { nodeId?: string; edgeId?: string; part: 'header' | 'body' | 'edgeLabel' } | null;
  onInlineEditingSave?: (nodeId: string, part: 'header' | 'body', value: string) => void;
  onEdgeLabelSave?: (edgeId: string, newLabel: string) => void;
  onInlineEditingCancel?: () => void;
  onTextSelectionChange?: (selectedText: string) => void;
  onHyperlinkEdit?: (nodeId: string, hyperlinkId: string) => void;
  onHyperlinkDelete?: (nodeId: string, hyperlinkId: string) => void;
  onTextObjectHyperlinkEdit?: (canvasObjectId: string) => void;
  tableData?: Record<string, DataTable>;
  onOpenTable?: (tableId: string) => void;
  onTableDataChange?: (tableId: string, table: DataTable) => void;
  onCreateNodeFromRow?: (tableId: string, row: Record<string, unknown>, rowIndex: number) => void;
  onFocusNode?: (nodeId: string) => void;
  onFormLinkTable?: (nodeId: string) => void;
  onFormUnlinkTable?: (nodeId: string) => void;
  onUpdateTableCell?: (tableId: string, rowId: string, columnId: string, value: string) => void;
  onSaveAsTemplate?: (nodeId: string, templateName: string, description?: string) => void;
  savedTemplates?: SavedCompoundTemplate[];
  onGenerateFromTemplate?: (tableId: string, template: SavedCompoundTemplate, selectedRowIds?: string[]) => void;
  flowSettings?: FlowSettingsMap;
  onFlowSettingsChange?: (flowId: string, settings: FlowSettings) => void;
  onResetFlowStatuses?: (flowId: string) => void;
  onNodeStatusChange?: (nodeId: string) => void;
  onApplyTheme?: (flowId: string, theme: WorkflowTheme) => void;
  onDeleteWorkflow?: (flowId: string, nodeIds: string[]) => void;
  onDragWorkflow?: (flowId: string, nodeIds: string[], deltaX: number, deltaY: number, isDragStart?: boolean) => void;
  onLayoutWorkflow?: (flowId: string, nodeIds: string[], layoutType: 'hierarchical' | 'horizontal' | 'vertical') => void;
  onRefreshFigma?: (nodeId: string) => Promise<void>;
  isFigmaAuthenticated?: boolean; // Whether user can refresh Figma frames
  onWildcardGenerateBranch?: (nodeId: string) => void;
  onWildcardAdoptBranch?: (nodeId: string) => void;
  onWildcardDiscardBranch?: (nodeId: string) => void;
  onExperimentGenerateBranch?: (nodeId: string, currentDescription?: string) => void;
  onExperimentAdoptBranch?: (nodeId: string) => void;
  onExperimentDiscardBranch?: (nodeId: string) => void;
  experimentOptionsMap?: Map<string, {
    options: import('@/lib/kiteframe/types').ExperimentOption[];
    loading: boolean;
    error: string | null;
  }>;
  onExperimentRefreshOptions?: (nodeId: string) => void;
  onExperimentGenerateOptionsForMode?: (nodeId: string, mode: import('@/lib/kiteframe/types').ExperimentMode) => void;
  onExperimentRegenerate?: (nodeId: string, mode: import('@/lib/kiteframe/types').ExperimentMode) => void;
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
  onEdgeDoubleClick,
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
  connectionPreview,
  inlineEditing,
  onInlineEditingSave,
  onEdgeLabelSave,
  onInlineEditingCancel,
  onTextSelectionChange,
  onHyperlinkEdit,
  onHyperlinkDelete,
  onTextObjectHyperlinkEdit,
  tableData,
  onOpenTable,
  onTableDataChange,
  onCreateNodeFromRow,
  onFocusNode,
  onFormLinkTable,
  onFormUnlinkTable,
  onUpdateTableCell,
  onSaveAsTemplate,
  savedTemplates,
  onGenerateFromTemplate,
  flowSettings,
  onFlowSettingsChange,
  onResetFlowStatuses,
  onNodeStatusChange,
  onApplyTheme,
  onDeleteWorkflow,
  onDragWorkflow,
  onLayoutWorkflow,
  onRefreshFigma,
  isFigmaAuthenticated,
  onWildcardGenerateBranch,
  onWildcardAdoptBranch,
  onWildcardDiscardBranch,
  onExperimentGenerateBranch,
  onExperimentAdoptBranch,
  onExperimentDiscardBranch,
  experimentOptionsMap,
  onExperimentRefreshOptions,
  onExperimentGenerateOptionsForMode,
  onExperimentRegenerate,
}: WorkflowCanvasProps) {
  // Minimap state removed for performance
  
  // Get selected canvas objects for styling panel
  const selectedCanvasObjects = canvasObjects.filter(obj => obj.selected);

  const ancestorsForId = useCallback((id:string) => {
    return AncestorsStore.get()[id] ?? [];
  }, []);

  const [, force] = React.useReducer(x=>x+1, 0);
  useEffect(()=>{ const unsub = VLStore.subscribe(force); return () => { unsub(); }; },[]);
  const { hidden, locked } = VLStore.get();

  const hiddenNodeIds = new Set(
    nodes.filter((n:any) => isEffectivelyOn(n.id, ancestorsForId(n.id), hidden)).map((n:any)=>n.id)
  );
  const visibleNodes = nodes.filter((n:any) => !hiddenNodeIds.has(n.id));
  const visibleEdges = edges.filter((e:any) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target));

  const isLocked = (id:string) => isEffectivelyOn(id, ancestorsForId(id), locked);
  
  // Count hidden workflows (workflow group IDs start with 'wf:')
  const hiddenWorkflowCount = useMemo(() => {
    return Object.entries(hidden).filter(([id, isHidden]) => 
      isHidden && id.startsWith('wf:')
    ).length;
  }, [hidden]);
  
  // Unhide all workflows (clears workflow group flags AND their child nodes)
  const unhideAllWorkflows = useCallback(() => {
    // Get all hidden workflow IDs
    const hiddenWorkflowIds = Object.entries(hidden)
      .filter(([id, isHidden]) => isHidden && id.startsWith('wf:'))
      .map(([id]) => id);
    
    // Get all child node IDs for hidden workflows from ancestors store
    const ancestors = AncestorsStore.get();
    const nodeIdsInHiddenWorkflows = new Set<string>();
    
    Object.entries(ancestors).forEach(([nodeId, ancestorIds]) => {
      // If any ancestor is a hidden workflow, mark this node for unhiding
      if (ancestorIds.some(ancestorId => hiddenWorkflowIds.includes(ancestorId))) {
        nodeIdsInHiddenWorkflows.add(nodeId);
      }
    });
    
    // VLStore.set MERGES values, so we must explicitly set false for items to unhide
    const hiddenUpdates: Record<string, boolean> = {};
    
    // Set all workflow groups to false (unhide them)
    hiddenWorkflowIds.forEach(id => {
      hiddenUpdates[id] = false;
    });
    
    // Set all child nodes of hidden workflows to false (unhide them)
    nodeIdsInHiddenWorkflows.forEach(id => {
      hiddenUpdates[id] = false;
    });
    
    VLStore.set({ hidden: hiddenUpdates });
  }, [hidden]);
  
  const onNodesChangeGuarded = useCallback((newNodes: Node[]) => {
    // Guard against position changes and deletions for locked nodes
    // KiteFrameCanvas sends full Node[] arrays, not change objects
    
    // Create a map of current node positions for locked nodes
    const lockedNodePositions = new Map<string, { x: number; y: number }>();
    const lockedNodeIds = new Set<string>();
    
    nodes.forEach(node => {
      if (isLocked(node.id)) {
        lockedNodePositions.set(node.id, { ...node.position });
        lockedNodeIds.add(node.id);
      }
    });
    
    // Check if any locked nodes were removed
    const newNodeIds = new Set(newNodes.map(n => n.id));
    const removedLockedNodes = nodes.filter(n => lockedNodeIds.has(n.id) && !newNodeIds.has(n.id));
    
    // Restore positions for locked nodes that were dragged
    let finalNodes = newNodes.map(node => {
      if (lockedNodePositions.has(node.id)) {
        const originalPos = lockedNodePositions.get(node.id)!;
        // Restore position if it changed
        if (node.position.x !== originalPos.x || node.position.y !== originalPos.y) {
          return { ...node, position: originalPos };
        }
      }
      return node;
    });
    
    // Re-add any locked nodes that were removed
    if (removedLockedNodes.length > 0) {
      finalNodes = [...finalNodes, ...removedLockedNodes];
    }
    
    onNodesChange?.(finalNodes);
  }, [onNodesChange, nodes, locked]);
  const onConnectGuarded = useCallback((conn:any)=>{
    if (isLocked(conn.source) || isLocked(conn.target)) return;
    onConnect?.(conn);
  }, [onConnect, locked]);
  
  // Guard node double-click (inline editing) for locked nodes
  const onNodeDoubleClickGuarded = useCallback((e: React.MouseEvent, node: Node, part?: 'header' | 'body') => {
    if (isLocked(node.id)) return;
    onNodeDoubleClick?.(e, node, part);
  }, [onNodeDoubleClick, locked]);
  
  // Guard node right-click (context menu) for locked nodes
  const onNodeRightClickGuarded = useCallback((e: React.MouseEvent, node: Node) => {
    if (isLocked(node.id)) {
      e.preventDefault();
      return;
    }
    onNodeRightClick?.(e, node);
  }, [onNodeRightClick, locked]);
  
  // Guard edge double-click (label editing) for locked edges
  const onEdgeDoubleClickGuarded = useCallback((edge: Edge) => {
    if (isLocked(edge.source) || isLocked(edge.target)) return;
    onEdgeDoubleClick?.(edge);
  }, [onEdgeDoubleClick, locked]);
  
  // Guard edge label save for locked edges
  const onEdgeLabelSaveGuarded = useCallback((edgeId: string, newLabel: string) => {
    const edge = edges.find(e => e.id === edgeId);
    if (edge && (isLocked(edge.source) || isLocked(edge.target))) return;
    onEdgeLabelSave?.(edgeId, newLabel);
  }, [onEdgeLabelSave, edges, locked]);
  
  // Guard edges change for locked edges
  const onEdgesChangeGuarded = useCallback((newEdges: Edge[]) => {
    // Prevent deletion of edges connected to locked nodes
    const currentEdgeIds = new Set(edges.map(e => e.id));
    const newEdgeIds = new Set(newEdges.map(e => e.id));
    
    // Check if any locked edges are being removed
    const removedEdges = edges.filter(e => !newEdgeIds.has(e.id));
    const hasLockedRemoval = removedEdges.some(e => isLocked(e.source) || isLocked(e.target));
    
    if (hasLockedRemoval) {
      // Restore the locked edges that were removed
      const lockedEdges = removedEdges.filter(e => isLocked(e.source) || isLocked(e.target));
      onEdgesChange?.([...newEdges, ...lockedEdges]);
    } else {
      onEdgesChange?.(newEdges);
    }
  }, [onEdgesChange, edges, locked]);
  
  // Guard inline editing save for locked nodes
  const onInlineEditingSaveGuarded = useCallback((nodeId: string, part: 'header' | 'body', value: string) => {
    if (isLocked(nodeId)) return;
    onInlineEditingSave?.(nodeId, part, value);
  }, [onInlineEditingSave, locked]);

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
    const zoom = Math.max(0.1, fitZoom); // Remove upper cap to allow proper zoom for single nodes
    
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
        onEdgesChange={onEdgesChangeGuarded}
        onCanvasObjectsChange={onCanvasObjectsChange}
        onConnect={onConnectGuarded}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClickGuarded}
        onEdgeClick={(e, edge) => onEdgeClick?.(edge)}
        onEdgeDoubleClick={(e, edge) => onEdgeDoubleClickGuarded?.(edge)}
        onCanvasClick={onCanvasClick}
        onNodeRightClick={onNodeRightClickGuarded}
        onCanvasObjectClick={onCanvasObjectClick}
        onCanvasObjectRightClick={onCanvasObjectRightClick}
        onImageButtonClick={onImageButtonClick}
        viewport={viewport}
        onViewportChange={onViewportChange}
        selectedNodes={selectedNodeIds || []}
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
        inlineEditing={inlineEditing}
        onInlineEditingSave={onInlineEditingSaveGuarded}
        onEdgeLabelSave={onEdgeLabelSaveGuarded}
        onInlineEditingCancel={onInlineEditingCancel}
        onTextSelectionChange={onTextSelectionChange}
        onHyperlinkEdit={onHyperlinkEdit}
        onHyperlinkDelete={onHyperlinkDelete}
        onTextObjectHyperlinkEdit={onTextObjectHyperlinkEdit}
        tableData={tableData}
        onOpenTable={onOpenTable}
        onTableDataChange={onTableDataChange}
        onCreateNodeFromRow={onCreateNodeFromRow}
        onFocusNode={onFocusNode}
        onFormLinkTable={onFormLinkTable}
        onFormUnlinkTable={onFormUnlinkTable}
        onUpdateTableCell={onUpdateTableCell}
        onSaveAsTemplate={onSaveAsTemplate}
        savedTemplates={savedTemplates}
        onGenerateFromTemplate={onGenerateFromTemplate}
        flowSettings={flowSettings}
        onFlowSettingsChange={onFlowSettingsChange}
        onResetFlowStatuses={onResetFlowStatuses}
        onNodeStatusChange={onNodeStatusChange}
        onApplyTheme={onApplyTheme}
        onDeleteWorkflow={onDeleteWorkflow}
        onDragWorkflow={onDragWorkflow}
        onLayoutWorkflow={onLayoutWorkflow}
        onRefreshFigma={onRefreshFigma}
        isFigmaAuthenticated={isFigmaAuthenticated}
        onWildcardGenerateBranch={onWildcardGenerateBranch}
        onWildcardAdoptBranch={onWildcardAdoptBranch}
        onWildcardDiscardBranch={onWildcardDiscardBranch}
        onExperimentGenerateBranch={onExperimentGenerateBranch}
        onExperimentAdoptBranch={onExperimentAdoptBranch}
        onExperimentDiscardBranch={onExperimentDiscardBranch}
        experimentOptionsMap={experimentOptionsMap}
        onExperimentRefreshOptions={onExperimentRefreshOptions}
        onExperimentGenerateOptionsForMode={onExperimentGenerateOptionsForMode}
        onExperimentRegenerate={onExperimentRegenerate}
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
        hiddenWorkflowCount={hiddenWorkflowCount}
        onUnhideAll={unhideAllWorkflows}
      />

      {/* Minimap removed to improve performance */}
    </div>
  );
}
