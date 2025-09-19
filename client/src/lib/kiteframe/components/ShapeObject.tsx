import React, { useRef, useCallback } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import type { CanvasObject, ShapeNodeData } from '../types';
import { cn } from '@/lib/utils';

interface ShapeObjectProps {
  object: CanvasObject & { data: ShapeNodeData };
  onUpdate?: (updates: Partial<ShapeNodeData>) => void;
  onResize?: (width: number, height: number, resizeInfo?: { position: string }) => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onAddReaction?: (objectId: string, emoji: string) => void;
  onRemoveReaction?: (objectId: string, emoji: string) => void;
  viewport?: { x: number; y: number; zoom: number };
  selectedCanvasObjectCount?: number; // For resize handle gating
}

export const ShapeObject: React.FC<ShapeObjectProps> = ({
  object,
  onUpdate,
  onResize,
  onStartDrag,
  onClick,
  onContextMenu,
  onAddReaction,
  onRemoveReaction,
  viewport,
  selectedCanvasObjectCount = 0
}) => {
  const objectRef = useRef<HTMLDivElement>(null);
  const shapeSize = {
    width: object.style?.width || object.width || 200,
    height: object.style?.height || object.height || (object.data?.shapeType === 'rectangle' ? 200 : 100)
  };

  const handleResize = useCallback((width: number, height: number) => {
    onResize?.(width, height);
  }, [onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Start drag if not clicking on resize handle, and only on left-click
    if (!e.defaultPrevented && e.button === 0) {
      onStartDrag?.(e);
    }
  };

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

  const renderShape = () => {
    const { 
      shapeType, 
      fillColor, 
      strokeColor, 
      strokeWidth, 
      borderRadius, 
      opacity,
      fillOpacity,
      strokeOpacity,
      strokeStyle,
      lineCap,
      arrowSize 
    } = object.data;
    const { width, height } = shapeSize;

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
        default:
          return 'none';
      }
    };

    switch (shapeType) {
      case 'rectangle':
        return (
          <div
            className="w-full h-full"
            style={{
              ...commonStyles,
              backgroundColor: fillOpacity !== undefined ? hexToRgba(fillColor || '#3b82f6', fillOpacity / 100) : (fillColor || '#3b82f6'),
              border: strokeWidth && strokeWidth > 0 
                ? `${strokeWidth}px ${strokeStyle || 'solid'} ${strokeOpacity !== undefined ? hexToRgba(strokeColor || '#1d4ed8', strokeOpacity / 100) : (strokeColor || '#1d4ed8')}` 
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
                fill: fillColor || '#10b981',
                fillOpacity: fillOpacity !== undefined ? fillOpacity / 100 : 1,
                stroke: strokeWidth && strokeWidth > 0 ? strokeColor || '#059669' : 'none',
                strokeOpacity: strokeWidth && strokeWidth > 0 && strokeOpacity !== undefined ? strokeOpacity / 100 : 1,
                strokeWidth: strokeWidth || 0,
                strokeDasharray: strokeWidth && strokeWidth > 0 ? getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2) : 'none',
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
                fill: fillColor || '#f59e0b',
                fillOpacity: fillOpacity !== undefined ? fillOpacity / 100 : 1,
                stroke: strokeWidth && strokeWidth > 0 ? strokeColor || '#d97706' : 'none',
                strokeOpacity: strokeWidth && strokeWidth > 0 && strokeOpacity !== undefined ? strokeOpacity / 100 : 1,
                strokeWidth: strokeWidth && strokeWidth > 0 ? (strokeWidth || 2) * (100 / Math.min(width, height)) : 0,
                strokeDasharray: strokeWidth && strokeWidth > 0 ? getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2) : 'none',
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
                fill: fillColor || '#8b5cf6',
                fillOpacity: fillOpacity !== undefined ? fillOpacity / 100 : 1,
                stroke: strokeWidth && strokeWidth > 0 ? strokeColor || '#7c3aed' : 'none',
                strokeOpacity: strokeWidth && strokeWidth > 0 && strokeOpacity !== undefined ? strokeOpacity / 100 : 1,
                strokeWidth: strokeWidth && strokeWidth > 0 ? (strokeWidth || 2) * (100 / Math.min(width, height)) : 0,
                strokeDasharray: strokeWidth && strokeWidth > 0 ? getStrokeDashArray(strokeStyle || 'solid', strokeWidth || 2) : 'none',
                filter: object.data.shadow?.enabled 
                  ? `drop-shadow(${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'})`
                  : 'none',
              }}
              data-testid="shape-hexagon"
            />
          </svg>
        );

      case 'line':
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
            <line
              x1="10"
              y1="50"
              x2="90"
              y2="50"
              style={{
                stroke: strokeColor || '#6b7280',
                strokeWidth: (strokeWidth || 2) * (100 / Math.min(width, height)),
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
        const arrowMarkerSize = (arrowSize || 1) * 10;
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
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
                    fill: strokeColor || '#6b7280'
                  }}
                />
              </marker>
            </defs>
            <line
              x1="10"
              y1="50"
              x2="85"
              y2="50"
              style={{
                stroke: strokeColor || '#6b7280',
                strokeWidth: (strokeWidth || 2) * (100 / Math.min(width, height)),
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

  return (
    <div
      ref={objectRef}
      className={cn(
        "group relative cursor-pointer",
        object.selected && "outline outline-2 outline-blue-500"
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
      onMouseDown={handleMouseDown}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      {/* Shape content */}
      <div className="w-full h-full">
        {renderShape()}
      </div>

      {/* Resize handles - only visible when exactly one canvas object is selected */}
      {object.selected && selectedCanvasObjectCount === 1 && (
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