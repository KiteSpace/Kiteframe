import { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical, Check, X, ChevronDown, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ExperimentBranchHeaderProps {
  experimentId: string;
  mode: 'whatif' | 'risk' | 'enhancement' | 'prompt';
  originNodeId: string;
  position: { x: number; y: number };
  scale: number;
  onAccept: (experimentId: string) => void;
  onReject: (experimentId: string) => void;
  onEdit?: (experimentId: string) => void;
  onDragAll?: (experimentId: string, deltaX: number, deltaY: number, isDragStart?: boolean) => void;
  readOnly?: boolean;
}

const MODE_LABELS: Record<string, string> = {
  whatif: 'What-If',
  risk: 'Risk',
  enhancement: 'Enhancement',
  prompt: 'Prompt',
};

export function ExperimentBranchHeader({
  experimentId,
  mode,
  originNodeId,
  position,
  scale,
  onAccept,
  onReject,
  onEdit,
  onDragAll,
  readOnly = false,
}: ExperimentBranchHeaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isFirstMoveRef = useRef(true);

  const handleGripMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly || !onDragAll) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isFirstMoveRef.current = true;
  }, [readOnly, onDragAll]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !onDragAll) return;
      const deltaX = (e.clientX - dragStartRef.current.x) / scale;
      const deltaY = (e.clientY - dragStartRef.current.y) / scale;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      onDragAll(experimentId, deltaX, deltaY, isFirstMoveRef.current);
      isFirstMoveRef.current = false;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, experimentId, scale, onDragAll]);

  const modeLabel = MODE_LABELS[mode] || 'Experiment';

  const offsetAboveNode = 40;

  return (
    <div
      data-testid={`experiment-branch-header-${experimentId}`}
      className="absolute flex items-center gap-1 px-3 py-1 rounded-full shadow-md select-none z-50"
      style={{
        left: position.x,
        top: position.y - offsetAboveNode / scale,
        transform: `scale(${1 / scale})`,
        transformOrigin: 'bottom left',
        backgroundColor: '#f3e8ff',
      }}
    >
      {!readOnly && onDragAll && (
        <div
          data-testid={`experiment-drag-handle-${experimentId}`}
          onMouseDown={handleGripMouseDown}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-purple-200 rounded transition-colors"
        >
          <GripVertical className="w-4 h-4 text-purple-600" />
        </div>
      )}

      <span 
        className="text-sm font-medium text-purple-800 flex-shrink-0"
        data-testid={`experiment-mode-label-${experimentId}`}
      >
        {modeLabel}
      </span>

      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid={`experiment-options-${experimentId}`}
              className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-purple-200 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 text-purple-600" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              data-testid={`experiment-accept-menu-${experimentId}`}
              onClick={() => onAccept(experimentId)}
            >
              <Check className="w-3 h-3 mr-2 text-green-600" />
              Accept Branch
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid={`experiment-reject-menu-${experimentId}`}
              onClick={() => onReject(experimentId)}
            >
              <X className="w-3 h-3 mr-2 text-red-600" />
              Reject Branch
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem
                data-testid={`experiment-edit-${experimentId}`}
                onClick={() => onEdit(experimentId)}
              >
                <Pencil className="w-3 h-3 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="ghost"
          size="sm"
          data-testid={`experiment-accept-${experimentId}`}
          onClick={() => onAccept(experimentId)}
          className="h-6 px-2 text-xs rounded-full bg-purple-600 hover:bg-purple-700 text-white"
          disabled={readOnly}
        >
          <Check className="w-3 h-3 mr-1" />
          Accept
        </Button>

        <Button
          variant="ghost"
          size="sm"
          data-testid={`experiment-reject-${experimentId}`}
          onClick={() => onReject(experimentId)}
          className="h-6 px-2 text-xs rounded-full bg-white hover:bg-gray-100 text-gray-700"
          disabled={readOnly}
        >
          <X className="w-3 h-3 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  );
}

export default ExperimentBranchHeader;
