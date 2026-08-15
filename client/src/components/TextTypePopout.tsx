import { useRef, useState } from 'react';
import { Type, AlignLeft } from 'lucide-react';
import { clientToWorld } from '@/lib/kiteframe/utils/geometry';

interface TextTypePopoutProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTextType: (textType: 'text' | 'text-field') => void;
  onCreateTextTypeAtPosition?: (textType: 'text' | 'text-field', position: { x: number; y: number }) => void;
  viewport: { x: number; y: number; zoom: number };
  isToolbarExpanded?: boolean;
}

const textTypes = [
  {
    type: 'text' as const,
    icon: Type,
    color: 'text-blue-500',
    label: 'Label',
    description: 'Single-line text label',
  },
  {
    type: 'text-field' as const,
    icon: AlignLeft,
    color: 'text-purple-500',
    label: 'Text Field',
    description: 'Rich-text block with formatting',
  },
];

export function TextTypePopout({
  isOpen,
  onClose,
  onCreateTextType,
  onCreateTextTypeAtPosition,
  viewport,
  isToolbarExpanded = false,
}: TextTypePopoutProps) {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    textType: string | null;
    startPos: { x: number; y: number } | null;
    currentPos: { x: number; y: number } | null;
  }>({ isDragging: false, textType: null, startPos: null, currentPos: null });

  // Synchronous "a drag just happened" flag. React state resets asynchronously,
  // so the card's click handler (which fires after document mouseup) would see
  // isDragging=false and create a second, centered object. The ref is set on
  // mouseup and consumed by the very next click.
  const dragJustEndedRef = useRef(false);

  const handleTextTypeMouseDown = (
    e: React.MouseEvent,
    textType: 'text' | 'text-field',
  ) => {
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    const startPos = { x: e.clientX, y: e.clientY };
    let hasMoved = false;

    setDragState({
      isDragging: false,
      textType,
      startPos,
      currentPos: startPos,
    });

    const handleMouseMove = (e: MouseEvent) => {
      const distance = Math.sqrt(
        Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2),
      );
      if (distance > 5) {
        hasMoved = true;
        setDragState((prev) => ({
          ...prev,
          isDragging: true,
          currentPos: { x: e.clientX, y: e.clientY },
        }));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (hasMoved) {
        // Suppress the click event that follows this mouseup — the object (if
        // any) is created here at the drop position, not by the click handler.
        dragJustEndedRef.current = true;
        const canvasElement = document.querySelector('[data-testid="workflow-canvas"]');
        if (canvasElement) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const canvasX = e.clientX - canvasRect.left;
          const canvasY = e.clientY - canvasRect.top;
          if (canvasX >= 0 && canvasX <= canvasRect.width && canvasY >= 0 && canvasY <= canvasRect.height) {
            const worldPos = clientToWorld(e.clientX, e.clientY, viewport, canvasRect);
            if (onCreateTextTypeAtPosition) {
              onCreateTextTypeAtPosition(textType, worldPos);
            } else {
              onCreateTextType(textType);
            }
            onClose();
          }
        }
      }

      setDragState({ isDragging: false, textType: null, startPos: null, currentPos: null });
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        data-testid="text-type-popout-backdrop"
      />

      {/* Popout Panel */}
      <div
        className="fixed w-40 bg-card border border-border rounded-md shadow-lg p-3"
        style={{ zIndex: 60, left: isToolbarExpanded ? '200px' : '80px', top: '50%', transform: 'translateY(-50%)' }}
        data-testid="text-type-popout"
      >
        <h3 className="text-sm font-semibold mb-3">Text</h3>
        <div className="flex flex-col gap-2">
          {textTypes.map((tt) => {
            const IconComponent = tt.icon;
            return (
              <div
                key={tt.type}
                className="p-2 border border-border rounded-md cursor-pointer text-center hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                onClick={() => {
                  // Consume the drag flag: a click that follows a drag must not
                  // create a second (centered) object.
                  if (dragJustEndedRef.current) {
                    dragJustEndedRef.current = false;
                    return;
                  }
                  onCreateTextType(tt.type);
                  onClose();
                }}
                onMouseDown={(e) => handleTextTypeMouseDown(e, tt.type)}
                data-testid={`popout-text-type-${tt.type}`}
              >
                <IconComponent className={`${tt.color} mb-1 mx-auto`} size={16} />
                <div className="text-xs font-medium">{tt.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag visual indicator */}
      {dragState.isDragging && dragState.currentPos && dragState.textType && (
        <div
          className="fixed pointer-events-none bg-white/90 dark:bg-gray-800/90 border border-border rounded-md p-2 shadow-lg backdrop-blur-sm"
          style={{
            zIndex: 70,
            left: dragState.currentPos.x + 10,
            top: dragState.currentPos.y - 20,
          }}
        >
          <div className="flex items-center gap-2 text-sm">
            {(() => {
              const tt = textTypes.find((t) => t.type === dragState.textType);
              if (!tt) return null;
              const IconComponent = tt.icon;
              return (
                <>
                  <IconComponent className={tt.color} size={16} />
                  <span className="font-medium">{tt.label}</span>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
