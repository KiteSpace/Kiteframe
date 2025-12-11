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
  Link2Off,
  Link as LinkIcon,
  ArrowLeftRight,
  Minus,
  MoveRight,
  Circle,
  Diamond,
  ArrowRight,
  ChevronDown,
  Zap,
  Sparkles,
  Square,
  Triangle,
  Hexagon,
  PenTool,
  Plus,
  Lock
} from 'lucide-react';
import type { Node, Edge, NodeColors, CanvasObject, EdgeMarker, NodeHyperlink, OgMetadata } from '../types';
import { getOptimalTextColor } from '../utils/colorUtils';

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
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
  }, part?: 'header' | 'body') => void;
  onAddHyperlink?: (hyperlink: { 
    id?: string; // If provided, update existing; otherwise add new
    text: string; 
    url: string; 
    showPreview?: boolean;
    metadata?: OgMetadata;
  }) => void;
  onDeleteHyperlink?: (hyperlinkId: string) => void;
  hyperlinks?: NodeHyperlink[]; // Current hyperlinks for the node
  editingHyperlinkId?: string | null; // ID of hyperlink being edited
  selectedText?: string;
  onDelete?: () => void;
  onBreakDataLink?: () => void;
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
  onGenerateWorkflow?: () => void;
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
  onCanvasObjectFillStyleChange?: (fillStyle: 'solid' | 'transparent' | 'none') => void;
  onShapeTypeChange?: (shapeType: 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'line' | 'arrow' | 'polygon') => void;
  scale?: number;
  isInlineEditing?: boolean; // Show text style options when inline editing is active
  inlineEditingPart?: 'header' | 'body' | 'edgeLabel'; // Which part is being edited
  initialSubmenu?: string | null; // Submenu to open initially (e.g., 'link' to open link editor)
  onTextObjectHyperlinkChange?: (hyperlink: {
    url: string;
    text?: string;
    showPreview: boolean;
    showText: boolean;
    metadata?: OgMetadata;
  } | null) => void; // Callback for text object hyperlink changes
  onOpenComponentMenu?: () => void; // Callback for compound nodes to open component menu
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
  '#64748b', '#1e293b', '#ffffff'
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
  onAddHyperlink,
  onDeleteHyperlink,
  hyperlinks = [],
  editingHyperlinkId = null,
  selectedText = '',
  onDelete,
  onBreakDataLink,
  onEdgeStyleChange,
  onEdgeDirectionSwap,
  onWireframe,
  canUseWireframe = false,
  onGenerateWorkflow,
  onCanvasObjectColorChange,
  onCanvasObjectStyleChange,
  onCanvasObjectTextStyleChange,
  onCanvasObjectFillStyleChange,
  onShapeTypeChange,
  scale = 1,
  isInlineEditing = false,
  inlineEditingPart,
  initialSubmenu = null,
  onTextObjectHyperlinkChange,
  onOpenComponentMenu
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(initialSubmenu);
  const [iconVisible, setIconVisible] = useState(node?.data?.iconVisible ?? true);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  
  // Handle initialSubmenu prop changes (e.g., when edit hyperlink is requested)
  useEffect(() => {
    if (initialSubmenu) {
      setActiveSubmenu(initialSubmenu);
    }
  }, [initialSubmenu]);
  
  // Remember the editing part when text submenu opens (before blur clears inlineEditing state)
  const [rememberedEditingPart, setRememberedEditingPart] = useState<'header' | 'body' | undefined>(undefined);
  
  // Hyperlink input state
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMetadata, setPreviewMetadata] = useState<{
    title?: string;
    description?: string;
    favicon?: string;
    image?: string;
    siteName?: string;
  } | null>(null);
  
  // Text object hyperlink state
  const [textLinkUrl, setTextLinkUrl] = useState('');
  const [textLinkText, setTextLinkText] = useState('');
  const [textShowPreview, setTextShowPreview] = useState(false);
  const [textShowText, setTextShowText] = useState(true);
  const [textPreviewLoading, setTextPreviewLoading] = useState(false);
  const [textPreviewMetadata, setTextPreviewMetadata] = useState<{
    title?: string;
    description?: string;
    favicon?: string;
    image?: string;
    siteName?: string;
  } | null>(null);
  
  // Cache the selected text when link submenu opens (before blur clears it)
  const cachedSelectedTextRef = useRef('');
  
  // Pre-fill link inputs when link submenu opens
  useEffect(() => {
    if (activeSubmenu === 'link') {
      // Check for editing specific hyperlink (new multi-link system)
      const editingLink = editingHyperlinkId 
        ? hyperlinks.find(h => h.id === editingHyperlinkId)
        : null;
      
      // Fallback to legacy single hyperlink
      const legacyLink = node?.data?.hyperlink;
      
      const linkToEdit = editingLink || (legacyLink?.url ? legacyLink : null);
      
      if (linkToEdit?.text && linkToEdit?.url) {
        setLinkText(linkToEdit.text);
        setLinkUrl(linkToEdit.url);
        setShowPreview(linkToEdit.showPreview ?? false);
        setPreviewMetadata(linkToEdit.metadata ?? null);
      } else {
        setLinkText('');
        setLinkUrl('');
        setShowPreview(false);
        setPreviewMetadata(null);
      }
    }
  }, [activeSubmenu, node?.data?.hyperlink, hyperlinks, editingHyperlinkId]); // Re-run when hyperlink data changes

  // Pre-fill text object hyperlink inputs when textLink submenu opens
  useEffect(() => {
    if (activeSubmenu === 'textLink' && canvasObject?.type === 'text') {
      const existingHyperlink = (canvasObject.data as any)?.hyperlink;
      const objectText = (canvasObject.data as any)?.text || '';
      if (existingHyperlink?.url) {
        setTextLinkUrl(existingHyperlink.url);
        // Use hyperlink text if set, otherwise use object's main text
        setTextLinkText(existingHyperlink.text || objectText);
        setTextShowPreview(existingHyperlink.showPreview ?? false);
        setTextShowText(existingHyperlink.showText ?? true);
        setTextPreviewMetadata(existingHyperlink.metadata ?? null);
      } else {
        setTextLinkUrl('');
        // Default to object's main text when creating new hyperlink
        setTextLinkText(objectText);
        setTextShowPreview(false);
        setTextShowText(true);
        setTextPreviewMetadata(null);
      }
    }
  }, [activeSubmenu, canvasObject, initialSubmenu]);

  // Sync icon visibility and reset submenu when node changes (but preserve initialSubmenu)
  const prevNodeIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    setIconVisible(node?.data?.iconVisible ?? true);
    // Only reset submenu if node id actually changed, not on first mount with initialSubmenu
    if (prevNodeIdRef.current !== undefined && prevNodeIdRef.current !== node?.id) {
      setActiveSubmenu(initialSubmenu ?? null);
    }
    prevNodeIdRef.current = node?.id;
  }, [node?.id, node?.data?.iconVisible, initialSubmenu]);
  
  // Remember the editing part when inline editing starts or changes
  useEffect(() => {
    if (isInlineEditing && inlineEditingPart) {
      setRememberedEditingPart(inlineEditingPart as 'header' | 'body');
    }
  }, [isInlineEditing, inlineEditingPart]);

  const isNodeTarget = target?.type === 'node';
  const isEdgeTarget = target?.type === 'edge';
  const isCanvasObjectTarget = target?.type === 'canvasObject';

  // Determine if toolbar should appear above or below
  // Only show above if there's actually enough space, otherwise show below
  const toolbarHeight = 60;
  const submenuHeight = 150;
  const minSpaceNeeded = toolbarHeight + submenuHeight;
  const spaceAbove = nodeRect ? nodeRect.top : position.y;
  const spaceBelow = nodeRect ? viewportHeight - nodeRect.bottom : viewportHeight - position.y;
  // Prefer showing above only if there's enough space above AND it's not blocking the node
  const showAbove = spaceAbove >= minSpaceNeeded;

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
      // During inline editing, we render a custom text toolbar instead of buttons
      // Return empty array - the text toolbar is rendered separately
      if (isInlineEditing) {
        return [];
      }
      
      // Table nodes only get color and delete
      if (node?.type === 'table') {
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
            id: 'delete',
            icon: <Trash2 size={18} />,
            label: 'Delete',
            color: 'bg-red-500',
            hoverColor: 'hover:bg-red-600',
            onClick: () => { onDelete?.(); onClose(); }
          }
        ];
      }
      
      // Code nodes only get delete button (they have their own built-in UI)
      if (node?.type === 'code') {
        return [
          {
            id: 'delete',
            icon: <Trash2 size={18} />,
            label: 'Delete',
            color: 'bg-red-500',
            hoverColor: 'hover:bg-red-600',
            onClick: () => { onDelete?.(); onClose(); }
          }
        ];
      }
      
      // Render nodes (HTML preview) only get color palette and delete
      if (node?.type === 'render') {
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
            id: 'delete',
            icon: <Trash2 size={18} />,
            label: 'Delete',
            color: 'bg-red-500',
            hoverColor: 'hover:bg-red-600',
            onClick: () => { onDelete?.(); onClose(); }
          }
        ];
      }
      
      // Output nodes get color palette, stroke style, and delete only
      if (node?.type === 'output') {
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
            id: 'style',
            icon: <Brush size={18} />,
            label: 'Border Style',
            color: 'bg-emerald-500',
            hoverColor: 'hover:bg-emerald-600',
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
      }
      
      // Normal node toolbar (not inline editing)
      const baseButtons: ToolbarButton[] = [
        {
          id: 'color',
          icon: <Palette size={18} />,
          label: 'Color',
          color: 'bg-blue-500',
          hoverColor: 'hover:bg-blue-600',
          hasSubmenu: true
        },
        {
          id: 'style',
          icon: <Brush size={18} />,
          label: 'Border Style',
          color: 'bg-emerald-500',
          hoverColor: 'hover:bg-emerald-600',
          hasSubmenu: true
        }
      ];
      
      // Compound nodes have their own component menu, skip emoji and link
      if (node?.type === 'compound') {
        // Add component button for compound nodes
        baseButtons.push({
          id: 'addComponent',
          icon: <Plus size={18} />,
          label: 'Add Component',
          color: 'bg-green-500',
          hoverColor: 'hover:bg-green-600',
          onClick: () => { 
            onOpenComponentMenu?.();
            // Don't close the toolbar - the component menu will handle its own state
          }
        });
      } else if (node?.type === 'image' || node?.type === 'form' || node?.type === 'webview') {
        // Image, Form, and Webview nodes don't get icon/emoji or link buttons
        // They only get color, style, and delete
      } else {
        // Basic nodes (input, process, condition, output, ai) get icon and link
        baseButtons.push(
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
            hasSubmenu: true
          }
        );
      }
      
      baseButtons.push({
        id: 'delete',
        icon: <Trash2 size={18} />,
        label: 'Delete',
        color: 'bg-red-500',
        hoverColor: 'hover:bg-red-600',
        onClick: () => { onDelete?.(); onClose(); }
      });
      
      return baseButtons;
    } else if (isEdgeTarget) {
      const isDataLink = edge?.data?.isDataLink === true;
      const edgeButtons: ToolbarButton[] = [
        {
          id: 'color',
          icon: <Palette size={18} />,
          label: 'Color',
          color: 'bg-blue-500',
          hoverColor: 'hover:bg-blue-600',
          hasSubmenu: true
        }
      ];
      
      // Only show swap direction for non-data-link edges (data links have enforced direction)
      if (!isDataLink) {
        edgeButtons.push({
          id: 'direction',
          icon: <ArrowLeftRight size={18} />,
          label: 'Swap Direction',
          color: 'bg-purple-500',
          hoverColor: 'hover:bg-purple-600',
          onClick: () => { onEdgeDirectionSwap?.(); }
        });
      }
      
      edgeButtons.push(
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
        }
      );
      
      // All edges get delete button - for data link edges, just removes the edge (keeps form values)
      edgeButtons.push({
        id: 'delete',
        icon: <Trash2 size={18} />,
        label: 'Delete',
        color: 'bg-red-500',
        hoverColor: 'hover:bg-red-600',
        onClick: () => { onDelete?.(); onClose(); }
      });
      
      return edgeButtons;
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
      
      // Hyperlink button for text objects only
      if (objType === 'text') {
        buttons.push({
          id: 'textLink',
          icon: <LinkIcon size={18} />,
          label: 'Hyperlink',
          color: 'bg-indigo-500',
          hoverColor: 'hover:bg-indigo-600',
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
      
      // Fill style button for shapes only
      if (objType === 'shape') {
        buttons.push({
          id: 'fillStyle',
          icon: <Eye size={18} />,
          label: 'Fill Style',
          color: 'bg-cyan-500',
          hoverColor: 'hover:bg-cyan-600',
          hasSubmenu: true
        });
        
        // Shape type button
        buttons.push({
          id: 'shapeType',
          icon: <Square size={18} />,
          label: 'Change Shape',
          color: 'bg-orange-500',
          hoverColor: 'hover:bg-orange-600',
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
                  borderColor: '#e2e8f0',
                  headerTextColor: '#0f172a',
                  bodyTextColor: '#334155'
                });
              } else {
                const headerTextColor = getOptimalTextColor(color);
                onColorChange({ 
                  headerBackground: color,
                  bodyBackground: getTintedBodyColor(color, 0.1),
                  borderColor: color,
                  headerTextColor
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

  const renderFillStyleSubmenu = () => {
    const currentFillStyle = (canvasObject?.data as any)?.fillStyle || 'solid';
    
    const fillStyleOptions = [
      { id: 'solid', label: 'Solid', description: '50% intensity (lighter hue)', icon: <Square size={16} className="fill-current" /> },
      { id: 'transparent', label: 'Transparent', description: '30% opacity', icon: <Square size={16} className="opacity-30" /> },
      { id: 'none', label: 'No Fill', description: 'Border only', icon: <Square size={16} className="fill-none" /> }
    ];
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150 min-w-[180px]",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Fill Style</div>
          <div className="flex flex-col gap-1">
            {fillStyleOptions.map((opt) => (
              <button
                type="button"
                key={opt.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-700 text-left",
                  currentFillStyle === opt.id && "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500"
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onCanvasObjectFillStyleChange?.(opt.id as 'solid' | 'transparent' | 'none');
                }}
                data-testid={`toolbar-fill-${opt.id}`}
              >
                <span className="text-gray-600 dark:text-gray-300">{opt.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderShapeTypeSubmenu = () => {
    const currentShapeType = (canvasObject?.data as any)?.shapeType || 'rectangle';
    
    const shapeOptions = [
      { id: 'rectangle', label: 'Rectangle', icon: <Square size={18} /> },
      { id: 'circle', label: 'Circle', icon: <Circle size={18} /> },
      { id: 'triangle', label: 'Triangle', icon: <Triangle size={18} /> },
      { id: 'hexagon', label: 'Hexagon', icon: <Hexagon size={18} /> },
      { id: 'arrow', label: 'Arrow', icon: <ArrowRight size={18} /> },
      { id: 'line', label: 'Line', icon: <Minus size={18} /> },
      { id: 'polygon', label: 'Polygon', icon: <PenTool size={18} /> }
    ];
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150 min-w-[280px]",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Change Shape</div>
          <div className="grid grid-cols-3 gap-3">
            {shapeOptions.map((opt) => (
              <button
                type="button"
                key={opt.id}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105",
                  currentShapeType === opt.id && "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500"
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onShapeTypeChange?.(opt.id as 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'line' | 'arrow' | 'polygon');
                }}
                title={opt.label}
                data-testid={`toolbar-shape-${opt.id}`}
              >
                <span className="text-gray-600 dark:text-gray-300">{opt.icon}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderLinkSubmenu = () => {
    // Support for multiple hyperlinks - check both legacy single and new array format
    const existingHyperlinks = hyperlinks || [];
    const editingLink = editingHyperlinkId 
      ? existingHyperlinks.find(h => h.id === editingHyperlinkId)
      : node?.data?.hyperlink ? { 
          id: 'legacy-0', 
          text: node.data.hyperlink.text, 
          url: node.data.hyperlink.url,
          showPreview: node.data.hyperlink.showPreview,
          metadata: node.data.hyperlink.metadata,
        } 
      : null;
    const isEditing = !!editingLink;
    
    const fetchMetadata = async (url: string) => {
      setPreviewLoading(true);
      try {
        let normalizedUrl = url;
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          normalizedUrl = 'https://' + normalizedUrl;
        }
        
        const response = await fetch('/api/og-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedUrl }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.metadata) {
            setPreviewMetadata(data.metadata);
            return data.metadata;
          }
        }
        return null;
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
        return null;
      } finally {
        setPreviewLoading(false);
      }
    };
    
    const handleTogglePreview = async () => {
      const newShowPreview = !showPreview;
      setShowPreview(newShowPreview);
      
      if (newShowPreview && !previewMetadata && linkUrl) {
        // Fetch metadata when enabling preview
        await fetchMetadata(linkUrl);
      }
    };
    
    const handleAddLink = async () => {
      const finalText = linkText.trim();
      const finalUrl = linkUrl.trim();
      
      if (finalText && finalUrl) {
        let url = finalUrl;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        
        // If showPreview is enabled but metadata isn't fetched yet, fetch it now
        let metadata = previewMetadata;
        if (showPreview && !metadata) {
          metadata = await fetchMetadata(url);
        }
        
        onAddHyperlink?.({ 
          id: isEditing ? editingLink?.id : undefined, // Include id when editing
          text: finalText, 
          url,
          showPreview,
          metadata: showPreview ? metadata ?? undefined : undefined,
        });
        setActiveSubmenu(null);
        setLinkText('');
        setLinkUrl('');
        setShowPreview(false);
        setPreviewMetadata(null);
      }
    };
    
    const handleRemoveLink = () => {
      if (isEditing && editingLink?.id && onDeleteHyperlink) {
        onDeleteHyperlink(editingLink.id);
      } else {
        // Fallback for legacy single hyperlink
        onAddHyperlink?.({ text: '', url: '' });
      }
      setActiveSubmenu(null);
      setLinkText('');
      setLinkUrl('');
      setShowPreview(false);
      setPreviewMetadata(null);
    };
    
    const isValidUrl = (url: string) => {
      if (!url) return false;
      try {
        new URL(url.startsWith('http') ? url : `https://${url}`);
        return true;
      } catch {
        return false;
      }
    };
    
    const canSubmit = linkText.trim() && isValidUrl(linkUrl);
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150 min-w-[280px]",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          {/* Link Text Field */}
          <input
            type="text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Button text..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            data-testid="link-text-input"
          />
          
          {/* URL Field */}
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              // Reset preview metadata when URL changes
              if (previewMetadata) {
                setPreviewMetadata(null);
              }
            }}
            placeholder="https://example.com"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) {
                handleAddLink();
              }
            }}
            data-testid="link-url-input"
          />
          
          {/* Show Preview Toggle */}
          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Show link preview
            </label>
            <button
              type="button"
              onClick={handleTogglePreview}
              disabled={previewLoading}
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
                showPreview 
                  ? "bg-cyan-500" 
                  : "bg-gray-300 dark:bg-gray-600",
                previewLoading && "opacity-50 cursor-wait"
              )}
              data-testid="link-preview-toggle"
            >
              <span 
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                  showPreview && "translate-x-4"
                )}
              />
            </button>
          </div>
          
          {/* Preview Loading Indicator */}
          {previewLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              Fetching preview...
            </div>
          )}
          
          {/* Preview Card (when metadata is loaded) */}
          {showPreview && previewMetadata && !previewLoading && (
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                {previewMetadata.title || 'No title'}
              </div>
              {previewMetadata.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                  {previewMetadata.description}
                </div>
              )}
              <div className="flex items-center gap-1 mt-1">
                {previewMetadata.favicon && (
                  <img 
                    src={previewMetadata.favicon} 
                    alt="" 
                    className="w-3 h-3 rounded-sm"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <span className="text-[10px] text-gray-400">
                  {(() => {
                    try {
                      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
                      return new URL(url).hostname;
                    } catch {
                      return linkUrl;
                    }
                  })()}
                </span>
              </div>
            </div>
          )}
          
          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!canSubmit || previewLoading}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                canSubmit && !previewLoading
                  ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              )}
              data-testid="link-add-button"
            >
              {isEditing ? 'Update' : 'Add'}
            </button>
            
            {isEditing && (
              <button
                type="button"
                onClick={handleRemoveLink}
                className="py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                data-testid="link-remove-button"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render text object hyperlink submenu (URL only, with show preview and show text toggles)
  const renderTextLinkSubmenu = () => {
    const existingHyperlink = (canvasObject?.data as any)?.hyperlink;
    const isEditing = !!existingHyperlink?.url;
    
    const fetchTextMetadata = async (url: string) => {
      setTextPreviewLoading(true);
      try {
        let normalizedUrl = url;
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          normalizedUrl = 'https://' + normalizedUrl;
        }
        
        const response = await fetch('/api/og-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedUrl }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.metadata) {
            setTextPreviewMetadata(data.metadata);
            return data.metadata;
          }
        }
        return null;
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
        return null;
      } finally {
        setTextPreviewLoading(false);
      }
    };
    
    const handleToggleTextPreview = async () => {
      const newShowPreview = !textShowPreview;
      setTextShowPreview(newShowPreview);
      
      if (newShowPreview && !textPreviewMetadata && textLinkUrl) {
        await fetchTextMetadata(textLinkUrl);
      }
    };
    
    const handleToggleTextShow = () => {
      setTextShowText(!textShowText);
    };
    
    const handleApplyTextLink = async () => {
      const finalUrl = textLinkUrl.trim();
      const finalText = textLinkText.trim();
      
      if (finalUrl) {
        let url = finalUrl;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        
        let metadata = textPreviewMetadata;
        if (textShowPreview && !metadata) {
          metadata = await fetchTextMetadata(url);
        }
        
        onTextObjectHyperlinkChange?.({
          url,
          text: finalText || undefined,
          showPreview: textShowPreview,
          showText: textShowText,
          metadata: textShowPreview ? metadata ?? undefined : undefined,
        });
        setActiveSubmenu(null);
      }
    };
    
    const handleRemoveTextLink = () => {
      onTextObjectHyperlinkChange?.(null);
      setActiveSubmenu(null);
      setTextLinkUrl('');
      setTextLinkText('');
      setTextShowPreview(false);
      setTextShowText(true);
      setTextPreviewMetadata(null);
    };
    
    const isValidUrl = (url: string) => {
      if (!url) return false;
      try {
        new URL(url.startsWith('http') ? url : `https://${url}`);
        return true;
      } catch {
        return false;
      }
    };
    
    // Must have valid URL AND at least one display option enabled
    const hasDisplayOption = textShowText || textShowPreview;
    const canSubmit = isValidUrl(textLinkUrl) && hasDisplayOption;
    
    return (
      <div 
        ref={submenuRef}
        className={cn(
          "absolute left-1/2 -translate-x-1/2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150 min-w-[280px]",
          showAbove ? "bottom-full mb-2" : "top-full mt-2"
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          {/* URL Input */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Link2 className="w-3 h-3" />
              URL
            </label>
            <input
              type="text"
              value={textLinkUrl}
              onChange={(e) => setTextLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit && !textPreviewLoading) {
                  e.preventDefault();
                  handleApplyTextLink();
                }
              }}
              data-testid="text-link-url-input"
              autoFocus
            />
          </div>
          
          {/* Text Input */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Type className="w-3 h-3" />
              Text
            </label>
            <input
              type="text"
              value={textLinkText}
              onChange={(e) => setTextLinkText(e.target.value)}
              placeholder="Link text (optional)"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit && !textPreviewLoading) {
                  e.preventDefault();
                  handleApplyTextLink();
                }
              }}
              data-testid="text-link-text-input"
            />
          </div>
          
          {/* Show Text Toggle */}
          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <Type className="w-3.5 h-3.5" />
              Show text
            </label>
            <button
              type="button"
              onClick={handleToggleTextShow}
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
                textShowText 
                  ? "bg-indigo-500" 
                  : "bg-gray-300 dark:bg-gray-600"
              )}
              data-testid="text-link-show-text-toggle"
            >
              <span 
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                  textShowText && "translate-x-4"
                )}
              />
            </button>
          </div>
          
          {/* Show Preview Toggle */}
          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Show link preview
            </label>
            <button
              type="button"
              onClick={handleToggleTextPreview}
              disabled={textPreviewLoading}
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
                textShowPreview 
                  ? "bg-indigo-500" 
                  : "bg-gray-300 dark:bg-gray-600",
                textPreviewLoading && "opacity-50 cursor-wait"
              )}
              data-testid="text-link-preview-toggle"
            >
              <span 
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                  textShowPreview && "translate-x-4"
                )}
              />
            </button>
          </div>
          
          {/* Preview Loading Indicator */}
          {textPreviewLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Fetching preview...
            </div>
          )}
          
          {/* Warning when no display option is selected */}
          {!hasDisplayOption && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-700 dark:text-amber-400">
              <span>At least one display option must be enabled</span>
            </div>
          )}
          
          {/* Preview Card (when metadata is loaded) */}
          {textShowPreview && textPreviewMetadata && !textPreviewLoading && (
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                {textPreviewMetadata.title || 'No title'}
              </div>
              {textPreviewMetadata.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                  {textPreviewMetadata.description}
                </div>
              )}
              <div className="flex items-center gap-1 mt-1">
                {textPreviewMetadata.favicon && (
                  <img 
                    src={textPreviewMetadata.favicon} 
                    alt="" 
                    className="w-3 h-3 rounded-sm"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <span className="text-[10px] text-gray-400">
                  {(() => {
                    try {
                      const url = textLinkUrl.startsWith('http') ? textLinkUrl : `https://${textLinkUrl}`;
                      return new URL(url).hostname;
                    } catch {
                      return textLinkUrl;
                    }
                  })()}
                </span>
              </div>
            </div>
          )}
          
          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyTextLink}
              disabled={!canSubmit || textPreviewLoading}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                canSubmit && !textPreviewLoading
                  ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              )}
              data-testid="text-link-apply-button"
            >
              {isEditing ? 'Update' : 'Add'}
            </button>
            
            {isEditing && (
              <button
                type="button"
                onClick={handleRemoveTextLink}
                className="py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                data-testid="text-link-remove-button"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTextSubmenu = () => {
    // Get node data for nodes, canvas object data for canvas objects
    const nodeData = node?.data;
    const objData = canvasObject?.data;
    
    // Use remembered editing part (survives blur events) or fall back to current prop
    const effectiveEditingPart = rememberedEditingPart || inlineEditingPart;
    
    // Determine if editing header or body for nodes
    const isEditingHeaderCheck = effectiveEditingPart === 'header';
    
    // Determine current fontSize - same property name for both
    const currentFontSize = isCanvasObjectTarget 
      ? objData?.fontSize 
      : (isEditingHeaderCheck ? nodeData?.headerFontSize : nodeData?.fontSize);
    
    // Determine if bold is active
    // For nodes: uses 'bold' boolean (or 'headerBold' for header)
    // For canvas objects: uses 'fontWeight' = 'bold' | 'normal'
    const isBold = isCanvasObjectTarget 
      ? objData?.fontWeight === 'bold' 
      : (isEditingHeaderCheck ? nodeData?.headerBold : nodeData?.bold);
    
    // Determine if italic is active
    // For nodes: uses 'italic' boolean (or 'headerItalic' for header)
    // For canvas objects: uses 'textDecoration' containing 'italic'
    const isItalic = isCanvasObjectTarget 
      ? (objData?.textDecoration || '').includes('italic')
      : (isEditingHeaderCheck ? nodeData?.headerItalic : nodeData?.italic);
    
    // Determine if strikethrough is active
    // For nodes: uses 'strikethrough' boolean (or 'headerStrikethrough' for header)
    // For canvas objects: uses 'textDecoration' containing 'line-through'
    const isStrikethrough = isCanvasObjectTarget 
      ? (objData?.textDecoration || '').includes('line-through')
      : (isEditingHeaderCheck ? nodeData?.headerStrikethrough : nodeData?.strikethrough);
    
    // Determine current text alignment
    const currentAlign = isCanvasObjectTarget 
      ? objData?.textAlign 
      : (isEditingHeaderCheck ? nodeData?.headerTextAlign : nodeData?.textAlign);
    
    // Determine which part's styles to read based on effective editing part
    const relevantStyles = isEditingHeaderCheck 
      ? { 
          fontSize: nodeData?.headerFontSize, 
          bold: nodeData?.headerBold, 
          italic: nodeData?.headerItalic, 
          strikethrough: nodeData?.headerStrikethrough,
          underline: nodeData?.headerUnderline,
          textAlign: nodeData?.headerTextAlign 
        }
      : { 
          fontSize: nodeData?.fontSize, 
          bold: nodeData?.bold, 
          italic: nodeData?.italic, 
          strikethrough: nodeData?.strikethrough,
          underline: nodeData?.underline,
          textAlign: nodeData?.textAlign 
        };
    
    const handleFontSizeChange = (size: number) => {
      if (isNodeTarget) {
        // Use remembered editing part to survive blur events
        onTextStyleChange?.({ fontSize: size }, effectiveEditingPart as 'header' | 'body');
      } else if (isCanvasObjectTarget) {
        onCanvasObjectTextStyleChange?.({ fontSize: size });
      }
    };
    
    const handleBoldToggle = () => {
      if (isNodeTarget) {
        onTextStyleChange?.({ bold: !relevantStyles.bold }, effectiveEditingPart as 'header' | 'body');
      } else if (isCanvasObjectTarget) {
        // Toggle between 'bold' and 'normal'
        const newBold = objData?.fontWeight !== 'bold';
        onCanvasObjectTextStyleChange?.({ bold: newBold });
      }
    };
    
    const handleItalicToggle = () => {
      if (isNodeTarget) {
        onTextStyleChange?.({ italic: !relevantStyles.italic }, effectiveEditingPart as 'header' | 'body');
      } else if (isCanvasObjectTarget) {
        // Toggle italic in textDecoration
        const currentDecoration = objData?.textDecoration || 'none';
        const newItalic = !currentDecoration.includes('italic');
        onCanvasObjectTextStyleChange?.({ italic: newItalic });
      }
    };
    
    const handleStrikethroughToggle = () => {
      if (isNodeTarget) {
        onTextStyleChange?.({ strikethrough: !relevantStyles.strikethrough }, effectiveEditingPart as 'header' | 'body');
      } else if (isCanvasObjectTarget) {
        // Toggle line-through in textDecoration
        const currentDecoration = objData?.textDecoration || 'none';
        const newStrikethrough = !currentDecoration.includes('line-through');
        onCanvasObjectTextStyleChange?.({ strikethrough: newStrikethrough });
      }
    };
    
    const handleAlignChange = (align: 'left' | 'center' | 'right') => {
      if (isNodeTarget) {
        onTextStyleChange?.({ align }, effectiveEditingPart as 'header' | 'body');
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

  // Size labels for the dropdown
  const FONT_SIZE_LABELS: Record<number, string> = {
    10: 'XS',
    12: 'Small',
    14: 'Medium',
    16: 'Large',
    18: 'XL',
    20: 'XXL',
    24: 'Huge'
  };

  // Render inline text formatting toolbar (shown when editing text)
  const renderInlineTextToolbar = () => {
    const nodeData = node?.data;
    const effectiveEditingPart = rememberedEditingPart || inlineEditingPart;
    const isEditingHeaderCheck = effectiveEditingPart === 'header';
    
    const currentFontSize = isEditingHeaderCheck ? nodeData?.headerFontSize : nodeData?.fontSize;
    const isBold = isEditingHeaderCheck ? nodeData?.headerBold : nodeData?.bold;
    const isItalic = isEditingHeaderCheck ? nodeData?.headerItalic : nodeData?.italic;
    const isStrikethrough = isEditingHeaderCheck ? nodeData?.headerStrikethrough : nodeData?.strikethrough;
    const currentAlign = isEditingHeaderCheck ? nodeData?.headerTextAlign : nodeData?.textAlign;
    
    const handleFontSizeChange = (size: number) => {
      onTextStyleChange?.({ fontSize: size }, effectiveEditingPart as 'header' | 'body');
      setActiveSubmenu(null);
    };
    
    const handleBoldToggle = () => {
      onTextStyleChange?.({ bold: !isBold }, effectiveEditingPart as 'header' | 'body');
    };
    
    const handleItalicToggle = () => {
      onTextStyleChange?.({ italic: !isItalic }, effectiveEditingPart as 'header' | 'body');
    };
    
    const handleStrikethroughToggle = () => {
      onTextStyleChange?.({ strikethrough: !isStrikethrough }, effectiveEditingPart as 'header' | 'body');
    };
    
    const handleAlignChange = (align: 'left' | 'center' | 'right') => {
      onTextStyleChange?.({ align }, effectiveEditingPart as 'header' | 'body');
      setActiveSubmenu(null);
    };
    
    const currentSizeLabel = FONT_SIZE_LABELS[currentFontSize || 12] || 'Small';
    
    const getCurrentAlignIcon = () => {
      switch (currentAlign) {
        case 'center': return <AlignCenter size={16} />;
        case 'right': return <AlignRight size={16} />;
        default: return <AlignLeft size={16} />;
      }
    };
    
    return (
      <div className="relative">
        {/* Main inline text toolbar - themed to match main toolbar */}
        <div className="flex items-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-full shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Text Size Dropdown */}
          <button
            className={cn(
              "flex items-center gap-1.5 h-10 px-4 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-l-full transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-700",
              activeSubmenu === 'textSize' && "bg-gray-100 dark:bg-gray-700"
            )}
            onClick={() => setActiveSubmenu(activeSubmenu === 'textSize' ? null : 'textSize')}
            data-testid="toolbar-textsize-dropdown"
          >
            <span>{currentSizeLabel}</span>
            <ChevronDown size={14} className={cn("transition-transform", activeSubmenu === 'textSize' && "rotate-180")} />
          </button>
          
          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
          
          {/* Bold */}
          <button
            className={cn(
              "w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-200 transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-700",
              isBold && "bg-violet-100 dark:bg-violet-600 text-violet-700 dark:text-white"
            )}
            onClick={handleBoldToggle}
            title="Bold"
            data-testid="toolbar-inline-bold"
          >
            <Bold size={16} />
          </button>
          
          {/* Strikethrough */}
          <button
            className={cn(
              "w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-200 transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-700",
              isStrikethrough && "bg-violet-100 dark:bg-violet-600 text-violet-700 dark:text-white"
            )}
            onClick={handleStrikethroughToggle}
            title="Strikethrough"
            data-testid="toolbar-inline-strikethrough"
          >
            <Strikethrough size={16} />
          </button>
          
          {/* Italic */}
          <button
            className={cn(
              "w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-200 transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-700",
              isItalic && "bg-violet-100 dark:bg-violet-600 text-violet-700 dark:text-white"
            )}
            onClick={handleItalicToggle}
            title="Italic"
            data-testid="toolbar-inline-italic"
          >
            <Italic size={16} />
          </button>
          
          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
          
          {/* Alignment Dropdown */}
          <button
            className={cn(
              "flex items-center gap-1.5 h-10 px-3 text-gray-700 dark:text-gray-200 rounded-r-full transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-700",
              activeSubmenu === 'textAlign' && "bg-gray-100 dark:bg-gray-700"
            )}
            onClick={() => setActiveSubmenu(activeSubmenu === 'textAlign' ? null : 'textAlign')}
            title="Alignment"
            data-testid="toolbar-align-dropdown"
          >
            {getCurrentAlignIcon()}
            <ChevronDown size={14} className={cn("transition-transform", activeSubmenu === 'textAlign' && "rotate-180")} />
          </button>
        </div>
        
        {/* Text Size Submenu - themed to match */}
        {activeSubmenu === 'textSize' && (
          <div 
            ref={submenuRef}
            className={cn(
              "absolute left-0 p-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150 min-w-[100px]",
              showAbove ? "bottom-full mb-2" : "top-full mt-2"
            )}
          >
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 rounded-lg transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  currentFontSize === size && "bg-violet-100 dark:bg-violet-600 text-violet-700 dark:text-white"
                )}
                onClick={() => handleFontSizeChange(size)}
                data-testid={`toolbar-inline-fontsize-${size}`}
              >
                {FONT_SIZE_LABELS[size]}
              </button>
            ))}
          </div>
        )}
        
        {/* Alignment Submenu - themed to match */}
        {activeSubmenu === 'textAlign' && (
          <div 
            ref={submenuRef}
            className={cn(
              "absolute right-0 p-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in-0 zoom-in-95 duration-150",
              showAbove ? "bottom-full mb-2" : "top-full mt-2"
            )}
          >
            <div className="flex gap-1">
              <button
                className={cn(
                  "w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-200 rounded-lg transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  (currentAlign === 'left' || !currentAlign) && "bg-violet-100 dark:bg-violet-600 text-violet-700 dark:text-white"
                )}
                onClick={() => handleAlignChange('left')}
                title="Align Left"
                data-testid="toolbar-inline-align-left"
              >
                <AlignLeft size={16} />
              </button>
              <button
                className={cn(
                  "w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-200 rounded-lg transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  currentAlign === 'center' && "bg-violet-100 dark:bg-violet-600 text-violet-700 dark:text-white"
                )}
                onClick={() => handleAlignChange('center')}
                title="Align Center"
                data-testid="toolbar-inline-align-center"
              >
                <AlignCenter size={16} />
              </button>
              <button
                className={cn(
                  "w-10 h-10 flex items-center justify-center text-gray-700 dark:text-gray-200 rounded-lg transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  currentAlign === 'right' && "bg-violet-100 dark:bg-violet-600 text-violet-700 dark:text-white"
                )}
                onClick={() => handleAlignChange('right')}
                title="Align Right"
                data-testid="toolbar-inline-align-right"
              >
                <AlignRight size={16} />
              </button>
            </div>
          </div>
        )}
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

  // Calculate toolbar position with proper 16px gap
  const toolbarX = nodeRect ? nodeRect.left + nodeRect.width / 2 : position.x;
  // When above: anchor to node top, transform moves toolbar up by 100% + 16px gap
  // When below: anchor to node bottom, transform moves toolbar down by 16px gap
  const toolbarY = showAbove 
    ? (nodeRect ? nodeRect.top : position.y)
    : (nodeRect ? nodeRect.bottom : position.y);
  
  // Different transforms for above vs below positioning
  const toolbarTransform = showAbove
    ? 'translate(-50%, calc(-100% - 16px))' // Bottom of toolbar is 16px above anchor
    : 'translate(-50%, 16px)'; // Top of toolbar is 16px below anchor

  // When inline editing a node, show the inline text toolbar
  if (isNodeTarget && isInlineEditing) {
    return (
      <div
        ref={menuRef}
        className="fixed z-[100] pointer-events-auto"
        style={{
          left: toolbarX,
          top: toolbarY,
          transform: toolbarTransform
        }}
        data-testid="linear-toolbar"
        data-toolbar="linear-text"
      >
        {renderInlineTextToolbar()}
      </div>
    );
  }

  // When editing a text object hyperlink (initialSubmenu === 'textLink'), show ONLY the textLink submenu
  // without the main toolbar buttons - this is for dedicated hyperlink editing from the edit button
  if (isCanvasObjectTarget && initialSubmenu === 'textLink' && activeSubmenu === 'textLink') {
    return (
      <div
        ref={menuRef}
        className="fixed z-[100] pointer-events-auto"
        style={{
          left: toolbarX,
          top: toolbarY,
          transform: toolbarTransform
        }}
        data-testid="linear-toolbar"
        data-toolbar="linear-textlink-only"
      >
        <div className="relative">
          {renderTextLinkSubmenu()}
        </div>
      </div>
    );
  }

  // When editing a basic node hyperlink (initialSubmenu === 'link'), show ONLY the link submenu
  // without the main toolbar buttons - this is for dedicated hyperlink editing from the edit button
  if (isNodeTarget && initialSubmenu === 'link' && activeSubmenu === 'link') {
    return (
      <div
        ref={menuRef}
        className="fixed z-[100] pointer-events-auto"
        style={{
          left: toolbarX,
          top: toolbarY,
          transform: toolbarTransform
        }}
        data-testid="linear-toolbar"
        data-toolbar="linear-link-only"
      >
        <div className="relative">
          {renderLinkSubmenu()}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] pointer-events-auto"
      style={{
        left: toolbarX,
        top: toolbarY,
        transform: toolbarTransform
      }}
      data-testid="linear-toolbar"
      data-toolbar="linear"
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
                tabIndex={0}
              >
                {button.icon}
              </button>
            );
          })}
          
          {/* Wireframe button - only for Basic nodes and Compound nodes (not for image/table/form/code nodes) */}
          {isNodeTarget && node?.type !== 'image' && node?.type !== 'table' && node?.type !== 'form' && node?.type !== 'code' && node?.type !== 'output' && !isInlineEditing && (
            <button
              className={cn(
                "h-9 px-3 rounded-full flex items-center gap-1.5 text-sm font-medium shadow-md transition-all duration-200",
                canUseWireframe 
                  ? "text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 hover:scale-105 active:scale-95 hover:shadow-lg cursor-pointer"
                  : "text-gray-400 bg-gray-300 dark:bg-gray-600 dark:text-gray-500 cursor-not-allowed opacity-60"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (canUseWireframe) {
                  onWireframe?.();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={!canUseWireframe}
              title={canUseWireframe ? "Generate wireframe mockup" : "Pro feature - Upgrade to use Wireframe"}
              data-testid="toolbar-button-wireframe"
              tabIndex={canUseWireframe ? 0 : -1}
            >
              <Sparkles size={14} />
              <span>Wireframe</span>
              {!canUseWireframe && (
                <Lock size={12} className="ml-0.5" />
              )}
            </button>
          )}
          
          {/* Generate Workflow button - only for Figma image nodes with semantic data */}
          {isNodeTarget && node?.type === 'image' && node?.data?.figmaSemantic && onGenerateWorkflow && !isInlineEditing && (
            <button
              className={cn(
                "h-9 px-3 rounded-full flex items-center gap-1.5 text-sm font-medium shadow-md transition-all duration-200",
                "text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 hover:scale-105 active:scale-95 hover:shadow-lg cursor-pointer"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onGenerateWorkflow();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="Generate workflow nodes from Figma semantic data"
              data-testid="toolbar-button-generate-workflow"
              tabIndex={0}
            >
              <Zap size={14} />
              <span>Generate Workflow</span>
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
              tabIndex={0}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {/* Submenus */}
        {activeSubmenu === 'color' && renderColorSubmenu()}
        {activeSubmenu === 'style' && renderStyleSubmenu()}
        {activeSubmenu === 'text' && renderTextSubmenu()}
        {activeSubmenu === 'link' && renderLinkSubmenu()}
        {activeSubmenu === 'textLink' && renderTextLinkSubmenu()}
        {activeSubmenu === 'icon' && renderIconSubmenu()}
        {activeSubmenu === 'strokeStyle' && renderStrokeStyleSubmenu()}
        {activeSubmenu === 'lineType' && renderLineTypeSubmenu()}
        {activeSubmenu === 'endpoints' && renderEndpointsSubmenu()}
        {activeSubmenu === 'fillStyle' && renderFillStyleSubmenu()}
        {activeSubmenu === 'shapeType' && renderShapeTypeSubmenu()}
      </div>
    </div>
  );
};

export default LinearToolbar;
