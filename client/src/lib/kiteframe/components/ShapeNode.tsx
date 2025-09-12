import React, { useRef, useCallback } from 'react';
import { DefaultNode } from './DefaultNode';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import { NodeHandles } from './NodeHandles';
import type { Node, ShapeNodeData } from '../types';
import { cn } from '@/lib/utils';

interface ShapeNodeProps {
  node: Node & { data: ShapeNodeData };
  onUpdate?: (updates: Partial<ShapeNodeData>) => void;
  onResize?: (width: number, height: number) => void;
  onAddReaction?: (nodeId: string, emoji: string) => void;
  onRemoveReaction?: (nodeId: string, emoji: string) => void;
}

export const ShapeNode: React.FC<ShapeNodeProps> = ({
  node,
  onUpdate,
  onResize,
  onAddReaction,
  onRemoveReaction
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const shapeSize = {
    width: node.style?.width || node.width || 200,
    height: node.style?.height || node.height || 100
  };

  const handleResize = useCallback((width: number, height: number) => {
    onResize?.(width, height);
  }, [onResize]);

  const renderShape = () => {
    const { shapeType, fillColor, strokeColor, strokeWidth, borderRadius, opacity } = node.data;
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
              points="50,10 90,90 10,90"
              fill={fillColor || '#f59e0b'}
              stroke={strokeColor || '#d97706'}
              strokeWidth={(strokeWidth || 2) * (100 / Math.min(width, height))}
              opacity={opacity || 1}
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
              stroke={strokeColor || '#6b7280'}
              strokeWidth={(strokeWidth || 3) * (100 / Math.min(width, height))}
              opacity={opacity || 1}
              data-testid="shape-line"
            />
          </svg>
        );

      case 'arrow':
        return (
          <svg width="100%" height="100%" viewBox="0 0 100 100" className="overflow-visible">
            <defs>
              <marker
                id={`arrowhead-${node.id}`}
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={strokeColor || '#ef4444'}
                />
              </marker>
            </defs>
            <line
              x1="10"
              y1="50"
              x2="80"
              y2="50"
              stroke={strokeColor || '#ef4444'}
              strokeWidth={(strokeWidth || 3) * (100 / Math.min(width, height))}
              markerEnd={`url(#arrowhead-${node.id})`}
              opacity={opacity || 1}
              data-testid="shape-arrow"
            />
          </svg>
        );

      default:
        return (
          <div
            className="w-full h-full flex items-center justify-center text-gray-400 text-sm"
            style={commonStyles}
          >
            Unknown shape: {shapeType}
          </div>
        );
    }
  };

  return (
    <DefaultNode
      node={{
        ...node,
        style: {
          ...node.style,
          width: shapeSize.width,
          height: shapeSize.height
        }
      }}
      className="overflow-visible bg-transparent border-transparent shadow-none"
    >
      <div ref={nodeRef} className="relative w-full h-full">
        {renderShape()}

        {/* Shape type indicator - shows on hover */}
        <div className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded capitalize">
          {node.data.shapeType || 'shape'}
        </div>

        {/* Node handles for connections */}
        {node.showHandles !== false && (
          <NodeHandles 
            node={node}
            onHandleConnect={() => {}} // Will be handled by KiteFrameCanvas
          />
        )}

        {/* Emoji reactions */}
        <div className="absolute bottom-0 right-0 transform translate-x-1 translate-y-1">
          <EmojiReactions 
            nodeId={node.id}
            reactions={node.data?.reactions}
            onAddReaction={onAddReaction}
            onRemoveReaction={onRemoveReaction}
            position="bottom"
          />
        </div>

        {/* Resize handles */}
        {node.resizable && (
          <>
            <ResizeHandle
              position="bottom-right"
              nodeRef={nodeRef}
              onResize={handleResize}
              minWidth={50}
              minHeight={50}
            />
            <ResizeHandle
              position="top-left"
              nodeRef={nodeRef}
              onResize={handleResize}
              minWidth={50}
              minHeight={50}
            />
            <ResizeHandle
              position="top-right"
              nodeRef={nodeRef}
              onResize={handleResize}
              minWidth={50}
              minHeight={50}
            />
            <ResizeHandle
              position="bottom-left"
              nodeRef={nodeRef}
              onResize={handleResize}
              minWidth={50}
              minHeight={50}
            />
          </>
        )}
      </div>
    </DefaultNode>
  );
};