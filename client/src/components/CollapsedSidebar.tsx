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
              <sidebarIcons.workflow className="w-4 h-4" />
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
    </TooltipProvider>
  );
}