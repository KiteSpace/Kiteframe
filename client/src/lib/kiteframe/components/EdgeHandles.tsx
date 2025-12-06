import React, { useState, useEffect } from 'react';
import type { Node, Edge } from '../types';
import { useEventCleanup } from '../utils/eventCleanup';

interface EdgeHandlesProps {
  edge: Edge;
  sourceNode?: Node;
  targetNode?: Node;
  nodes: Node[];
  edges: Edge[];
  onEdgeReconnect?: (edgeId: string, newSource: string, newTarget: string) => void;
  viewport?: { x: number; y: number; zoom: number };
  visualConfig?: {
    handleColor?: string;
    previewColor?: string;
    validColor?: string;
    invalidColor?: string;
  };
}

interface DragState {
  isDragging: boolean;
  isSource: boolean; // true for source handle, false for target handle
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  originalSource: string;
  originalTarget: string;
}

export function EdgeHandles({
  edge,
  sourceNode,
  targetNode,
  nodes,
  edges,
  onEdgeReconnect,
  viewport = { x: 0, y: 0, zoom: 1 },
  visualConfig = {}
}: EdgeHandlesProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const cleanupManager = useEventCleanup();

  const {
    handleColor = '#3b82f6',
    previewColor = '#3b82f6',
    validColor = '#22c55e',
    invalidColor = '#ef4444'
  } = visualConfig;

  // Calculate connection point for a node edge
  const getConnectionPoint = (node: Node, otherNode: Node) => {
    const nodeWidth = node.width || 200;
    const nodeHeight = node.height || 100;
    const nodeX = node.position.x;
    const nodeY = node.position.y;
    const nodeCenterX = nodeX + nodeWidth / 2;
    const nodeCenterY = nodeY + nodeHeight / 2;
    
    const otherNodeWidth = otherNode.width || 200;
    const otherNodeHeight = otherNode.height || 100;
    const otherCenterX = otherNode.position.x + otherNodeWidth / 2;
    const otherCenterY = otherNode.position.y + otherNodeHeight / 2;
    
    // Calculate angle between nodes to determine connection side
    const deltaX = otherCenterX - nodeCenterX;
    const deltaY = otherCenterY - nodeCenterY;
    const angle = Math.atan2(deltaY, deltaX);
    
    // Determine which edge to connect to based on angle
    const absAngle = Math.abs(angle);
    const isHorizontal = absAngle < Math.PI / 4 || absAngle > (3 * Math.PI / 4);
    
    const handleOffset = 8; // Handle size
    
    let connectionPoint;
    if (isHorizontal) {
      // Connect to left or right edge
      if (deltaX > 0) {
        connectionPoint = { x: nodeX + nodeWidth + handleOffset/2, y: nodeCenterY };
      } else {
        connectionPoint = { x: nodeX - handleOffset/2, y: nodeCenterY };
      }
    } else {
      // Connect to top or bottom edge
      if (deltaY > 0) {
        connectionPoint = { x: nodeCenterX, y: nodeY + nodeHeight + handleOffset/2 };
      } else {
        connectionPoint = { x: nodeCenterX, y: nodeY - handleOffset/2 };
      }
    }
    
    return connectionPoint;
  };

  // Check if cursor position is over a node
  const getNodeUnderCursor = (x: number, y: number): Node | null => {
    for (const node of nodes) {
      const nodeWidth = node.width || 200;
      const nodeHeight = node.height || 100;
      
      if (
        x >= node.position.x &&
        x <= node.position.x + nodeWidth &&
        y >= node.position.y &&
        y <= node.position.y + nodeHeight
      ) {
        return node;
      }
    }
    return null;
  };

  // Handle mouse down on edge handles
  const handleMouseDown = (event: React.MouseEvent, isSource: boolean) => {
    event.stopPropagation();
    event.preventDefault();
    
    // Prevent canvas panning during drag
    const customEvent = new CustomEvent('edgeHandleDragStart');
    window.dispatchEvent(customEvent);

    // Get canvas container for coordinate transformation
    const svg = (event.currentTarget as Element).closest('svg');
    if (!svg) return;

    const canvasContainer = svg.closest('.kiteframe-canvas') as HTMLElement;
    if (!canvasContainer) return;
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    // Transform screen coordinates to canvas coordinates
    const rawMouseX = event.clientX - canvasRect.left;
    const rawMouseY = event.clientY - canvasRect.top;
    const x = (rawMouseX - viewport.x) / viewport.zoom;
    const y = (rawMouseY - viewport.y) / viewport.zoom;

    setDragState({
      isDragging: true,
      isSource,
      startPosition: { x, y },
      currentPosition: { x, y },
      originalSource: edge.source,
      originalTarget: edge.target
    });
  };

  // Handle mouse move during drag
  const handleMouseMove = (event: MouseEvent) => {
    if (!dragState) return;

    const svg = document.querySelector(`[data-edge-id="${edge.id}"]`)?.closest('svg');
    if (!svg) return;

    const canvasContainer = svg.closest('.kiteframe-canvas') as HTMLElement;
    if (!canvasContainer) return;
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    // Transform screen coordinates to canvas coordinates
    const rawMouseX = event.clientX - canvasRect.left;
    const rawMouseY = event.clientY - canvasRect.top;
    const x = (rawMouseX - viewport.x) / viewport.zoom;
    const y = (rawMouseY - viewport.y) / viewport.zoom;

    // Update drag state with current cursor position
    setDragState(prev => prev ? {
      ...prev,
      currentPosition: { x, y }
    } : null);

    // Check if we're over a valid target node for visual feedback
    const nodeUnder = getNodeUnderCursor(x, y);
    setHoveredNode(nodeUnder && nodeUnder.id !== edge.source && nodeUnder.id !== edge.target ? nodeUnder.id : null);
  };

  // Handle mouse up to complete reconnection
  const handleMouseUp = (event: MouseEvent) => {
    if (!dragState) return;

    const svg = document.querySelector(`[data-edge-id="${edge.id}"]`)?.closest('svg');
    if (!svg) return;

    const canvasContainer = svg.closest('.kiteframe-canvas') as HTMLElement;
    if (!canvasContainer) return;
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    // Transform screen coordinates to canvas coordinates  
    const rawMouseX = event.clientX - canvasRect.left;
    const rawMouseY = event.clientY - canvasRect.top;
    const x = (rawMouseX - viewport.x) / viewport.zoom;
    const y = (rawMouseY - viewport.y) / viewport.zoom;

    // Check if we're over a valid target node
    const targetNode = getNodeUnderCursor(x, y);
    
    if (targetNode && targetNode.id !== edge.source && targetNode.id !== edge.target) {
      // Calculate new source and target based on which handle was dragged
      const newSource = dragState.isSource ? targetNode.id : edge.source;
      const newTarget = dragState.isSource ? edge.target : targetNode.id;
      
      // Check if this connection already exists (prevent duplicates)
      const edgeExists = edges?.some(e => 
        e.id !== edge.id && (
          (e.source === newSource && e.target === newTarget) || 
          (e.source === newTarget && e.target === newSource)
        )
      ) || false;
      
      if (!edgeExists) {
        onEdgeReconnect?.(edge.id, newSource, newTarget);
      }
    }

    // Clean up drag state
    setDragState(null);
    setHoveredNode(null);
    
    // Re-enable canvas panning
    const customEvent = new CustomEvent('edgeHandleDragEnd');
    window.dispatchEvent(customEvent);
  };

  // Set up global mouse events when dragging starts
  useEffect(() => {
    if (dragState?.isDragging) {
      const cleanupMove = cleanupManager.addEventListener(document, 'mousemove', handleMouseMove);
      const cleanupUp = cleanupManager.addEventListener(document, 'mouseup', handleMouseUp);
      
      return () => {
        cleanupMove();
        cleanupUp();
      };
    }
  }, [dragState?.isDragging, edge.id, edge.source, edge.target, cleanupManager]);

  if (!sourceNode || !targetNode) return null;

  // Calculate handle positions
  const sourcePoint = getConnectionPoint(sourceNode, targetNode);
  const targetPoint = getConnectionPoint(targetNode, sourceNode);

  return (
    <g data-edge-id={edge.id} data-testid="edge-handles">
      
      {/* Preview line during drag */}
      {dragState && (() => {
        const previewX1 = dragState.isSource ? dragState.currentPosition.x : sourcePoint.x;
        const previewY1 = dragState.isSource ? dragState.currentPosition.y : sourcePoint.y;
        const previewX2 = dragState.isSource ? targetPoint.x : dragState.currentPosition.x;
        const previewY2 = dragState.isSource ? targetPoint.y : dragState.currentPosition.y;
        
        // Check if connection would be valid
        const newSource = dragState.isSource ? (hoveredNode || dragState.originalSource) : dragState.originalSource;
        const newTarget = dragState.isSource ? dragState.originalTarget : (hoveredNode || dragState.originalTarget);
        const edgeExists = edges?.some(e => 
          e.id !== edge.id && (
            (e.source === newSource && e.target === newTarget) || 
            (e.source === newTarget && e.target === newSource)
          )
        ) || false;
        
        // Color: red for invalid, green for valid target, blue for default
        const strokeColor = edgeExists ? invalidColor : (hoveredNode ? validColor : previewColor);
        
        return (
          <line
            x1={previewX1}
            y1={previewY1}
            x2={previewX2}
            y2={previewY2}
            stroke={strokeColor}
            strokeWidth="3"
            strokeDasharray="5,5"
            opacity="0.8"
            pointerEvents="none"
          />
        );
      })()}

      {/* Original connection ghost during drag */}
      {dragState && (
        <line
          x1={sourcePoint.x}
          y1={sourcePoint.y}
          x2={targetPoint.x}
          y2={targetPoint.y}
          stroke="#64748b"
          strokeWidth="2"
          opacity="0.3"
          pointerEvents="none"
        />
      )}

      {/* Source handle (blue circle) */}
      <circle
        cx={sourcePoint.x}
        cy={sourcePoint.y}
        r="8"
        fill={handleColor}
        stroke="white"
        strokeWidth="3"
        cursor="pointer"
        opacity={dragState?.isSource ? 0.7 : 1}
        onMouseDown={(e) => handleMouseDown(e, true)}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          pointerEvents: 'auto'
        }}
      />

      {/* Target handle (blue circle) */}
      <circle
        cx={targetPoint.x}
        cy={targetPoint.y}
        r="8"
        fill={handleColor}
        stroke="white"
        strokeWidth="3"
        cursor="pointer"
        opacity={dragState?.isSource === false ? 0.7 : 1}
        onMouseDown={(e) => handleMouseDown(e, false)}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          pointerEvents: 'auto'
        }}
      />

      {/* Visual feedback for hovered nodes during drag */}
      {dragState && hoveredNode && (() => {
        const hoveredNodeObj = nodes.find(n => n.id === hoveredNode);
        if (!hoveredNodeObj) return null;
        
        const nodeWidth = hoveredNodeObj.width || 200;
        const nodeHeight = hoveredNodeObj.height || 100;
        
        return (
          <rect
            x={hoveredNodeObj.position.x - 4}
            y={hoveredNodeObj.position.y - 4}
            width={nodeWidth + 8}
            height={nodeHeight + 8}
            fill="none"
            stroke={validColor}
            strokeWidth="3"
            rx="8"
            opacity="0.6"
            pointerEvents="none"
          />
        );
      })()}
    </g>
  );
}