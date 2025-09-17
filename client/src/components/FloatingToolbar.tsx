import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Undo2, Redo2, ZoomIn, LayoutGrid, GripVertical, Camera, History, Maximize2,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, 
  AlignVerticalJustifyEnd, ArrowLeftRight, ArrowUpDown, ArrowRight, ArrowDown, 
  Grid3X3, Workflow 
} from 'lucide-react';

interface FloatingToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onAutoLayout: (layoutType: string) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function FloatingToolbar({
  onUndo,
  onRedo,
  onFitView,
  onAutoLayout,
  canUndo,
  canRedo,
}: FloatingToolbarProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [selectedLayoutMode, setSelectedLayoutMode] = useState<'workflows' | 'nodes' | null>(null);
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

  // Consolidated layout options with icons
  const layoutSections = [
    {
      title: 'Horizontal',
      options: [
        { id: 'align-left', label: 'Align Left', icon: AlignLeft, type: 'align' },
        { id: 'align-center', label: 'Align Center', icon: AlignCenter, type: 'align' },
        { id: 'align-right', label: 'Align Right', icon: AlignRight, type: 'align' },
      ]
    },
    {
      title: 'Vertical',
      options: [
        { id: 'align-top', label: 'Align Top', icon: AlignVerticalJustifyStart, type: 'align' },
        { id: 'align-middle', label: 'Align Middle', icon: AlignVerticalJustifyCenter, type: 'align' },
        { id: 'align-bottom', label: 'Align Bottom', icon: AlignVerticalJustifyEnd, type: 'align' },
      ]
    },
    {
      title: 'Distribute',
      options: [
        { id: 'distribute-horizontal', label: 'Distribute Horizontally', icon: ArrowLeftRight, type: 'distribute' },
        { id: 'distribute-vertical', label: 'Distribute Vertically', icon: ArrowUpDown, type: 'distribute' },
      ]
    },
    {
      title: 'Layout',
      options: [
        { id: 'layout-horizontal', label: 'Horizontal Flow', icon: ArrowRight, type: 'layout' },
        { id: 'layout-vertical', label: 'Vertical Flow', icon: ArrowDown, type: 'layout' },
        { id: 'layout-grid', label: 'Grid Layout', icon: Grid3X3, type: 'layout' },
        { id: 'layout-hierarchical', label: 'Hierarchical', icon: Workflow, type: 'layout' },
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
              {selectedLayoutMode === null ? (
                // Show layout mode selection (workflows vs nodes)
                <>
                  <div className="text-sm font-medium text-foreground mb-3">Choose Layout Mode</div>
                  {layoutModes.map((mode) => (
                    <button
                      key={mode.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors rounded-md mb-2"
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
                // Show icon grid for selected mode
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium text-foreground">
                      {selectedLayoutMode === 'workflows' ? 'Layout Workflows' : 'Layout Nodes'}
                    </div>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent"
                      onClick={() => setSelectedLayoutMode(null)}
                    >
                      ← Back
                    </button>
                  </div>
                  
                  {/* Icon Grid Sections */}
                  <div className="space-y-4">
                    {layoutSections.map((section) => (
                      <div key={section.title}>
                        <div className="text-xs font-medium text-muted-foreground mb-2">{section.title}</div>
                        <div className="grid grid-cols-3 gap-2">
                          {section.options.map((option) => {
                            const IconComponent = option.icon;
                            return (
                              <button
                                key={option.id}
                                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg transition-colors group"
                                onClick={() => {
                                  // Map option to correct event format
                                  let eventId = '';
                                  const modePrefix = selectedLayoutMode === 'workflows' ? 'workflows' : 'nodes';
                                  
                                  if (option.type === 'align') {
                                    const alignType = option.id.replace('align-', '');
                                    eventId = `align:${modePrefix}-${alignType}`;
                                  } else if (option.type === 'distribute') {
                                    const distributeType = option.id.replace('distribute-', '');
                                    eventId = `distribute:${modePrefix}-${distributeType}`;
                                  } else if (option.type === 'layout') {
                                    const layoutType = option.id.replace('layout-', '');
                                    eventId = `layout:${modePrefix}-${layoutType}`;
                                  }
                                  
                                  onAutoLayout(eventId);
                                  setShowLayoutDropdown(false);
                                  setSelectedLayoutMode(null);
                                }}
                                title={option.label}
                              >
                                <IconComponent size={20} className="text-muted-foreground group-hover:text-foreground" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>


      </div>

      {/* Click outside to close dropdown */}
      {showLayoutDropdown && (
        <div 
          className="absolute inset-0 z-30" 
          onClick={() => {
            setShowLayoutDropdown(false);
            setSelectedLayoutMode(null);
          }}
        />
      )}
    </div>
  );
}