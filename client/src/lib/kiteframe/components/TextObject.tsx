import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ResizeHandle } from './ResizeHandle';
import { EmojiReactions } from './EmojiReactions';
import type { CanvasObject, TextNodeData } from '../types';
import { cn } from '@/lib/utils';
import { useEventCleanup } from '../utils/eventCleanup';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';

interface TextObjectProps {
  object: CanvasObject & { data: TextNodeData };
  onUpdate?: (updates: Partial<TextNodeData>) => void;
  onResize?: (width: number, height: number, resizeInfo?: { position: string }) => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onAddReaction?: (objectId: string, emoji: string) => void;
  onRemoveReaction?: (objectId: string, emoji: string) => void;
  onHyperlinkEdit?: () => void;
  onHyperlinkDelete?: () => void;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  onExitEdit?: () => void;
  viewport?: { x: number; y: number; zoom: number };
  selectedCanvasObjectCount?: number; // For resize handle gating
}

export const TextObject: React.FC<TextObjectProps> = ({
  object,
  onUpdate,
  onResize,
  onStartDrag,
  onClick,
  onContextMenu,
  onAddReaction,
  onRemoveReaction,
  onHyperlinkEdit,
  onHyperlinkDelete,
  style,
  autoFocus = false,
  onExitEdit,
  viewport,
  selectedCanvasObjectCount = 0
}) => {
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [text, setText] = useState(object.data.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const cleanupManager = useEventCleanup();
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
  
  // Hover state for hyperlink menu with delay to prevent quick disappearance
  const [showHyperlinkMenu, setShowHyperlinkMenu] = useState(false);
  const hyperlinkMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleHyperlinkMenuEnter = useCallback(() => {
    if (hyperlinkMenuTimeoutRef.current) {
      clearTimeout(hyperlinkMenuTimeoutRef.current);
      hyperlinkMenuTimeoutRef.current = null;
    }
    setShowHyperlinkMenu(true);
  }, []);
  
  const handleHyperlinkMenuLeave = useCallback(() => {
    // Add delay before hiding to give user time to move to the menu
    hyperlinkMenuTimeoutRef.current = setTimeout(() => {
      setShowHyperlinkMenu(false);
    }, 200);
  }, []);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hyperlinkMenuTimeoutRef.current) {
        clearTimeout(hyperlinkMenuTimeoutRef.current);
      }
    };
  }, []);
  
  // Drag detection to prevent link opening after drag
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Sync local text state with prop changes (important for TypographyPanel updates)
  useEffect(() => {
    setText(object.data.text || '');
  }, [object.data.text]);

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
      // Use minWidth for preview-only mode (showText=false, showPreview=true)
      const previewMinWidth = 200;
      
      // Measure the entire container (includes both text and preview clone)
      const measuredWidth = measureRef.current.scrollWidth;
      const measuredHeight = measureRef.current.scrollHeight;
      
      // Determine min width based on what's visible
      const effectiveMinWidth = (object.data.hyperlink?.showText === false && object.data.hyperlink?.showPreview) 
        ? previewMinWidth 
        : minWidth;
      
      let width = Math.max(effectiveMinWidth, Math.min(maxAutoWidth, measuredWidth + 20));
      let height = Math.max(50, measuredHeight + 10);
      
      setTextSize(prevSize => {
        // Only update if dimensions actually changed
        if (prevSize.width !== width || prevSize.height !== height) {
          cleanupManager.setTimeout(() => {
            onResizeRef.current?.(width, height);
          }, 0);
          return { width, height };
        }
        return prevSize;
      });
    } else if (measureRef.current && isManuallyResized) {
      // For manually resized text, only adjust height to fit content within the set width
      const measuredHeight = measureRef.current.scrollHeight;
      const height = Math.max(50, measuredHeight + 10);
      
      setTextSize(prevSize => {
        if (prevSize.height !== height) {
          cleanupManager.setTimeout(() => {
            onResizeRef.current?.(prevSize.width, height);
          }, 0);
          return { ...prevSize, height };
        }
        return prevSize;
      });
    }
  }, [text, object.data.fontSize, object.data.fontFamily, isManuallyResized, object.data.hyperlink?.showPreview, object.data.hyperlink?.showText, object.data.hyperlink?.metadata]);

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
    // Only start drag if not clicking on resize handle and not editing, and only on left-click
    if (!e.defaultPrevented && !isEditing && e.button === 0) {
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
    fontStyle: object.data.fontStyle || 'normal',
    textAlign: object.data.textAlign as 'left' | 'center' | 'right' | 'justify' || 'left',
    lineHeight: object.data.lineHeight || 1.5,
    letterSpacing: `${object.data.letterSpacing || 0}px`,
    color: object.data.textColor || '#000000',
    textDecoration: object.data.textDecoration || 'none',
    textTransform: object.data.textTransform as 'none' | 'uppercase' | 'lowercase' | 'capitalize' || 'none',
    backgroundColor: object.data.backgroundColor || 'transparent',
  };

  const containerStyles = {
    // Border styling
    borderColor: object.data.borderColor || 'transparent',
    borderWidth: `${object.data.borderWidth || 0}px`,
    borderStyle: object.data.borderStyle || 'solid',
    borderRadius: `${object.data.borderRadius || 0}px`,
    // Effects
    opacity: object.data.opacity || 1,
    // Shadow
    boxShadow: object.data.shadow?.enabled 
      ? `${object.data.shadow.offsetX || 0}px ${object.data.shadow.offsetY || 0}px ${object.data.shadow.blur || 0}px ${object.data.shadow.color || '#00000020'}`
      : 'none',
    // Padding
    padding: object.data.padding 
      ? `${object.data.padding.top || 8}px ${object.data.padding.right || 8}px ${object.data.padding.bottom || 8}px ${object.data.padding.left || 8}px`
      : '8px',
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
        zIndex: object.zIndex || 0,
        ...containerStyles,
        ...style
      }}
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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid={`text-object-${object.id}`}
    >
      {/* Invisible container for measuring total height (text + preview) */}
      <div
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          top: 0,
          left: 0,
          width: isManuallyResized ? `${textSize.width}px` : 'auto',
          minWidth: object.data.hyperlink?.showPreview ? '200px' : undefined,
          height: 'auto',
        }}
        aria-hidden="true"
      >
        {/* Hidden text for measuring */}
        {(object.data.hyperlink?.showText !== false) && (
          <div
            style={{
              ...textStyles,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              padding: '8px',
            }}
          >
            {text || object.data.text || 'Type here...'}
          </div>
        )}
        {/* Hidden preview clone for measuring */}
        {object.data.hyperlink?.showPreview && object.data.hyperlink?.metadata && (
          <div
            style={{
              marginTop: object.data.hyperlink?.showText !== false ? '8px' : '0',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '10px',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
              {object.data.hyperlink.metadata.title || 'No title'}
            </div>
            {object.data.hyperlink.metadata.description && (
              <div style={{ 
                fontSize: '11px', 
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                marginBottom: '6px',
              }}>
                {object.data.hyperlink.metadata.description}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '16px' }}>
              {/* Favicon and hostname */}
            </div>
          </div>
        )}
      </div>

      {/* Hyperlink container with hover menu */}
      {object.data.hyperlink?.url ? (
        <div
          className="relative"
          onMouseEnter={handleHyperlinkMenuEnter}
          onMouseLeave={handleHyperlinkMenuLeave}
        >
          {/* Hover menu - Edit/Delete only (click on link itself opens it) */}
          {showHyperlinkMenu && !isEditing && (
            <div
              className="absolute left-0 bottom-full mb-1 z-50 animate-in fade-in-0 zoom-in-95 duration-150"
              onMouseEnter={handleHyperlinkMenuEnter}
              onMouseLeave={handleHyperlinkMenuLeave}
            >
              <div 
                style={{
                  display: 'flex',
                  gap: '2px',
                  padding: '4px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  border: '1px solid #e5e7eb',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHyperlinkEdit?.();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#3b82f6';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                  data-testid="text-hyperlink-edit-button"
                  title="Edit link"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHyperlinkDelete?.();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#6b7280',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                  data-testid="text-hyperlink-delete-button"
                  title="Delete link"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
          
          {/* Text content - conditionally visible based on hyperlink.showText */}
          {(object.data.hyperlink?.showText !== false) && (
            <>
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  placeholder="Type here..."
                  className="w-full p-2 border-none outline-none resize-none bg-transparent"
                  style={textStyles}
                  data-testid="text-object-textarea"
                />
              ) : (
                <div
                  className="w-full p-2 whitespace-pre-wrap break-words block hover:underline cursor-pointer"
                  style={{...textStyles, color: textStyles.color || '#3b82f6', textDecoration: 'underline'}}
                  onMouseDown={(e) => {
                    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Check if mouse moved significantly from mousedown position (drag detection)
                    if (dragStartPosRef.current) {
                      const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
                      const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
                      if (dx > 5 || dy > 5) {
                        dragStartPosRef.current = null;
                        return; // Was a drag, don't open link
                      }
                    }
                    dragStartPosRef.current = null;
                    const url = object.data.hyperlink?.url;
                    if (url) {
                      window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  data-testid="text-object-link"
                >
                  {text || object.data.text || 'Type here...'}
                </div>
              )}
            </>
          )}
          
          {/* Hyperlink Preview Card - draggable to move text object */}
          {object.data.hyperlink?.showPreview && object.data.hyperlink?.metadata && (
            <div
              className="hyperlink-preview-card"
              style={{
                marginTop: object.data.hyperlink?.showText !== false ? '8px' : '0',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'grab',
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                dragStartPosRef.current = { x: e.clientX, y: e.clientY };
                // Allow dragging the text object via the preview card
                if (e.button === 0 && !isEditing) {
                  onStartDrag?.(e);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Check if mouse moved significantly from mousedown position (drag detection)
                if (dragStartPosRef.current) {
                  const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
                  const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
                  if (dx > 5 || dy > 5) {
                    dragStartPosRef.current = null;
                    return; // Was a drag, don't open link
                  }
                }
                dragStartPosRef.current = null;
                const url = object.data.hyperlink?.url;
                if (url) {
                  window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer');
                }
              }}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              data-testid={`text-object-preview-${object.id}`}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#1f2937', marginBottom: '4px' }}>
                {object.data.hyperlink.metadata.title || 'No title'}
              </div>
              {object.data.hyperlink.metadata.description && (
                <div style={{ 
                  fontSize: '11px', 
                  color: '#6b7280',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: '6px',
                }}>
                  {object.data.hyperlink.metadata.description}
                </div>
              )}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
              }}>
                {object.data.hyperlink.metadata.favicon && (
                  <img 
                    src={object.data.hyperlink.metadata.favicon} 
                    alt="" 
                    style={{ width: '14px', height: '14px', borderRadius: '2px' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {(() => {
                    try {
                      const url = object.data.hyperlink?.url;
                      return url ? new URL(url.startsWith('http') ? url : `https://${url}`).hostname : '';
                    } catch {
                      return object.data.hyperlink?.url || '';
                    }
                  })()}
                </span>
                <ExternalLink size={12} style={{ color: '#9ca3af', marginLeft: 'auto' }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Non-hyperlink text content */
        <>
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
        </>
      )}

      {/* Resize handles - only visible when exactly one canvas object is selected */}
      {object.selected && selectedCanvasObjectCount === 1 && (
        <>
          <ResizeHandle
            position="top-left"
            nodeRef={objectRef}
            onResize={(width, height, resizeInfo) => {
              setTextSize({ width, height });
              setIsManuallyResized(true);
              onResize?.(width, height);
            }}
            minWidth={150}
            minHeight={50}
            maxWidth={5000}
            maxHeight={3000}
            viewport={viewport}
          />
          <ResizeHandle
            position="top-right"
            nodeRef={objectRef}
            onResize={(width, height, resizeInfo) => {
              setTextSize({ width, height });
              setIsManuallyResized(true);
              onResize?.(width, height);
            }}
            minWidth={150}
            minHeight={50}
            maxWidth={5000}
            maxHeight={3000}
            viewport={viewport}
          />
          <ResizeHandle
            position="bottom-left"
            nodeRef={objectRef}
            onResize={(width, height, resizeInfo) => {
              setTextSize({ width, height });
              setIsManuallyResized(true);
              onResize?.(width, height);
            }}
            minWidth={150}
            minHeight={50}
            maxWidth={5000}
            maxHeight={3000}
            viewport={viewport}
          />
          <ResizeHandle
            position="bottom-right"
            nodeRef={objectRef}
            onResize={(width, height, resizeInfo) => {
              setTextSize({ width, height });
              setIsManuallyResized(true);
              onResize?.(width, height);
            }}
            minWidth={150}
            minHeight={50}
            maxWidth={5000}
            maxHeight={3000}
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