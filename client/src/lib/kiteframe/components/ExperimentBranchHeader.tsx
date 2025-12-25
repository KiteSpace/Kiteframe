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
  whatif: 'What-If Experiment',
  risk: 'Risk Experiment',
  enhancement: 'Enhancement Experiment',
  prompt: 'AI Experiment',
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

  return (
    <div
      data-testid={`experiment-branch-header-${experimentId}`}
      className="absolute flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg border-2 select-none z-50"
      style={{
        left: position.x,
        top: position.y - 48,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        backgroundColor: '#f3e8ff',
        borderColor: '#9333ea',
        minWidth: '200px',
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
        className="text-sm font-medium text-purple-800 flex-1 truncate"
        data-testid={`experiment-mode-label-${experimentId}`}
      >
        {modeLabel}
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          data-testid={`experiment-accept-${experimentId}`}
          onClick={() => onAccept(experimentId)}
          className="h-6 px-2 text-xs bg-purple-600 hover:bg-purple-700 text-white"
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
          className="h-6 px-2 text-xs bg-white hover:bg-gray-100 text-gray-700 border border-gray-300"
          disabled={readOnly}
        >
          <X className="w-3 h-3 mr-1" />
          Reject
        </Button>

        {onEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                data-testid={`experiment-more-${experimentId}`}
                className="h-6 px-1 text-xs text-purple-700 hover:bg-purple-200"
                disabled={readOnly}
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid={`experiment-edit-${experimentId}`}
                onClick={() => onEdit(experimentId)}
              >
                <Pencil className="w-3 h-3 mr-2" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export default ExperimentBranchHeader;
