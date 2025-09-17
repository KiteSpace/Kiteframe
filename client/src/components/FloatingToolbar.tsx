import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Undo2, Redo2, ZoomIn, LayoutGrid, GripVertical, Camera, History, Maximize2, AlignLeft, ArrowLeftRight } from 'lucide-react';

interface FloatingToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onAutoLayout: (layoutType: string) => void;
  onAlign?: (alignType: string) => void;
  onDistribute?: (distributeType: string) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function FloatingToolbar({
  onUndo,
  onRedo,
  onFitView,
  onAutoLayout,
  onAlign,
  onDistribute,
  canUndo,
  canRedo,
}: FloatingToolbarProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [selectedLayoutMode, setSelectedLayoutMode] = useState<'workflows' | 'nodes' | null>(null);
  const [showAlignDropdown, setShowAlignDropdown] = useState(false);
  const [selectedAlignMode, setSelectedAlignMode] = useState<'workflows' | 'nodes' | null>(null);
  const [showDistributeDropdown, setShowDistributeDropdown] = useState(false);
  const [selectedDistributeMode, setSelectedDistributeMode] = useState<'workflows' | 'nodes' | null>(null);
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

  const layoutModes = [
    { id: 'workflows' as const, label: 'Layout Workflows', description: 'Arrange entire workflows as units' },
    { id: 'nodes' as const, label: 'Layout Nodes', description: 'Arrange individual nodes' },
  ];

  const layoutOptions = [
    { id: 'horizontal', label: 'Horizontal Flow' },
    { id: 'vertical', label: 'Vertical Flow' },
    { id: 'grid', label: 'Grid' },
    { id: 'circular', label: 'Circular' },
    { id: 'hierarchical', label: 'Hierarchical' },
  ];

  const alignOptions = [
    { id: 'left', label: 'Align Left' },
    { id: 'center', label: 'Align Center' },
    { id: 'right', label: 'Align Right' },
    { id: 'top', label: 'Align Top' },
    { id: 'middle', label: 'Align Middle' },
    { id: 'bottom', label: 'Align Bottom' },
  ];

  const distributeOptions = [
    { id: 'horizontal', label: 'Distribute Horizontally' },
    { id: 'vertical', label: 'Distribute Vertically' },
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
            <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-48 z-50">
              {selectedLayoutMode === null ? (
                // Show layout mode selection (workflows vs nodes)
                <>
                  {layoutModes.map((mode) => (
                    <button
                      key={mode.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => {
                        setSelectedLayoutMode(mode.id);
                      }}
                    >
                      <div className="font-medium">{mode.label}</div>
                      <div className="text-xs text-muted-foreground">{mode.description}</div>
                    </button>
                  ))}
                </>
              ) : (
                // Show layout algorithm options for selected mode
                <>
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                    {selectedLayoutMode === 'workflows' ? 'Layout Workflows' : 'Layout Nodes'}
                    <button
                      className="float-right text-xs hover:text-foreground"
                      onClick={() => setSelectedLayoutMode(null)}
                    >
                      ← Back
                    </button>
                  </div>
                  {layoutOptions.map((option) => (
                    <button
                      key={option.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => {
                        const layoutId = selectedLayoutMode === 'workflows' 
                          ? `workflows-${option.id}` 
                          : `nodes-${option.id}`;
                        onAutoLayout(layoutId);
                        setShowLayoutDropdown(false);
                        setSelectedLayoutMode(null);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Align */}
        {onAlign && (
          <div className="relative">
            <button
              className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
              onClick={() => setShowAlignDropdown(!showAlignDropdown)}
              title="Align"
            >
              <AlignLeft size={16} />
            </button>
            
            {showAlignDropdown && (
              <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-48 z-50">
                {selectedAlignMode === null ? (
                  <>
                    {layoutModes.map((mode) => (
                      <button
                        key={mode.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setSelectedAlignMode(mode.id);
                        }}
                      >
                        <div className="font-medium">{mode.label.replace('Layout', 'Align')}</div>
                        <div className="text-xs text-muted-foreground">{mode.description.replace('Arrange', 'Align')}</div>
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                      {selectedAlignMode === 'workflows' ? 'Align Workflows' : 'Align Nodes'}
                      <button
                        className="float-right text-xs hover:text-foreground"
                        onClick={() => setSelectedAlignMode(null)}
                      >
                        ← Back
                      </button>
                    </div>
                    {alignOptions.map((option) => (
                      <button
                        key={option.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          const alignId = selectedAlignMode === 'workflows' 
                            ? `workflows-${option.id}` 
                            : `nodes-${option.id}`;
                          onAlign(alignId);
                          setShowAlignDropdown(false);
                          setSelectedAlignMode(null);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Distribute */}
        {onDistribute && (
          <div className="relative">
            <button
              className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-accent rounded-full transition-colors"
              onClick={() => setShowDistributeDropdown(!showDistributeDropdown)}
              title="Distribute"
            >
              <ArrowLeftRight size={16} />
            </button>
            
            {showDistributeDropdown && (
              <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-48 z-50">
                {selectedDistributeMode === null ? (
                  <>
                    {layoutModes.map((mode) => (
                      <button
                        key={mode.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          setSelectedDistributeMode(mode.id);
                        }}
                      >
                        <div className="font-medium">{mode.label.replace('Layout', 'Distribute')}</div>
                        <div className="text-xs text-muted-foreground">{mode.description.replace('Arrange', 'Distribute')}</div>
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                      {selectedDistributeMode === 'workflows' ? 'Distribute Workflows' : 'Distribute Nodes'}
                      <button
                        className="float-right text-xs hover:text-foreground"
                        onClick={() => setSelectedDistributeMode(null)}
                      >
                        ← Back
                      </button>
                    </div>
                    {distributeOptions.map((option) => (
                      <button
                        key={option.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => {
                          const distributeId = selectedDistributeMode === 'workflows' 
                            ? `workflows-${option.id}` 
                            : `nodes-${option.id}`;
                          onDistribute(distributeId);
                          setShowDistributeDropdown(false);
                          setSelectedDistributeMode(null);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Click outside to close dropdowns */}
      {(showLayoutDropdown || showAlignDropdown || showDistributeDropdown) && (
        <div 
          className="absolute inset-0 z-30" 
          onClick={() => {
            setShowLayoutDropdown(false);
            setSelectedLayoutMode(null);
            setShowAlignDropdown(false);
            setSelectedAlignMode(null);
            setShowDistributeDropdown(false);
            setSelectedDistributeMode(null);
          }}
        />
      )}
    </div>
  );
}