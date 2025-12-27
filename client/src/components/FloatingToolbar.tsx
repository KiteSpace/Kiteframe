import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Undo2, Redo2, ZoomIn, LayoutGrid, GripVertical, Camera, History, Maximize2,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, 
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignVerticalSpaceBetween, AlignHorizontalSpaceBetween, EyeOff
} from 'lucide-react';

interface FloatingToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onAutoLayout: (layoutType: string | { eventId: string; spacing: number }) => void;
  canUndo: boolean;
  canRedo: boolean;
  hiddenWorkflowCount?: number;
  onUnhideAll?: () => void;
}

export function FloatingToolbar({
  onUndo,
  onRedo,
  onFitView,
  onAutoLayout,
  canUndo,
  canRedo,
  hiddenWorkflowCount = 0,
  onUnhideAll,
}: FloatingToolbarProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [spacing, setSpacing] = useState(10);
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

  // Unified layout options matching screenshot design
  const workflowsOptions = [
    {
      title: 'Horizontal Align',
      options: [
        { id: 'align-left', label: 'Left', icon: AlignStartVertical, eventId: 'align:workflows-left' },
        { id: 'align-center', label: 'Center', icon: AlignCenterVertical, eventId: 'align:workflows-center' },
        { id: 'align-right', label: 'Right', icon: AlignEndVertical, eventId: 'align:workflows-right' },
      ]
    },
    {
      title: 'Vertical Align',
      options: [
        { id: 'align-top', label: 'Top', icon: AlignStartHorizontal, eventId: 'align:workflows-top' },
        { id: 'align-middle', label: 'Middle', icon: AlignCenterHorizontal, eventId: 'align:workflows-middle' },
        { id: 'align-bottom', label: 'Bottom', icon: AlignEndHorizontal, eventId: 'align:workflows-bottom' },
      ]
    },
    {
      title: 'Distribute',
      hasInput: true,
      options: [
        { id: 'distribute-vertical', label: 'Vertical Space Between', icon: AlignVerticalSpaceBetween, eventId: 'distribute:workflows-vertical' },
        { id: 'distribute-horizontal', label: 'Horizontal Space Between', icon: AlignHorizontalSpaceBetween, eventId: 'distribute:workflows-horizontal' },
      ]
    }
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
            <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-lg p-4 w-80 z-50">
              {/* Workflows Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Workflows</h3>
                <div className="space-y-4">
                  {workflowsOptions.map((section) => (
                    <div key={section.title}>
                      <div className="text-sm font-medium text-muted-foreground mb-2">{section.title}</div>
                      {section.hasInput ? (
                        // Special layout for Distribute section with input field
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={spacing}
                              onChange={(e) => {
                                const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                setSpacing(value);
                              }}
                              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                              placeholder="10"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                              px
                            </span>
                          </div>
                          {section.options.map((option) => {
                            const IconComponent = option.icon;
                            return (
                              <button
                                key={option.id}
                                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg transition-colors group bg-muted/50 w-12 h-12"
                                onClick={() => {
                                  // Pass spacing as payload data instead of in event name
                                  const eventData = { eventId: option.eventId, spacing };
                                  onAutoLayout(eventData);
                                  setShowLayoutDropdown(false);
                                }}
                                title={option.label}
                              >
                                <IconComponent size={20} className="text-muted-foreground group-hover:text-foreground" />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        // Regular grid layout for align sections
                        <div className="grid grid-cols-3 gap-2">
                          {section.options.map((option) => {
                            const IconComponent = option.icon;
                            return (
                              <button
                                key={option.id}
                                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg transition-colors group bg-muted/50"
                                onClick={() => {
                                  onAutoLayout(option.eventId);
                                  setShowLayoutDropdown(false);
                                }}
                                title={option.label}
                              >
                                <IconComponent size={20} className="text-muted-foreground group-hover:text-foreground" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

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

      {/* Click outside to close dropdown */}
      {showLayoutDropdown && (
        <div 
          className="absolute inset-0 z-30" 
          onClick={() => {
            setShowLayoutDropdown(false);
          }}
        />
      )}
    </div>
  );
}