import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, GripVertical, Palette, Trash2, LayoutGrid, Shuffle, ArrowRight, ArrowDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { FlowSettings, Flow } from '../utils/FlowDetection';
import { useWorkflowNames } from '../../../stores/workflowNameStore';
import { useNodeToWorkflow } from '../../../stores/nodeToWorkflowStore';
import { workflowThemes, type WorkflowTheme } from '../../../lib/themes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Color palette and utilities from LinearToolbar
const COLOR_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#06b6d4', '#6366f1',
  '#64748b', '#1e293b', '#ffffff'
];

const getTintedBodyColor = (headerColor: string, intensity: number = 0.1): string => {
  let r = 248, g = 250, b = 252;
  
  if (headerColor.startsWith('#')) {
    const hex = headerColor.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  }
  
  const mixedR = Math.round(255 * (1 - intensity) + r * intensity);
  const mixedG = Math.round(255 * (1 - intensity) + g * intensity);
  const mixedB = Math.round(255 * (1 - intensity) + b * intensity);
  
  return `#${mixedR.toString(16).padStart(2, '0')}${mixedG.toString(16).padStart(2, '0')}${mixedB.toString(16).padStart(2, '0')}`;
};

interface WorkflowHeaderProps {
  flowId: string;
  settings: FlowSettings;
  position: { x: number; y: number };
  scale: number;
  onSettingsChange: (flowId: string, settings: FlowSettings) => void;
  onResetStatuses: (flowId: string) => void;
  onThemeChange?: (flowId: string) => void;
  onApplyTheme?: (flowId: string, theme: WorkflowTheme) => void;
  onDeleteWorkflow?: (flowId: string) => void;
  onDragWorkflow?: (flowId: string, deltaX: number, deltaY: number, isDragStart?: boolean) => void;
  onLayoutWorkflow?: (flowId: string, layoutType: 'hierarchical' | 'horizontal' | 'vertical') => void;
  readOnly?: boolean;
  flowNodes?: any[];
}

export function WorkflowHeader({
  flowId,
  settings,
  position,
  scale,
  onSettingsChange,
  onResetStatuses,
  onThemeChange,
  onApplyTheme,
  onDeleteWorkflow,
  onDragWorkflow,
  onLayoutWorkflow,
  readOnly = false,
  flowNodes = [],
}: WorkflowHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showThemePopover, setShowThemePopover] = useState(false);
  const [showLayoutPopover, setShowLayoutPopover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const justDraggedRef = useRef(false);
  
  const workflowNames = useWorkflowNames();
  const nodeToWorkflow = useNodeToWorkflow();
  
  // Try to get workflow name from the first node in the flow
  const firstNodeId = flowNodes.length > 0 ? flowNodes[0].id : null;
  const workflowNameFromNode = firstNodeId ? nodeToWorkflow.getWorkflowNameForNode(firstNodeId) : null;
  const workflowName = workflowNameFromNode || workflowNames.get(flowId) || 'Workflow';
  
  const [nameValue, setNameValue] = useState(workflowName);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameValue(workflowName);
  }, [workflowName]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Drag workflow handlers
  const isFirstMoveRef = useRef(true);
  
  const handleGripMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly || !onDragWorkflow) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isFirstMoveRef.current = true;
  }, [readOnly, onDragWorkflow]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !onDragWorkflow) return;
      const deltaX = (e.clientX - dragStartRef.current.x) / scale;
      const deltaY = (e.clientY - dragStartRef.current.y) / scale;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      // Pass isDragStart=true on first move to trigger undo snapshot
      onDragWorkflow(flowId, deltaX, deltaY, isFirstMoveRef.current);
      isFirstMoveRef.current = false;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      // Set flag to prevent dropdown toggle on drag end
      justDraggedRef.current = true;
      // Reset after a short delay to allow normal clicks
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 100);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, flowId, scale, onDragWorkflow]);

  const handleNameSubmit = () => {
    const trimmedName = nameValue.trim() || 'Workflow';
    setIsEditingName(false);
    workflowNames.set(flowId, trimmedName);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setNameValue(settings.name);
      setIsEditingName(false);
    }
  };

  const handleToggleTracking = (checked: boolean) => {
    onSettingsChange(flowId, { ...settings, statusTrackingEnabled: checked });
  };

  const handleResetStatuses = () => {
    onResetStatuses(flowId);
  };

  // Position header directly above the top-left corner of the flow in canvas coordinates
  // The header is inside kiteframe-world which has the transform applied.
  // With inverse scaling (scale(1/zoom)), the header renders at constant screen size (~32px).
  // Using fixed 48 canvas unit offset with bottom-left origin:
  // - At zoom 1: gap = 48 - 32 = 16px ✓
  // - At any zoom: header scales around bottom-left, so bottom edge stays 48 units above node
  // - Visual gap = 48 - 32 = 16px constant
  const headerOffset = 48;
  
  const headerStyle: React.CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y - headerOffset,
    zIndex: 1000,
    // Use inverse scale to keep UI readable at any zoom level
    transform: `scale(${1 / scale})`,
    transformOrigin: 'bottom left',
  };

  return (
    <div
      style={headerStyle}
      ref={dropdownRef}
      className="workflow-header"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid={`workflow-header-${flowId}`}
    >
      <div className="relative">
        <button
          onClick={() => {
            // Don't toggle dropdown if we just finished dragging
            if (justDraggedRef.current) return;
            if (!readOnly) setIsOpen(!isOpen);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-shadow text-sm font-medium"
          style={{ backgroundColor: '#2b313d', color: '#ffffff' }}
          data-testid={`workflow-header-toggle-${flowId}`}
        >
          <span 
            onMouseDown={handleGripMouseDown}
            title="Drag workflow"
            className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <GripVertical 
              size={14} 
              className="opacity-60"
            />
          </span>
          <ChevronDown
            size={14}
            className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent border-none outline-none text-sm font-medium w-32"
              data-testid={`workflow-name-input-${flowId}`}
            />
          ) : (
            <span
              onDoubleClick={() => !readOnly && setIsEditingName(true)}
              className="cursor-text"
              data-testid={`workflow-name-${flowId}`}
            >
              {workflowName}
            </span>
          )}
        </button>

        {isOpen && (
          <div
            className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 min-w-[200px] z-[1001]"
            data-testid={`workflow-dropdown-${flowId}`}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <Switch
                checked={settings.statusTrackingEnabled}
                onCheckedChange={handleToggleTracking}
                disabled={readOnly}
                data-testid={`workflow-status-toggle-${flowId}`}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">
                Status Tracking
              </span>
            </div>

            {settings.statusTrackingEnabled && (
              <button
                onClick={handleResetStatuses}
                disabled={readOnly}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
                data-testid={`workflow-reset-statuses-${flowId}`}
              >
                Reset all statuses
              </button>
            )}

            <div className="border-t border-gray-200 dark:border-gray-600 my-2" />

            <Popover open={showThemePopover} onOpenChange={setShowThemePopover}>
              <PopoverTrigger asChild>
                <button
                  disabled={readOnly}
                  className="flex items-center gap-2 w-full text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1.5 transition-colors disabled:opacity-50"
                  data-testid={`workflow-theme-${flowId}`}
                >
                  <Palette size={14} />
                  Theme
                </button>
              </PopoverTrigger>
              <PopoverContent 
                side="right" 
                align="start"
                className="w-auto p-2"
              >
                <div className="grid grid-cols-7 gap-1">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        // Create theme from color
                        const headerTextColor = color === '#ffffff' ? '#0f172a' : '#ffffff';
                        const theme = {
                          id: color,
                          name: color,
                          description: '',
                          nodeStyles: {
                            headerBackground: color,
                            headerText: headerTextColor,
                            bodyBackground: color === '#ffffff' ? '#ffffff' : getTintedBodyColor(color),
                            bodyText: color === '#ffffff' ? '#334155' : headerTextColor,
                            border: color === '#ffffff' ? '#e2e8f0' : color,
                          },
                          edgeStyles: {
                            stroke: color,
                            strokeSelected: color,
                          }
                        };
                        onApplyTheme?.(flowId, theme);
                        setShowThemePopover(false);
                        setIsOpen(false);
                      }}
                      className="w-6 h-6 rounded border-2 border-gray-200 dark:border-gray-600 hover:scale-110 transition-transform hover:border-gray-400 dark:hover:border-gray-400"
                      style={{ backgroundColor: color }}
                      title={color}
                      data-testid={`workflow-theme-swatch-${color.replace('#', '')}`}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={showLayoutPopover} onOpenChange={setShowLayoutPopover}>
              <PopoverTrigger asChild>
                <button
                  disabled={readOnly}
                  className="flex items-center gap-2 w-full text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1.5 transition-colors disabled:opacity-50"
                  data-testid={`workflow-layout-${flowId}`}
                >
                  <LayoutGrid size={14} />
                  Layout
                </button>
              </PopoverTrigger>
              <PopoverContent 
                side="right" 
                align="start"
                className="w-auto p-2"
              >
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      onLayoutWorkflow?.(flowId, 'hierarchical');
                      setShowLayoutPopover(false);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    data-testid={`workflow-layout-tidy-${flowId}`}
                  >
                    <Shuffle size={14} />
                    Tidy
                  </button>
                  <button
                    onClick={() => {
                      onLayoutWorkflow?.(flowId, 'horizontal');
                      setShowLayoutPopover(false);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    data-testid={`workflow-layout-horizontal-${flowId}`}
                  >
                    <ArrowRight size={14} />
                    Horizontal Flow
                  </button>
                  <button
                    onClick={() => {
                      onLayoutWorkflow?.(flowId, 'vertical');
                      setShowLayoutPopover(false);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    data-testid={`workflow-layout-vertical-${flowId}`}
                  >
                    <ArrowDown size={14} />
                    Vertical Flow
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <div className="border-t border-gray-200 dark:border-gray-600 my-2" />

            <button
              onClick={() => {
                setShowDeleteDialog(true);
                setIsOpen(false);
              }}
              disabled={readOnly}
              className="flex items-center gap-2 w-full text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2 py-1.5 transition-colors disabled:opacity-50"
              data-testid={`workflow-delete-${flowId}`}
            >
              <Trash2 size={14} />
              Delete Workflow
            </button>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{workflowName}" and all {flowNodes.length} nodes in it. This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDeleteWorkflow?.(flowId);
                setShowDeleteDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
