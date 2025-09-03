import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Undo, Redo, ZoomIn, LayoutGrid, GripVertical, Camera, History, Maximize2 } from 'lucide-react';

interface FloatingToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onAutoLayout: (layoutType: string) => void;
  onSnapshot: () => void;
  onVersionHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function FloatingToolbar({
  onUndo,
  onRedo,
  onFitView,
  onAutoLayout,
  onSnapshot,
  onVersionHistory,
  canUndo,
  canRedo,
}: FloatingToolbarProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize position at bottom center
  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current) {
        const container = containerRef.current.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          setPosition({
            x: containerRect.width / 2 - 200, // Approximate half toolbar width
            y: containerRect.height - 80, // 80px from bottom
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
    
    // Keep toolbar within bounds
    const maxX = containerRect.width - 400; // Approximate toolbar width
    const maxY = containerRect.height - 60; // Toolbar height
    
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
    if (containerRef.current) {
      const container = containerRef.current.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        setPosition({
          x: containerRect.width / 2 - 200,
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

  const layoutOptions = [
    { id: 'horizontal', label: 'Horizontal Flow' },
    { id: 'vertical', label: 'Vertical Flow' },
    { id: 'grid', label: 'Grid' },
    { id: 'circular', label: 'Circular' },
    { id: 'hierarchical', label: 'Hierarchical' },
  ];

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
          <Redo size={16} />
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
          <Undo size={16} />
        </button>

        {/* Fit to View */}
        <button
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
          onClick={onFitView}
          title="Fit to View"
        >
          <Maximize2 size={16} />
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Auto Layout */}
        <div className="relative">
          <button
            className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
            onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
            title="Auto Layout"
          >
            <LayoutGrid size={16} />
          </button>
          
          {showLayoutDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-40 z-50">
              {layoutOptions.map((option) => (
                <button
                  key={option.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onClick={() => {
                    onAutoLayout(option.id);
                    setShowLayoutDropdown(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Snapshot */}
        <button
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
          onClick={onSnapshot}
          title="Create Snapshot (Pro)"
        >
          <Camera size={16} />
        </button>

        {/* Version History */}
        <button
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
          onClick={onVersionHistory}
          title="Version History (Pro)"
        >
          <History size={16} />
        </button>
      </div>

      {/* Click outside to close dropdown */}
      {showLayoutDropdown && (
        <div 
          className="absolute inset-0 z-30" 
          onClick={() => setShowLayoutDropdown(false)}
        />
      )}
    </div>
  );
}