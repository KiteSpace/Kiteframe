import { useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { clientToWorld } from '@/lib/kiteframe/utils/geometry';
import { workflowThemes, type WorkflowTheme } from '@/lib/themes';

interface CollapsedSidebarProps {
  toggleSidebar: () => void;
  onCreateNode: (type: string) => void;
  onCreateNodeAtPosition?: (type: string, position: { x: number; y: number }) => void;
  onFitView: () => void;
  onClearCanvas: () => void;
  onExport: () => void;
  onImport: () => void;
  onOpenAiGenerator?: () => void;
  onCreateTemplate?: (templateType: string) => void;
  onCreateTemplateAtPosition?: (templateType: string, position: { x: number; y: number }) => void;
  onApplyTheme?: (theme: WorkflowTheme) => void;
  activePopout: 'node-types' | 'shapes' | 'templates' | 'themes' | null;
  setActivePopout: (popout: 'node-types' | 'shapes' | 'templates' | 'themes' | null) => void;
  sidebarIcons: Record<string, LucideIcon>;
  viewport: { x: number; y: number; zoom: number };
}

export function CollapsedSidebar({
  toggleSidebar,
  onCreateNode,
  onCreateNodeAtPosition,
  viewport,
  onFitView,
  onClearCanvas,
  onExport,
  onImport,
  onOpenAiGenerator,
  onCreateTemplate,
  onCreateTemplateAtPosition,
  onApplyTheme,
  activePopout,
  setActivePopout,
  sidebarIcons
}: CollapsedSidebarProps) {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    iconType: string | null;
    templateType?: string | null;
    startPos: { x: number; y: number } | null;
    currentPos: { x: number; y: number } | null;
  }>({ isDragging: false, iconType: null, templateType: null, startPos: null, currentPos: null });

  // Template types (from Sidebar.tsx)
  const templateTypes = [
    { type: 'user-journey', icon: sidebarIcons['route'], color: 'text-blue-500', label: 'User Journey' },
    { type: 'mindmap', icon: sidebarIcons['map-pin'], color: 'text-green-500', label: 'Mindmap' },
    { type: 'system-architecture', icon: sidebarIcons['network'], color: 'text-purple-500', label: 'System Architecture' },
    { type: 'swim-lanes', icon: sidebarIcons['layers'], color: 'text-orange-500', label: 'Swim Lanes' },
    { type: 'user-account-creation', icon: sidebarIcons['user-plus'], color: 'text-pink-500', label: 'User Account Creation' },
    { type: 'io-logic', icon: sidebarIcons['circuit-board'], color: 'text-cyan-500', label: 'I/O Logic' }
  ];
  
  const handleIconClick = (iconKey: string) => {
    console.log('🎯 HANDLE ICON CLICK CALLED:', { iconKey, currentActivePopout: activePopout });
    
    switch (iconKey) {
      case 'brain':
        onOpenAiGenerator?.();
        break;
      case 'workflow':
        const newNodeTypesState = activePopout === 'node-types' ? null : 'node-types';
        console.log('🎯 SETTING NODE TYPES POPOUT:', { from: activePopout, to: newNodeTypesState });
        setActivePopout(newNodeTypesState);
        break;
      case 'type':
        // Click creates text at center, drag-and-drop creates at mouse position
        onCreateNode('text');
        break;
      case 'sticky-note':
        // Click creates sticky note at center, drag-and-drop creates at mouse position
        onCreateNode('sticky');
        break;
      case 'shapes':
        const newShapesState = activePopout === 'shapes' ? null : 'shapes';
        console.log('🎯 SETTING SHAPES POPOUT:', { from: activePopout, to: newShapesState });
        setActivePopout(newShapesState);
        break;
      case 'route':
        const newTemplatesState = activePopout === 'templates' ? null : 'templates';
        console.log('🎯 SETTING TEMPLATES POPOUT:', { from: activePopout, to: newTemplatesState });
        setActivePopout(newTemplatesState);
        break;
      case 'palette':
        const newThemesState = activePopout === 'themes' ? null : 'themes';
        console.log('🎯 SETTING THEMES POPOUT:', { from: activePopout, to: newThemesState });
        setActivePopout(newThemesState);
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
      default:
        console.log('🚫 UNKNOWN ICON KEY:', iconKey);
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
    let hasMoved = false;
    
    setDragState({
      isDragging: false, // Don't set dragging until we actually move
      iconType: iconKey,
      startPos,
      currentPos: startPos,
    });

    const handleMouseMove = (e: MouseEvent) => {
      const distance = Math.sqrt(
        Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2)
      );
      
      // Only start dragging if moved more than 5 pixels
      if (distance > 5) {
        hasMoved = true;
        setDragState(prev => ({
          ...prev,
          isDragging: true,
          currentPos: { x: e.clientX, y: e.clientY }
        }));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      console.log('🎯 COLLAPSED SIDEBAR DRAG END:', { iconKey, endPos: { x: e.clientX, y: e.clientY }, hasMoved });
      
      if (hasMoved) {
        // This was a drag operation - try to place at mouse position
        const canvasElement = document.querySelector('[data-testid="workflow-canvas"]');
        
        if (canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const canvasX = e.clientX - canvasRect.left;
          const canvasY = e.clientY - canvasRect.top;
          
          // Only create object if dropped on canvas
          if (canvasX >= 0 && canvasX <= canvasRect.width && canvasY >= 0 && canvasY <= canvasRect.height) {
            // Convert screen coordinates to world coordinates using viewport transformation
            const worldPos = clientToWorld(e.clientX, e.clientY, viewport, canvasRect);
            console.log('🎯 CALLING onCreateNodeAtPosition from collapsed sidebar:', { iconKey, worldPosition: worldPos, screenPos: { x: e.clientX, y: e.clientY }, viewport, canvasRect });
            // Convert icon key to node type and call position-based creation
            const nodeType = iconKey === 'type' ? 'text' : iconKey === 'sticky-note' ? 'sticky' : iconKey;
            onCreateNodeAtPosition?.(nodeType, worldPos);
          } else {
            console.log('🎯 DROP OUTSIDE CANVAS - NO OBJECT CREATED');
          }
        }
      }
      // If not moved, the click handler will take care of center placement
      
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

  // Template drag and drop handlers
  const handleTemplateMouseDown = (
    e: React.MouseEvent,
    templateType: string,
  ) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    console.log('🎯 COLLAPSED SIDEBAR TEMPLATE DRAG START:', { templateType, startPos: { x: e.clientX, y: e.clientY } });
    
    e.preventDefault();
    e.stopPropagation();
    
    const startPos = { x: e.clientX, y: e.clientY };
    let hasMoved = false;
    
    setDragState({
      isDragging: false, // Don't set dragging until we actually move
      iconType: 'template',
      templateType,
      startPos,
      currentPos: startPos,
    });

    const handleMouseMove = (e: MouseEvent) => {
      const distance = Math.sqrt(
        Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2)
      );
      
      // Only start dragging if moved more than 5 pixels
      if (distance > 5) {
        hasMoved = true;
        setDragState(prev => ({
          ...prev,
          isDragging: true,
          currentPos: { x: e.clientX, y: e.clientY }
        }));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      console.log('🎯 COLLAPSED SIDEBAR TEMPLATE DRAG END:', { templateType, endPos: { x: e.clientX, y: e.clientY }, hasMoved });
      
      if (hasMoved) {
        // This was a drag operation - try to place at mouse position
        const canvasElement = document.querySelector('[data-testid="workflow-canvas"]');
        
        if (canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const canvasX = e.clientX - canvasRect.left;
          const canvasY = e.clientY - canvasRect.top;
          
          // Only create template if dropped on canvas
          if (canvasX >= 0 && canvasX <= canvasRect.width && canvasY >= 0 && canvasY <= canvasRect.height) {
            // Convert screen coordinates to world coordinates using viewport transformation
            const worldPos = clientToWorld(e.clientX, e.clientY, viewport, canvasRect);
            console.log('🎯 CALLING onCreateTemplateAtPosition from collapsed sidebar:', { templateType, worldPosition: worldPos, screenPos: { x: e.clientX, y: e.clientY } });
            onCreateTemplateAtPosition?.(templateType, worldPos);
          } else {
            console.log('🎯 TEMPLATE DROP OUTSIDE CANVAS - NO TEMPLATE CREATED');
          }
        }
      } else {
        // This was a click - create template at center
        onCreateTemplate?.(templateType);
      }
      
      // Reset drag state
      setDragState({
        isDragging: false,
        iconType: null,
        templateType: null,
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
      case 'route': return 'Templates';
      case 'palette': return 'Themes';
      case 'fit-view': return 'Fit View';
      case 'clear': return 'Clear Canvas';
      case 'export': return 'Export';
      case 'import': return 'Import';
      default: return iconKey;
    }
  };

  const isPopoutIcon = (iconKey: string): boolean => {
    return ['workflow', 'shapes', 'route', 'palette'].includes(iconKey);
  };

  const isActive = (iconKey: string): boolean => {
    if (iconKey === 'workflow') return activePopout === 'node-types';
    if (iconKey === 'shapes') return activePopout === 'shapes';
    if (iconKey === 'route') return activePopout === 'templates';
    if (iconKey === 'palette') return activePopout === 'themes';
    return false;
  };

  // Split icons into main, template/theme, and action groups
  const mainIcons = ['brain', 'workflow', 'type', 'shapes', 'sticky-note'];
  const templateThemeIcons = ['route', 'palette'];
  const actionIcons = ['clear', 'export', 'import'];

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-card border-r border-border p-2" data-testid="collapsed-sidebar">

        {/* Main Icons */}
        <div className="space-y-2 mb-4">
          {mainIcons.map((iconKey) => {
            const IconComponent = sidebarIcons[iconKey];
            if (!IconComponent) return null;

            return (
              <Tooltip key={iconKey}>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      // Only handle click if no drag occurred
                      if (!dragState.isDragging) {
                        handleIconClick(iconKey);
                      }
                    }}
                    onMouseDown={(e) => handleIconMouseDown(e, iconKey)}
                    className={`
                      w-8 h-8 rounded-md flex items-center justify-center transition-colors
                      ${iconKey === 'brain'
                        ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700'
                        : isActive(iconKey) 
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

        {/* Template and Theme Icons */}
        <div className="space-y-2 mb-4">
          {templateThemeIcons.map((iconKey) => {
            const IconComponent = sidebarIcons[iconKey];
            if (!IconComponent) return null;

            return (
              <Tooltip key={iconKey}>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      console.log('🎯 TEMPLATE/THEME ICON CLICKED:', { iconKey, activePopout });
                      handleIconClick(iconKey);
                    }}
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

      {/* Templates Popout */}
      {activePopout === 'templates' && (
        <>
          {/* Backdrop to close popout when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setActivePopout(null)}
            data-testid="templates-popout-backdrop"
          />
          <div className="absolute left-16 top-32 w-40 bg-card border border-border rounded-md shadow-lg p-3" style={{ zIndex: 60 }}>
          <h3 className="text-sm font-semibold mb-3">Templates</h3>
          <div className="grid grid-cols-1 gap-2">
            {templateTypes.map((template) => {
              const IconComponent = template.icon;
              if (!IconComponent) return null;
              
              return (
                <div
                  key={template.type}
                  className="p-3 border border-border rounded-md cursor-pointer text-center hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 select-none"
                  onMouseDown={(e) => handleTemplateMouseDown(e, template.type)}
                  data-testid={`template-${template.type}`}
                  style={{ userSelect: 'none' }}
                >
                  <IconComponent className={`${template.color} mb-1 mx-auto`} size={20} />
                  <div className="text-xs font-medium">{template.label}</div>
                </div>
              );
            })}
          </div>
          </div>
        </>
      )}

      {/* Themes Popout */}
      {activePopout === 'themes' && (
        <>
          {/* Backdrop to close popout when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setActivePopout(null)}
            data-testid="themes-popout-backdrop"
          />
          <div className="absolute left-16 top-32 w-40 bg-card border border-border rounded-md shadow-lg p-3" style={{ zIndex: 60 }}>
          <h3 className="text-sm font-semibold mb-3">Workflow Themes</h3>
          <div className="grid grid-cols-1 gap-2">
            {workflowThemes.slice(0, 8).map((theme) => (
              <button
                key={theme.id}
                onClick={() => onApplyTheme?.(theme)}
                className="p-2 border border-border rounded-md hover:bg-accent transition-all duration-200 text-left group"
                title={theme.description}
                data-testid={`theme-${theme.id}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: theme.nodeStyles.headerBackground }}
                  />
                  <div 
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: theme.nodeStyles.bodyBackground }}
                  />
                </div>
                <div className="text-xs font-medium">{theme.name}</div>
              </button>
            ))}
          </div>
          </div>
        </>
      )}

      {/* Drag Visual Indicator - matches expanded sidebar style */}
      {dragState.isDragging && dragState.currentPos && dragState.iconType && (
        <div
          className="fixed pointer-events-none bg-white/90 dark:bg-gray-800/90 border border-border rounded-md p-2 shadow-lg backdrop-blur-sm"
          style={{
            zIndex: 60,
            left: dragState.currentPos.x + 10,
            top: dragState.currentPos.y - 20,
            transform: 'translate(0, 0)',
          }}
        >
          <div className="flex items-center gap-2 text-sm">
            {(() => {
              if (dragState.iconType === 'template' && dragState.templateType) {
                const template = templateTypes.find(t => t.type === dragState.templateType);
                if (template && template.icon) {
                  return (
                    <>
                      <template.icon className={`w-4 h-4 ${template.color}`} />
                      <span className="font-medium">{template.label}</span>
                    </>
                  );
                }
              } else {
                const IconComponent = sidebarIcons[dragState.iconType];
                if (IconComponent) {
                  return (
                    <>
                      <IconComponent className="w-4 h-4" />
                      <span className="font-medium">{getTooltipText(dragState.iconType)}</span>
                    </>
                  );
                }
              }
              return null;
            })()}
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}