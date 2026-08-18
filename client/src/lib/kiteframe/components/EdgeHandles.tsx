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
  pointerId: number;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  originalSource: string;
  originalTarget: string;
}

// Visible handle radius (world units before zoom).
const HANDLE_RADIUS = 8;
// Invisible hit-target radius — larger than the visible dot so touch/pen can grab it.
// The connection point is pushed this far outside the node border so the entire
// hit circle clears the node DOM (which paints above the edge SVG layer).
const HANDLE_HIT_RADIUS = 14;

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
    
    // Push the handle fully outside the node so its hit area is never covered
    // by the node DOM (which renders above the edge SVG layer).
    const handleOffset = HANDLE_HIT_RADIUS;
    
    let connectionPoint;
    if (isHorizontal) {
      // Connect to left or right edge
      if (deltaX > 0) {
        connectionPoint = { x: nodeX + nodeWidth + handleOffset, y: nodeCenterY };
      } else {
        connectionPoint = { x: nodeX - handleOffset, y: nodeCenterY };
      }
    } else {
      // Connect to top or bottom edge
      if (deltaY > 0) {
        connectionPoint = { x: nodeCenterX, y: nodeY + nodeHeight + handleOffset };
      } else {
        connectionPoint = { x: nodeCenterX, y: nodeY - handleOffset };
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

  // Transform a pointer's screen coordinates into canvas/world coordinates.
  const getCanvasCoords = (target: Element | null, clientX: number, clientY: number) => {
    const svg = target?.closest('svg') ?? document.querySelector(`[data-edge-id="${edge.id}"]`)?.closest('svg');
    if (!svg) return null;
    const canvasContainer = svg.closest('.kiteframe-canvas') as HTMLElement | null;
    if (!canvasContainer) return null;
    const canvasRect = canvasContainer.getBoundingClientRect();
    const rawX = clientX - canvasRect.left;
    const rawY = clientY - canvasRect.top;
    return {
      x: (rawX - viewport.x) / viewport.zoom,
      y: (rawY - viewport.y) / viewport.zoom,
    };
  };

  // Handle pointer down on edge handles (mouse, touch, or pen)
  const handlePointerDown = (event: React.PointerEvent, isSource: boolean) => {
    event.stopPropagation();
    event.preventDefault();

    const coords = getCanvasCoords(event.currentTarget as Element, event.clientX, event.clientY);
    if (!coords) return;

    // Capture the pointer so move/up events keep targeting this element even if
    // the pointer leaves it during the drag.
    try {
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      // setPointerCapture can throw if the pointer is already released; ignore.
    }

    // Prevent canvas panning during drag (dispatched only once a drag is
    // actually starting so it is always balanced by edgeHandleDragEnd).
    const customEvent = new CustomEvent('edgeHandleDragStart');
    window.dispatchEvent(customEvent);

    setDragState({
      isDragging: true,
      isSource,
      pointerId: event.pointerId,
      startPosition: coords,
      currentPosition: coords,
      originalSource: edge.source,
      originalTarget: edge.target
    });
  };

  // Handle pointer move during drag
  const handlePointerMove = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const coords = getCanvasCoords(event.target as Element, event.clientX, event.clientY);
    if (!coords) return;

    // Update drag state with current pointer position
    setDragState(prev => prev ? {
      ...prev,
      currentPosition: coords
    } : null);

    // Check if we're over a valid target node for visual feedback
    const nodeUnder = getNodeUnderCursor(coords.x, coords.y);
    setHoveredNode(nodeUnder && nodeUnder.id !== edge.source && nodeUnder.id !== edge.target ? nodeUnder.id : null);
  };

  // Handle pointer up to complete reconnection
  const handlePointerUp = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    try {
      (event.target as Element)?.releasePointerCapture?.(event.pointerId);
    } catch {
      // releasePointerCapture can throw if capture was already released; ignore.
    }

    const coords = getCanvasCoords(event.target as Element, event.clientX, event.clientY);

    // Check if we're over a valid target node
    const targetNode = coords ? getNodeUnderCursor(coords.x, coords.y) : null;

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

  // Cancel the drag (e.g. pointercancel) without reconnecting
  const handlePointerCancel = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    try {
      (event.target as Element)?.releasePointerCapture?.(event.pointerId);
    } catch {
      // releasePointerCapture can throw if capture was already released; ignore.
    }
    setDragState(null);
    setHoveredNode(null);
    const customEvent = new CustomEvent('edgeHandleDragEnd');
    window.dispatchEvent(customEvent);
  };

  // Set up global pointer events when dragging starts
  useEffect(() => {
    if (dragState?.isDragging) {
      const cleanupMove = cleanupManager.addEventListener(document, 'pointermove', handlePointerMove as EventListener);
      const cleanupUp = cleanupManager.addEventListener(document, 'pointerup', handlePointerUp as EventListener);
      const cleanupCancel = cleanupManager.addEventListener(document, 'pointercancel', handlePointerCancel as EventListener);
      
      return () => {
        cleanupMove();
        cleanupUp();
        cleanupCancel();
      };
    }
  }, [dragState?.isDragging, dragState?.pointerId, edge.id, edge.source, edge.target, cleanupManager]);

  if (!sourceNode || !targetNode) return null;

  // Calculate handle positions
  const sourcePoint = getConnectionPoint(sourceNode, targetNode);
  const targetPoint = getConnectionPoint(targetNode, sourceNode);

  // Shared style for grabbable handle circles.
  const handleStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    touchAction: 'none',
  };

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

      {/* Source handle (enlarged invisible hit area + visible blue circle) */}
      <circle
        cx={sourcePoint.x}
        cy={sourcePoint.y}
        r={HANDLE_HIT_RADIUS}
        fill="transparent"
        cursor="pointer"
        onPointerDown={(e) => handlePointerDown(e, true)}
        style={handleStyle}
      />
      <circle
        cx={sourcePoint.x}
        cy={sourcePoint.y}
        r={HANDLE_RADIUS}
        fill={handleColor}
        stroke="white"
        strokeWidth="3"
        cursor="pointer"
        opacity={dragState?.isSource ? 0.7 : 1}
        onPointerDown={(e) => handlePointerDown(e, true)}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          ...handleStyle,
        }}
      />

      {/* Target handle (enlarged invisible hit area + visible blue circle) */}
      <circle
        cx={targetPoint.x}
        cy={targetPoint.y}
        r={HANDLE_HIT_RADIUS}
        fill="transparent"
        cursor="pointer"
        onPointerDown={(e) => handlePointerDown(e, false)}
        style={handleStyle}
      />
      <circle
        cx={targetPoint.x}
        cy={targetPoint.y}
        r={HANDLE_RADIUS}
        fill={handleColor}
        stroke="white"
        strokeWidth="3"
        cursor="pointer"
        opacity={dragState?.isSource === false ? 0.7 : 1}
        onPointerDown={(e) => handlePointerDown(e, false)}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          ...handleStyle,
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
