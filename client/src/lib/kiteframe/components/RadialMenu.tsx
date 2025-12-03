import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Palette, 
  Type, 
  Brush, 
  Smile, 
  Trash2, 
  X,
  Minus,
  Circle,
  Square
} from 'lucide-react';
import type { Node, Edge, NodeColors } from '../types';

interface RadialMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  target: { type: 'node' | 'edge'; id: string } | null;
  node?: Node;
  edge?: Edge;
  onClose: () => void;
  onColorChange?: (colors: Partial<NodeColors>) => void;
  onEdgeColorChange?: (color: string) => void;
  onTextEdit?: () => void;
  onStyleChange?: (style: { borderStyle?: string; borderWidth?: number; strokeWidth?: number }) => void;
  onEmojiSelect?: (emoji: string) => void;
  onDelete?: () => void;
  scale?: number;
}

interface RadialSector {
  id: string;
  icon: React.ReactNode;
  label: string;
  angle: number;
  color: string;
  hoverColor: string;
  onClick?: () => void;
  submenu?: React.ReactNode;
}

const COLOR_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#06b6d4', '#6366f1',
  '#64748b', '#1e293b', '#ffffff', '#f1f5f9', '#fef3c7'
];

const STROKE_WIDTHS = [1, 2, 3, 4, 6];
const BORDER_STYLES = ['solid', 'dashed', 'dotted'];

const QUICK_EMOJIS = ['👍', '❤️', '⭐', '🔥', '💡', '✅', '❌', '🎉'];

export const RadialMenu: React.FC<RadialMenuProps> = ({
  isOpen,
  position,
  target,
  node,
  edge,
  onClose,
  onColorChange,
  onEdgeColorChange,
  onTextEdit,
  onStyleChange,
  onEmojiSelect,
  onDelete,
  scale = 1
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isNodeTarget = target?.type === 'node';
  const isEdgeTarget = target?.type === 'edge';

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    } else {
      setActiveSubmenu(null);
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
        if (activeSubmenu) {
          setActiveSubmenu(null);
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
  }, [isOpen, activeSubmenu, onClose]);

  const handleSectorClick = useCallback((sectorId: string, onClick?: () => void) => {
    if (onClick) {
      onClick();
    } else {
      setActiveSubmenu(activeSubmenu === sectorId ? null : sectorId);
    }
  }, [activeSubmenu]);

  const radius = 70;
  const sectorSize = 44;
  const submenuRadius = 130;

  const sectors: RadialSector[] = isNodeTarget ? [
    {
      id: 'color',
      icon: <Palette size={18} />,
      label: 'Color',
      angle: -90,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600'
    },
    {
      id: 'text',
      icon: <Type size={18} />,
      label: 'Text',
      angle: -30,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
      onClick: onTextEdit
    },
    {
      id: 'style',
      icon: <Brush size={18} />,
      label: 'Style',
      angle: 30,
      color: 'bg-emerald-500',
      hoverColor: 'hover:bg-emerald-600'
    },
    {
      id: 'emoji',
      icon: <Smile size={18} />,
      label: 'Emoji',
      angle: 90,
      color: 'bg-amber-500',
      hoverColor: 'hover:bg-amber-600'
    },
    {
      id: 'delete',
      icon: <Trash2 size={18} />,
      label: 'Delete',
      angle: 150,
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-600',
      onClick: () => { onDelete?.(); onClose(); }
    }
  ] : [
    {
      id: 'color',
      icon: <Palette size={18} />,
      label: 'Color',
      angle: -90,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600'
    },
    {
      id: 'style',
      icon: <Brush size={18} />,
      label: 'Style',
      angle: 0,
      color: 'bg-emerald-500',
      hoverColor: 'hover:bg-emerald-600'
    },
    {
      id: 'text',
      icon: <Type size={18} />,
      label: 'Label',
      angle: 90,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
      onClick: onTextEdit
    },
    {
      id: 'delete',
      icon: <Trash2 size={18} />,
      label: 'Delete',
      angle: 180,
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-600',
      onClick: () => { onDelete?.(); onClose(); }
    }
  ];

  const renderColorSubmenu = () => {
    const baseAngle = sectors.find(s => s.id === 'color')?.angle || -90;
    return (
      <div 
        className="absolute transition-all duration-200"
        style={{
          transform: `rotate(${baseAngle}deg)`,
          transformOrigin: 'center center'
        }}
      >
        <div 
          className="flex gap-1 p-2 bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-200 dark:border-gray-700"
          style={{
            transform: `translateY(-${submenuRadius}px) rotate(${-baseAngle}deg)`
          }}
        >
          {COLOR_PALETTE.map((color, i) => (
            <button
              key={color}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-transform hover:scale-125",
                color === '#ffffff' ? 'border-gray-300' : 'border-transparent'
              )}
              style={{ 
                backgroundColor: color,
                animationDelay: `${i * 30}ms`
              }}
              onClick={() => {
                if (isNodeTarget && onColorChange) {
                  onColorChange({ 
                    headerBackground: color,
                    borderColor: color
                  });
                } else if (isEdgeTarget && onEdgeColorChange) {
                  onEdgeColorChange(color);
                }
                setActiveSubmenu(null);
              }}
              data-testid={`radial-color-${color.replace('#', '')}`}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderStyleSubmenu = () => {
    const baseAngle = sectors.find(s => s.id === 'style')?.angle || 30;
    return (
      <div 
        className="absolute transition-all duration-200"
        style={{
          transform: `rotate(${baseAngle}deg)`,
          transformOrigin: 'center center'
        }}
      >
        <div 
          className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700"
          style={{
            transform: `translateY(-${submenuRadius}px) rotate(${-baseAngle}deg)`
          }}
        >
          {isNodeTarget ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Border Style</div>
              <div className="flex gap-2">
                {BORDER_STYLES.map((style) => (
                  <button
                    key={style}
                    className={cn(
                      "w-10 h-8 rounded border-2 bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                      node?.data?.borderStyle === style && "ring-2 ring-blue-500"
                    )}
                    style={{
                      borderStyle: style as any,
                      borderColor: '#64748b'
                    }}
                    onClick={() => {
                      onStyleChange?.({ borderStyle: style });
                      setActiveSubmenu(null);
                    }}
                    data-testid={`radial-style-${style}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Stroke Width</div>
              <div className="flex gap-2 items-center">
                {STROKE_WIDTHS.map((width) => (
                  <button
                    key={width}
                    className={cn(
                      "w-8 h-8 rounded flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                      edge?.style?.strokeWidth === width && "ring-2 ring-blue-500"
                    )}
                    onClick={() => {
                      onStyleChange?.({ strokeWidth: width });
                      setActiveSubmenu(null);
                    }}
                    data-testid={`radial-stroke-${width}`}
                  >
                    <div 
                      className="bg-gray-600 dark:bg-gray-300 rounded-full" 
                      style={{ width: '100%', height: `${width}px` }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEmojiSubmenu = () => {
    const baseAngle = sectors.find(s => s.id === 'emoji')?.angle || 90;
    return (
      <div 
        className="absolute transition-all duration-200"
        style={{
          transform: `rotate(${baseAngle}deg)`,
          transformOrigin: 'center center'
        }}
      >
        <div 
          className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-200 dark:border-gray-700 flex gap-1"
          style={{
            transform: `translateY(-${submenuRadius}px) rotate(${-baseAngle}deg)`
          }}
        >
          {QUICK_EMOJIS.map((emoji, i) => (
            <button
              key={emoji}
              className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-lg transition-transform hover:scale-125"
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => {
                onEmojiSelect?.(emoji);
                setActiveSubmenu(null);
              }}
              data-testid={`radial-emoji-${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] pointer-events-auto radial-menu-enter"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
      }}
      data-testid="radial-menu"
    >
      <div className="relative">
        <button
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center z-10 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          onClick={onClose}
          data-testid="radial-menu-close"
        >
          <X size={16} className="text-gray-500" />
        </button>

        {sectors.map((sector, index) => {
          const angleRad = (sector.angle * Math.PI) / 180;
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius;
          const isActive = activeSubmenu === sector.id;

          return (
            <div
              key={sector.id}
              className="absolute left-1/2 top-1/2 radial-sector-enter"
              style={{
                left: x,
                top: y,
                animationDelay: `${index * 50}ms`
              }}
            >
              <button
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200",
                  sector.color,
                  sector.hoverColor,
                  isActive && "ring-2 ring-white ring-offset-2 scale-110",
                  "hover:scale-110 active:scale-95"
                )}
                onClick={() => handleSectorClick(sector.id, sector.onClick)}
                title={sector.label}
                data-testid={`radial-sector-${sector.id}`}
              >
                {sector.icon}
              </button>
            </div>
          );
        })}

        {activeSubmenu === 'color' && renderColorSubmenu()}
        {activeSubmenu === 'style' && renderStyleSubmenu()}
        {activeSubmenu === 'emoji' && renderEmojiSubmenu()}
      </div>
    </div>
  );
};

export default RadialMenu;
