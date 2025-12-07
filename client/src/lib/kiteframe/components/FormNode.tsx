import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import DragPlaceholder from './DragPlaceholder';
import { 
  Plus, 
  Trash2, 
  Link2, 
  Link2Off, 
  GripVertical,
  FileText
} from 'lucide-react';
import type { 
  Node, 
  FormNodeData, 
  FormNodeField, 
  DataTable,
  FormNodeComponentProps 
} from '../types';
import { sanitizeText } from '../utils/validation';
import { getBorderColorFromHeader } from '@/lib/themes';

const MIN_FORM_WIDTH = 280;
const MIN_FORM_HEIGHT = 150;
const DEFAULT_FORM_WIDTH = 320;
const DEFAULT_FORM_HEIGHT = 200;

const FormNodeComponent: React.FC<FormNodeComponentProps> = ({
  node,
  onUpdate,
  onDoubleClick,
  onFocusNode,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
  tables = [],
  onOpenDataLinkPicker,
  showDragPlaceholder = false,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.formTitle || 'Form');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  const fields = node.data.fields || [];
  const formTitle = node.data.formTitle || 'Form';
  
  const nodeWidth = node.style?.width || node.width || DEFAULT_FORM_WIDTH;
  const nodeHeight = node.style?.height || node.height || DEFAULT_FORM_HEIGHT;
  
  const headerColor = node.data.colors?.headerBackground || '#6366f1';
  const bodyColor = node.data.colors?.bodyBackground || '#ffffff';
  const borderColor = node.data.colors?.borderColor || getBorderColorFromHeader(headerColor);
  const headerTextColor = node.data.colors?.headerTextColor || '#ffffff';

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

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
    const sanitizedTitle = sanitizeText(editTitleValue.trim() || 'Form');
    onUpdate?.(node.id, {
      data: { ...node.data, formTitle: sanitizedTitle },
    });
    setIsEditingTitle(false);
  }, [editTitleValue, node.id, node.data, onUpdate]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditTitleValue(node.data.formTitle || 'Form');
      setIsEditingTitle(false);
    }
  }, [handleTitleSubmit, node.data.formTitle]);

  const handleResize = useCallback((width: number, height: number) => {
    if (onUpdate) {
      onUpdate(node.id, {
        style: { ...node.style, width, height },
      });
    }
  }, [node.id, node.style, onUpdate]);

  const handleAddField = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newField: FormNodeField = {
      id: `field-${Date.now()}`,
      label: `Field ${fields.length + 1}`,
      value: '',
      placeholder: 'Enter value...',
    };
    onUpdate?.(node.id, {
      data: { ...node.data, fields: [...fields, newField] },
    });
  }, [node.id, node.data, fields, onUpdate]);

  const handleRemoveField = useCallback((fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate?.(node.id, {
      data: { ...node.data, fields: fields.filter((f: FormNodeField) => f.id !== fieldId) },
    });
  }, [node.id, node.data, fields, onUpdate]);

  const handleFieldLabelChange = useCallback((fieldId: string, newLabel: string) => {
    const updatedFields = fields.map((f: FormNodeField) => 
      f.id === fieldId ? { ...f, label: newLabel } : f
    );
    onUpdate?.(node.id, {
      data: { ...node.data, fields: updatedFields },
    });
  }, [node.id, node.data, fields, onUpdate]);

  const handleFieldValueChange = useCallback((fieldId: string, newValue: string) => {
    const updatedFields = fields.map((f: FormNodeField) => 
      f.id === fieldId ? { ...f, value: newValue, dataLink: undefined } : f
    );
    onUpdate?.(node.id, {
      data: { ...node.data, fields: updatedFields },
    });
  }, [node.id, node.data, fields, onUpdate]);

  const handleDataLinkClick = useCallback((fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const field = fields.find((f: FormNodeField) => f.id === fieldId);
    onOpenDataLinkPicker?.(fieldId, field?.dataLink);
  }, [fields, onOpenDataLinkPicker]);

  const handleRemoveDataLink = useCallback((fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedFields = fields.map((f: FormNodeField) => 
      f.id === fieldId ? { ...f, dataLink: undefined } : f
    );
    onUpdate?.(node.id, {
      data: { ...node.data, fields: updatedFields },
    });
  }, [node.id, node.data, fields, onUpdate]);

  const getLinkedValue = useCallback((field: FormNodeField): string => {
    if (!field.dataLink) return field.value;
    
    const table = tables.find(t => t.id === field.dataLink?.tableId);
    if (!table) return field.dataLink.displayValue || '[Table not found]';
    
    const row = table.rows.find(r => r.id === field.dataLink?.rowId);
    if (!row) return field.dataLink.displayValue || '[Row not found]';
    
    const value = row.values[field.dataLink.columnId];
    return value !== null && value !== undefined ? String(value) : '';
  }, [tables]);

  const renderField = useCallback((field: FormNodeField, index: number) => {
    const isLinked = !!field.dataLink;
    const displayValue = getLinkedValue(field);
    const isEditing = editingFieldId === field.id;

    return (
      <div 
        key={field.id}
        className="flex items-start gap-2 group"
        data-testid={`form-field-${field.id}`}
      >
        <div className="flex-1 space-y-1">
          {(node.data.showLabels !== false) && (
            <input
              type="text"
              value={field.label}
              onChange={(e) => handleFieldLabelChange(field.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-xs font-medium text-gray-600 dark:text-gray-400 bg-transparent border-none p-0 w-full focus:outline-none focus:ring-0"
              placeholder="Field label"
              data-testid={`form-field-label-${field.id}`}
            />
          )}
          <div className="flex items-center gap-1">
            <input
              type={field.type || 'text'}
              value={isLinked ? displayValue : field.value}
              onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder={field.placeholder || 'Enter value...'}
              disabled={isLinked}
              className={cn(
                "flex-1 px-2 py-1.5 text-sm border rounded transition-colors",
                "focus:outline-none focus:ring-1 focus:ring-indigo-500",
                isLinked 
                  ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 cursor-not-allowed" 
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              )}
              data-testid={`form-field-input-${field.id}`}
            />
            
            {isLinked ? (
              <button
                onClick={(e) => handleRemoveDataLink(field.id, e)}
                className="p-1.5 text-indigo-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                title="Remove data link"
                data-testid={`form-field-unlink-${field.id}`}
              >
                <Link2Off size={14} />
              </button>
            ) : (
              <button
                onClick={(e) => handleDataLinkClick(field.id, e)}
                className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="Link to table data"
                data-testid={`form-field-link-${field.id}`}
              >
                <Link2 size={14} />
              </button>
            )}
            
            <button
              onClick={(e) => handleRemoveField(field.id, e)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
              title="Remove field"
              data-testid={`form-field-remove-${field.id}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
          
          {isLinked && field.dataLink && (
            <div className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
              <Link2 size={10} />
              <span className="truncate">
                Linked: {field.dataLink.tableId} → {field.dataLink.columnId}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }, [
    node.data.showLabels,
    editingFieldId,
    getLinkedValue,
    handleFieldLabelChange,
    handleFieldValueChange,
    handleDataLinkClick,
    handleRemoveDataLink,
    handleRemoveField
  ]);

  return (
    <div
      ref={nodeRef}
      className={cn(
        "kiteframe-node absolute cursor-move select-none",
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
      data-testid={`form-node-${node.id}`}
    >
      {/* Drag placeholder - renders lightweight version during drag for performance */}
      {showDragPlaceholder ? (
        <>
          <DragPlaceholder
            nodeType="form"
            width={nodeWidth}
            height={nodeHeight}
            label={formTitle}
            selected={node.selected}
          />
          {showHandles && (
            <NodeHandles
              node={{ ...node, width: nodeWidth, height: nodeHeight }}
              scale={viewport?.zoom || 1}
              onHandleConnect={onHandleConnect}
            />
          )}
        </>
      ) : (
        <>
          <div
            className={cn(
              "w-full h-full flex flex-col rounded-xl overflow-hidden shadow-lg",
              node.selected && "outline outline-2 outline-blue-500"
            )}
            style={{
              backgroundColor: bodyColor,
              borderWidth: 2,
              borderStyle: 'solid',
              borderColor: borderColor,
            }}
          >
            {/* Header */}
            <div
          className="flex items-center justify-between px-3 py-2 gap-2 group rounded-t-lg"
          style={{ backgroundColor: headerColor }}
          onDoubleClick={handleTitleDoubleClick}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText size={16} style={{ color: headerTextColor }} />
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
                data-testid={`form-title-input-${node.id}`}
              />
            ) : (
              <span
                className="text-sm font-medium truncate cursor-text"
                style={{ color: headerTextColor }}
                title={formTitle}
              >
                {sanitizeText(formTitle)}
              </span>
            )}
          </div>
          <span 
            className="px-1.5 py-0.5 bg-white/20 rounded text-xs flex-shrink-0"
            style={{ color: headerTextColor }}
          >
            {fields.length} fields
          </span>
        </div>

        {/* Fields Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-4">
              <FileText size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No fields yet</p>
              <button
                onClick={handleAddField}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddField(e as any);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors"
                data-testid={`form-add-first-field-${node.id}`}
              >
                <Plus size={14} />
                Add Field
              </button>
            </div>
          ) : (
            <>
              {fields.map((field: FormNodeField, index: number) => renderField(field, index))}
            </>
          )}
        </div>

        {/* Footer - Add Field Button */}
        {fields.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={handleAddField}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddField(e as any);
              }}
              className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
              data-testid={`form-add-field-${node.id}`}
            >
              <Plus size={14} />
              Add Field
            </button>
          </div>
        )}
      </div>
        </>
      )}

      {/* Connection Handles - always rendered outside conditional */}
      {showHandles && (
        <NodeHandles
          node={{ ...node, width: nodeWidth, height: nodeHeight }}
          scale={viewport?.zoom || 1}
          onHandleConnect={onHandleConnect}
        />
      )}

      {/* Resize Handle - only visible when selected, always outside conditional */}
      {showResizeHandle && node.resizable !== false && node.selected && !showDragPlaceholder && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={handleResize}
          minWidth={MIN_FORM_WIDTH}
          minHeight={MIN_FORM_HEIGHT}
        />
      )}
    </div>
  );
};

export const FormNode = memo(FormNodeComponent);

export const createFormNode = (
  id: string,
  position: { x: number; y: number },
  data: Partial<FormNodeData> = {},
): Node & { data: FormNodeData } => ({
  id,
  type: 'form',
  position,
  data: {
    label: data.label || 'Form',
    formTitle: data.formTitle || 'Form',
    fields: data.fields || [],
    showLabels: data.showLabels ?? true,
    layout: data.layout || 'vertical',
    colors: data.colors || {
      headerBackground: '#6366f1',
      bodyBackground: '#ffffff',
      borderColor: '#818cf8',
      headerTextColor: '#ffffff',
    },
  },
  style: {
    width: DEFAULT_FORM_WIDTH,
    height: DEFAULT_FORM_HEIGHT,
  },
  resizable: true,
  draggable: true,
  selectable: true,
});
