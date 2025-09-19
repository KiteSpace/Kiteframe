import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DefaultNode } from './DefaultNode';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import { NodeHandles } from './NodeHandles';
import type { Node, StickyNoteData } from '../types';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { toNumericWeight } from '@/lib/fontUtils';

interface StickyNoteProps {
  node: Node & { data: StickyNoteData };
  onUpdate?: (updates: Partial<StickyNoteData>) => void;
  onResize?: (width: number, height: number) => void;
  onDelete?: () => void;
  onAddReaction?: (nodeId: string, emoji: string) => void;
  onRemoveReaction?: (nodeId: string, emoji: string) => void;
}

export const StickyNote: React.FC<StickyNoteProps> = ({
  node,
  onUpdate,
  onResize,
  onDelete,
  onAddReaction,
  onRemoveReaction
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(node.data.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const noteSize = {
    width: node.style?.width || node.width || 200,
    height: node.style?.height || node.height || 150
  };

  // Auto-adjust textarea height based on content
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [text, isEditing]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Enter edit mode on single click for sticky notes (more intuitive)
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    onUpdate?.({ ...node.data, text: newText });
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Auto-save the text when exiting edit mode
    if (text !== node.data.text) {
      onUpdate?.({ ...node.data, text });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      e.stopPropagation();
    }
    // Allow Enter for line breaks in sticky notes
  };

  const handleResize = useCallback((width: number, height: number) => {
    onResize?.(width, height);
  }, [onResize]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  // Sticky note color options
  const getBackgroundColor = () => {
    const color = node.data.backgroundColor || '#fef08a'; // Default yellow
    return color;
  };

  const getTextColor = () => {
    return node.data.textColor || '#713f12'; // Dark brown for good contrast on yellow
  };

  // Helper function to generate box shadow from shadow data
  const getBoxShadow = () => {
    if (!node.data.shadow?.enabled) return 'none';
    
    const { color, blur, offsetX, offsetY } = node.data.shadow;
    return `${offsetX}px ${offsetY}px ${blur}px ${color}`;
  };

  const stickyStyles: React.CSSProperties = {
    backgroundColor: getBackgroundColor(),
    color: getTextColor(),
    fontSize: node.data.fontSize || 14,
    fontFamily: node.data.fontFamily || 'Inter, system-ui, sans-serif',
    fontStyle: node.data.fontStyle || 'normal',
    fontWeight: toNumericWeight(node.data.fontWeight),
    textAlign: node.data.textAlign || 'left',
    textDecoration: node.data.textDecoration || 'none',
    lineHeight: node.data.lineHeight || 1.4,
    letterSpacing: node.data.letterSpacing || 0,
    borderRadius: node.data.borderRadius || 8,
    border: node.data.borderWidth && node.data.borderWidth > 0 
      ? `${node.data.borderWidth}px ${node.data.borderStyle || 'solid'} ${node.data.borderColor || node.data.backgroundColor}` 
      : 'none',
    boxShadow: getBoxShadow(),
    opacity: node.data.opacity || 1
  };

  return (
    <DefaultNode
      node={{
        ...node,
        style: {
          ...node.style,
          width: noteSize.width,
          height: noteSize.height
        }
      }}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "sticky-note overflow-hidden shadow-lg",
        // Add a subtle paper texture effect
        "bg-gradient-to-br from-transparent to-black/5",
        // Slightly rotated effect for more authentic look
        "transform rotate-1 hover:rotate-0 transition-transform duration-200"
      )}
      style={stickyStyles}
    >
      <div ref={nodeRef} className="relative w-full h-full">
        {/* Sticky note header with lines */}
        <div className="absolute top-0 left-0 right-0 h-8 opacity-20">
          {/* Hole punch effect */}
          <div className="absolute top-3 left-6 w-2 h-2 bg-white rounded-full shadow-inner" />
          <div className="absolute top-3 left-12 w-2 h-2 bg-white rounded-full shadow-inner" />
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
          data-testid="sticky-note-delete"
        >
          <X className="w-3 h-3" />
        </button>

        {/* Content area with vertical alignment */}
        <div className="p-4 pt-8 h-full" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: node.data.verticalAlign === 'middle' ? 'center' : node.data.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'
        }}>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Write your note..."
              className="w-full bg-transparent border-none outline-none resize-none placeholder-current placeholder-opacity-60 leading-relaxed"
              style={{
                fontSize: node.data.fontSize || 14,
                fontFamily: node.data.fontFamily || 'Inter, system-ui, sans-serif',
                fontStyle: node.data.fontStyle || 'normal',
                fontWeight: toNumericWeight(node.data.fontWeight),
                textAlign: node.data.textAlign || 'left',
                textDecoration: node.data.textDecoration || 'none',
                lineHeight: node.data.lineHeight || 1.4,
                letterSpacing: node.data.letterSpacing || 0,
                color: getTextColor(),
                minHeight: 'auto',
                height: 'auto',
                flex: node.data.verticalAlign === 'middle' || node.data.verticalAlign === 'bottom' ? '0 0 auto' : '1 1 auto'
              }}
              data-testid="sticky-note-textarea"
            />
          ) : (
            <div
              className="w-full cursor-text leading-relaxed whitespace-pre-wrap break-words"
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              style={{
                fontSize: node.data.fontSize || 14,
                fontFamily: node.data.fontFamily || 'Inter, system-ui, sans-serif',
                fontStyle: node.data.fontStyle || 'normal',
                fontWeight: toNumericWeight(node.data.fontWeight),
                textAlign: node.data.textAlign || 'left',
                textDecoration: node.data.textDecoration || 'none',
                lineHeight: node.data.lineHeight || 1.4,
                letterSpacing: node.data.letterSpacing || 0,
                flex: node.data.verticalAlign === 'middle' || node.data.verticalAlign === 'bottom' ? '0 0 auto' : '1 1 auto'
              }}
              data-testid="sticky-note-content"
            >
              {text || (
                <span className="text-current opacity-60 italic">
                  Click to write a note...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Subtle shadow effect for realism */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-tl from-black/20 to-transparent" />
        </div>

        {/* Node handles for connections */}
        {node.showHandles !== false && (
          <NodeHandles 
            node={node}
            scale={1}
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
              minHeight={100}
            />
          </>
        )}
      </div>
    </DefaultNode>
  );
};