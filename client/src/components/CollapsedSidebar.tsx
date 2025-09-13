import { useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CollapsedSidebarProps {
  toggleSidebar: () => void;
  onCreateNode: (type: string) => void;
  onFitView: () => void;
  onClearCanvas: () => void;
  onExport: () => void;
  onImport: () => void;
  onOpenAiGenerator?: () => void;
  activePopout: 'node-types' | 'shapes' | null;
  setActivePopout: (popout: 'node-types' | 'shapes' | null) => void;
  sidebarIcons: Record<string, LucideIcon>;
}

export function CollapsedSidebar({
  toggleSidebar,
  onCreateNode,
  onFitView,
  onClearCanvas,
  onExport,
  onImport,
  onOpenAiGenerator,
  activePopout,
  setActivePopout,
  sidebarIcons
}: CollapsedSidebarProps) {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    iconType: string | null;
    startPos: { x: number; y: number } | null;
    currentPos: { x: number; y: number } | null;
  }>({ isDragging: false, iconType: null, startPos: null, currentPos: null });
  
  const handleIconClick = (iconKey: string) => {
    switch (iconKey) {
      case 'brain':
        onOpenAiGenerator?.();
        break;
      case 'workflow':
        setActivePopout(activePopout === 'node-types' ? null : 'node-types');
        break;
      case 'type':
        onCreateNode('text');
        break;
      case 'sticky-note':
        onCreateNode('sticky');
        break;
      case 'shapes':
        setActivePopout(activePopout === 'shapes' ? null : 'shapes');
        break;
      case 'fit-view':
        onFitView();
        break;
      case 'clear':
        onClearCanvas();
        break;
      case 'export':
        onExport();
        break;
      case 'import':
        onImport();
        break;
    }
  };

  // Drag and drop handlers for draggable icons
  const handleIconMouseDown = (
    e: React.MouseEvent,
    iconKey: string,
  ) => {
    // Only handle draggable icons
    if (!['type', 'sticky-note'].includes(iconKey)) return;
    
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    console.log('🎯 COLLAPSED SIDEBAR DRAG START:', { iconKey, startPos: { x: e.clientX, y: e.clientY } });
    
    e.preventDefault();
    e.stopPropagation();
    
    const startPos = { x: e.clientX, y: e.clientY };
    setDragState({
      isDragging: true,
      iconType: iconKey,
      startPos,
      currentPos: startPos,
    });

    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => ({
        ...prev,
        currentPos: { x: e.clientX, y: e.clientY }
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      console.log('🎯 COLLAPSED SIDEBAR DRAG END:', { iconKey, endPos: { x: e.clientX, y: e.clientY } });
      
      // Find the canvas element
      const canvasElement = document.querySelector('.kiteframe-canvas');
      
      if (canvasElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        const y = e.clientY - canvasRect.top;
        
        // Only create object if dropped on canvas
        if (x >= 0 && x <= canvasRect.width && y >= 0 && y <= canvasRect.height) {
          console.log('🎯 CALLING onCreateNode from collapsed sidebar:', { iconKey, position: { x, y } });
          // Convert icon key to node type
          const nodeType = iconKey === 'type' ? 'text' : iconKey === 'sticky-note' ? 'sticky' : iconKey;
          onCreateNode(nodeType);
        } else {
          console.log('🎯 DROP OUTSIDE CANVAS - NO OBJECT CREATED');
        }
      }
      
      // Reset drag state
      setDragState({
        isDragging: false,
        iconType: null,
        startPos: null,
        currentPos: null,
      });
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getTooltipText = (iconKey: string): string => {
    switch (iconKey) {
      case 'brain': return 'AI Assistant';
      case 'workflow': return 'Node Types';
      case 'type': return 'Text';
      case 'sticky-note': return 'Sticky Note';
      case 'shapes': return 'Shapes';
      case 'fit-view': return 'Fit View';
      case 'clear': return 'Clear Canvas';
      case 'export': return 'Export';
      case 'import': return 'Import';
      default: return iconKey;
    }
  };

  const isPopoutIcon = (iconKey: string): boolean => {
    return iconKey === 'workflow' || iconKey === 'shapes';
  };

  const isActive = (iconKey: string): boolean => {
    if (iconKey === 'workflow') return activePopout === 'node-types';
    if (iconKey === 'shapes') return activePopout === 'shapes';
    return false;
  };

  // Split icons into main and action groups
  const mainIcons = ['brain', 'workflow', 'type', 'shapes', 'sticky-note'];
  const actionIcons = ['fit-view', 'clear', 'export', 'import'];

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-card border-r border-border p-2" data-testid="collapsed-sidebar">
        {/* Toggle Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md hover:bg-accent transition-colors mb-4"
              data-testid="toggle-sidebar"
              title="Expand Sidebar"
            >
              {(() => {
                const ChevronIcon = sidebarIcons['chevron-right'];
                return ChevronIcon ? <ChevronIcon className="w-4 h-4" /> : null;
              })()}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Expand Sidebar</p>
          </TooltipContent>
        </Tooltip>

        {/* Main Icons */}
        <div className="space-y-2 mb-4">
          {mainIcons.map((iconKey) => {
            const IconComponent = sidebarIcons[iconKey];
            if (!IconComponent) return null;

            return (
              <Tooltip key={iconKey}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleIconClick(iconKey)}
                    onMouseDown={(e) => handleIconMouseDown(e, iconKey)}
                    className={`
                      w-8 h-8 rounded-md flex items-center justify-center transition-colors
                      ${isActive(iconKey) 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent'
                      }
                    `}
                    data-testid={`icon-${iconKey}`}
                    title={getTooltipText(iconKey)}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{getTooltipText(iconKey)}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-b border-border mb-4"></div>

        {/* Action Icons */}
        <div className="space-y-2 flex-1">
          {actionIcons.map((iconKey) => {
            const IconComponent = sidebarIcons[iconKey];
            if (!IconComponent) return null;

            return (
              <Tooltip key={iconKey}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleIconClick(iconKey)}
                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors"
                    data-testid={`action-${iconKey}`}
                    title={getTooltipText(iconKey)}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{getTooltipText(iconKey)}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Drag Visual Indicator - matches expanded sidebar style */}
      {dragState.isDragging && dragState.currentPos && dragState.iconType && (
        <div
          className="fixed pointer-events-none z-50 bg-white/90 dark:bg-gray-800/90 border border-border rounded-md p-2 shadow-lg backdrop-blur-sm"
          style={{
            left: dragState.currentPos.x + 10,
            top: dragState.currentPos.y - 20,
            transform: 'translate(0, 0)',
          }}
        >
          <div className="flex items-center gap-2 text-sm">
            {(() => {
              const IconComponent = sidebarIcons[dragState.iconType];
              if (IconComponent) {
                return (
                  <>
                    <IconComponent className="w-4 h-4" />
                    <span className="font-medium">{getTooltipText(dragState.iconType)}</span>
                  </>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}