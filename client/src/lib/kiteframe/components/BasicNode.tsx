import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import type { Node, BasicNodeData, BasicNodeComponentProps } from '../types';
import { sanitizeText, validateColor } from '../utils/validation';


const BasicNodeComponent: React.FC<BasicNodeComponentProps> = ({
  node,
  onUpdate,
  onConnect,
  onDoubleClick,
  className,
  style,
  showHandles = true,
  showResizeHandle = true
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.data.label || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    onDoubleClick?.(e);
  }, [onDoubleClick]);

  const handleLabelSubmit = useCallback(() => {
    if (onUpdate) {
      const sanitizedLabel = sanitizeText(editValue.trim() || 'Basic Node');
      onUpdate(node.id, {
        data: { ...node.data, label: sanitizedLabel }
      });
    }
    setIsEditing(false);
  }, [editValue, node.id, node.data, onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLabelSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(node.data.label || '');
      setIsEditing(false);
    }
  }, [handleLabelSubmit, node.data.label]);

  const handleResize = useCallback((width: number, height: number) => {
    if (onUpdate) {
      onUpdate(node.id, {
        style: { ...node.style, width, height }
      });
    }
  }, [node.id, node.style, onUpdate]);

  // Get colors with fallbacks and validation - memoized for performance
  const colors = useMemo(() => {
    const nodeColors = node.data.colors || {};
    return {
      headerBg: validateColor(nodeColors.headerBackground || '') ? nodeColors.headerBackground : '#f8fafc',
      bodyBg: validateColor(nodeColors.bodyBackground || '') ? nodeColors.bodyBackground : '#ffffff',
      borderColor: validateColor(nodeColors.borderColor || '') ? nodeColors.borderColor : '#e2e8f0',
      headerTextColor: validateColor(nodeColors.headerTextColor || '') ? nodeColors.headerTextColor : '#1e293b',
      bodyTextColor: validateColor(nodeColors.bodyTextColor || '') ? nodeColors.bodyTextColor : '#64748b'
    };
  }, [node.data.colors]);

  const nodeWidth = node.style?.width || node.width || 200;
  const nodeHeight = node.style?.height || node.height || 120;

  // Memoize node styles to prevent unnecessary recalculations
  const nodeStyles = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: nodeWidth,
    height: nodeHeight,
    zIndex: node.zIndex || 0,
    ...style
  }), [node.position.x, node.position.y, nodeWidth, nodeHeight, node.zIndex, style]);

  return (
    <div
      ref={nodeRef}
      className={cn(
        'kiteframe-node group',
        'border-2 rounded-lg shadow-md transition-all duration-200',
        'hover:shadow-lg cursor-move',
        node.selected ? 'ring-2 ring-blue-500 shadow-lg' : '',
        node.hidden ? 'opacity-0 pointer-events-none' : '',
        className
      )}
      style={{
        ...nodeStyles,
        borderColor: colors.borderColor,
      }}
      onDoubleClick={handleDoubleClick}
      data-testid={`basic-node-${node.id}`}
    >
      {/* Header */}
      <div 
        className="h-8 px-3 flex items-center justify-between rounded-t-md"
        style={{
          backgroundColor: colors.headerBg,
          color: colors.headerTextColor
        }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleLabelSubmit}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-none outline-none text-sm font-medium w-full"
            style={{ color: colors.headerTextColor }}
            data-testid="basic-node-label-input"
          />
        ) : (
          <span 
            className="text-sm font-medium truncate"
            title={node.data.label}
          >
            {sanitizeText(node.data.label || 'Basic Node')}
          </span>
        )}
        
        {/* Node type indicator */}
        <div 
          className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"
          title="Basic Node"
        />
      </div>

      {/* Body */}
      <div 
        className="flex-1 p-3 rounded-b-md"
        style={{
          backgroundColor: colors.bodyBg,
          color: colors.bodyTextColor,
          minHeight: nodeHeight - 32 // Account for header height
        }}
      >
        {node.data.description ? (
          <p className="text-xs leading-relaxed">
            {sanitizeText(node.data.description)}
          </p>
        ) : (
          <div className="text-xs opacity-60 italic">
            Double-click to edit
          </div>
        )}
      </div>

      {/* Connection Handles */}
      {showHandles && (
        <NodeHandles
          node={node}
          scale={1} // Default scale, should be passed from canvas
          onHandleConnect={useCallback((pos, e) => {
            // Handle connection logic
            console.log('Handle connect:', pos, e);
          }, [])}
        />
      )}

      {/* Resize Handle */}
      {showResizeHandle && node.resizable !== false && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={handleResize}
          minWidth={150}
          minHeight={80}
        />
      )}
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const BasicNode = React.memo(BasicNodeComponent);

// Default props for creating a basic node
export const createBasicNode = (
  id: string, 
  position: { x: number; y: number },
  data: Partial<BasicNodeData> = {}
): Node & { data: BasicNodeData } => ({
  id,
  type: 'basic',
  position,
  data: {
    label: data.label || 'Basic Node',
    description: data.description || '',
    colors: data.colors || {}
  },
  width: 200,
  height: 120,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true
});