import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import DragPlaceholder from './DragPlaceholder';
import { useScrollIsolation } from '../hooks/useScrollIsolation';
import { 
  Plus, 
  Trash2, 
  Link2, 
  Link2Off, 
  GripVertical,
  FileText,
  Table2,
  ExternalLink,
  X,
  Move,
  Type,
  Hash,
  Mail,
  Globe,
  Calendar,
  AlignLeft,
  CheckSquare,
  ToggleLeft,
  ChevronDown,
  Circle
} from 'lucide-react';
import type { 
  Node as KiteNode, 
  FormNodeData, 
  FormNodeField, 
  FormFieldType,
  DataTable,
  FormNodeComponentProps 
} from '../types';
import { sanitizeText } from '../utils/validation';
import { getBorderColorFromHeader } from '@/lib/themes';
import { StatusBadge } from './StatusBadge';

const MIN_FORM_WIDTH = 280;
const MIN_FORM_HEIGHT = 150;
const DEFAULT_FORM_WIDTH = 320;
const DEFAULT_FORM_HEIGHT = 200;
const MAX_FORM_HEIGHT = 600;

interface FieldPickerMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onAddField: (type: FormFieldType) => void;
  onClose: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}

const FieldPickerMenu: React.FC<FieldPickerMenuProps> = ({
  isOpen,
  position,
  onAddField,
  onClose,
  onDragStart
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { type: 'text' as FormFieldType, icon: Type, label: 'Text', color: 'bg-blue-500' },
    { type: 'number' as FormFieldType, icon: Hash, label: 'Number', color: 'bg-emerald-500' },
    { type: 'email' as FormFieldType, icon: Mail, label: 'Email', color: 'bg-purple-500' },
    { type: 'url' as FormFieldType, icon: Globe, label: 'URL', color: 'bg-cyan-500' },
    { type: 'date' as FormFieldType, icon: Calendar, label: 'Date', color: 'bg-orange-500' },
    { type: 'textarea' as FormFieldType, icon: AlignLeft, label: 'Textarea', color: 'bg-indigo-500' },
    { type: 'checkbox' as FormFieldType, icon: CheckSquare, label: 'Checkbox', color: 'bg-green-500' },
    { type: 'toggle' as FormFieldType, icon: ToggleLeft, label: 'Toggle', color: 'bg-pink-500' },
    { type: 'dropdown' as FormFieldType, icon: ChevronDown, label: 'Dropdown', color: 'bg-amber-500' },
    { type: 'radio' as FormFieldType, icon: Circle, label: 'Radio', color: 'bg-rose-500' },
  ];

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        minWidth: 240,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid="form-field-picker-menu"
    >
      <div 
        className="flex items-center justify-between px-3 py-2 bg-indigo-100 dark:bg-indigo-900/50 cursor-move"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2">
          <Move size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Add Field</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded"
          data-testid="close-field-picker-menu"
        >
          <X size={14} className="text-indigo-600 dark:text-indigo-400" />
        </button>
      </div>
      <div className="p-2 grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.type}
            onClick={(e) => {
              e.stopPropagation();
              onAddField(item.type);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddField(item.type);
            }}
            className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid={`add-field-${item.type}`}
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

  return createPortal(menuContent, document.body);
};

const FormNodeComponent: React.FC<FormNodeComponentProps> = ({
  node,
  onUpdate,
  onDoubleClick,
  onFocusNode,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  isStatusEnabled = false,
  onStatusClick,
  readOnly = false,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
  tables = [],
  onOpenDataLinkPicker,
  onLinkTable,
  onUnlinkTable,
  onUpdateTableCell,
  showDragPlaceholder = false,
  isAnyDragActive = false,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.formTitle || 'Form');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [fieldPickerPosition, setFieldPickerPosition] = useState({ x: 0, y: 0 });
  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [menuDragOffset, setMenuDragOffset] = useState({ x: 0, y: 0 });
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Prevent canvas zoom from intercepting scroll events on the form content
  useScrollIsolation(contentRef);
  
  const fields = node.data.fields || [];
  const formTitle = node.data.formTitle || 'Form';
  
  const nodeWidth = node.style?.width || node.width || DEFAULT_FORM_WIDTH;
  const rawHeight = node.style?.height || node.height || DEFAULT_FORM_HEIGHT;
  const nodeHeight = Math.min(rawHeight, MAX_FORM_HEIGHT);
  
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

  const handleOpenFieldPicker = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFieldPickerPosition({
      x: rect.left,
      y: rect.bottom + 4,
    });
    setShowFieldPicker(true);
  }, []);

  const handleAddFieldWithType = useCallback((type: FormFieldType) => {
    const fieldLabels: Record<FormFieldType, string> = {
      text: 'Text',
      number: 'Number',
      email: 'Email',
      url: 'URL',
      date: 'Date',
      textarea: 'Text Area',
      checkbox: 'Checkbox',
      toggle: 'Toggle',
      dropdown: 'Dropdown',
      radio: 'Radio',
    };
    
    const timestamp = Date.now();
    const optionIds = [`opt-${timestamp}-1`, `opt-${timestamp}-2`, `opt-${timestamp}-3`];
    
    const newField: FormNodeField = {
      id: `field-${timestamp}`,
      label: `${fieldLabels[type]} ${fields.length + 1}`,
      value: '',
      type,
      placeholder: type === 'email' ? 'Enter email...' 
        : type === 'url' ? 'Enter URL...'
        : type === 'number' ? 'Enter number...'
        : 'Enter value...',
      checked: type === 'checkbox' || type === 'toggle' ? false : undefined,
      options: type === 'dropdown' || type === 'radio' ? [
        { id: optionIds[0], label: 'Option 1', value: 'option1' },
        { id: optionIds[1], label: 'Option 2', value: 'option2' },
        { id: optionIds[2], label: 'Option 3', value: 'option3' },
      ] : undefined,
      selectedOptionId: type === 'dropdown' || type === 'radio' ? optionIds[0] : undefined,
    };
    onUpdate?.(node.id, {
      data: { ...node.data, fields: [...fields, newField] },
    });
    setShowFieldPicker(false);
  }, [node.id, node.data, fields, onUpdate]);

  const handleMenuDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMenu(true);
    setMenuDragOffset({
      x: e.clientX - fieldPickerPosition.x,
      y: e.clientY - fieldPickerPosition.y,
    });
  }, [fieldPickerPosition]);

  useEffect(() => {
    if (!isDraggingMenu) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setFieldPickerPosition({
        x: e.clientX - menuDragOffset.x,
        y: e.clientY - menuDragOffset.y,
      });
    };
    
    const handleMouseUp = () => {
      setIsDraggingMenu(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingMenu, menuDragOffset]);

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

  const handleFieldValueChange = useCallback((fieldId: string, newValue: string, isLinked: boolean = false) => {
    const field = fields.find((f: FormNodeField) => f.id === fieldId);
    
    if (isLinked && field?.dataLink && onUpdateTableCell) {
      onUpdateTableCell(
        field.dataLink.tableId,
        field.dataLink.rowId,
        field.dataLink.columnId,
        newValue
      );
    } else {
      const updatedFields = fields.map((f: FormNodeField) => 
        f.id === fieldId ? { ...f, value: newValue, dataLink: undefined } : f
      );
      onUpdate?.(node.id, {
        data: { ...node.data, fields: updatedFields },
      });
    }
  }, [node.id, node.data, fields, onUpdate, onUpdateTableCell]);

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

  const handleFieldCheckedChange = useCallback((fieldId: string, checked: boolean) => {
    const updatedFields = fields.map((f: FormNodeField) => 
      f.id === fieldId ? { ...f, checked } : f
    );
    onUpdate?.(node.id, {
      data: { ...node.data, fields: updatedFields },
    });
  }, [node.id, node.data, fields, onUpdate]);

  const handleFieldOptionChange = useCallback((fieldId: string, selectedOptionId: string) => {
    const updatedFields = fields.map((f: FormNodeField) => 
      f.id === fieldId ? { ...f, selectedOptionId } : f
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

  const renderFieldInput = useCallback((field: FormNodeField, isLinked: boolean, displayValue: string) => {
    const fieldType = field.type || 'text';
    const baseInputClass = cn(
      "w-full px-2 py-1.5 text-sm border rounded transition-colors",
      "focus:outline-none focus:ring-1 focus:ring-indigo-500",
      "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
    );

    switch (fieldType) {
      case 'textarea':
        return (
          <textarea
            value={isLinked ? displayValue : field.value}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value, isLinked)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={field.placeholder || 'Enter text...'}
            rows={3}
            className={cn(baseInputClass, "resize-none")}
            data-testid={`form-field-textarea-${field.id}`}
          />
        );

      case 'checkbox':
        return (
          <label 
            className="flex items-center gap-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={field.checked || false}
              onChange={(e) => handleFieldCheckedChange(field.id, e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
              data-testid={`form-field-checkbox-${field.id}`}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {field.checked ? 'Checked' : 'Unchecked'}
            </span>
          </label>
        );

      case 'toggle':
        return (
          <label 
            className="flex items-center gap-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="switch"
              aria-checked={field.checked || false}
              onClick={(e) => {
                e.stopPropagation();
                handleFieldCheckedChange(field.id, !field.checked);
              }}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                field.checked ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-600"
              )}
              data-testid={`form-field-toggle-${field.id}`}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  field.checked ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {field.checked ? 'On' : 'Off'}
            </span>
          </label>
        );

      case 'dropdown':
        return (
          <select
            value={field.selectedOptionId || ''}
            onChange={(e) => handleFieldOptionChange(field.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(baseInputClass, "cursor-pointer")}
            data-testid={`form-field-dropdown-${field.id}`}
          >
            {field.options?.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div 
            className="flex flex-col gap-1.5"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {field.options?.map((option) => (
              <label 
                key={option.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`radio-${field.id}`}
                  value={option.id}
                  checked={field.selectedOptionId === option.id}
                  onChange={() => handleFieldOptionChange(field.id, option.id)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  data-testid={`form-field-radio-${field.id}-${option.id}`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type={fieldType}
            value={isLinked ? displayValue : field.value}
            onChange={(e) => handleFieldValueChange(field.id, e.target.value, isLinked)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={field.placeholder || 'Enter value...'}
            className={baseInputClass}
            data-testid={`form-field-input-${field.id}`}
          />
        );
    }
  }, [handleFieldValueChange, handleFieldCheckedChange, handleFieldOptionChange]);

  const renderField = useCallback((field: FormNodeField, index: number) => {
    const isLinked = !!field.dataLink;
    const displayValue = getLinkedValue(field);
    const fieldType = field.type || 'text';
    const isCheckboxOrToggle = fieldType === 'checkbox' || fieldType === 'toggle';
    const isRadio = fieldType === 'radio';

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
          <div className={cn(
            "flex",
            isRadio ? "flex-col" : "items-center"
          )}>
            <div className={cn("flex-1 min-w-0", isRadio && "mb-1")}>
              {renderFieldInput(field, isLinked, displayValue)}
            </div>
            
            <div className="flex items-center flex-shrink-0">
              {!isCheckboxOrToggle && !isRadio && (
                isLinked ? (
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
                )
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
          </div>
        </div>
      </div>
    );
  }, [
    node.data.showLabels,
    getLinkedValue,
    renderFieldInput,
    handleFieldLabelChange,
    handleDataLinkClick,
    handleRemoveDataLink,
    handleRemoveField
  ]);

  return (
    <div
      ref={nodeRef}
      className={cn(
        "kiteframe-node group absolute cursor-move select-none",
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
        <DragPlaceholder
          nodeType="form"
          width={nodeWidth}
          height={nodeHeight}
          label={formTitle}
          selected={node.selected}
        />
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
          
          {/* Link Table Button/Indicator */}
          {node.data.linkedTableId ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.data.linkedTableNodeId && onFocusNode) {
                    onFocusNode(node.data.linkedTableNodeId);
                  }
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors"
                style={{ color: headerTextColor }}
                title={`Linked to: ${node.data.linkedTableName || node.data.linkedTableId}`}
                data-testid={`form-linked-table-${node.id}`}
              >
                <Table2 size={12} />
                <span className="truncate max-w-[80px]">
                  {node.data.linkedTableName || 'Table'}
                </span>
                <ExternalLink size={10} className="opacity-60" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlinkTable?.(node.id);
                }}
                className="p-0.5 hover:bg-white/20 rounded transition-colors"
                style={{ color: headerTextColor }}
                title="Unlink from table"
                data-testid={`form-unlink-table-${node.id}`}
              >
                <Link2Off size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLinkTable?.(node.id);
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors flex-shrink-0"
              style={{ color: headerTextColor }}
              title="Link to a table"
              data-testid={`form-link-table-${node.id}`}
            >
              <Table2 size={12} />
              <span>Link table</span>
            </button>
          )}
          
          <span 
            className="px-1.5 py-0.5 bg-white/20 rounded text-xs flex-shrink-0"
            style={{ color: headerTextColor }}
          >
            {fields.length} fields
          </span>
        </div>

        {/* Fields Container */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-4">
              <FileText size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No fields yet</p>
              <button
                onClick={handleOpenFieldPicker}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenFieldPicker(e as any);
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
              onClick={handleOpenFieldPicker}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleOpenFieldPicker(e as any);
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

      {/* Field Picker Menu */}
      <FieldPickerMenu
        isOpen={showFieldPicker}
        position={fieldPickerPosition}
        onAddField={handleAddFieldWithType}
        onClose={() => setShowFieldPicker(false)}
        onDragStart={handleMenuDragStart}
      />
        </>
      )}

      {/* Status Badge Footer - positioned at bottom-right */}
      {isStatusEnabled && (
        <div 
          className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <StatusBadge
            status={node.data?.status}
            onClick={() => onStatusClick?.(node.id)}
            disabled={readOnly}
          />
        </div>
      )}

      {/* Connection Handles - hidden during any drag operation */}
      {showHandles && !isAnyDragActive && (
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
): KiteNode & { data: FormNodeData } => ({
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
