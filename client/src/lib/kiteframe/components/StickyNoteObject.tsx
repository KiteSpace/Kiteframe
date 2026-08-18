import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import type { CanvasObject, StickyNoteData } from '../types';
import { getOptimalTextColor } from '../utils/colorUtils';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useEventCleanup } from '../utils/eventCleanup';

interface StickyNoteObjectProps {
  object: CanvasObject & { data: StickyNoteData };
  onUpdate?: (updates: Partial<StickyNoteData>) => void;
  onResize?: (width: number, height: number, resizeInfo?: { position: string }) => void;
  onDelete?: () => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onAddReaction?: (objectId: string, emoji: string) => void;
  onRemoveReaction?: (objectId: string, emoji: string) => void;
  viewport?: { x: number; y: number; zoom: number };
  selectedCanvasObjectCount?: number; // For resize handle gating
}

export const StickyNoteObject: React.FC<StickyNoteObjectProps> = ({
  object,
  onUpdate,
  onResize,
  onDelete,
  onStartDrag,
  onClick,
  onContextMenu,
  onAddReaction,
  onRemoveReaction,
  viewport,
  selectedCanvasObjectCount = 0
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(object.data.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const cleanupManager = useEventCleanup();

  // Sync local text state with external updates
  useEffect(() => {
    if (!isEditing && object.data.text !== text) {
      setText(object.data.text || '');
    }
  }, [object.data.text, isEditing, text]);

  const noteSize = {
    width: object.style?.width || object.width || 200,
    height: object.style?.height || object.height || 150
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

  // Track clicks for proper select/edit behavior  
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef<(() => void) | null>(null);
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Always call onClick for selection first
    onClick?.(e);
    
    // Handle single vs double click logic
    setClickCount(prev => prev + 1);
    
    if (clickTimeoutRef.current) {
      clickTimeoutRef.current();
    }
    
    clickTimeoutRef.current = cleanupManager.setTimeout(() => {
      if (clickCount === 0) {
        // First click - just select (onClick already called)
      } else if (clickCount >= 1) {
        // Second click or more - enter edit mode  
        if (!isEditing && object.selected) {
          setIsEditing(true);
        }
      }
      setClickCount(0);
    }, 300);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if not editing and not clicking on resize handle or delete button, and only on left-click
    if (!isEditing && !e.defaultPrevented && e.button === 0) {
      onStartDrag?.(e);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    onUpdate?.({ ...object.data, text: newText });
  };

  const handleBlur = () => {
    setIsEditing(false);
    // Auto-save the text when exiting edit mode
    if (text !== object.data.text) {
      onUpdate?.({ ...object.data, text });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleResize = useCallback((width: number, height: number) => {
    onResize?.(width, height);
  }, [onResize]);

  // Helper function to convert hex to rgb components
  const hexToRgb = (hex: string): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Handle 3-character hex codes
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }
    
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `${r}, ${g}, ${b}`;
  };

  // Apply auto text color logic if enabled
  const displayTextColor = object.data.autoTextColor !== false 
    ? getOptimalTextColor(object.data.backgroundColor || '#fef3c7')
    : object.data.textColor || '#000000';

  const containerStyles = {
    position: 'absolute' as const,
    left: object.position.x,
    top: object.position.y,
    width: noteSize.width,
    height: noteSize.height,
    // Background color with opacity
    backgroundColor: object.data.backgroundOpacity !== undefined 
      ? `rgba(${hexToRgb(object.data.backgroundColor || '#fef3c7')}, ${object.data.backgroundOpacity / 100})` 
      : (object.data.backgroundColor || '#fef3c7'),
    // Border styling with opacity
    borderColor: object.data.borderOpacity !== undefined 
      ? `rgba(${hexToRgb(object.data.borderColor || '#d97706')}, ${object.data.borderOpacity / 100})` 
      : (object.data.borderColor || '#d97706'),
    borderWidth: `${object.data.borderWidth || 2}px`,
    borderStyle: object.data.borderStyle || 'solid',
    borderRadius: `${object.data.borderRadius || 8}px`,
    // Effects
    // opacity handled through backgroundColor and borderColor opacity
    boxShadow: object.data.shadow?.enabled 
      ? `${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'}`
      : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', // Default shadow
    zIndex: object.zIndex || 0,
    // Padding
    padding: object.data.padding 
      ? `${object.data.padding.top || 12}px ${object.data.padding.right || 12}px ${object.data.padding.bottom || 12}px ${object.data.padding.left || 12}px`
      : '12px',
  };

  const textStyles = {
    fontSize: `${object.data.fontSize || 14}px`,
    fontFamily: object.data.fontFamily || 'Inter, system-ui, sans-serif',
    fontWeight: object.data.fontWeight || 'normal',
    fontStyle: object.data.fontStyle || 'normal',
    textAlign: object.data.textAlign as 'left' | 'center' | 'right' | 'justify' || 'left',
    textDecoration: object.data.textDecoration || 'none',
    lineHeight: object.data.lineHeight || 1.4,
    color: displayTextColor,
  };

  return (
    <div
      ref={objectRef}
      className={cn(
        "group relative cursor-pointer transition-all hover:shadow-xl",
        object.selected && "outline outline-2 outline-blue-500"
      )}
      style={containerStyles}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
      data-testid={`sticky-note-object-${object.id}`}
    >

      {/* Content area - padding removed from here as it's applied to container */}
      <div className="w-full h-full relative flex items-stretch">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Write your note..."
            className="w-full h-full bg-transparent border-none outline-none resize-none"
            style={textStyles}
            data-testid="sticky-note-textarea"
          />
        ) : (
          <div
            className="w-full h-full whitespace-pre-wrap break-words overflow-hidden"
            style={textStyles}
          >
            {text || object.data.text || 'Write your note...'}
          </div>
        )}
      </div>

      {/* Resize handles - only visible when exactly one canvas object is selected */}
      {object.selected && selectedCanvasObjectCount === 1 && (
        <>
          <ResizeHandle
            position="top-left"
            nodeRef={objectRef}
            onResize={(width, height) => {
              handleResize(width, height);
            }}
            minWidth={150}
            minHeight={80}
            maxWidth={2000}
            maxHeight={1500}
            viewport={viewport}
          />
          <ResizeHandle
            position="top-right"
            nodeRef={objectRef}
            onResize={(width, height) => {
              handleResize(width, height);
            }}
            minWidth={150}
            minHeight={80}
            maxWidth={2000}
            maxHeight={1500}
            viewport={viewport}
          />
          <ResizeHandle
            position="bottom-left"
            nodeRef={objectRef}
            onResize={(width, height) => {
              handleResize(width, height);
            }}
            minWidth={150}
            minHeight={80}
            maxWidth={2000}
            maxHeight={1500}
            viewport={viewport}
          />
          <ResizeHandle
            position="bottom-right"
            nodeRef={objectRef}
            onResize={(width, height) => {
              handleResize(width, height);
            }}
            minWidth={150}
            minHeight={80}
            maxWidth={2000}
            maxHeight={1500}
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