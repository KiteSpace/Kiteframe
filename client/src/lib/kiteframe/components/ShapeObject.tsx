import React, { useRef, useCallback, useState, useEffect } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
// import { InlineTextEditor } from './InlineTextEditor'; // Disabled for shapes
import type { CanvasObject, ShapeNodeData } from '../types';
import { DISABLE_SHAPE_TEXT } from '../constants/defaults';
import { cn } from '@/lib/utils';

interface ShapeObjectProps {
  object: CanvasObject & { data: ShapeNodeData };
  onUpdate?: (updates: Partial<ShapeNodeData>) => void;
  onResize?: (width: number, height: number, resizeInfo?: { position: string }) => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onAddReaction?: (objectId: string, emoji: string) => void;
  onRemoveReaction?: (objectId: string, emoji: string) => void;
  viewport?: { x: number; y: number; zoom: number };
  selectedCanvasObjectCount?: number; // For resize handle gating
  // Endpoint dragging callbacks for line/arrow shapes
  onEndpointDragStart?: (endpoint: 'start' | 'end', e: React.MouseEvent) => void;
  onEndpointDrag?: (endpoint: 'start' | 'end', position: { x: number; y: number }) => void;
  onEndpointDragEnd?: (endpoint: 'start' | 'end', position: { x: number; y: number }) => void;
  // Freeform point management with auto-bounds
  onFreeformPointAdd?: (objectId: string, point: { x: number; y: number }) => void;
  onFreeformClose?: (objectId: string) => void;
  canvasRef?: React.RefObject<HTMLDivElement>;
}

export const ShapeObject: React.FC<ShapeObjectProps> = ({
  object,
  onUpdate,
  onResize,
  onStartDrag,
  onClick,
  onDoubleClick,
  onContextMenu,
  onAddReaction,
  onRemoveReaction,
  viewport,
  selectedCanvasObjectCount = 0,
  onEndpointDragStart,
  onEndpointDrag,
  onEndpointDragEnd,
  onFreeformPointAdd,
  onFreeformClose,
  canvasRef
}) => {
  const objectRef = useRef<HTMLDivElement>(null);
  // Text editing disabled for shapes\n  // const [isEditingText, setIsEditingText] = useState(false);
  
  // Freeform shape creation state - track mouse position for preview line
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  
  // Use style dimensions if available, otherwise fall back to object dimensions
  const shapeSize = {
    width: object.style?.width || object.width || 200,
    height: object.style?.height || object.height || (object.data?.shapeType === 'rectangle' ? 200 : 100)
  };

  // Check for size mismatch between style and object dimensions
  const hasSizeMismatch = (object.style?.width && object.style.width !== object.width) || 
                         (object.style?.height && object.style.height !== object.height);

  console.log('📏 SHAPE OBJECT: Size calculations', {
    objectId: object.id,
    shapeType: object.data.shapeType,
    calculatedSize: shapeSize,
    boundingBoxSize: {
      width: object.width,
      height: object.height
    },
    styleSize: object.style,
    sizeMismatch: hasSizeMismatch ? {
      style: object.style,
      base: { width: object.width || 200, height: object.height || 100 },
      difference: {
        width: (object.style?.width || object.width || 200) - (object.width || 200),
        height: (object.style?.height || object.height || 100) - (object.height || 100)
      },
      needsSync: true
    } : false,
    hasText: !!object.data.text,
    textContent: object.data.text,
    isSelected: object.selected
  });

  const handleResize = useCallback((width: number, height: number) => {
    console.log('🔄 SHAPE OBJECT: Resize triggered - syncing dimensions', {
      objectId: object.id,
      newSize: { width, height },
      currentBoundingBox: { width: object.width, height: object.height },
      currentStyle: object.style
    });
    
    // Sync both style and base dimensions to prevent mismatch
    onUpdate?.({
      style: { ...object.style, width, height }
    });
    onResize?.(width, height);
  }, [onResize, onUpdate, object.id, object.width, object.height, object.style]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Start drag if not clicking on resize handle, and only on left-click
    if (!e.defaultPrevented && e.button === 0) {
      onStartDrag?.(e);
    }
  };

  // Freeform shape creation handlers
  const isFreeformCreating = object.data.shapeType === 'freeform' && object.data.isCreating;
  const freeformPoints = object.data.points || [];
  
  // Use ref to track latest freeformPoints to avoid stale closure in event handlers
  const freeformPointsRef = useRef(freeformPoints);
  freeformPointsRef.current = freeformPoints;
  
  // Canvas-level click handler for freeform creation (uses canvas coordinates)
  // Uses proper clientToWorld conversion: canvasX = (clientX - rect.left) / zoom + viewportX
  useEffect(() => {
    if (!isFreeformCreating || !canvasRef?.current) return;
    
    const canvas = canvasRef.current;
    
    const handleCanvasClick = (e: MouseEvent) => {
      // Only handle left clicks
      if (e.button !== 0) return;
      
      // Ignore clicks on UI elements (buttons, inputs, etc.)
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('[role="button"]')) {
        return;
      }
      
      const canvasRect = canvas.getBoundingClientRect();
      const zoom = viewport?.zoom || 1;
      const viewportX = viewport?.x || 0;
      const viewportY = viewport?.y || 0;
      
      // Convert screen coordinates to canvas/world coordinates using proper formula
      // Same as clientToWorld helper: canvasCoord = (clientCoord - rectOffset) / zoom + viewportOffset
      const canvasX = (e.clientX - canvasRect.left) / zoom + viewportX;
      const canvasY = (e.clientY - canvasRect.top) / zoom + viewportY;
      
      // Convert to shape-local coordinates
      const localX = canvasX - object.position.x;
      const localY = canvasY - object.position.y;
      
      // Get latest points from ref to avoid stale closure
      const currentPoints = freeformPointsRef.current;
      
      // Check if clicking near the first point to close the shape
      if (currentPoints.length >= 3) {
        const firstPt = currentPoints[0];
        const dist = Math.hypot(localX - firstPt.x, localY - firstPt.y);
        if (dist < 20) {
          console.log('🖊️ Freeform: Closing shape by clicking first point');
          if (onFreeformClose) {
            onFreeformClose(object.id);
          } else {
            onUpdate?.({ isClosed: true, isCreating: false });
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }
      
      // Add the new point using canvas-level callback or direct update
      console.log('🖊️ Freeform: Adding point via canvas click', { localX, localY, canvasX, canvasY, totalPoints: currentPoints.length + 1 });
      
      if (onFreeformPointAdd) {
        onFreeformPointAdd(object.id, { x: localX, y: localY });
      } else {
        onUpdate?.({ points: [...currentPoints, { x: localX, y: localY }] });
      }
      
      e.stopPropagation();
      e.preventDefault();
    };
    
    const handleCanvasDoubleClick = (e: MouseEvent) => {
      // Get latest points from ref
      const currentPoints = freeformPointsRef.current;
      
      // Close the shape if we have at least 3 points
      if (currentPoints.length >= 3) {
        console.log('🖊️ Freeform: Closing shape via double-click', currentPoints.length, 'points');
        if (onFreeformClose) {
          onFreeformClose(object.id);
        } else {
          onUpdate?.({ isClosed: true, isCreating: false });
        }
        e.stopPropagation();
        e.preventDefault();
      }
    };
    
    const handleCanvasMouseMove = (e: MouseEvent) => {
      const canvasRect = canvas.getBoundingClientRect();
      const zoom = viewport?.zoom || 1;
      const viewportX = viewport?.x || 0;
      const viewportY = viewport?.y || 0;
      
      // Convert to shape-local coordinates using proper formula
      const canvasX = (e.clientX - canvasRect.left) / zoom + viewportX;
      const canvasY = (e.clientY - canvasRect.top) / zoom + viewportY;
      const localX = canvasX - object.position.x;
      const localY = canvasY - object.position.y;
      
      setMousePos({ x: localX, y: localY });
    };
    
    canvas.addEventListener('click', handleCanvasClick, true);
    canvas.addEventListener('dblclick', handleCanvasDoubleClick, true);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    
    return () => {
      canvas.removeEventListener('click', handleCanvasClick, true);
      canvas.removeEventListener('dblclick', handleCanvasDoubleClick, true);
      canvas.removeEventListener('mousemove', handleCanvasMouseMove);
    };
  }, [isFreeformCreating, canvasRef, viewport, object.position, object.id, onUpdate, onFreeformPointAdd, onFreeformClose]);
  
  const handleFreeformClick = useCallback((e: React.MouseEvent) => {
    // This is now a fallback - canvas-level handler is primary
    if (!isFreeformCreating) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const rect = objectRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const zoom = viewport?.zoom || 1;
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    const newPoints = [...freeformPoints, { x, y }];
    
    console.log('🖊️ Freeform: Adding point (fallback)', { x, y, totalPoints: newPoints.length });
    
    onUpdate?.({ points: newPoints });
  }, [isFreeformCreating, freeformPoints, viewport, onUpdate]);
  
  const handleFreeformDoubleClick = useCallback((e: React.MouseEvent) => {
    // This is now a fallback - canvas-level handler is primary
    if (!isFreeformCreating) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    // Close the shape if we have at least 3 points
    if (freeformPoints.length >= 3) {
      console.log('🖊️ Freeform: Closing shape (fallback)', freeformPoints.length, 'points');
      onUpdate?.({ isClosed: true, isCreating: false });
    }
  }, [isFreeformCreating, freeformPoints.length, onUpdate]);
  
  const handleFreeformMouseMove = useCallback((e: React.MouseEvent) => {
    // This is now a fallback - canvas-level handler is primary
    if (!isFreeformCreating) return;
    
    const rect = objectRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const zoom = viewport?.zoom || 1;
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    setMousePos({ x, y });
  }, [isFreeformCreating, viewport]);
  
  const handleFreeformMouseLeave = useCallback(() => {
    setMousePos(null);
  }, []);
  
  // Check if clicking near the first point (to close the shape)
  const handleFreeformPointClick = useCallback((pointIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // If clicking on first point and we have at least 3 points, close the shape
    if (pointIndex === 0 && freeformPoints.length >= 3 && isFreeformCreating) {
      console.log('🖊️ Freeform: Closing shape by clicking first point');
      if (onFreeformClose) {
        onFreeformClose(object.id);
      } else {
        onUpdate?.({ isClosed: true, isCreating: false });
      }
    }
  }, [isFreeformCreating, freeformPoints.length, onUpdate, onFreeformClose, object.id]);
  
  // Vertex dragging state for freeform shapes (editing mode, not creation mode)
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const isFreeformEditing = object.data.shapeType === 'freeform' && !object.data.isCreating && object.selected;
  
  const handleVertexDragStart = useCallback((vertexIndex: number, e: React.MouseEvent) => {
    if (!isFreeformEditing) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    setDraggingVertexIndex(vertexIndex);
    console.log('🖊️ Freeform: Start dragging vertex', vertexIndex);
    
    const rect = objectRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const zoom = viewport?.zoom || 1;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const x = (moveEvent.clientX - rect.left) / zoom;
      const y = (moveEvent.clientY - rect.top) / zoom;
      
      // Update the vertex position
      const newPoints = [...freeformPoints];
      newPoints[vertexIndex] = { x, y };
      onUpdate?.({ points: newPoints });
    };
    
    const handleMouseUp = () => {
      setDraggingVertexIndex(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      console.log('🖊️ Freeform: End dragging vertex', vertexIndex);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isFreeformEditing, freeformPoints, viewport, onUpdate]);
  
  // Insert a new vertex at the midpoint of a segment
  const handleSegmentMidpointClick = useCallback((segmentIndex: number, e: React.MouseEvent) => {
    if (!isFreeformEditing) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const p1 = freeformPoints[segmentIndex];
    const p2 = freeformPoints[(segmentIndex + 1) % freeformPoints.length];
    
    // Calculate midpoint
    const midpoint = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
    
    // Insert the new point after segmentIndex
    const newPoints = [
      ...freeformPoints.slice(0, segmentIndex + 1),
      midpoint,
      ...freeformPoints.slice(segmentIndex + 1)
    ];
    
    console.log('🖊️ Freeform: Inserting vertex at segment', segmentIndex, 'midpoint:', midpoint);
    onUpdate?.({ points: newPoints });
    setHoveredSegmentIndex(null);
  }, [isFreeformEditing, freeformPoints, onUpdate]);

  // Helper function to convert hex color to rgba with opacity
  const hexToRgba = (hex: string, opacity: number): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Handle 3-character hex codes
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Helper function to lighten a color by blending with white at a given intensity
  // intensity: 1.0 = original color, 0.5 = 50% lighter (blended with white), 0 = white
  const lightenColor = (hex: string, intensity: number): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Handle 3-character hex codes
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Blend with white (255, 255, 255) based on intensity
    // intensity 1.0 = original color, 0.5 = halfway to white, 0 = white
    const newR = Math.round(r * intensity + 255 * (1 - intensity));
    const newG = Math.round(g * intensity + 255 * (1 - intensity));
    const newB = Math.round(b * intensity + 255 * (1 - intensity));
    
    // Convert back to hex
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  };

  // Get the fill color based on fillStyle
  // solid = 50% intensity (lighter hue) at 100% opacity
  // transparent = 30% opacity 
  // none = no fill
  const getFillColor = (color: string, fillStyle?: string, fillOpacity?: number): string => {
    if (fillStyle === 'none' || fillOpacity === 0) {
      return 'transparent';
    }
    if (fillStyle === 'solid') {
      // 50% intensity = lighter hue at 100% opacity
      return lightenColor(color, 0.5);
    }
    if (fillStyle === 'transparent') {
      // 30% opacity
      return hexToRgba(color, 0.3);
    }
    // Default fallback: use opacity if provided
    if (fillOpacity !== undefined) {
      return hexToRgba(color, fillOpacity);
    }
    return color;
  };

  const renderShape = () => {
    const { 
      shapeType, 
      fillColor, 
      strokeColor, 
      strokeWidth, 
      borderRadius, 
      opacity,
      fillOpacity,
      fillStyle,
      strokeOpacity,
      strokeStyle,
      lineCap,
      arrowSize 
    } = object.data;
    const { width, height } = shapeSize;
    
    // Calculate the actual fill color based on fillStyle
    const computedFillColor = getFillColor(fillColor || '#3b82f6', fillStyle, fillOpacity);

    const commonStyles = {
      width: '100%',
      height: '100%'
    };

    // Generate stroke dash pattern based on style
    const getStrokeDashArray = (style: string, width: number) => {
      switch (style) {
        case 'dashed':
          return `${width * 4} ${width * 2}`;
        case 'dotted':
          return `${width} ${width}`;
        case 'none':
          return 'none';
        default:
          return 'none';
      }
    };

    // Check if stroke should be rendered
    const shouldRenderStroke = (style: string, width: number) => {
      return style !== 'none' && width && width > 0;
    };

    switch (shapeType) {
      case 'rectangle':
        return (
          <div
            className="w-full h-full"
            style={{
              ...commonStyles,
              backgroundColor: computedFillColor,
              border: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0)
                ? `${strokeWidth}px ${strokeStyle === 'none' ? 'none' : (strokeStyle || 'solid')} ${strokeOpacity !== undefined ? hexToRgba(strokeColor || '#1d4ed8', strokeOpacity) : (strokeColor || '#1d4ed8')}` 
                : 'none',
              borderRadius: borderRadius || 8,
              boxShadow: object.data.shadow?.enabled 
                ? `${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'}`
                : 'none',
            }}
            data-testid="shape-rectangle"
          />
        );

      case 'circle':
        const radius = Math.min(width, height) / 2 - (strokeWidth || 0) / 2;
        const centerX = width / 2;
        const centerY = height / 2;
        return (
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              style={{
                fill: computedFillColor,
                stroke: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? strokeColor || '#059669' : 'none',
                strokeOpacity: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) && strokeOpacity !== undefined ? strokeOpacity : 1.0,
                strokeWidth: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? strokeWidth || 0 : 0,
                strokeDasharray: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2) : 'none',
                filter: object.data.shadow?.enabled 
                  ? `drop-shadow(${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'})`
                  : 'none',
              }}
              data-testid="shape-circle"
            />
          </svg>
        );

      case 'triangle':
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
            <polygon
              points="50,10 10,90 90,90"
              style={{
                fill: computedFillColor,
                stroke: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? strokeColor || '#d97706' : 'none',
                strokeOpacity: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) && strokeOpacity !== undefined ? strokeOpacity : 1.0,
                strokeWidth: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? (strokeWidth || 2) * (100 / Math.min(width, height)) : 0,
                strokeDasharray: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2) : 'none',
                filter: object.data.shadow?.enabled 
                  ? `drop-shadow(${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'})`
                  : 'none',
              }}
              data-testid="shape-triangle"
            />
          </svg>
        );

      case 'hexagon':
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
            <polygon
              points="50,5 85,25 85,75 50,95 15,75 15,25"
              style={{
                fill: computedFillColor,
                stroke: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? strokeColor || '#7c3aed' : 'none',
                strokeOpacity: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) && strokeOpacity !== undefined ? strokeOpacity : 1.0,
                strokeWidth: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? (strokeWidth || 2) * (100 / Math.min(width, height)) : 0,
                strokeDasharray: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2) : 'none',
                filter: object.data.shadow?.enabled 
                  ? `drop-shadow(${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'})`
                  : 'none',
              }}
              data-testid="shape-hexagon"
            />
          </svg>
        );

      case 'line':
        // Use startPoint and endPoint if available, otherwise use defaults
        const lineStartX = object.data.startPoint?.x ?? 0;
        const lineStartY = object.data.startPoint?.y ?? height / 2;
        const lineEndX = object.data.endPoint?.x ?? width;
        const lineEndY = object.data.endPoint?.y ?? height / 2;
        return (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible absolute top-0 left-0">
            <line
              x1={lineStartX}
              y1={lineStartY}
              x2={lineEndX}
              y2={lineEndY}
              style={{
                stroke: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? strokeColor || '#6b7280' : '#6b7280',
                strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
                strokeWidth: strokeWidth || 2,
                strokeDasharray: getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2),
                strokeLinecap: lineCap || 'round',
                filter: object.data.shadow?.enabled 
                  ? `drop-shadow(${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'})`
                  : 'none',
              }}
              data-testid="shape-line"
            />
          </svg>
        );

      case 'arrow':
        // Use startPoint and endPoint if available, otherwise use defaults
        const arrowStartX = object.data.startPoint?.x ?? 0;
        const arrowStartY = object.data.startPoint?.y ?? height / 2;
        const arrowEndX = object.data.endPoint?.x ?? width;
        const arrowEndY = object.data.endPoint?.y ?? height / 2;
        const arrowMarkerSize = (arrowSize || 1) * 10;
        return (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible absolute top-0 left-0">
            <defs>
              <marker
                id={`arrowhead-${object.id}`}
                markerWidth={arrowMarkerSize}
                markerHeight={arrowMarkerSize * 0.7}
                refX={arrowMarkerSize * 0.9}
                refY={arrowMarkerSize * 0.35}
                orient="auto"
              >
                <polygon
                  points={`0 0, ${arrowMarkerSize} ${arrowMarkerSize * 0.35}, 0 ${arrowMarkerSize * 0.7}`}
                  style={{
                    fill: strokeColor || '#6b7280',
                    fillOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0
                  }}
                />
              </marker>
            </defs>
            <line
              x1={arrowStartX}
              y1={arrowStartY}
              x2={arrowEndX}
              y2={arrowEndY}
              style={{
                stroke: strokeColor || '#6b7280',
                strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
                strokeWidth: strokeWidth || 2,
                strokeDasharray: getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2),
                strokeLinecap: lineCap || 'round',
                filter: object.data.shadow?.enabled 
                  ? `drop-shadow(${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'})`
                  : 'none',
              }}
              markerEnd={`url(#arrowhead-${object.id})`}
              data-testid="shape-arrow"
            />
          </svg>
        );

      case 'freeform':
        const renderFreeformPoints = object.data.points || [];
        const isFreeformClosed = object.data.isClosed ?? false;
        const isCreating = object.data.isCreating ?? false;
        
        // If no points yet, show a placeholder
        if (renderFreeformPoints.length === 0) {
          return (
            <div 
              className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded cursor-crosshair"
              style={{ minWidth: 100, minHeight: 100 }}
            >
              <span className="text-gray-400 text-sm pointer-events-none">Click to add points</span>
            </div>
          );
        }
        
        // Convert points array to SVG points string
        const freeformPointsString = renderFreeformPoints.map(p => `${p.x},${p.y}`).join(' ');
        
        // Get last point for preview line
        const lastPoint = renderFreeformPoints[renderFreeformPoints.length - 1];
        const firstPoint = renderFreeformPoints[0];
        
        return (
          <svg 
            width={width} 
            height={height} 
            viewBox={`0 0 ${width} ${height}`} 
            className="overflow-visible absolute top-0 left-0"
            style={{ cursor: isCreating ? 'crosshair' : 'default' }}
          >
            {isFreeformClosed ? (
              // Closed polygon - render with fill
              <polygon
                points={freeformPointsString}
                style={{
                  fill: computedFillColor,
                  stroke: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? strokeColor || '#6b7280' : 'none',
                  strokeOpacity: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) && strokeOpacity !== undefined ? strokeOpacity : 1.0,
                  strokeWidth: strokeWidth || 2,
                  strokeDasharray: shouldRenderStroke(strokeStyle || 'solid', strokeWidth || 0) ? getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2) : 'none',
                  strokeLinejoin: 'round',
                  filter: object.data.shadow?.enabled 
                    ? `drop-shadow(${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'})`
                    : 'none',
                }}
                data-testid="shape-freeform-polygon"
              />
            ) : (
              <>
                {/* Open polyline - no fill, just stroke */}
                <polyline
                  points={freeformPointsString}
                  style={{
                    fill: 'none',
                    stroke: strokeColor || '#6b7280',
                    strokeOpacity: strokeOpacity !== undefined ? strokeOpacity : 1.0,
                    strokeWidth: strokeWidth || 2,
                    strokeDasharray: getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2),
                    strokeLinecap: lineCap || 'round',
                    strokeLinejoin: 'round',
                    filter: object.data.shadow?.enabled 
                      ? `drop-shadow(${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'})`
                      : 'none',
                  }}
                  data-testid="shape-freeform-polyline"
                />
                {/* Preview line from last point to mouse during creation */}
                {isCreating && mousePos && lastPoint && (
                  <line
                    x1={lastPoint.x}
                    y1={lastPoint.y}
                    x2={mousePos.x}
                    y2={mousePos.y}
                    style={{
                      stroke: strokeColor || '#6b7280',
                      strokeOpacity: 0.5,
                      strokeWidth: strokeWidth || 2,
                      strokeDasharray: '4 4',
                    }}
                  />
                )}
                {/* Preview line to first point when close enough */}
                {isCreating && mousePos && firstPoint && renderFreeformPoints.length >= 3 && (
                  (() => {
                    const distToFirst = Math.hypot(mousePos.x - firstPoint.x, mousePos.y - firstPoint.y);
                    if (distToFirst < 20) {
                      return (
                        <line
                          x1={lastPoint.x}
                          y1={lastPoint.y}
                          x2={firstPoint.x}
                          y2={firstPoint.y}
                          style={{
                            stroke: '#22c55e',
                            strokeOpacity: 0.7,
                            strokeWidth: strokeWidth || 2,
                            strokeDasharray: '4 4',
                          }}
                        />
                      );
                    }
                    return null;
                  })()
                )}
              </>
            )}
            {/* Segment midpoint indicators - show when editing (selected but not creating) */}
            {!isCreating && object.selected && renderFreeformPoints.length >= 2 && (() => {
              const segments = [];
              const numSegments = isFreeformClosed ? renderFreeformPoints.length : renderFreeformPoints.length - 1;
              
              for (let i = 0; i < numSegments; i++) {
                const p1 = renderFreeformPoints[i];
                const p2 = renderFreeformPoints[(i + 1) % renderFreeformPoints.length];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                
                segments.push(
                  <circle
                    key={`midpoint-${i}`}
                    cx={midX}
                    cy={midY}
                    r={hoveredSegmentIndex === i ? 5 : 3}
                    fill={hoveredSegmentIndex === i ? '#22c55e' : '#9ca3af'}
                    stroke="white"
                    strokeWidth={1}
                    style={{ cursor: 'pointer', opacity: hoveredSegmentIndex === i ? 1 : 0.6 }}
                    onMouseEnter={() => setHoveredSegmentIndex(i)}
                    onMouseLeave={() => setHoveredSegmentIndex(null)}
                    onMouseDown={(e) => handleSegmentMidpointClick(i, e)}
                    data-testid={`freeform-midpoint-${i}`}
                  />
                );
              }
              return segments;
            })()}
            {/* Vertex points - show during creation and when selected */}
            {(isCreating || object.selected) && renderFreeformPoints.map((point, idx) => (
              <circle
                key={idx}
                cx={point.x}
                cy={point.y}
                r={idx === 0 && isCreating && renderFreeformPoints.length >= 3 ? 8 : 
                   (draggingVertexIndex === idx ? 7 : 5)}
                fill={idx === 0 && isCreating && renderFreeformPoints.length >= 3 ? '#22c55e' : 
                      (draggingVertexIndex === idx ? '#1d4ed8' : '#3b82f6')}
                stroke="white"
                strokeWidth={2}
                style={{ cursor: idx === 0 && isCreating ? 'pointer' : 'move' }}
                onMouseDown={(e) => {
                  if (isCreating && idx === 0 && renderFreeformPoints.length >= 3) {
                    handleFreeformPointClick(idx, e);
                  } else if (!isCreating) {
                    handleVertexDragStart(idx, e);
                  }
                }}
                data-testid={`freeform-vertex-${idx}`}
              />
            ))}
          </svg>
        );

      default:
        return (
          <div
            className="w-full h-full"
            style={{
              ...commonStyles,
              backgroundColor: fillColor || '#e5e7eb',
              border: `${strokeWidth || 2}px solid ${strokeColor || '#9ca3af'}`,
              borderRadius: borderRadius || 4
            }}
          />
        );
    }
  };

  // Line, arrow, and freeform shapes don't need bounding box (they have point/vertex handles instead)
  const isLineShape = object.data.shapeType === 'line' || object.data.shapeType === 'arrow' || object.data.shapeType === 'freeform';

  return (
    <div
      ref={objectRef}
      className={cn(
        "group relative",
        isFreeformCreating ? "cursor-crosshair" : "cursor-pointer",
        object.selected && !isLineShape && "outline outline-2 outline-blue-500"
      )}
      style={{
        position: 'absolute',
        left: object.position.x,
        top: object.position.y,
        width: shapeSize.width,
        height: shapeSize.height,
        zIndex: object.zIndex || 0,
      }}
      data-testid={`shape-object-${object.id}`}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        // In freeform creation mode, don't start dragging - let clicks add points
        if (isFreeformCreating) {
          e.preventDefault();
          return;
        }
        handleMouseDown(e);
      }}
      onClick={(e) => {
        // In freeform creation mode, handle point addition
        if (isFreeformCreating) {
          // Check if we're clicking near the first point to close the shape
          if (freeformPoints.length >= 3 && mousePos) {
            const firstPt = freeformPoints[0];
            const dist = Math.hypot(mousePos.x - firstPt.x, mousePos.y - firstPt.y);
            if (dist < 20) {
              handleFreeformPointClick(0, e);
              return;
            }
          }
          handleFreeformClick(e);
          return;
        }
        onClick?.(e);
      }}
      onDoubleClick={(e) => {
        // In freeform creation mode, close the shape
        if (isFreeformCreating) {
          handleFreeformDoubleClick(e);
          return;
        }
        
        // Text editing disabled for shapes
        if (DISABLE_SHAPE_TEXT) {
          e.preventDefault();
          e.stopPropagation();
          onDoubleClick?.(e);
          return;
        }
        
        // Legacy text editing code (disabled)
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
      onMouseMove={isFreeformCreating ? handleFreeformMouseMove : undefined}
      onMouseLeave={isFreeformCreating ? handleFreeformMouseLeave : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      {/* Shape content */}
      <div className="w-full h-full relative">
        {renderShape()}
        
        {/* Text content disabled for shapes */}
        {(() => {
          if (DISABLE_SHAPE_TEXT || !object.data.text) return null;
          
          // Calculate inner text area for the specific shape type
          const innerRect = getInnerTextRect(
            object.data.shapeType,
            shapeSize.width,
            shapeSize.height,
            object.data.strokeWidth || 0,
            8 // padding
          );
          
          console.log('🎯 SHAPE OBJECT: Text positioning calculation', {
            objectId: object.id,
            shapeType: object.data.shapeType,
            fullShapeSize: shapeSize,
            strokeWidth: object.data.strokeWidth || 0,
            innerTextRect: innerRect,
            textContent: object.data.text,
            sizeComparison: innerRect ? {
              widthReduction: `${Math.round(((shapeSize.width - innerRect.width) / shapeSize.width) * 100)}%`,
              heightReduction: `${Math.round(((shapeSize.height - innerRect.height) / shapeSize.height) * 100)}%`
            } : 'No inner rect'
          });
          
          // Don't render text for shapes that don't support it (line, arrow)
          if (!innerRect) {
            console.log('❌ SHAPE OBJECT: Shape does not support text', {
              objectId: object.id,
              shapeType: object.data.shapeType
            });
            return null;
          }
          
          const fontSize = object.data.fontSize || 14;
          const lineHeight = 1.2;
          const maxLines = Math.max(1, Math.floor(innerRect.height / (fontSize * lineHeight)));
          
          console.log('📝 SHAPE OBJECT: Text rendering parameters', {
            objectId: object.id,
            fontSize,
            lineHeight,
            maxLines,
            innerRectHeight: innerRect.height,
            calculatedLineCapacity: innerRect.height / (fontSize * lineHeight)
          });
          
          return (
            <div 
              className="absolute flex items-center justify-center pointer-events-none"
              style={{
                left: innerRect.x,
                top: innerRect.y,
                width: innerRect.width,
                height: innerRect.height,
                clipPath: innerRect.clipPath
              }}
            >
              <div
                style={{
                  color: object.data.textColor || '#374151',
                  fontSize: `${fontSize}px`,
                  fontFamily: object.data.fontFamily || 'Inter',
                  fontWeight: object.data.fontWeight || 'normal',
                  fontStyle: object.data.fontStyle || 'normal',
                  textAlign: object.data.textAlign || 'center',
                  lineHeight: lineHeight.toString(),
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  overflow: 'hidden',
                  display: '-webkit-box' as any,
                  WebkitBoxOrient: 'vertical' as any,
                  WebkitLineClamp: maxLines,
                  width: '100%',
                  maxWidth: '100%',
                  maxHeight: `${innerRect.height}px` // Fallback for non-WebKit browsers
                }}
              >
                {object.data.text}
              </div>
            </div>
          );
        })()}
        
        {/* Text editor disabled for shapes */}
        {!DISABLE_SHAPE_TEXT && false && (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <InlineTextEditor
              initialValue={object.data.text || ''}
              placeholder="Add text..."
              onSave={(text) => {
                console.log('💾 SHAPE OBJECT: Text save from editor', {
                  objectId: object.id,
                  shapeType: object.data.shapeType,
                  previousText: object.data.text,
                  newText: text,
                  textChanged: object.data.text !== text
                });
                
                onUpdate?.({ text });
                setIsEditingText(false);
              }}
              onCancel={() => {
                console.log('❌ SHAPE OBJECT: Text edit cancelled', {
                  objectId: object.id,
                  shapeType: object.data.shapeType,
                  existingText: object.data.text
                });
                
                setIsEditingText(false);
              }}
              fontSize={object.data.fontSize || 14}
              fontFamily={object.data.fontFamily || 'Inter'}
              fontWeight={object.data.fontWeight || 'normal'}
              color={object.data.textColor || '#374151'}
              textAlign={object.data.textAlign || 'center'}
              className="text-center"
            />
          </div>
        )}
      </div>

      {/* Resize handles - only visible when exactly one canvas object is selected (not for line/arrow shapes) */}
      {object.selected && selectedCanvasObjectCount === 1 && !isLineShape && (
        <>
          <ResizeHandle
            position="top-left"
            nodeRef={objectRef}
            onResize={handleResize}
            minWidth={50}
            minHeight={50}
            maxWidth={5000}
            maxHeight={5000}
            viewport={viewport}
          />
          <ResizeHandle
            position="top-right"
            nodeRef={objectRef}
            onResize={handleResize}
            minWidth={50}
            minHeight={50}
            maxWidth={5000}
            maxHeight={5000}
            viewport={viewport}
          />
          <ResizeHandle
            position="bottom-left"
            nodeRef={objectRef}
            onResize={handleResize}
            minWidth={50}
            minHeight={50}
            maxWidth={5000}
            maxHeight={5000}
            viewport={viewport}
          />
          <ResizeHandle
            position="bottom-right"
            nodeRef={objectRef}
            onResize={handleResize}
            minWidth={50}
            minHeight={50}
            maxWidth={5000}
            maxHeight={5000}
            viewport={viewport}
          />
        </>
      )}

      {/* Endpoint handles for line/arrow shapes - shown when selected */}
      {object.selected && selectedCanvasObjectCount === 1 && 
       (object.data.shapeType === 'line' || object.data.shapeType === 'arrow') && (
        <>
          {/* Start endpoint handle */}
          <div
            className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-move shadow-md hover:bg-blue-50 hover:scale-110 transition-transform"
            style={{
              left: (object.data.startPoint?.x ?? 0) - 8,
              top: (object.data.startPoint?.y ?? shapeSize.height / 2) - 8,
              transform: viewport ? `scale(${1 / viewport.zoom})` : undefined,
              transformOrigin: 'center center',
              zIndex: 1000,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEndpointDragStart?.('start', e);
            }}
            data-testid="endpoint-handle-start"
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            </div>
          </div>
          {/* End endpoint handle */}
          <div
            className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-move shadow-md hover:bg-blue-50 hover:scale-110 transition-transform"
            style={{
              left: (object.data.endPoint?.x ?? shapeSize.width) - 8,
              top: (object.data.endPoint?.y ?? shapeSize.height / 2) - 8,
              transform: viewport ? `scale(${1 / viewport.zoom})` : undefined,
              transformOrigin: 'center center',
              zIndex: 1000,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEndpointDragStart?.('end', e);
            }}
            data-testid="endpoint-handle-end"
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            </div>
          </div>
        </>
      )}

      {/* Emoji Reactions */}
      <EmojiReactions
        nodeId={object.id}
        reactions={object.reactions}
        onAddReaction={onAddReaction}
        onRemoveReaction={onRemoveReaction}
        position="bottom"
      />
    </div>
  );
};