import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Undo2, Redo2, ZoomIn, GripVertical, Camera, History, Maximize2, EyeOff
} from 'lucide-react';

interface FloatingToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hiddenWorkflowCount?: number;
  onUnhideAll?: () => void;
}

export function FloatingToolbar({
  onUndo,
  onRedo,
  onFitView,
  canUndo,
  canRedo,
  hiddenWorkflowCount = 0,
  onUnhideAll,
}: FloatingToolbarProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hasBeenDragged, setHasBeenDragged] = useState(false);

  // Initialize position at bottom center
  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current && toolbarRef.current && !hasBeenDragged) {
        const container = containerRef.current.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const toolbarRect = toolbarRef.current.getBoundingClientRect();
          const toolbarWidth = toolbarRect.width || 400;
          setPosition({
            x: (containerRect.width - toolbarWidth) / 2,
            y: containerRect.height - 80, // 80px from bottom
          });
        }
      }
    };

    // Delay initial position to let toolbar render
    const timer = setTimeout(updatePosition, 50);
    window.addEventListener('resize', updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [hasBeenDragged]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!toolbarRef.current) return;
    
    const rect = toolbarRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    setHasBeenDragged(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const container = containerRef.current.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffset.x;
    const newY = e.clientY - containerRect.top - dragOffset.y;
    
    // Get actual toolbar dimensions
    const toolbarRect = toolbarRef.current?.getBoundingClientRect();
    const toolbarWidth = toolbarRect?.width || 400; // Fallback to 400 if measurement fails
    const toolbarHeight = toolbarRect?.height || 60; // Fallback to 60 if measurement fails
    
    // Keep toolbar within bounds
    const maxX = containerRect.width - toolbarWidth;
    const maxY = containerRect.height - toolbarHeight;
    
    setPosition({
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY)),
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    // Reset to default position (bottom center)
    setHasBeenDragged(false);
    if (containerRef.current && toolbarRef.current) {
      const container = containerRef.current.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const toolbarRect = toolbarRef.current.getBoundingClientRect();
        const toolbarWidth = toolbarRect.width || 400;
        setPosition({
          x: (containerRect.width - toolbarWidth) / 2,
          y: containerRect.height - 80,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-40"
    >
      <div
        ref={toolbarRef}
        className="absolute pointer-events-auto bg-card border border-border rounded-full shadow-lg px-2 py-2 flex items-center gap-1 select-none"
        style={{
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {/* Drag Handle */}
        <button
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to move toolbar (double-click to reset position)"
        >
          <GripVertical size={14} />
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo */}
        <button
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            canUndo 
              ? 'text-foreground hover:bg-accent' 
              : 'text-muted-foreground cursor-not-allowed'
          }`}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
        >
          <Undo2 size={16} />
        </button>

        {/* Redo */}
        <button
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            canRedo 
              ? 'text-foreground hover:bg-accent' 
              : 'text-muted-foreground cursor-not-allowed'
          }`}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
        >
          <Redo2 size={16} />
        </button>

        {/* Fit to View */}
        <button
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
          onClick={onFitView}
          title="Fit to View"
        >
          <Maximize2 size={16} />
        </button>

        {/* Hidden Workflows Button - only show when there are hidden workflows */}
        {hiddenWorkflowCount > 0 && onUnhideAll && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <button
              className="h-8 flex items-center gap-1.5 px-2 text-foreground hover:bg-accent rounded-full transition-colors"
              onClick={onUnhideAll}
              title="Unhide all workflows"
              data-testid="button-unhide-workflows"
            >
              <EyeOff size={16} />
              <span className="text-sm font-medium">{hiddenWorkflowCount}</span>
            </button>
          </>
        )}


      </div>
    </div>
  );
}