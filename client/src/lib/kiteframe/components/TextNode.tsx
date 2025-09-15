import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DefaultNode } from './DefaultNode';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import { NodeHandles } from './NodeHandles';
import type { Node, TextNodeData } from '../types';
import { cn } from '@/lib/utils';
import { useEventCleanup } from '../utils/eventCleanup';

interface TextNodeProps {
  node: Node & { data: TextNodeData };
  onUpdate?: (updates: Partial<TextNodeData>) => void;
  onResize?: (width: number, height: number) => void;
  onAddReaction?: (nodeId: string, emoji: string) => void;
  onRemoveReaction?: (nodeId: string, emoji: string) => void;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  onExitEdit?: () => void;
}

export const TextNode: React.FC<TextNodeProps> = ({
  node,
  onUpdate,
  onResize,
  onAddReaction,
  onRemoveReaction,
  style,
  autoFocus = false,
  onExitEdit
}) => {
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [text, setText] = useState(node.data.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [textSize, setTextSize] = useState({ 
    width: node.style?.width || 200, 
    height: node.style?.height || 100 
  });
  
  // Mobile touch handling
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const cleanupManager = useEventCleanup();

  // Auto-focus when component mounts if autoFocus is true
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      setIsEditing(true);
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Auto-resize based on content - using refs to avoid infinite loops
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    if (measureRef.current) {
      const width = Math.max(200, Math.min(400, measureRef.current.scrollWidth + 20));
      const height = Math.max(50, measureRef.current.scrollHeight + 20);
      
      setTextSize(prevSize => {
        // Only update if dimensions actually changed to prevent unnecessary renders
        if (prevSize.width !== width || prevSize.height !== height) {
          // Use cleanup manager for timeout to avoid calling onResize during render
          cleanupManager.setTimeout(() => {
            onResizeRef.current?.(width, height);
          }, 0);
          return { width, height };
        }
        return prevSize;
      });
    }
  }, [text, node.data.fontSize, node.data.fontFamily, node.data.lineHeight, cleanupManager]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    onUpdate?.({ ...node.data, text: newText });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartTime(Date.now());
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touchDuration = Date.now() - touchStartTime;
    const now = Date.now();
    
    // If it's a short tap (less than 300ms)
    if (touchDuration < 300) {
      // Check for double-tap (two taps within 500ms)
      if (now - lastTapTime < 500) {
        setIsEditing(true);
        setLastTapTime(0); // Reset to prevent triple-tap issues
      } else {
        setLastTapTime(now);
        // Single tap - also enter edit mode for better mobile UX
        cleanupManager.setTimeout(() => {
          if (Date.now() - lastTapTime >= 400) {
            setIsEditing(true);
          }
        }, 400);
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // On mobile devices, also allow single click to edit for better accessibility
    if ('ontouchstart' in window) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    onExitEdit?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      onExitEdit?.();
      e.stopPropagation();
    }
    // Allow other keys to propagate for text editing
  };

  const handleResize = useCallback((width: number, height: number) => {
    setTextSize({ width, height });
    onResize?.(width, height);
  }, [onResize]);

  const textStyles: React.CSSProperties = {
    fontSize: node.data.fontSize || 16,
    fontFamily: node.data.fontFamily || 'Inter, system-ui, sans-serif',
    fontWeight: node.data.fontWeight || 'normal',
    textAlign: node.data.textAlign || 'left',
    lineHeight: node.data.lineHeight || 1.4,
    letterSpacing: node.data.letterSpacing || 0,
    color: node.data.textColor || 'hsl(var(--foreground))',
    textDecoration: node.data.textDecoration || 'none',
    textTransform: node.data.textTransform || 'none',
    backgroundColor: node.data.backgroundColor || 'transparent'
  };

  return (
    <DefaultNode
      node={{
        ...node,
        style: {
          ...node.style,
          width: textSize.width,
          height: textSize.height
        }
      }}
      onDoubleClick={handleDoubleClick}
      className="overflow-hidden"
      style={{ backgroundColor: textStyles.backgroundColor }}
    >
      <div ref={nodeRef} className="relative w-full h-full">
        {/* Hidden measuring div for auto-sizing */}
        <div
          ref={measureRef}
          className="absolute invisible whitespace-pre-wrap break-words p-3"
          style={{
            ...textStyles,
            width: '400px', // Max width for measuring
            minHeight: '50px'
          }}
        >
          {text || 'Type something...'}
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Type something..."
            className="w-full h-full p-3 bg-transparent border-2 border-blue-500 rounded resize-none outline-none"
            style={{
              ...textStyles,
              background: 'rgba(59, 130, 246, 0.05)',
            }}
            data-testid="text-node-textarea"
          />
        ) : (
          <div
            className="w-full h-full p-3 cursor-text hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded transition-colors touch-manipulation"
            style={textStyles}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
            data-testid="text-node-content"
          >
            {text || (
              <span className="text-gray-400 italic">
                Type something...
              </span>
            )}
          </div>
        )}

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
              minWidth={150}
              minHeight={50}
            />
          </>
        )}
      </div>
    </DefaultNode>
  );
};