import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import type { CanvasObject, StickyNoteData } from '../types';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface StickyNoteObjectProps {
  object: CanvasObject & { data: StickyNoteData };
  onUpdate?: (updates: Partial<StickyNoteData>) => void;
  onResize?: (width: number, height: number) => void;
  onDelete?: () => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onAddReaction?: (objectId: string, emoji: string) => void;
  onRemoveReaction?: (objectId: string, emoji: string) => void;
  viewport?: { x: number; y: number; zoom: number };
}

export const StickyNoteObject: React.FC<StickyNoteObjectProps> = ({
  object,
  onUpdate,
  onResize,
  onDelete,
  onStartDrag,
  onClick,
  onAddReaction,
  onRemoveReaction,
  viewport
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(object.data.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);

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
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Always call onClick for selection first
    onClick?.(e);
    
    // Handle single vs double click logic
    setClickCount(prev => prev + 1);
    
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    clickTimeoutRef.current = setTimeout(() => {
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
    // Only start drag if not editing and not clicking on resize handle or delete button
    if (!isEditing && !e.defaultPrevented) {
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

  return (
    <div
      ref={objectRef}
      className={cn(
        "group relative border-2 rounded-lg shadow-lg cursor-pointer transition-all hover:shadow-xl",
        object.selected && "outline outline-2 outline-blue-500"
      )}
      style={{
        position: 'absolute',
        left: object.position.x,
        top: object.position.y,
        width: noteSize.width,
        height: noteSize.height,
        backgroundColor: object.data.backgroundColor || '#fef3c7',
        borderColor: object.data.backgroundColor ? 
          `color-mix(in srgb, ${object.data.backgroundColor} 80%, #000000 20%)` : 
          '#f59e0b',
        zIndex: object.selected ? 50 : 1,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      data-testid={`sticky-note-object-${object.id}`}
    >

      {/* Content area */}
      <div className="w-full h-full p-3 relative">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Write your note..."
            className="w-full h-full bg-transparent border-none outline-none resize-none text-sm"
            style={{
              fontSize: `${object.data.fontSize || 14}px`,
              fontFamily: object.data.fontFamily || 'Inter, system-ui, sans-serif',
              color: object.data.textColor || '#000000',
            }}
            data-testid="sticky-note-textarea"
          />
        ) : (
          <div
            className="w-full h-full whitespace-pre-wrap break-words text-sm overflow-hidden"
            style={{
              fontSize: `${object.data.fontSize || 14}px`,
              fontFamily: object.data.fontFamily || 'Inter, system-ui, sans-serif',
              color: object.data.textColor || '#000000',
            }}
          >
            {text || object.data.text || 'Write your note...'}
          </div>
        )}
      </div>

      {/* Resize handles - only vertical resizing (top and bottom) */}
      {object.selected && (
        <>
          <ResizeHandle
            position="top-left"
            nodeRef={objectRef}
            onResize={(width, height) => {
              // Only allow height changes for sticky notes
              handleResize(noteSize.width, height);
            }}
            minWidth={noteSize.width}
            minHeight={80}
            maxWidth={noteSize.width}
            maxHeight={300}
            viewport={viewport}
          />
          <ResizeHandle
            position="top-right"
            nodeRef={objectRef}
            onResize={(width, height) => {
              // Only allow height changes for sticky notes
              handleResize(noteSize.width, height);
            }}
            minWidth={noteSize.width}
            minHeight={80}
            maxWidth={noteSize.width}
            maxHeight={300}
            viewport={viewport}
          />
          <ResizeHandle
            position="bottom-left"
            nodeRef={objectRef}
            onResize={(width, height) => {
              // Only allow height changes for sticky notes
              handleResize(noteSize.width, height);
            }}
            minWidth={noteSize.width}
            minHeight={80}
            maxWidth={noteSize.width}
            maxHeight={300}
            viewport={viewport}
          />
          <ResizeHandle
            position="bottom-right"
            nodeRef={objectRef}
            onResize={(width, height) => {
              // Only allow height changes for sticky notes
              handleResize(noteSize.width, height);
            }}
            minWidth={noteSize.width}
            minHeight={80}
            maxWidth={noteSize.width}
            maxHeight={300}
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