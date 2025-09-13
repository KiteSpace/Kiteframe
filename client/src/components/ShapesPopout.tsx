import { useState } from 'react';
import { Square, Circle, Triangle, Hexagon } from 'lucide-react';

interface ShapesPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateShape: (shapeType: string) => void;
}

export function ShapesPopout({ isOpen, onClose, onCreateShape }: ShapesPopoutProps) {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    shapeType: string | null;
    startPos: { x: number; y: number } | null;
    currentPos: { x: number; y: number } | null;
  }>({ isDragging: false, shapeType: null, startPos: null, currentPos: null });

  const shapeTypes = [
    { type: 'rectangle', icon: Square, color: 'text-blue-500', label: 'Rectangle' },
    { type: 'circle', icon: Circle, color: 'text-green-500', label: 'Circle' },
    { type: 'triangle', icon: Triangle, color: 'text-yellow-500', label: 'Triangle' },
    { type: 'hexagon', icon: Hexagon, color: 'text-purple-500', label: 'Hexagon' },
  ];

  // Drag and drop handlers for shapes
  const handleShapeMouseDown = (
    e: React.MouseEvent,
    shapeType: string,
  ) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    console.log('🎯 SHAPE POPOUT DRAG START:', { shapeType, startPos: { x: e.clientX, y: e.clientY } });
    
    e.preventDefault();
    e.stopPropagation();
    
    const startPos = { x: e.clientX, y: e.clientY };
    setDragState({
      isDragging: true,
      shapeType,
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
      console.log('🎯 SHAPE POPOUT DRAG END:', { shapeType, endPos: { x: e.clientX, y: e.clientY } });
      
      // Find the canvas element
      const canvasElement = document.querySelector('.kiteframe-canvas');
      
      if (canvasElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        const x = e.clientX - canvasRect.left;
        const y = e.clientY - canvasRect.top;
        
        // Only create shape if dropped on canvas
        if (x >= 0 && x <= canvasRect.width && y >= 0 && y <= canvasRect.height) {
          console.log('🎯 CALLING onCreateShape from popout:', { shapeType, position: { x, y } });
          onCreateShape(shapeType);
          // Don't close popout after drag-and-drop - only on outside click or toggle
        } else {
          console.log('🎯 DROP OUTSIDE CANVAS - NO SHAPE CREATED');
        }
      }
      
      // Reset drag state
      setDragState({
        isDragging: false,
        shapeType: null,
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop to close popout when clicking outside */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
        data-testid="shapes-popout-backdrop"
      />
      
      {/* Popout Panel */}
      <div 
        className="absolute left-12 top-16 z-50 w-40 bg-card border border-border rounded-md shadow-lg p-3"
        data-testid="shapes-popout"
      >
        <h3 className="text-sm font-semibold mb-3">Shapes</h3>
        <div className="flex flex-col gap-2">
          {shapeTypes.map((shapeType) => {
            const IconComponent = shapeType.icon;
            return (
              <div
                key={shapeType.type}
                className="p-2 border border-border rounded-md cursor-pointer text-center hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                onClick={() => {
                  onCreateShape(shapeType.type);
                  // Don't close popout on click - only on outside click or toggle
                }}
                onMouseDown={(e) => handleShapeMouseDown(e, shapeType.type)}
                data-testid={`popout-shape-${shapeType.type}`}
              >
                <IconComponent className={`${shapeType.color} mb-1 mx-auto`} size={16} />
                <div className="text-xs font-medium">{shapeType.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag Visual Indicator - matches expanded sidebar style */}
      {dragState.isDragging && dragState.currentPos && dragState.shapeType && (
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
              const shapeTypeData = shapeTypes.find(st => st.type === dragState.shapeType);
              if (shapeTypeData) {
                const IconComponent = shapeTypeData.icon;
                return (
                  <>
                    <IconComponent className={`${shapeTypeData.color}`} size={16} />
                    <span className="font-medium">{shapeTypeData.label}</span>
                  </>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}
    </>
  );
}