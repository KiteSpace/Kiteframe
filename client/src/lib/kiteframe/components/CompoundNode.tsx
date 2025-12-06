import { memo, useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import { 
  Layers,
  Type,
  Image,
  Link,
  TextCursorInput,
  GripVertical,
  Trash2,
  X,
  Move,
  Plus
} from 'lucide-react';
import type { 
  Node, 
  CompoundNodeData, 
  CompoundSubcomponent,
  CompoundTextSubcomponent,
  CompoundImageSubcomponent,
  CompoundLinkSubcomponent,
  CompoundInputSubcomponent
} from '../types';
import { sanitizeText } from '../utils/validation';
import { getBorderColorFromHeader } from '@/lib/themes';

const MIN_COMPOUND_WIDTH = 280;
const MIN_COMPOUND_HEIGHT = 180;
const DEFAULT_COMPOUND_WIDTH = 320;
const DEFAULT_COMPOUND_HEIGHT = 280;

interface CompoundNodeComponentProps {
  node: Node & { data: CompoundNodeData };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  showHandles?: boolean;
  showResizeHandle?: boolean;
  onStartDrag?: (e: React.MouseEvent, node: Node) => void;
  onClick?: (e: React.MouseEvent, node: Node) => void;
  onHandleConnect?: (position: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => void;
  viewport?: { x: number; y: number; zoom: number };
}

interface ComponentMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onAddComponent: (type: 'text' | 'image' | 'link' | 'input') => void;
  onClose: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}

const ComponentMenu: React.FC<ComponentMenuProps> = ({
  isOpen,
  position,
  onAddComponent,
  onClose,
  onDragStart
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const menuItems = [
    { type: 'text' as const, icon: Type, label: 'Text', color: 'bg-blue-500' },
    { type: 'image' as const, icon: Image, label: 'Image', color: 'bg-green-500' },
    { type: 'link' as const, icon: Link, label: 'Link', color: 'bg-purple-500' },
    { type: 'input' as const, icon: TextCursorInput, label: 'Input', color: 'bg-orange-500' },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        minWidth: 180,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid="compound-component-menu"
    >
      <div 
        className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 cursor-move"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2">
          <Move size={14} className="text-gray-500" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Components</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          data-testid="close-component-menu"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>
      <div className="p-2 grid grid-cols-2 gap-2">
        {menuItems.map((item) => (
          <button
            key={item.type}
            onClick={() => onAddComponent(item.type)}
            className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid={`add-component-${item.type}`}
          >
            <div className={cn("p-2 rounded-lg", item.color)}>
              <item.icon size={16} className="text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface SubcomponentRendererProps {
  subcomponent: CompoundSubcomponent;
  onUpdate: (id: string, data: any) => void;
  onRemove: (id: string) => void;
  isDragging: boolean;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  dropIndicator: 'above' | 'below' | null;
  isSelected: boolean;
}

const SubcomponentRenderer: React.FC<SubcomponentRendererProps> = ({
  subcomponent,
  onUpdate,
  onRemove,
  isDragging,
  onDragStart,
  dropIndicator,
  isSelected
}) => {
  const renderContent = () => {
    switch (subcomponent.type) {
      case 'text':
        const textData = subcomponent as CompoundTextSubcomponent;
        if (!isSelected) {
          return (
            <p
              className="text-sm text-gray-700 dark:text-gray-300"
              style={{
                fontSize: textData.data.fontSize || 14,
                fontWeight: textData.data.fontWeight || 'normal',
                textAlign: textData.data.textAlign || 'left',
                color: textData.data.textColor,
              }}
              data-testid={`subcomponent-text-display-${subcomponent.id}`}
            >
              {textData.data.content || 'Empty text'}
            </p>
          );
        }
        return (
          <textarea
            value={textData.data.content}
            onChange={(e) => onUpdate(subcomponent.id, { content: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Enter text..."
            className="w-full bg-transparent resize-none text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
            style={{
              fontSize: textData.data.fontSize || 14,
              fontWeight: textData.data.fontWeight || 'normal',
              textAlign: textData.data.textAlign || 'left',
              color: textData.data.textColor,
            }}
            rows={2}
            data-testid={`subcomponent-text-${subcomponent.id}`}
          />
        );
      
      case 'image':
        const imgData = (subcomponent as CompoundImageSubcomponent).data;
        return imgData.src ? (
          <img
            src={imgData.src}
            alt={imgData.alt || 'Image'}
            className="w-full object-cover rounded"
            style={{ height: isSelected ? (imgData.height || 80) : 'auto' }}
            data-testid={`subcomponent-image-${subcomponent.id}`}
          />
        ) : (
          isSelected ? (
            <div 
              className="w-full bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-400"
              style={{ height: imgData.height || 80 }}
              data-testid={`subcomponent-image-placeholder-${subcomponent.id}`}
            >
              <div className="text-center">
                <Image size={20} className="mx-auto mb-1" />
                <input
                  type="text"
                  placeholder="Paste image URL..."
                  className="text-xs bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none text-center w-32"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    if (e.target.value) {
                      onUpdate(subcomponent.id, { src: e.target.value });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                      onUpdate(subcomponent.id, { src: (e.target as HTMLInputElement).value });
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div 
              className="w-full bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-400"
              style={{ height: 60 }}
              data-testid={`subcomponent-image-placeholder-display-${subcomponent.id}`}
            >
              <Image size={20} />
            </div>
          )
        );
      
      case 'link':
        const linkData = (subcomponent as CompoundLinkSubcomponent).data;
        if (!isSelected) {
          return (
            <a
              href={linkData.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
              data-testid={`subcomponent-link-display-${subcomponent.id}`}
            >
              {linkData.text || 'Link'}
            </a>
          );
        }
        return (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={linkData.text}
              onChange={(e) => onUpdate(subcomponent.id, { text: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Link text"
              className="w-full bg-transparent text-sm text-blue-600 dark:text-blue-400 underline focus:outline-none"
              data-testid={`subcomponent-link-text-${subcomponent.id}`}
            />
            <input
              type="url"
              value={linkData.url}
              onChange={(e) => onUpdate(subcomponent.id, { url: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="https://..."
              className="w-full bg-gray-50 dark:bg-gray-700 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid={`subcomponent-link-url-${subcomponent.id}`}
            />
          </div>
        );
      
      case 'input':
        const inputData = (subcomponent as CompoundInputSubcomponent).data;
        if (!isSelected) {
          return (
            <div className="flex flex-col gap-1">
              {inputData.label && (
                <span 
                  className="text-xs font-medium text-gray-600 dark:text-gray-400"
                  data-testid={`subcomponent-input-label-display-${subcomponent.id}`}
                >
                  {inputData.label}
                </span>
              )}
              <div 
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                data-testid={`subcomponent-input-display-${subcomponent.id}`}
              >
                {inputData.value || inputData.placeholder || 'Empty'}
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-1">
            {inputData.label && (
              <input
                type="text"
                value={inputData.label}
                onChange={(e) => onUpdate(subcomponent.id, { label: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Label"
                className="text-xs font-medium text-gray-600 dark:text-gray-400 bg-transparent focus:outline-none"
                data-testid={`subcomponent-input-label-${subcomponent.id}`}
              />
            )}
            <input
              type={inputData.inputType || 'text'}
              value={inputData.value}
              onChange={(e) => onUpdate(subcomponent.id, { value: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder={inputData.placeholder || 'Enter value...'}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              data-testid={`subcomponent-input-${subcomponent.id}`}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  const iconMap = {
    text: Type,
    image: Image,
    link: Link,
    input: TextCursorInput
  };

  const Icon = iconMap[subcomponent.type];

  if (!isSelected) {
    return (
      <div
        className="relative"
        data-testid={`subcomponent-${subcomponent.id}`}
      >
        <div className="p-2">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all",
        isDragging && "opacity-50 scale-95",
        dropIndicator === 'above' && "ring-t-2 ring-blue-500",
        dropIndicator === 'below' && "ring-b-2 ring-blue-500"
      )}
      data-testid={`subcomponent-${subcomponent.id}`}
    >
      {dropIndicator === 'above' && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded" />
      )}
      
      <div className="flex items-start gap-2 p-2">
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          onMouseDown={(e) => onDragStart(e, subcomponent.id)}
          data-testid={`drag-handle-${subcomponent.id}`}
        >
          <GripVertical size={14} className="text-gray-400" />
        </div>
        
        <div className="flex-shrink-0 p-1">
          <Icon size={14} className="text-gray-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(subcomponent.id);
          }}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`remove-subcomponent-${subcomponent.id}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      {dropIndicator === 'below' && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded" />
      )}
    </div>
  );
};

const CompoundNodeComponent: React.FC<CompoundNodeComponentProps> = ({
  node,
  onUpdate,
  onDoubleClick,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.label || 'Compound');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [draggingSubcomponent, setDraggingSubcomponent] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);
  const [isMenuDragging, setIsMenuDragging] = useState(false);
  const [menuDragOffset, setMenuDragOffset] = useState({ x: 0, y: 0 });
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const subcomponents = useMemo(() => 
    [...(node.data.subcomponents || [])].sort((a, b) => a.order - b.order),
    [node.data.subcomponents]
  );
  
  const nodeWidth = node.style?.width || node.width || DEFAULT_COMPOUND_WIDTH;
  const nodeHeight = node.style?.height || node.height || DEFAULT_COMPOUND_HEIGHT;
  
  const headerColor = node.data.colors?.headerBackground || '#059669';
  const bodyColor = node.data.colors?.bodyBackground || '#ffffff';
  const borderColor = node.data.colors?.borderColor || getBorderColorFromHeader(headerColor);
  const headerTextColor = node.data.colors?.headerTextColor || '#ffffff';

  useEffect(() => {
    if (!node.selected && menuOpen) {
      setMenuOpen(false);
    }
  }, [node.selected]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isMenuDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMenuPosition({
        x: e.clientX - menuDragOffset.x,
        y: e.clientY - menuDragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsMenuDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMenuDragging, menuDragOffset]);

  const handleMenuDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuDragging(true);
    setMenuDragOffset({
      x: e.clientX - menuPosition.x,
      y: e.clientY - menuPosition.y
    });
  }, [menuPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('input, button, textarea, select, [contenteditable="true"]');
    if (isInteractiveElement) return;
    e.stopPropagation();
    onStartDrag?.(e, node);
  }, [onStartDrag, node]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e, node);
  }, [onClick, node]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(e);
  }, [onDoubleClick]);

  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  }, []);

  const handleTitleSubmit = useCallback(() => {
    const sanitizedTitle = sanitizeText(editTitleValue.trim() || 'Compound');
    onUpdate?.(node.id, {
      data: { ...node.data, label: sanitizedTitle },
    });
    setIsEditingTitle(false);
  }, [editTitleValue, node.id, node.data, onUpdate]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditTitleValue(node.data.label || 'Compound');
      setIsEditingTitle(false);
    }
  }, [handleTitleSubmit, node.data.label]);

  const handleResize = useCallback((width: number, height: number) => {
    if (onUpdate) {
      onUpdate(node.id, {
        style: { ...node.style, width, height },
      });
    }
  }, [node.id, node.style, onUpdate]);

  const handleAddComponent = useCallback((type: 'text' | 'image' | 'link' | 'input') => {
    const maxOrder = subcomponents.reduce((max, s) => Math.max(max, s.order), -1);
    const newId = `sub-${Date.now()}`;
    
    let newSubcomponent: CompoundSubcomponent;
    
    switch (type) {
      case 'text':
        newSubcomponent = {
          id: newId,
          type: 'text',
          order: maxOrder + 1,
          data: {
            content: '',
            fontSize: 14,
            fontWeight: 'normal',
            textAlign: 'left'
          }
        };
        break;
      case 'image':
        newSubcomponent = {
          id: newId,
          type: 'image',
          order: maxOrder + 1,
          data: {
            src: '',
            alt: '',
            height: 80
          }
        };
        break;
      case 'link':
        newSubcomponent = {
          id: newId,
          type: 'link',
          order: maxOrder + 1,
          data: {
            text: 'Link text',
            url: ''
          }
        };
        break;
      case 'input':
        newSubcomponent = {
          id: newId,
          type: 'input',
          order: maxOrder + 1,
          data: {
            label: 'Label',
            value: '',
            placeholder: 'Enter value...'
          }
        };
        break;
    }
    
    onUpdate?.(node.id, {
      data: {
        ...node.data,
        subcomponents: [...(node.data.subcomponents || []), newSubcomponent]
      }
    });
  }, [node.id, node.data, subcomponents, onUpdate]);

  const handleUpdateSubcomponent = useCallback((subId: string, dataUpdates: any) => {
    const updatedSubcomponents = (node.data.subcomponents || []).map((sub: CompoundSubcomponent) =>
      sub.id === subId ? { ...sub, data: { ...sub.data, ...dataUpdates } } : sub
    );
    onUpdate?.(node.id, {
      data: { ...node.data, subcomponents: updatedSubcomponents }
    });
  }, [node.id, node.data, onUpdate]);

  const handleRemoveSubcomponent = useCallback((subId: string) => {
    const updatedSubcomponents = (node.data.subcomponents || []).filter((sub: CompoundSubcomponent) => sub.id !== subId);
    onUpdate?.(node.id, {
      data: { ...node.data, subcomponents: updatedSubcomponents }
    });
  }, [node.id, node.data, onUpdate]);

  const handleSubcomponentDragStart = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingSubcomponent(id);
  }, []);

  useEffect(() => {
    if (!draggingSubcomponent) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseY = e.clientY;
      
      let targetId: string | null = null;
      let position: 'above' | 'below' = 'below';
      
      const subElements = containerRef.current.querySelectorAll('[data-testid^="subcomponent-"]');
      subElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const id = el.getAttribute('data-testid')?.replace('subcomponent-', '');
        
        if (id && id !== draggingSubcomponent) {
          if (mouseY < midY && mouseY > rect.top - 10) {
            targetId = id;
            position = 'above';
          } else if (mouseY >= midY && mouseY < rect.bottom + 10) {
            targetId = id;
            position = 'below';
          }
        }
      });
      
      if (targetId) {
        setDropTarget({ id: targetId, position });
      } else {
        setDropTarget(null);
      }
    };

    const handleMouseUp = () => {
      if (draggingSubcomponent && dropTarget) {
        const currentSubs = [...(node.data.subcomponents || [])];
        const dragIndex = currentSubs.findIndex(s => s.id === draggingSubcomponent);
        const dropIndex = currentSubs.findIndex(s => s.id === dropTarget.id);
        
        if (dragIndex !== -1 && dropIndex !== -1 && dragIndex !== dropIndex) {
          const [removed] = currentSubs.splice(dragIndex, 1);
          const adjustedDropIndex = dropTarget.position === 'above' 
            ? (dragIndex < dropIndex ? dropIndex - 1 : dropIndex)
            : (dragIndex < dropIndex ? dropIndex : dropIndex + 1);
          currentSubs.splice(adjustedDropIndex, 0, removed);
          
          const reordered = currentSubs.map((sub, idx) => ({ ...sub, order: idx }));
          onUpdate?.(node.id, {
            data: { ...node.data, subcomponents: reordered }
          });
        }
      }
      
      setDraggingSubcomponent(null);
      setDropTarget(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingSubcomponent, dropTarget, node.id, node.data, onUpdate]);

  return (
    <>
      <div
        ref={nodeRef}
        className={cn(
          "absolute cursor-move select-none",
          node.selected && "z-10",
          className
        )}
        style={{
          left: node.position.x,
          top: node.position.y,
          width: nodeWidth,
          height: nodeHeight,
          ...style,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        data-testid={`compound-node-${node.id}`}
      >
        <div
          className={cn(
            "w-full h-full flex flex-col rounded-xl overflow-hidden shadow-lg",
            node.selected && "ring-2 ring-emerald-500 ring-offset-2"
          )}
          style={{
            backgroundColor: bodyColor,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: borderColor,
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 gap-2 group rounded-t-lg"
            style={{ backgroundColor: headerColor }}
            onDoubleClick={handleTitleDoubleClick}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Layers size={16} style={{ color: headerTextColor }} />
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleTitleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex-1 bg-white/20 text-white px-1.5 py-0.5 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-white/50"
                  data-testid={`compound-title-input-${node.id}`}
                />
              ) : (
                <span
                  className="text-sm font-medium truncate cursor-text"
                  style={{ color: headerTextColor }}
                  title={node.data.label || 'Compound'}
                >
                  {sanitizeText(node.data.label || 'Compound')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {node.selected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = nodeRef.current?.getBoundingClientRect();
                    if (rect) {
                      setMenuPosition({
                        x: rect.right + 16,
                        y: rect.top
                      });
                      setMenuOpen(true);
                    }
                  }}
                  className="p-1 rounded hover:bg-white/20 transition-colors"
                  data-testid={`compound-add-btn-header-${node.id}`}
                >
                  <Plus size={14} style={{ color: headerTextColor }} />
                </button>
              )}
              <span 
                className="px-1.5 py-0.5 bg-white/20 rounded text-xs"
                style={{ color: headerTextColor }}
              >
                {subcomponents.length} items
              </span>
            </div>
          </div>

          <div 
            ref={containerRef}
            className="flex-1 overflow-y-auto p-3"
            style={{ gap: node.data.gap || 8 }}
          >
            {subcomponents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-4">
                <Layers size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No components yet</p>
                {node.selected ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = nodeRef.current?.getBoundingClientRect();
                      if (rect) {
                        setMenuPosition({
                          x: rect.right + 16,
                          y: rect.top
                        });
                        setMenuOpen(true);
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    data-testid={`compound-add-btn-empty-${node.id}`}
                  >
                    <Plus size={20} className="text-gray-500 dark:text-gray-400" />
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Select this node to add components
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: node.data.gap || 8 }}>
                {subcomponents.map((sub) => (
                  <SubcomponentRenderer
                    key={sub.id}
                    subcomponent={sub}
                    onUpdate={handleUpdateSubcomponent}
                    onRemove={handleRemoveSubcomponent}
                    isDragging={draggingSubcomponent === sub.id}
                    onDragStart={handleSubcomponentDragStart}
                    dropIndicator={dropTarget && dropTarget.id === sub.id ? dropTarget.position : null}
                    isSelected={node.selected || false}
                  />
                ))}
                {node.selected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = nodeRef.current?.getBoundingClientRect();
                      if (rect) {
                        setMenuPosition({
                          x: rect.right + 16,
                          y: rect.top
                        });
                        setMenuOpen(true);
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors mx-auto mt-2"
                    data-testid={`compound-add-btn-body-${node.id}`}
                  >
                    <Plus size={16} className="text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {showHandles && (
          <NodeHandles
            node={{ ...node, width: nodeWidth, height: nodeHeight }}
            scale={viewport?.zoom || 1}
            onHandleConnect={onHandleConnect}
          />
        )}

        {showResizeHandle && node.resizable !== false && (
          <ResizeHandle
            position="bottom-right"
            nodeRef={nodeRef}
            onResize={handleResize}
            minWidth={MIN_COMPOUND_WIDTH}
            minHeight={MIN_COMPOUND_HEIGHT}
          />
        )}
      </div>

      <ComponentMenu
        isOpen={menuOpen && (node.selected === true)}
        position={menuPosition}
        onAddComponent={handleAddComponent}
        onClose={() => setMenuOpen(false)}
        onDragStart={handleMenuDragStart}
      />
    </>
  );
};

export const CompoundNode = memo(CompoundNodeComponent);

export const createCompoundNode = (
  id: string,
  position: { x: number; y: number },
  data: Partial<CompoundNodeData> = {},
): Node & { data: CompoundNodeData } => ({
  id,
  type: 'compound',
  position,
  data: {
    label: data.label || 'Compound',
    description: data.description || '',
    subcomponents: data.subcomponents || [],
    containerPadding: data.containerPadding ?? 12,
    gap: data.gap ?? 8,
    colors: data.colors || {
      headerBackground: '#059669',
      bodyBackground: '#ffffff',
      borderColor: '#10b981',
      headerTextColor: '#ffffff',
    },
  },
  style: {
    width: DEFAULT_COMPOUND_WIDTH,
    height: DEFAULT_COMPOUND_HEIGHT,
  },
  resizable: true,
  draggable: true,
  selectable: true,
});
