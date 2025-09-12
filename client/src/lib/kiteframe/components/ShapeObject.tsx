import React, { useRef, useCallback } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import type { CanvasObject, ShapeNodeData } from '../types';
import { cn } from '@/lib/utils';

interface ShapeObjectProps {
  object: CanvasObject & { data: ShapeNodeData };
  onUpdate?: (updates: Partial<ShapeNodeData>) => void;
  onResize?: (width: number, height: number) => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onAddReaction?: (objectId: string, emoji: string) => void;
  onRemoveReaction?: (objectId: string, emoji: string) => void;
}

export const ShapeObject: React.FC<ShapeObjectProps> = ({
  object,
  onUpdate,
  onResize,
  onStartDrag,
  onClick,
  onAddReaction,
  onRemoveReaction
}) => {
  const objectRef = useRef<HTMLDivElement>(null);
  const shapeSize = {
    width: object.style?.width || object.width || 200,
    height: object.style?.height || object.height || 100
  };

  const handleResize = useCallback((width: number, height: number) => {
    onResize?.(width, height);
  }, [onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Start drag if not clicking on resize handle
    if (!e.defaultPrevented) {
      onStartDrag?.(e);
    }
  };

  const renderShape = () => {
    const { shapeType, fillColor, strokeColor, strokeWidth, borderRadius, opacity } = object.data;
    const { width, height } = shapeSize;

    const commonStyles = {
      width: '100%',
      height: '100%',
      opacity: opacity || 1
    };

    switch (shapeType) {
      case 'rectangle':
        return (
          <div
            className="w-full h-full"
            style={{
              ...commonStyles,
              backgroundColor: fillColor || '#3b82f6',
              border: `${strokeWidth || 2}px solid ${strokeColor || '#1d4ed8'}`,
              borderRadius: borderRadius || 8
            }}
            data-testid="shape-rectangle"
          />
        );

      case 'circle':
        return (
          <div
            className="w-full h-full rounded-full"
            style={{
              ...commonStyles,
              backgroundColor: fillColor || '#10b981',
              border: `${strokeWidth || 2}px solid ${strokeColor || '#059669'}`
            }}
            data-testid="shape-circle"
          />
        );

      case 'triangle':
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
            <polygon
              points="50,10 10,90 90,90"
              style={{
                fill: fillColor || '#f59e0b',
                stroke: strokeColor || '#d97706',
                strokeWidth: (strokeWidth || 2) * (100 / Math.min(width, height)),
                opacity: opacity || 1
              }}
              data-testid="shape-triangle"
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
                opacity: opacity || 1
              }}
              data-testid="shape-line"
            />
          </svg>
        );

      case 'arrow':
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
            <defs>
              <marker
                id={`arrowhead-${object.id}`}
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  style={{
                    fill: strokeColor || '#6b7280',
                    opacity: opacity || 1
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
                opacity: opacity || 1
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
        zIndex: object.selected ? 50 : 1,
      }}
      data-testid={`shape-object-${object.id}`}
      onMouseDown={handleMouseDown}
      onClick={onClick}
    >
      {/* Shape content */}
      <div className="w-full h-full">
        {renderShape()}
      </div>

      {/* Resize handles - all four corners when selected */}
      {object.selected && (
        <>
          <ResizeHandle
            position="top-left"
            nodeRef={objectRef}
            onResize={handleResize}
            minWidth={50}
            minHeight={50}
            maxWidth={500}
            maxHeight={500}
          />
          <ResizeHandle
            position="top-right"
            nodeRef={objectRef}
            onResize={handleResize}
            minWidth={50}
            minHeight={50}
            maxWidth={500}
            maxHeight={500}
          />
          <ResizeHandle
            position="bottom-left"
            nodeRef={objectRef}
            onResize={handleResize}
            minWidth={50}
            minHeight={50}
            maxWidth={500}
            maxHeight={500}
          />
          <ResizeHandle
            position="bottom-right"
            nodeRef={objectRef}
            onResize={handleResize}
            minWidth={50}
            minHeight={50}
            maxWidth={500}
            maxHeight={500}
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