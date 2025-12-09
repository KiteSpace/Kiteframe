import { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical, Maximize2, RotateCcw, Home } from 'lucide-react';

interface ViewOnlyToolbarProps {
  onFitView: () => void;
  onReset: () => void;
  onGoHome: () => void;
}

export function ViewOnlyToolbar({
  onFitView,
  onReset,
  onGoHome,
}: ViewOnlyToolbarProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current) {
        const container = containerRef.current.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          setPosition({
            x: containerRect.width / 2 - 100,
            y: containerRect.height - 70,
          });
        }
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!toolbarRef.current) return;
    
    const rect = toolbarRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const container = containerRef.current.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffset.x;
    const newY = e.clientY - containerRect.top - dragOffset.y;
    
    const toolbarRect = toolbarRef.current?.getBoundingClientRect();
    const toolbarWidth = toolbarRect?.width || 200;
    const toolbarHeight = toolbarRect?.height || 50;
    
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
    if (containerRef.current) {
      const container = containerRef.current.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        setPosition({
          x: containerRect.width / 2 - 100,
          y: containerRect.height - 70,
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
        <button
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to move toolbar (double-click to reset position)"
          data-testid="toolbar-drag-handle"
        >
          <GripVertical size={14} />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
          onClick={onGoHome}
          title="Go to Home"
          data-testid="toolbar-home"
        >
          <Home size={16} />
        </button>

        <button
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
          onClick={onFitView}
          title="Fit to View"
          data-testid="toolbar-fit-view"
        >
          <Maximize2 size={16} />
        </button>

        <button
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
          onClick={onReset}
          title="Reset View"
          data-testid="toolbar-reset"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}

export default ViewOnlyToolbar;
