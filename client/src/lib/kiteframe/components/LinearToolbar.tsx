import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Palette, 
  Type, 
  Brush, 
  Smile, 
  Trash2,
  X,
  Ban,
  Eye,
  EyeOff,
  Bold,
  Italic,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  ArrowLeftRight,
  Minus,
  MoveRight,
  Circle,
  Diamond,
  ArrowRight,
  ChevronDown,
  Zap,
  Sparkles
} from 'lucide-react';
import type { Node, Edge, NodeColors, CanvasObject, EdgeMarker } from '../types';

interface LinearToolbarProps {
  isOpen: boolean;
  position: { x: number; y: number };
  nodeRect?: { top: number; bottom: number; left: number; right: number; width: number };
  viewportHeight?: number;
  target: { type: 'node' | 'edge' | 'canvasObject'; id: string } | null;
  node?: Node;
  edge?: Edge;
  canvasObject?: CanvasObject;
  onClose: () => void;
  onColorChange?: (colors: Partial<NodeColors>) => void;
  onEdgeColorChange?: (color: string) => void;
  onTextEdit?: () => void;
  onStyleChange?: (style: { 
    borderStyle?: string; 
    borderWidth?: number; 
    strokeWidth?: number;
    noStroke?: boolean;
  }) => void;
  onIconSelect?: (iconData: { 
    icon?: string; 
    emoji?: string; 
    visible: boolean;
  }) => void;
  onTextStyleChange?: (style: {
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    align?: 'left' | 'center' | 'right';
  }) => void;
  onAddLink?: () => void;
  onDelete?: () => void;
  onEdgeStyleChange?: (style: {
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    strokeWidth?: number;
    lineType?: 'straight' | 'bezier' | 'step';
    markerStart?: EdgeMarker | boolean;
    markerEnd?: EdgeMarker | boolean;
    animated?: boolean;
  }) => void;
  onEdgeDirectionSwap?: () => void;
  onWireframe?: () => void;
  canUseWireframe?: boolean;
  onCanvasObjectColorChange?: (color: string) => void;
  onCanvasObjectStyleChange?: (style: {
    borderStyle?: string;
    borderWidth?: number;
    strokeStyle?: string;
    strokeWidth?: number;
  }) => void;
  onCanvasObjectTextStyleChange?: (style: {
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    textAlign?: 'left' | 'center' | 'right';
  }) => void;
  scale?: number;
}

type EndpointType = 'none' | 'arrow' | 'circle' | 'diamond';

interface ToolbarButton {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  hoverColor: string;
  onClick?: () => void;
  hasSubmenu?: boolean;
}

const COLOR_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#06b6d4', '#6366f1',
  '#64748b', '#1e293b', '#ffffff', '#f1f5f9', '#fef3c7'
];

// Utility to create a tinted body color from header color (10% intensity)
const getTintedBodyColor = (headerColor: string, intensity: number = 0.1): string => {
  let r = 248, g = 250, b = 252; // Default light gray
  
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
  } else if (headerColor.startsWith('rgb')) {
    const match = headerColor.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  }
  
  // Mix with white at the given intensity (10% color, 90% white)
  const mixedR = Math.round(255 * (1 - intensity) + r * intensity);
  const mixedG = Math.round(255 * (1 - intensity) + g * intensity);
  const mixedB = Math.round(255 * (1 - intensity) + b * intensity);
  
  return `#${mixedR.toString(16).padStart(2, '0')}${mixedG.toString(16).padStart(2, '0')}${mixedB.toString(16).padStart(2, '0')}`;
};

const STROKE_WIDTHS = [1, 2, 3, 4, 6];
const BORDER_STYLES = ['solid', 'dashed', 'dotted'];
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24];

const QUICK_ICONS = [
  { name: 'star', emoji: '⭐' },
  { name: 'heart', emoji: '❤️' },
  { name: 'check', emoji: '✅' },
  { name: 'cross', emoji: '❌' },
  { name: 'fire', emoji: '🔥' },
  { name: 'bolt', emoji: '⚡' },
  { name: 'idea', emoji: '💡' },
  { name: 'warning', emoji: '⚠️' },
  { name: 'info', emoji: 'ℹ️' },
  { name: 'flag', emoji: '🚩' },
  { name: 'target', emoji: '🎯' },
  { name: 'rocket', emoji: '🚀' }
];

export const LinearToolbar: React.FC<LinearToolbarProps> = ({
  isOpen,
  position,
  nodeRect,
  viewportHeight = window.innerHeight,
  target,
  node,
  edge,
  canvasObject,
  onClose,
  onColorChange,
  onEdgeColorChange,
  onTextEdit,
  onStyleChange,
  onIconSelect,
  onTextStyleChange,
  onAddLink,
  onDelete,
  onEdgeStyleChange,
  onEdgeDirectionSwap,
  onWireframe,
  canUseWireframe = false,
  onCanvasObjectColorChange,
  onCanvasObjectStyleChange,
  onCanvasObjectTextStyleChange,
  scale = 1
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [iconVisible, setIconVisible] = useState(node?.data?.iconVisible ?? true);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  // Sync icon visibility and reset submenu when node changes
  useEffect(() => {
    setIconVisible(node?.data?.iconVisible ?? true);
    setActiveSubmenu(null);
  }, [node?.id, node?.data?.iconVisible]);

  const isNodeTarget = target?.type === 'node';
  const isEdgeTarget = target?.type === 'edge';
  const isCanvasObjectTarget = target?.type === 'canvasObject';

  // Determine if toolbar should appear above or below
  const toolbarHeight = 60;
  const submenuHeight = 150;
  const spaceAbove = nodeRect ? nodeRect.top : position.y;
  const spaceBelow = nodeRect ? viewportHeight - nodeRect.bottom : viewportHeight - position.y;
  const showAbove = spaceAbove > (toolbarHeight + submenuHeight) || spaceAbove > spaceBelow;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && !menuRef.current.contains(target)) {
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

  const handleButtonClick = useCallback((buttonId: string, onClick?: () => void, hasSubmenu?: boolean) => {
    if (onClick) {
      onClick();
    } else if (hasSubmenu) {
      setActiveSubmenu(activeSubmenu === buttonId ? null : buttonId);
    }
  }, [activeSubmenu]);

  // Build buttons based on target type
  const getButtons = (): ToolbarButton[] => {
    if (isNodeTarget) {
      return [
        {
          id: 'color',
          icon: <Palette size={18} />,
          label: 'Color',
          color: 'bg-blue-500',
          hoverColor: 'hover:bg-blue-600',
          hasSubmenu: true
        },
        {
          id: 'text',
          icon: <Type size={18} />,
          label: 'Text Style',
          color: 'bg-purple-500',
          hoverColor: 'hover:bg-purple-600',
          hasSubmenu: true
        },
        {
          id: 'style',
          icon: <Brush size={18} />,
          label: 'Border Style',
          color: 'bg-emerald-500',
          hoverColor: 'hover:bg-emerald-600',
          hasSubmenu: true
        },
        {
          id: 'icon',
          icon: <Smile size={18} />,
          label: 'Icon/Emoji',
          color: 'bg-amber-500',
          hoverColor: 'hover:bg-amber-600',
          hasSubmenu: true
        },
        {
          id: 'link',
          icon: <Link2 size={18} />,
          label: 'Add Link',
          color: 'bg-cyan-500',
          hoverColor: 'hover:bg-cyan-600',
          onClick: onAddLink
        },
        {
          id: 'delete',
          icon: <Trash2 size={18} />,
          label: 'Delete',
          color: 'bg-red-500',
          hoverColor: 'hover:bg-red-600',
          onClick: () => { onDelete?.(); onClose(); }
        }
      ];
    } else if (isEdgeTarget) {
      return [
        {
          id: 'color',
          icon: <Palette size={18} />,
          label: 'Color',
          color: 'bg-blue-500',
          hoverColor: 'hover:bg-blue-600',
          hasSubmenu: true
        },
        {
          id: 'direction',
          icon: <ArrowLeftRight size={18} />,
          label: 'Swap Direction',
          color: 'bg-purple-500',
          hoverColor: 'hover:bg-purple-600',
          onClick: () => { onEdgeDirectionSwap?.(); }
        },
        {
          id: 'strokeStyle',
          icon: <Minus size={18} />,
          label: 'Stroke Style',
          color: 'bg-emerald-500',
          hoverColor: 'hover:bg-emerald-600',
          hasSubmenu: true
        },
        {
          id: 'lineType',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 20 C 8 20, 8 4, 12 4 C 16 4, 16 20, 20 20" />
            </svg>
          ),
          label: 'Line Type',
          color: 'bg-cyan-500',
          hoverColor: 'hover:bg-cyan-600',
          hasSubmenu: true
        },
        {
          id: 'endpoints',
          icon: <MoveRight size={18} />,
          label: 'Endpoints',
          color: 'bg-amber-500',
          hoverColor: 'hover:bg-amber-600',
          hasSubmenu: true
        },
        {
          id: 'delete',
          icon: <Trash2 size={18} />,
          label: 'Delete',
          color: 'bg-red-500',
          hoverColor: 'hover:bg-red-600',
          onClick: () => { onDelete?.(); onClose(); }
        }
      ];
    } else if (isCanvasObjectTarget) {
      // Sticky notes, text objects, shapes
      const objType = canvasObject?.type;
      const buttons: ToolbarButton[] = [
        {
          id: 'color',
          icon: <Palette size={18} />,
          label: 'Color',
          color: 'bg-blue-500',
          hoverColor: 'hover:bg-blue-600',
          hasSubmenu: true
        }
      ];
      
      if (objType === 'sticky' || objType === 'text') {
        buttons.push({
          id: 'text',
          icon: <Type size={18} />,
          label: 'Text Style',
          color: 'bg-purple-500',
          hoverColor: 'hover:bg-purple-600',
          hasSubmenu: true
        });
      }
      
      // Style button for shapes and sticky notes (stroke/border style)
      if (objType === 'shape' || objType === 'sticky') {
        buttons.push({
          id: 'style',
          icon: <Brush size={18} />,
          label: objType === 'shape' ? 'Stroke Style' : 'Border Style',
          color: 'bg-emerald-500',
          hoverColor: 'hover:bg-emerald-600',
          hasSubmenu: true
        });
      }
      
      buttons.push({
        id: 'delete',
        icon: <Trash2 size={18} />,
        label: 'Delete',
        color: 'bg-red-500',
        hoverColor: 'hover:bg-red-600',
        onClick: () => { onDelete?.(); onClose(); }
      });
      
      return buttons;
    }
    
    return [];
  };

  const buttons = getButtons();

  const renderColorSubmenu = () => (
    <div 
      ref={submenuRef}
      className={cn(
        "absolute left-1/2 -translate-x-1/2 flex gap-1 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150",
        showAbove ? "bottom-full mb-2" : "top-full mt-2"
      )}
    >
      {COLOR_PALETTE.map((color) => (
        <button
          key={color}
          className={cn(
            "w-7 h-7 rounded-full border-2 transition-transform hover:scale-125",
            color === '#ffffff' ? 'border-gray-300' : 'border-transparent'
          )}
          style={{ backgroundColor: color }}
          onClick={() => {
            if (isNodeTarget && onColorChange) {
              // White color uses default theme colors
              if (color === '#ffffff') {
                onColorChange({ 
                  headerBackground: '#f8fafc',
                  bodyBackground: '#ffffff',
                  borderColor: '#e2e8f0'
                });
              } else {
                onColorChange({ 
                  headerBackground: color,
                  bodyBackground: getTintedBodyColor(color, 0.1),
                  borderColor: color
                });
              }
            } else if (isEdgeTarget && onEdgeColorChange) {
              onEdgeColorChange(color);
            } else if (isCanvasObjectTarget && onCanvasObjectColorChange) {
              onCanvasObjectColorChange(color);
            }
          }}
          data-testid={`toolbar-color-${color.replace('#', '')}`}
        />
      ))}
    </div>
  );

  const renderStyleSubmenu = () => {
    // Determine the current style based on target type
    // For shapes, use strokeStyle; for nodes/sticky/text, use borderStyle
    const isShape = isCanvasObjectTarget && canvasObject?.type === 'shape';
    const currentStyle = isShape 
      ? canvasObject?.data?.strokeStyle 
      : isCanvasObjectTarget 
        ? canvasObject?.data?.borderStyle 
        : node?.data?.borderStyle;
    const hasNoStroke = isNodeTarget ? node?.data?.noStroke : false; // Only nodes support noStroke
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        <div className="space-y-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {isShape ? 'Stroke Style' : 'Border Style'}
          </div>
          <div className="flex gap-2">
            {/* No stroke option - only for nodes */}
            {isNodeTarget && (
              <button
                className={cn(
                  "w-10 h-8 rounded border-2 bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110 flex items-center justify-center",
                  hasNoStroke && "ring-2 ring-blue-500"
                )}
                onClick={() => {
                  onStyleChange?.({ noStroke: true });
                }}
                title="No stroke"
                data-testid="toolbar-style-none"
              >
                <Ban size={16} className="text-gray-400" />
              </button>
            )}
            {BORDER_STYLES.map((style) => (
              <button
                key={style}
                className={cn(
                  "w-10 h-8 rounded border-2 bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                  currentStyle === style && !hasNoStroke && "ring-2 ring-blue-500"
                )}
                style={{
                  borderStyle: style as any,
                  borderColor: '#64748b'
                }}
                onClick={() => {
                  if (isNodeTarget) {
                    onStyleChange?.({ borderStyle: style, noStroke: false });
                  } else if (isCanvasObjectTarget) {
                    // Use strokeStyle for shapes, borderStyle for others
                    if (isShape) {
                      onCanvasObjectStyleChange?.({ strokeStyle: style });
                    } else {
                      onCanvasObjectStyleChange?.({ borderStyle: style });
                    }
                  }
                }}
                data-testid={`toolbar-style-${style}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Helper to get current stroke style from edge
  const getEdgeStrokeStyle = (): 'solid' | 'dashed' | 'dotted' => {
    const dasharray = edge?.style?.strokeDasharray;
    const linecap = edge?.style?.strokeLinecap;
    if (!dasharray || dasharray === 'none') return 'solid';
    // Dotted uses round linecap with small dash pattern
    if (linecap === 'round' || dasharray.includes('0.1')) return 'dotted';
    return 'dashed';
  };

  // Helper to get endpoint type
  const getEndpointType = (marker: EdgeMarker | boolean | undefined): EndpointType => {
    if (marker === undefined || marker === null || marker === false) return 'none';
    if (marker === true) return 'arrow';
    if (typeof marker === 'object' && marker !== null) {
      return (marker.type as EndpointType) || 'arrow';
    }
    return 'none';
  };

  const renderStrokeStyleSubmenu = () => (
    <div 
      ref={submenuRef}
      className={cn(
        "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150 min-w-[200px]",
        showAbove ? "bottom-full mb-2" : "top-full mt-2"
      )}
    >
      <div className="space-y-3">
        {/* Stroke Style */}
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Stroke Style</div>
          <div className="flex gap-2">
            {[
              { id: 'solid', label: 'Solid', dasharray: 'none', linecap: 'butt' as const },
              { id: 'dashed', label: 'Dashed', dasharray: '8 4', linecap: 'butt' as const },
              { id: 'dotted', label: 'Dotted', dasharray: '0.1 6', linecap: 'round' as const }
            ].map((style) => (
              <button
                type="button"
                key={style.id}
                className={cn(
                  "w-12 h-8 rounded bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110 flex items-center justify-center px-1",
                  getEdgeStrokeStyle() === style.id && "ring-2 ring-blue-500"
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log('Stroke style clicked:', style.id);
                  onEdgeStyleChange?.({ strokeStyle: style.id as 'solid' | 'dashed' | 'dotted' });
                }}
                title={style.label}
                data-testid={`toolbar-stroke-${style.id}`}
              >
                <svg width="40" height="6" viewBox="0 0 40 6" className="pointer-events-none">
                  <line 
                    x1="2" y1="3" x2="38" y2="3" 
                    stroke="currentColor" 
                    strokeWidth="3"
                    strokeLinecap={style.linecap}
                    strokeDasharray={style.dasharray === 'none' ? undefined : style.dasharray}
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
        
        {/* Stroke Width */}
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Stroke Width</div>
          <div className="flex gap-2 items-center">
            {STROKE_WIDTHS.map((width) => (
              <button
                type="button"
                key={width}
                className={cn(
                  "w-8 h-8 rounded flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                  (edge?.style?.strokeWidth || 2) === width && "ring-2 ring-blue-500"
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onEdgeStyleChange?.({ strokeWidth: width });
                }}
                data-testid={`toolbar-stroke-width-${width}`}
              >
                <div 
                  className="bg-gray-600 dark:bg-gray-300 rounded-full w-full" 
                  style={{ height: `${width}px` }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLineTypeSubmenu = () => {
    const isAnimated = edge?.animated ?? false;
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Line Type</div>
          <div className="flex gap-2 items-center">
            {[
              { id: 'bezier', label: 'Bezier', path: 'M4 20 C 8 20, 8 4, 12 4 C 16 4, 16 20, 20 20' },
              { id: 'step', label: 'Step', path: 'M4 20 L4 12 L20 12 L20 4' },
              { id: 'straight', label: 'Straight', path: 'M4 20 L20 4' }
            ].map((type) => (
              <button
                type="button"
                key={type.id}
                className={cn(
                  "w-12 h-10 rounded bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110 flex items-center justify-center",
                  (edge?.type || 'bezier') === type.id && "ring-2 ring-blue-500"
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onEdgeStyleChange?.({ lineType: type.id as 'straight' | 'bezier' | 'step' });
                }}
                title={type.label}
                data-testid={`toolbar-line-${type.id}`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={type.path} />
                </svg>
              </button>
            ))}
            
            {/* Divider */}
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-600 mx-1" />
            
            {/* Animated Toggle */}
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors",
                isAnimated 
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" 
                  : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              )}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onEdgeStyleChange?.({ animated: !isAnimated });
              }}
              title={isAnimated ? "Turn off animation" : "Turn on animation"}
              data-testid="toolbar-animated-toggle"
            >
              <Zap size={14} className={cn("pointer-events-none", isAnimated && "fill-current")} />
              <span className="text-xs font-medium pointer-events-none">Animated</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEndpointsSubmenu = () => {
    const startType = getEndpointType(edge?.markerStart);
    const endType = getEndpointType(edge?.markerEnd);
    
    const endpointOptions: { id: EndpointType; label: string; icon: React.ReactNode }[] = [
      { 
        id: 'none', 
        label: 'None (Round)',
        icon: <span className="pointer-events-none"><Minus size={16} /></span>
      },
      { 
        id: 'arrow', 
        label: 'Arrow',
        icon: <span className="pointer-events-none"><ArrowRight size={16} /></span>
      },
      { 
        id: 'circle', 
        label: 'Dot',
        icon: <span className="pointer-events-none"><Circle size={14} /></span>
      },
      { 
        id: 'diamond', 
        label: 'Diamond',
        icon: <span className="pointer-events-none"><Diamond size={14} /></span>
      }
    ];
    
    const createMarker = (type: EndpointType): EdgeMarker | boolean => {
      if (type === 'none') return false;
      if (type === 'arrow') return true;
      return { type: type as any, size: 8 };
    };
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150 min-w-[240px]",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        <div className="space-y-3">
          {/* Start Endpoint */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Start Point</div>
            <div className="flex gap-1">
              {endpointOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  className={cn(
                    "w-10 h-8 rounded bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110 flex items-center justify-center",
                    startType === opt.id && "ring-2 ring-blue-500"
                  )}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Start endpoint clicked:', opt.id);
                    onEdgeStyleChange?.({ markerStart: createMarker(opt.id) });
                  }}
                  title={opt.label}
                  data-testid={`toolbar-start-${opt.id}`}
                >
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>
          
          {/* End Endpoint */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">End Point</div>
            <div className="flex gap-1">
              {endpointOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  className={cn(
                    "w-10 h-8 rounded bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110 flex items-center justify-center",
                    endType === opt.id && "ring-2 ring-blue-500"
                  )}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('End endpoint clicked:', opt.id);
                    onEdgeStyleChange?.({ markerEnd: createMarker(opt.id) });
                  }}
                  title={opt.label}
                  data-testid={`toolbar-end-${opt.id}`}
                >
                  {opt.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTextSubmenu = () => {
    // Get node data for nodes, canvas object data for canvas objects
    const nodeData = node?.data;
    const objData = canvasObject?.data;
    
    // Determine current fontSize - same property name for both
    const currentFontSize = isCanvasObjectTarget ? objData?.fontSize : nodeData?.fontSize;
    
    // Determine if bold is active
    // For nodes: uses 'bold' boolean
    // For canvas objects: uses 'fontWeight' = 'bold' | 'normal'
    const isBold = isCanvasObjectTarget 
      ? objData?.fontWeight === 'bold' 
      : nodeData?.bold;
    
    // Determine if italic is active
    // For nodes: uses 'italic' boolean
    // For canvas objects: uses 'textDecoration' containing 'italic'
    const isItalic = isCanvasObjectTarget 
      ? (objData?.textDecoration || '').includes('italic')
      : nodeData?.italic;
    
    // Determine if strikethrough is active
    // For nodes: uses 'strikethrough' boolean
    // For canvas objects: uses 'textDecoration' containing 'line-through'
    const isStrikethrough = isCanvasObjectTarget 
      ? (objData?.textDecoration || '').includes('line-through')
      : nodeData?.strikethrough;
    
    // Determine current text alignment
    const currentAlign = isCanvasObjectTarget ? objData?.textAlign : nodeData?.textAlign;
    
    const handleFontSizeChange = (size: number) => {
      if (isNodeTarget) {
        onTextStyleChange?.({ fontSize: size });
      } else if (isCanvasObjectTarget) {
        onCanvasObjectTextStyleChange?.({ fontSize: size });
      }
    };
    
    const handleBoldToggle = () => {
      if (isNodeTarget) {
        onTextStyleChange?.({ bold: !nodeData?.bold });
      } else if (isCanvasObjectTarget) {
        // Toggle between 'bold' and 'normal'
        const newBold = objData?.fontWeight !== 'bold';
        onCanvasObjectTextStyleChange?.({ bold: newBold });
      }
    };
    
    const handleItalicToggle = () => {
      if (isNodeTarget) {
        onTextStyleChange?.({ italic: !nodeData?.italic });
      } else if (isCanvasObjectTarget) {
        // Toggle italic in textDecoration
        const currentDecoration = objData?.textDecoration || 'none';
        const newItalic = !currentDecoration.includes('italic');
        onCanvasObjectTextStyleChange?.({ italic: newItalic });
      }
    };
    
    const handleStrikethroughToggle = () => {
      if (isNodeTarget) {
        onTextStyleChange?.({ strikethrough: !nodeData?.strikethrough });
      } else if (isCanvasObjectTarget) {
        // Toggle line-through in textDecoration
        const currentDecoration = objData?.textDecoration || 'none';
        const newStrikethrough = !currentDecoration.includes('line-through');
        onCanvasObjectTextStyleChange?.({ strikethrough: newStrikethrough });
      }
    };
    
    const handleAlignChange = (align: 'left' | 'center' | 'right') => {
      if (isNodeTarget) {
        onTextStyleChange?.({ align });
      } else if (isCanvasObjectTarget) {
        onCanvasObjectTextStyleChange?.({ textAlign: align });
      }
    };
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 min-w-[280px] animate-in fade-in-0 zoom-in-95 duration-150",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        <div className="space-y-3">
          {/* Font Size */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Font Size</div>
            <div className="flex gap-1">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  className={cn(
                    "w-8 h-8 rounded text-xs font-medium bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-600",
                    currentFontSize === size && "ring-2 ring-blue-500"
                  )}
                  onClick={() => handleFontSizeChange(size)}
                  data-testid={`toolbar-fontsize-${size}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Text Style */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Style</div>
            <div className="flex gap-2">
              <button
                className={cn(
                  "w-9 h-9 rounded flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                  isBold && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900"
                )}
                onClick={handleBoldToggle}
                title="Bold"
                data-testid="toolbar-text-bold"
              >
                <Bold size={16} />
              </button>
              <button
                className={cn(
                  "w-9 h-9 rounded flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                  isItalic && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900"
                )}
                onClick={handleItalicToggle}
                title="Italic"
                data-testid="toolbar-text-italic"
              >
                <Italic size={16} />
              </button>
              <button
                className={cn(
                  "w-9 h-9 rounded flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                  isStrikethrough && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900"
                )}
                onClick={handleStrikethroughToggle}
                title="Strikethrough"
                data-testid="toolbar-text-strikethrough"
              >
                <Strikethrough size={16} />
              </button>
            </div>
          </div>

          {/* Alignment */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Alignment</div>
            <div className="flex gap-2">
              <button
                className={cn(
                  "w-9 h-9 rounded flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                  (currentAlign === 'left' || !currentAlign) && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900"
                )}
                onClick={() => handleAlignChange('left')}
                title="Align Left"
                data-testid="toolbar-align-left"
              >
                <AlignLeft size={16} />
              </button>
              <button
                className={cn(
                  "w-9 h-9 rounded flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                  currentAlign === 'center' && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900"
                )}
                onClick={() => handleAlignChange('center')}
                title="Align Center"
                data-testid="toolbar-align-center"
              >
                <AlignCenter size={16} />
              </button>
              <button
                className={cn(
                  "w-9 h-9 rounded flex items-center justify-center bg-gray-50 dark:bg-gray-700 transition-all hover:scale-110",
                  currentAlign === 'right' && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900"
                )}
                onClick={() => handleAlignChange('right')}
                title="Align Right"
                data-testid="toolbar-align-right"
              >
                <AlignRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderIconSubmenu = () => {
    const headerColor = node?.data?.colors?.headerBackground || '#8b5cf6';
    const bgColor = headerColor + '80'; // 50% opacity
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 min-w-[260px] animate-in fade-in-0 zoom-in-95 duration-150",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        <div className="space-y-3">
          {/* Visibility Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Icon Visibility</span>
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors",
                iconVisible 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" 
                  : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              )}
              onClick={() => {
                const newVisible = !iconVisible;
                setIconVisible(newVisible);
                // Preserve the existing emoji when toggling visibility
                // If enabling and no emoji exists, use a default star emoji
                const emojiToUse = node?.data?.nodeIcon || (newVisible ? '⭐' : undefined);
                console.log('🔘 Icon visibility toggle:', {
                  oldVisible: iconVisible,
                  newVisible,
                  existingIcon: node?.data?.nodeIcon,
                  emojiToUse,
                  nodeId: node?.id
                });
                onIconSelect?.({ emoji: emojiToUse, visible: newVisible });
              }}
              data-testid="toolbar-icon-visibility"
            >
              {iconVisible ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="text-xs font-medium">{iconVisible ? 'Visible' : 'Hidden'}</span>
            </button>
          </div>

          {/* Icon/Emoji Grid */}
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Select Icon</div>
            <div className="grid grid-cols-6 gap-1">
              {QUICK_ICONS.map((icon) => (
                <button
                  key={icon.name}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all hover:scale-110",
                    node?.data?.nodeIcon === icon.emoji && "ring-2 ring-blue-500"
                  )}
                  style={{ backgroundColor: bgColor }}
                  onClick={() => {
                    // Auto-enable visibility when selecting an icon while hidden
                    const shouldBeVisible = true;
                    if (!iconVisible) {
                      setIconVisible(true);
                    }
                    onIconSelect?.({ emoji: icon.emoji, visible: shouldBeVisible });
                  }}
                  title={icon.name}
                  data-testid={`toolbar-icon-${icon.name}`}
                >
                  {icon.emoji}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  // Calculate toolbar position
  const toolbarX = nodeRect ? nodeRect.left + nodeRect.width / 2 : position.x;
  const toolbarY = showAbove 
    ? (nodeRect ? nodeRect.top - 16 : position.y - 60)
    : (nodeRect ? nodeRect.bottom + 16 : position.y + 60);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] pointer-events-auto"
      style={{
        left: toolbarX,
        top: toolbarY,
        transform: 'translate(-50%, -50%)'
      }}
      data-testid="linear-toolbar"
    >
      <div className="relative">
        {/* Main toolbar - horizontal row of circular buttons */}
        <div className="flex items-center gap-2 p-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-full shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-200">
          {buttons.filter(b => b.id !== 'delete').map((button, index) => {
            const isActive = activeSubmenu === button.id;
            return (
              <button
                key={button.id}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-200",
                  button.color,
                  button.hoverColor,
                  isActive && "ring-2 ring-white ring-offset-2 scale-110",
                  "hover:scale-110 active:scale-95"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => handleButtonClick(button.id, button.onClick, button.hasSubmenu)}
                title={button.label}
                data-testid={`toolbar-button-${button.id}`}
              >
                {button.icon}
              </button>
            );
          })}
          
          {/* Wireframe button - only for nodes */}
          {isNodeTarget && node?.type !== 'image' && (
            <button
              className={cn(
                "h-9 px-3 rounded-full flex items-center gap-1.5 text-white text-sm font-medium shadow-md transition-all duration-200",
                "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600",
                "hover:scale-105 active:scale-95 hover:shadow-lg",
                !canUseWireframe && "opacity-75"
              )}
              onClick={() => onWireframe?.()}
              title={canUseWireframe ? "Generate wireframe mockup" : "Upgrade to use Wireframe (Pro feature)"}
              data-testid="toolbar-button-wireframe"
            >
              <Sparkles size={14} className="text-white" />
              <span>Wireframe</span>
            </button>
          )}
          
          {/* Delete button always last */}
          {buttons.find(b => b.id === 'delete') && (
            <button
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-200",
                "bg-red-500 hover:bg-red-600",
                "hover:scale-110 active:scale-95"
              )}
              onClick={() => { onDelete?.(); onClose(); }}
              title="Delete"
              data-testid="toolbar-button-delete"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {/* Submenus */}
        {activeSubmenu === 'color' && renderColorSubmenu()}
        {activeSubmenu === 'style' && renderStyleSubmenu()}
        {activeSubmenu === 'text' && renderTextSubmenu()}
        {activeSubmenu === 'icon' && renderIconSubmenu()}
        {activeSubmenu === 'strokeStyle' && renderStrokeStyleSubmenu()}
        {activeSubmenu === 'lineType' && renderLineTypeSubmenu()}
        {activeSubmenu === 'endpoints' && renderEndpointsSubmenu()}
      </div>
    </div>
  );
};

export default LinearToolbar;
