import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import type { CanvasObject, TextNodeData } from '../types';
import { cn } from '@/lib/utils';

interface TextObjectProps {
  object: CanvasObject & { data: TextNodeData };
  onUpdate?: (updates: Partial<TextNodeData>) => void;
  onResize?: (width: number, height: number) => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onAddReaction?: (objectId: string, emoji: string) => void;
  onRemoveReaction?: (objectId: string, emoji: string) => void;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  onExitEdit?: () => void;
}

export const TextObject: React.FC<TextObjectProps> = ({
  object,
  onUpdate,
  onResize,
  onStartDrag,
  onClick,
  onAddReaction,
  onRemoveReaction,
  style,
  autoFocus = false,
  onExitEdit
}) => {
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [text, setText] = useState(object.data.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  // Calculate initial size based on text content
  const getInitialDimensions = useCallback(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return { width: 200, height: 50 };
    
    const fontSize = object.data.fontSize || 16;
    const fontFamily = object.data.fontFamily || 'Inter, system-ui, sans-serif';
    context.font = `${fontSize}px ${fontFamily}`;
    
    const text = object.data.text || 'Type here...';
    const textMetrics = context.measureText(text);
    const textWidth = Math.max(150, Math.min(400, textMetrics.width + 40));
    const textHeight = Math.max(50, fontSize * 1.5 + 20);
    
    return {
      width: object.style?.width || textWidth,
      height: object.style?.height || textHeight
    };
  }, [object.data.text, object.data.fontSize, object.data.fontFamily, object.style?.width, object.style?.height]);
  
  const [textSize, setTextSize] = useState(getInitialDimensions);
  
  // Mobile touch handling
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

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

  // Auto-resize based on content with text wrapping support
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  
  const [isManuallyResized, setIsManuallyResized] = useState(false);

  useEffect(() => {
    if (measureRef.current && !isManuallyResized) {
      // For auto-sizing, allow text to expand horizontally to a max width
      const maxAutoWidth = 400;
      const minWidth = 150;
      
      let width = Math.max(minWidth, Math.min(maxAutoWidth, measureRef.current.scrollWidth + 20));
      let height = Math.max(50, measureRef.current.scrollHeight + 20);
      
      setTextSize(prevSize => {
        // Only update if dimensions actually changed
        if (prevSize.width !== width || prevSize.height !== height) {
          setTimeout(() => {
            onResizeRef.current?.(width, height);
          }, 0);
          return { width, height };
        }
        return prevSize;
      });
    } else if (measureRef.current && isManuallyResized) {
      // For manually resized text, only adjust height to fit content within the set width
      const height = Math.max(50, measureRef.current.scrollHeight + 20);
      
      setTextSize(prevSize => {
        if (prevSize.height !== height) {
          setTimeout(() => {
            onResizeRef.current?.(prevSize.width, height);
          }, 0);
          return { ...prevSize, height };
        }
        return prevSize;
      });
    }
  }, [text, object.data.fontSize, object.data.fontFamily, isManuallyResized]);

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
        // Don't enter edit mode
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
    // Only start drag if not editing and not clicking on resize handle
    if (!isEditing && !e.defaultPrevented) {
      onStartDrag?.(e);
    }
  };

  // Mobile double-tap detection
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setTouchStartTime(Date.now());
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    
    // Only process quick taps (< 200ms)
    if (touchDuration < 200) {
      const currentTime = Date.now();
      const timeSinceLastTap = currentTime - lastTapTime;
      
      if (timeSinceLastTap < 300) {
        // Double tap detected
        setIsEditing(true);
      } else {
        // Single tap
        if (!isEditing) {
          setIsEditing(true);
        }
      }
      setLastTapTime(currentTime);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    onUpdate?.({ ...object.data, text: newText });
  };

  const handleBlur = () => {
    setIsEditing(false);
    onExitEdit?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      onExitEdit?.();
    }
  };

  const textStyles = {
    fontSize: `${object.data.fontSize || 16}px`,
    fontFamily: object.data.fontFamily || 'Inter, system-ui, sans-serif',
    fontWeight: object.data.fontWeight || 'normal',
    textAlign: object.data.textAlign as 'left' | 'center' | 'right' | 'justify' || 'left',
    lineHeight: object.data.lineHeight || 1.5,
    letterSpacing: `${object.data.letterSpacing || 0}px`,
    color: object.data.textColor || '#000000',
    textDecoration: object.data.textDecoration || 'none',
    textTransform: object.data.textTransform as 'none' | 'uppercase' | 'lowercase' | 'capitalize' || 'none',
    backgroundColor: object.data.backgroundColor || 'transparent',
  };

  return (
    <div
      ref={objectRef}
      className={cn(
        "group relative cursor-text",
        object.selected && "outline outline-2 outline-blue-500"
      )}
      style={{
        position: 'absolute',
        left: object.position.x,
        top: object.position.y,
        width: textSize.width,
        height: textSize.height,
        zIndex: object.selected ? 50 : 1,
        ...style
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid={`text-object-${object.id}`}
    >
      {/* Invisible text for measuring */}
      <div
        ref={measureRef}
        style={{
          ...textStyles,
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          top: 0,
          left: 0,
          width: isManuallyResized ? `${textSize.width - 20}px` : 'auto',
          height: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '8px',
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden'
        }}
        aria-hidden="true"
      >
        {text || object.data.text || 'Type here...'}
      </div>

      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type here..."
          className="w-full h-full p-2 border-none outline-none resize-none bg-transparent"
          style={textStyles}
          data-testid="text-object-textarea"
        />
      ) : (
        <div
          className="w-full h-full p-2 whitespace-pre-wrap break-words"
          style={textStyles}
        >
          {text || object.data.text || 'Type here...'}
        </div>
      )}

      {/* Resize handles - all four corners when selected */}
      {object.selected && (
        <>
          <ResizeHandle
            position="top-left"
            nodeRef={objectRef}
            onResize={(width, height) => {
              setTextSize({ width, height });
              setIsManuallyResized(true);
              onResize?.(width, height);
            }}
            minWidth={150}
            minHeight={50}
            maxWidth={500}
            maxHeight={400}
          />
          <ResizeHandle
            position="top-right"
            nodeRef={objectRef}
            onResize={(width, height) => {
              setTextSize({ width, height });
              setIsManuallyResized(true);
              onResize?.(width, height);
            }}
            minWidth={150}
            minHeight={50}
            maxWidth={500}
            maxHeight={400}
          />
          <ResizeHandle
            position="bottom-left"
            nodeRef={objectRef}
            onResize={(width, height) => {
              setTextSize({ width, height });
              setIsManuallyResized(true);
              onResize?.(width, height);
            }}
            minWidth={150}
            minHeight={50}
            maxWidth={500}
            maxHeight={400}
          />
          <ResizeHandle
            position="bottom-right"
            nodeRef={objectRef}
            onResize={(width, height) => {
              setTextSize({ width, height });
              setIsManuallyResized(true);
              onResize?.(width, height);
            }}
            minWidth={150}
            minHeight={50}
            maxWidth={500}
            maxHeight={400}
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