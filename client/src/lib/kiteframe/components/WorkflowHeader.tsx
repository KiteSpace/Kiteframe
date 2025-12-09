import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MoreVertical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { FlowSettings } from '../utils/FlowDetection';
import { useWorkflowNames } from '../../../stores/workflowNameStore';

interface WorkflowHeaderProps {
  flowId: string;
  settings: FlowSettings;
  position: { x: number; y: number };
  scale: number;
  onSettingsChange: (flowId: string, settings: FlowSettings) => void;
  onResetStatuses: (flowId: string) => void;
  readOnly?: boolean;
}

export function WorkflowHeader({
  flowId,
  settings,
  position,
  scale,
  onSettingsChange,
  onResetStatuses,
  readOnly = false,
}: WorkflowHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const workflowNames = useWorkflowNames();
  const workflowName = workflowNames.get(flowId) || 'Workflow';
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
          onClick={() => !readOnly && setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-shadow text-sm font-medium"
          style={{ backgroundColor: '#2b313d', color: '#ffffff' }}
          data-testid={`workflow-header-toggle-${flowId}`}
        >
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
          </div>
        )}
      </div>
    </div>
  );
}
