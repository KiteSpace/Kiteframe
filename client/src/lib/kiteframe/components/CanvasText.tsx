import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ExternalLink, Edit, X } from 'lucide-react';
import { toNumericWeight } from '@/lib/fontUtils';

export interface CanvasTextData {
  id: string;
  text: string;
  position: { x: number; y: number };
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  color?: string;
  backgroundColor?: string;
  width?: number;
  height?: number;
  selected?: boolean;
  isEditing?: boolean;
  url?: string;
}

interface CanvasTextProps {
  data: CanvasTextData;
  onUpdate: (id: string, updates: Partial<CanvasTextData>) => void;
  onDelete: (id: string) => void;
  viewport: { x: number; y: number; zoom: number };
  onStartDrag?: (id: string, startPos: { x: number; y: number }) => void;
  onDrag?: (id: string, newPos: { x: number; y: number }) => void;
  onEndDrag?: (id: string) => void;
  onClick?: (id: string) => void;
}


export function CanvasText({
  data,
  onUpdate,
  onDelete,
  viewport,
  onStartDrag,
  onDrag,
  onEndDrag,
  onClick
}: CanvasTextProps) {
  const [isEditing, setIsEditing] = useState(data.isEditing || false);
  const [editText, setEditText] = useState(data.text);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlPopover, setShowUrlPopover] = useState(false);

  // Track edit mode from props and sync local state
  useEffect(() => {
    if (data.isEditing !== undefined) {
      setIsEditing(data.isEditing);
    }
  }, [data.isEditing]);

  // Auto-focus on creation if text is empty or in edit mode
  useEffect(() => {
    if ((data.text === '' && !isEditing) || data.isEditing) {
      setIsEditing(true);
    }
  }, [data.isEditing]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textRef.current) {
      setTimeout(() => {
        textRef.current?.focus();
        if (data.text === '') {
          textRef.current?.setSelectionRange(0, 0);
        } else {
          textRef.current?.select();
        }
      }, 50);
    }
  }, [isEditing, data.text]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Prevent click during drag
    if (isDragging) {
      return;
    }
    
    // If text has a URL and we're not in editing mode, show popover
    if (data.url && !data.isEditing && !data.selected) {
      setShowUrlPopover(true);
      return;
    }
    
    // Two-click system for existing text
    if (!data.isEditing) {
      if (data.selected) {
        // Second click on selected text - enter edit mode
        setIsEditing(true);
        setEditText(data.text);
        onUpdate(data.id, { isEditing: true, selected: true });
      } else {
        // First click - select text
        onClick?.(data.id);
        onUpdate(data.id, { selected: true, isEditing: false });
      }
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    
    // Don't delete newly created text objects immediately
    const textAge = Date.now() - parseInt(data.id.split('-')[1] || '0');
    const isNewlyCreated = textAge < 500;
    
    // Don't delete text objects that have URLs even if text is empty
    if (editText.trim() === '' && !isNewlyCreated && !data.url) {
      onDelete(data.id);
    } else if (editText.trim() === '' && (isNewlyCreated || data.url)) {
      onUpdate(data.id, { isEditing: false, selected: true });
    } else if (editText !== data.text) {
      onUpdate(data.id, { text: editText, isEditing: false, selected: true });
    } else {
      onUpdate(data.id, { isEditing: false, selected: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      const textAge = Date.now() - parseInt(data.id.split('-')[1] || '0');
      const isNewlyCreated = textAge < 2000;
      
      if (data.text === '' && isNewlyCreated) {
        onDelete(data.id);
      } else {
        setEditText(data.text);
        setIsEditing(false);
        onUpdate(data.id, { isEditing: false, selected: true });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    
    setIsDragging(true);
    
    // Store the initial mouse position in world coordinates
    const initialMouseWorldX = (e.clientX - viewport.x) / viewport.zoom;
    const initialMouseWorldY = (e.clientY - viewport.y) / viewport.zoom;
    
    // Calculate offset in world space
    const offsetX = initialMouseWorldX - data.position.x;
    const offsetY = initialMouseWorldY - data.position.y;

    onStartDrag?.(data.id, data.position);

    const handleMouseMove = (e: MouseEvent) => {
      const currentMouseWorldX = (e.clientX - viewport.x) / viewport.zoom;
      const currentMouseWorldY = (e.clientY - viewport.y) / viewport.zoom;
      
      const newX = currentMouseWorldX - offsetX;
      const newY = currentMouseWorldY - offsetY;
      
      onDrag?.(data.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onEndDrag?.(data.id);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Calculate actual text dimensions
  const actualWidth = data.width || Math.max(100, (data.text.length * (data.fontSize || 16) * 0.6));
  const actualHeight = data.height || Math.max(24, Math.ceil(data.text.split('\n').length * (data.fontSize || 16) * 1.2));
  
  // Calculate text height based on content and font size
  const textHeight = Math.ceil(data.text.split('\n').length * (data.fontSize || 16) * 1.2);
  
  // Get flexbox justifyContent value based on vertical alignment
  const getFlexJustifyContent = () => {
    const verticalAlign = data.verticalAlign || 'top';
    
    switch (verticalAlign) {
      case 'top':
        return 'flex-start';
      case 'middle':
        return 'center';
      case 'bottom':
        return 'flex-end';
      default:
        return 'flex-start';
    }
  };
  
  const flexJustifyContent = getFlexJustifyContent();

  // Get adaptive text color - theme-aware by default
  const getDefaultTextColor = () => {
    const isDark = document.documentElement.classList.contains('dark');
    return isDark ? '#ffffff' : '#000000';
  };
  
  const finalTextColor = data.color || getDefaultTextColor();

  // Wrapper style - positioned at exact data.position.y with flexbox for internal alignment
  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: data.position.x * viewport.zoom + viewport.x,
    top: data.position.y * viewport.zoom + viewport.y,
    width: actualWidth * viewport.zoom,
    height: actualHeight * viewport.zoom,
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: isEditing ? 'text' : 'none',
    pointerEvents: 'auto',
    backgroundColor: data.backgroundColor || 'transparent',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: flexJustifyContent
  };
  
  // Text content style - for internal text styling
  const textStyle: React.CSSProperties = {
    fontSize: (data.fontSize || 16) * viewport.zoom,
    fontFamily: data.fontFamily || 'Inter, system-ui, sans-serif',
    fontWeight: toNumericWeight(data.fontWeight),
    textAlign: data.textAlign || 'left',
    color: finalTextColor,
    lineHeight: '1.2',
    margin: 0,
    padding: 0
  };

  if (isEditing) {
    return (
      <div style={wrapperStyle} className="pointer-events-auto z-10">
        <textarea
          ref={textRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "resize-none outline-none border-none rounded px-1 py-0",
            "bg-transparent min-h-[1.2em] leading-tight",
            "focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          )}
          style={{
            ...textStyle,
            width: '100%',
            minHeight: textHeight * viewport.zoom,
            maxHeight: actualHeight * viewport.zoom,
            overflow: 'hidden',
            backgroundColor: 'transparent'
          }}
          data-testid="canvas-text-textarea"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={wrapperStyle}
      className={cn(
        "pointer-events-auto select-none z-10",
        data.selected ? 'ring-2 ring-blue-500 ring-opacity-50' : '',
        "hover:bg-gray-50 hover:bg-opacity-20 rounded transition-all"
      )}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      data-testid="canvas-text-display"
    >
      <div style={textStyle}>
        {data.text || (
          <span className="text-gray-400 italic text-sm">
            Click to edit...
          </span>
        )}
      </div>

      {/* URL Popover */}
      {showUrlPopover && data.url && (
        <div 
          className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 z-20"
          style={{ minWidth: '200px' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Link Preview
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUrlPopover(false);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              data-testid="close-url-popover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 break-all">
            {data.url}
          </div>
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
            onClick={(e) => e.stopPropagation()}
            data-testid="open-url-link"
          >
            <ExternalLink className="w-3 h-3" />
            Open Link
          </a>
        </div>
      )}
    </div>
  );
}