import { useState } from 'react';
import { LucideIcon, Menu, Share2, Upload, Figma } from 'lucide-react';
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
  onShare?: () => void;
  onOpenAiGenerator?: () => void;
  onUploadImage?: () => void;
  onImportFigma?: () => void;
  onCreateTemplate?: (templateType: string) => void;
  onCreateTemplateAtPosition?: (templateType: string, position: { x: number; y: number }) => void;
  onApplyTheme?: (theme: WorkflowTheme) => void;
  activePopout: 'node-types' | 'shapes' | 'templates' | 'themes' | 'boosts' | null;
  setActivePopout: (popout: 'node-types' | 'shapes' | 'templates' | 'themes' | 'boosts' | null) => void;
  sidebarIcons: Record<string, LucideIcon>;
  viewport: { x: number; y: number; zoom: number };
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  readOnly?: boolean;
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
  onShare,
  onOpenAiGenerator,
  onUploadImage,
  onImportFigma,
  onCreateTemplate,
  onCreateTemplateAtPosition,
  onApplyTheme,
  activePopout,
  setActivePopout,
  sidebarIcons,
  isExpanded = false,
  onToggleExpanded,
  readOnly = false
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
      case 'table':
        // Click creates table at center, drag-and-drop creates at mouse position
        onCreateNode('table');
        break;
      case 'form':
        // Click creates form at center, drag-and-drop creates at mouse position
        onCreateNode('form');
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
      case 'share':
        onShare?.();
        break;
      case 'rocket':
        const newBoostsState = activePopout === 'boosts' ? null : 'boosts';
        setActivePopout(newBoostsState);
        break;
      case 'download':
        onExport();
        break;
      case 'upload':
        onImport();
        break;
      case 'delete':
        onClearCanvas();
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
    if (!['type', 'sticky-note', 'table', 'form'].includes(iconKey)) return;
    
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
            const nodeType = iconKey === 'type' ? 'text' : iconKey === 'sticky-note' ? 'sticky' : iconKey === 'table' ? 'table' : iconKey === 'form' ? 'form' : iconKey;
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
      case 'workflow': return 'Node Types';
      case 'type': return 'Text';
      case 'sticky-note': return 'Sticky Note';
      case 'table': return 'Table';
      case 'form': return 'Form';
      case 'shapes': return 'Shapes';
      case 'route': return 'Templates';
      case 'palette': return 'Themes';
      case 'fit-view': return 'Fit View';
      case 'clear': return 'Clear Canvas';
      case 'export': return 'Export';
      case 'import': return 'Import';
      case 'share': return 'Share Link';
      case 'rocket': return 'Boosts';
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
    if (iconKey === 'rocket') return activePopout === 'boosts';
    return false;
  };

  // Split icons into main, template/theme, and action groups
  // Note: 'brain' removed - AI assistant is now the floating KiteAI button
  // Note: 'table' and 'form' removed - they exist inside node-types menu
  const mainIcons = ['workflow', 'type', 'shapes', 'sticky-note'];
  const templateThemeIcons = ['route', 'palette'];
  const actionIcons = readOnly ? ['clear', 'export', 'import'] : ['rocket', 'share', 'download', 'upload', 'delete'];

  return (
    <TooltipProvider>
      <div 
        className={`absolute left-4 top-1/2 -translate-y-1/2 flex flex-col bg-card border border-border shadow-lg p-2 z-40 transition-all duration-200 ${isExpanded ? 'w-44' : 'w-12'}`}
        style={{ borderRadius: isExpanded ? '12px' : '50px' }}
        data-testid="collapsed-sidebar"
      >
        {/* Hamburger Menu Toggle */}
        <button
          onClick={onToggleExpanded}
          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors mb-2"
          data-testid="toggle-toolbar-expand"
          title={isExpanded ? "Collapse toolbar" : "Expand toolbar"}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="border-b border-border mb-2"></div>

        {/* Main Icons */}
        <div className="space-y-1 mb-2">
          {mainIcons.map((iconKey) => {
            const IconComponent = sidebarIcons[iconKey];
            if (!IconComponent) return null;

            return (
              <Tooltip key={iconKey} delayDuration={isExpanded ? 1000 : 0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      if (!dragState.isDragging) {
                        handleIconClick(iconKey);
                      }
                    }}
                    onMouseDown={(e) => handleIconMouseDown(e, iconKey)}
                    className={`
                      ${isExpanded ? 'w-full px-2' : 'w-8'} h-8 rounded-md flex items-center gap-2 transition-colors
                      ${isActive(iconKey) 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent'
                      }
                    `}
                    data-testid={`icon-${iconKey}`}
                    title={isExpanded ? undefined : getTooltipText(iconKey)}
                  >
                    <IconComponent className="w-4 h-4 flex-shrink-0 ml-1.5" />
                    {isExpanded && <span className="text-sm font-medium truncate">{getTooltipText(iconKey)}</span>}
                  </button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">
                    <p>{getTooltipText(iconKey)}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-b border-border mb-2"></div>

        {/* Template and Theme Icons */}
        <div className="space-y-1 mb-2">
          {templateThemeIcons.map((iconKey) => {
            const IconComponent = sidebarIcons[iconKey];
            if (!IconComponent) return null;

            return (
              <Tooltip key={iconKey} delayDuration={isExpanded ? 1000 : 0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      handleIconClick(iconKey);
                    }}
                    className={`
                      ${isExpanded ? 'w-full px-2' : 'w-8'} h-8 rounded-md flex items-center gap-2 transition-colors
                      ${isActive(iconKey) 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent'
                      }
                    `}
                    data-testid={`icon-${iconKey}`}
                    title={isExpanded ? undefined : getTooltipText(iconKey)}
                  >
                    <IconComponent className="w-4 h-4 flex-shrink-0 ml-1.5" />
                    {isExpanded && <span className="text-sm font-medium truncate">{getTooltipText(iconKey)}</span>}
                  </button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">
                    <p>{getTooltipText(iconKey)}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-b border-border mb-2"></div>

        {/* Action Icons */}
        <div className="space-y-1">
          {actionIcons.map((iconKey) => {
            const IconComponent = sidebarIcons[iconKey];
            if (!IconComponent) return null;

            return (
              <Tooltip key={iconKey} delayDuration={isExpanded ? 1000 : 0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleIconClick(iconKey)}
                    className={`
                      ${isExpanded ? 'w-full px-2' : 'w-8'} h-8 rounded-md flex items-center gap-2 hover:bg-accent transition-colors
                    `}
                    data-testid={`action-${iconKey}`}
                    title={isExpanded ? undefined : getTooltipText(iconKey)}
                  >
                    <IconComponent className="w-4 h-4 flex-shrink-0 ml-1.5" />
                    {isExpanded && <span className="text-sm font-medium truncate">{getTooltipText(iconKey)}</span>}
                  </button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">
                    <p>{getTooltipText(iconKey)}</p>
                  </TooltipContent>
                )}
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
          <div className="fixed w-40 bg-card border border-border rounded-md shadow-lg p-3" style={{ zIndex: 60, left: isExpanded ? '200px' : '80px', top: '50%', transform: 'translateY(-50%)' }}>
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
          <div className="fixed w-40 bg-card border border-border rounded-md shadow-lg p-3" style={{ zIndex: 60, left: isExpanded ? '200px' : '80px', top: '50%', transform: 'translateY(-50%)' }}>
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

      {/* Boosts Popout */}
      {activePopout === 'boosts' && (
        <>
          {/* Backdrop to close popout when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setActivePopout(null)}
            data-testid="boosts-popout-backdrop"
          />
          <div className="fixed w-40 bg-card border border-border rounded-md shadow-lg p-3" style={{ zIndex: 60, left: isExpanded ? '200px' : '80px', top: '50%', transform: 'translateY(-50%)' }}>
            <h3 className="text-sm font-semibold mb-3">Boosts</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => {
                  setActivePopout(null);
                  onUploadImage?.();
                }}
                className="p-3 border border-border rounded-md cursor-pointer hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                data-testid="boost-upload-image"
              >
                <Upload className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium">Analyze Image</span>
              </button>
              <button
                onClick={() => {
                  setActivePopout(null);
                  onImportFigma?.();
                }}
                className="p-3 border border-border rounded-md cursor-pointer hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 flex flex-col gap-1"
                data-testid="boost-import-figma"
              >
                <div className="flex items-center gap-2 w-full">
                  <Figma className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-medium">Import Figma</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded font-medium">Early Access</span>
                </div>
              </button>
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