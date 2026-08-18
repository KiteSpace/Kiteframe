import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import { getBorderColorFromHeader } from '@/lib/themes';
import { Code2, Palette, Trash2 } from 'lucide-react';
import type { Node, Position } from '../types';
import { sanitizeText } from '../utils/validation';

const MIN_RENDER_WIDTH = 200;
const MIN_RENDER_HEIGHT = 150;
const DEFAULT_RENDER_WIDTH = 400;
const DEFAULT_RENDER_HEIGHT = 300;
const HEADER_HEIGHT = 36;

export interface RenderNodeData {
  label?: string;
  htmlContent?: string;
  sourceNodeId?: string;
  lastUpdated?: string;
  autoRefresh?: boolean;
  colors?: {
    headerBackground?: string;
    bodyBackground?: string;
    borderColor?: string;
    headerTextColor?: string;
  };
}

export interface RenderNode extends Node {
  type: 'render';
  data: RenderNodeData;
}

export interface RenderNodeComponentProps {
  node: RenderNode;
  onUpdate?: (id: string, updates: Partial<Node>) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onFocusNode?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onOpenColorPicker?: (nodeId: string) => void;
  className?: string;
  style?: React.CSSProperties;
  showHandles?: boolean;
  showResizeHandle?: boolean;
  onStartDrag?: (e: React.MouseEvent, node: Node) => void;
  onClick?: (e: React.MouseEvent, node: Node) => void;
  onHandleConnect?: (pos: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => void;
  viewport?: { zoom: number; x: number; y: number };
  showDragPlaceholder?: boolean;
  isAnyDragActive?: boolean;
}

const RenderNodeComponent: React.FC<RenderNodeComponentProps> = ({
  node,
  onUpdate,
  onDoubleClick,
  onFocusNode,
  onDelete,
  onOpenColorPicker,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
  showDragPlaceholder = false,
  isAnyDragActive = false,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.label || 'HTML');
  const [iframeKey, setIframeKey] = useState(0);
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  const htmlContent = node.data.htmlContent || '';
  const title = node.data.label || 'HTML';
  
  const nodeWidth = node.style?.width || node.width || DEFAULT_RENDER_WIDTH;
  const nodeHeight = node.style?.height || node.height || DEFAULT_RENDER_HEIGHT;
  
  const headerColor = node.data.colors?.headerBackground || '#7c3aed';
  const bodyColor = node.data.colors?.bodyBackground || '#ffffff';
  const borderColor = node.data.colors?.borderColor || getBorderColorFromHeader(headerColor);
  const headerTextColor = node.data.colors?.headerTextColor || '#ffffff';

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    setIframeKey(prev => prev + 1);
  }, [htmlContent]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('input, button, textarea, select, iframe, [contenteditable="true"]');
    if (isInteractiveElement) return;
    e.stopPropagation();
    onStartDrag?.(e, node);
  }, [onStartDrag, node]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e, node);
  }, [onClick, node]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(e);
  }, [onDoubleClick]);

  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  }, []);

  const handleTitleSubmit = useCallback(() => {
    const sanitizedTitle = sanitizeText(editTitleValue.trim() || 'HTML');
    onUpdate?.(node.id, {
      data: { ...node.data, label: sanitizedTitle },
    });
    setIsEditingTitle(false);
  }, [editTitleValue, node.id, node.data, onUpdate]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditTitleValue(node.data.label || 'HTML');
      setIsEditingTitle(false);
    }
  }, [handleTitleSubmit, node.data.label]);

  const handleResize = useCallback((width: number, height: number) => {
    if (onUpdate) {
      onUpdate(node.id, {
        style: { ...node.style, width, height },
      });
    }
  }, [node.id, node.style, onUpdate]);

  const hasContent = !!htmlContent;

  return (
    <>
      <div
        ref={nodeRef}
        className={cn(
          "absolute rounded-lg overflow-hidden shadow-lg transition-shadow",
          node.selected && "ring-2 ring-purple-500 ring-offset-1",
          className
        )}
        style={{
          ...style,
          left: node.position.x,
          top: node.position.y,
          width: nodeWidth,
          height: nodeHeight,
          minWidth: MIN_RENDER_WIDTH,
          minHeight: MIN_RENDER_HEIGHT,
          zIndex: node.zIndex || 0,
          border: `1px solid ${borderColor}`,
          backgroundColor: bodyColor,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        data-testid={`render-node-${node.id}`}
      >
        {showHandles && !isAnyDragActive && (
          <NodeHandles
            node={{ ...node, width: nodeWidth, height: nodeHeight }}
            scale={viewport?.zoom || 1}
            onHandleConnect={onHandleConnect}
          />
        )}

        <div
          className="flex items-center justify-between px-3 cursor-move"
          style={{ 
            backgroundColor: headerColor,
            color: headerTextColor,
            height: HEADER_HEIGHT,
          }}
          onDoubleClick={handleTitleDoubleClick}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Code2 size={14} className="flex-shrink-0 opacity-80" />
            
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleKeyDown}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex-1 bg-white/20 text-white placeholder-white/60 px-2 py-0.5 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/50"
                placeholder="Enter title..."
                data-testid="render-title-input"
              />
            ) : (
              <span className="font-medium text-sm truncate">{title}</span>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenColorPicker?.(node.id); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Color Palette"
              data-testid="render-color-picker"
            >
              <Palette size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(node.id); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 hover:bg-white/20 rounded transition-colors text-red-200 hover:text-red-100"
              title="Delete"
              data-testid="render-delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div 
          className="relative overflow-hidden"
          style={{ 
            height: nodeHeight - HEADER_HEIGHT,
            backgroundColor: bodyColor,
          }}
        >
          {hasContent ? (
            <iframe
              key={iframeKey}
              srcDoc={htmlContent}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title={title}
              style={{ backgroundColor: 'white' }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-3 text-gray-400">
              <Code2 size={32} className="opacity-50" />
              <span className="text-sm text-center">
                Connect to a Code node to render HTML output
              </span>
            </div>
          )}
        </div>

        {showResizeHandle && node.resizable !== false && (
          <ResizeHandle
            position="bottom-right"
            nodeRef={nodeRef}
            onResize={handleResize}
            minWidth={MIN_RENDER_WIDTH}
            minHeight={MIN_RENDER_HEIGHT}
            maxWidth={1200}
            maxHeight={900}
            viewport={viewport}
          />
        )}
      </div>
    </>
  );
};

export const createRenderNode = (
  id: string,
  position: Position,
  data: Partial<RenderNodeData> = {}
): RenderNode => ({
  id,
  type: 'render',
  position,
  data: {
    label: data.label || 'HTML',
    htmlContent: data.htmlContent || '',
    sourceNodeId: data.sourceNodeId,
    lastUpdated: data.lastUpdated,
    autoRefresh: data.autoRefresh !== false,
    colors: {
      headerBackground: data.colors?.headerBackground || '#7c3aed',
      bodyBackground: data.colors?.bodyBackground || '#ffffff',
      borderColor: data.colors?.borderColor,
      headerTextColor: data.colors?.headerTextColor || '#ffffff',
    },
  },
  width: DEFAULT_RENDER_WIDTH,
  height: DEFAULT_RENDER_HEIGHT,
  resizable: true,
});

export default memo(RenderNodeComponent);
