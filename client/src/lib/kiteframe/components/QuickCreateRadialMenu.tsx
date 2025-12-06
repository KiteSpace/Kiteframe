import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Plus,
  X,
  Square,
  Type,
  Shapes,
  StickyNote,
  Circle,
  Triangle,
  Hexagon,
  ArrowRight,
  PenTool,
  Minus
} from 'lucide-react';

export type QuickCreateType = 'node' | 'text' | 'shape' | 'sticky';
export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'polygon' | 'arrow' | 'line';

interface QuickCreateRadialMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onCreateNode: (position: { x: number; y: number }) => void;
  onCreateText: (position: { x: number; y: number }) => void;
  onCreateShape: (position: { x: number; y: number }, shapeType: ShapeType) => void;
  onCreateSticky: (position: { x: number; y: number }) => void;
  canvasPosition: { x: number; y: number };
}

interface RadialOption {
  id: QuickCreateType;
  icon: React.ReactNode;
  label: string;
  angle: number;
}

const SHAPE_OPTIONS: { id: ShapeType; icon: React.ReactNode; label: string }[] = [
  { id: 'rectangle', icon: <Square size={18} />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle size={18} />, label: 'Circle' },
  { id: 'triangle', icon: <Triangle size={18} />, label: 'Triangle' },
  { id: 'hexagon', icon: <Hexagon size={18} />, label: 'Hexagon' },
  { id: 'polygon', icon: <PenTool size={18} />, label: 'Polygon' },
  { id: 'arrow', icon: <ArrowRight size={18} />, label: 'Arrow' },
  { id: 'line', icon: <Minus size={18} />, label: 'Line' },
];

export const QuickCreateRadialMenu: React.FC<QuickCreateRadialMenuProps> = ({
  isOpen,
  position,
  onClose,
  onCreateNode,
  onCreateText,
  onCreateShape,
  onCreateSticky,
  canvasPosition
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showShapeSubmenu, setShowShapeSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setShowShapeSubmenu(false);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    } else {
      setShowShapeSubmenu(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showShapeSubmenu) {
          setShowShapeSubmenu(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, showShapeSubmenu, onClose]);

  const handleOptionClick = useCallback((optionId: QuickCreateType) => {
    if (optionId === 'shape') {
      setShowShapeSubmenu(true);
    } else if (optionId === 'node') {
      onCreateNode(canvasPosition);
      onClose();
    } else if (optionId === 'text') {
      onCreateText(canvasPosition);
      onClose();
    } else if (optionId === 'sticky') {
      onCreateSticky(canvasPosition);
      onClose();
    }
  }, [canvasPosition, onCreateNode, onCreateText, onCreateSticky, onClose]);

  const handleShapeSelect = useCallback((shapeType: ShapeType) => {
    onCreateShape(canvasPosition, shapeType);
    onClose();
  }, [canvasPosition, onCreateShape, onClose]);

  const radius = 80;
  const shapeRadius = 70;

  const options: RadialOption[] = [
    {
      id: 'node',
      icon: <Square size={20} />,
      label: 'New Node',
      angle: -90
    },
    {
      id: 'text',
      icon: <Type size={20} />,
      label: 'Text Object',
      angle: 0
    },
    {
      id: 'shape',
      icon: <Shapes size={20} />,
      label: 'Shape',
      angle: 90
    },
    {
      id: 'sticky',
      icon: <StickyNote size={20} />,
      label: 'Sticky Note',
      angle: 180
    }
  ];

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] pointer-events-auto radial-menu-enter"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
      }}
      data-testid="quick-create-radial-menu"
    >
      <div className="relative">
        {/* Center close button */}
        <button
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center z-10 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:scale-105"
          onClick={onClose}
          data-testid="quick-create-close"
        >
          <X size={20} className="text-gray-600 dark:text-gray-300" />
        </button>

        {/* Main options - radial fan */}
        {!showShapeSubmenu && options.map((option, index) => {
          const angleRad = (option.angle * Math.PI) / 180;
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius;

          return (
            <div
              key={option.id}
              className="absolute left-1/2 top-1/2 radial-sector-enter"
              style={{
                left: x,
                top: y,
                animationDelay: `${index * 50}ms`
              }}
            >
              <button
                className={cn(
                  "w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-200",
                  "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
                  "hover:scale-110 hover:shadow-xl active:scale-95",
                  "text-gray-700 dark:text-gray-200"
                )}
                onClick={() => handleOptionClick(option.id)}
                title={option.label}
                data-testid={`quick-create-${option.id}`}
              >
                {option.icon}
                <span className="text-[9px] font-medium mt-0.5 leading-tight text-center px-1">
                  {option.id === 'node' ? 'Node' : option.id === 'text' ? 'Text' : option.id === 'shape' ? 'Shape' : 'Sticky'}
                </span>
              </button>
            </div>
          );
        })}

        {/* Shape submenu - radial fan */}
        {showShapeSubmenu && SHAPE_OPTIONS.map((shape, index) => {
          const totalAngle = 300;
          const angleStep = totalAngle / Math.max(SHAPE_OPTIONS.length - 1, 1);
          const angle = -150 + (index * angleStep);
          const angleRad = (angle * Math.PI) / 180;
          const x = Math.cos(angleRad) * shapeRadius;
          const y = Math.sin(angleRad) * shapeRadius;

          return (
            <div
              key={shape.id}
              className="absolute left-1/2 top-1/2 radial-sector-enter"
              style={{
                left: x,
                top: y,
                animationDelay: `${index * 40}ms`
              }}
            >
              <button
                className={cn(
                  "w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-200",
                  "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
                  "hover:scale-110 hover:shadow-xl active:scale-95",
                  "text-gray-700 dark:text-gray-200"
                )}
                onClick={() => handleShapeSelect(shape.id)}
                title={shape.label}
                data-testid={`quick-create-shape-${shape.id}`}
              >
                {shape.icon}
                <span className="text-[8px] font-medium mt-0.5 leading-tight">
                  {shape.label.slice(0, 4)}
                </span>
              </button>
            </div>
          );
        })}

        {/* Back button when in shape submenu */}
        {showShapeSubmenu && (
          <button
            className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-[70px] px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-md radial-sector-enter"
            onClick={() => setShowShapeSubmenu(false)}
            style={{ animationDelay: '200ms' }}
            data-testid="quick-create-shape-back"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
};

export default QuickCreateRadialMenu;
