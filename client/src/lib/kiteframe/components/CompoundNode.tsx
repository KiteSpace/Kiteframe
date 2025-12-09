import { memo, useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import DragPlaceholder from './DragPlaceholder';
import { useScrollIsolation } from '../hooks/useScrollIsolation';
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
  Plus,
  Upload,
  Globe,
  Bold,
  Italic,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Minus as MinusIcon,
  Plus as PlusIcon,
  ExternalLink,
  Eye,
  Database,
  Table2,
  LinkIcon,
  Unlink,
  Bookmark,
  Columns
} from 'lucide-react';
import type { 
  Node, 
  CompoundNodeData, 
  CompoundSubcomponent,
  CompoundTextSubcomponent,
  CompoundImageSubcomponent,
  CompoundLinkSubcomponent,
  CompoundInputSubcomponent,
  CompoundInputDataLink,
  DataTable,
  TableNodeInfo,
  CompoundNodeComponentProps
} from '../types';
import { sanitizeText } from '../utils/validation';
import { getBorderColorFromHeader } from '@/lib/themes';
import { toPxNumber } from '@/utils/size';
import { StatusBadge } from './StatusBadge';

const MIN_COMPOUND_WIDTH = 280;
const MIN_COMPOUND_HEIGHT = 180;
const MAX_COMPOUND_HEIGHT = 600;
const DEFAULT_COMPOUND_WIDTH = 320;
const DEFAULT_COMPOUND_HEIGHT = 280;

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

  const menuContent = (
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
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddComponent(item.type);
            }}
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

  return createPortal(menuContent, document.body);
};

// DataLinkPicker - allows selecting a table cell to link to an input
interface DataLinkPickerProps {
  tables: TableNodeInfo[];
  onSelect: (link: CompoundInputDataLink) => void;
  onClose: () => void;
}

const DataLinkPicker: React.FC<DataLinkPickerProps> = ({ tables, onSelect, onClose }) => {
  const [selectedTable, setSelectedTable] = useState<TableNodeInfo | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  
  const selectedTableData = selectedTable?.table;
  const columns = selectedTableData?.columns || [];
  const rows = selectedTableData?.rows?.slice(0, 10) || []; // Limit to first 10 rows for picker
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid="data-link-picker"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-indigo-500" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Link to Table Data</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>
      
      <div className="max-h-48 overflow-y-auto">
        {!selectedTable ? (
          <div className="p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">Select a table:</div>
            {tables.map((t) => (
              <button
                key={t.tableId}
                onClick={() => setSelectedTable(t)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                data-testid={`data-link-table-${t.tableId}`}
              >
                <Table2 size={14} className="text-indigo-500 flex-shrink-0" />
                <span className="truncate">{t.tableName}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {t.table?.rows?.length || 0} rows
                </span>
              </button>
            ))}
          </div>
        ) : !selectedColumn ? (
          <div className="p-2">
            <button
              onClick={() => setSelectedTable(null)}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mb-2"
            >
              ← Back to tables
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">
              Select a column from <span className="font-medium">{selectedTable.tableName}</span>:
            </div>
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => setSelectedColumn(col.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                data-testid={`data-link-column-${col.id}`}
              >
                <span className="truncate">{col.name}</span>
                {col.type && (
                  <span className="text-xs text-gray-400 ml-auto">{col.type}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-2">
            <button
              onClick={() => setSelectedColumn(null)}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mb-2"
            >
              ← Back to columns
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">
              Select a row value:
            </div>
            {rows.map((row, idx) => {
              const value = row.values[selectedColumn];
              const displayVal = value !== null && value !== undefined ? String(value) : '(empty)';
              const column = columns.find(c => c.id === selectedColumn);
              
              return (
                <button
                  key={row.id}
                  onClick={() => {
                    onSelect({
                      tableId: selectedTable.tableId,
                      tableNodeId: selectedTable.nodeId,
                      tableName: selectedTable.tableName,
                      columnId: selectedColumn,
                      columnName: column?.name || selectedColumn,
                      rowId: row.id,
                      rowIndex: idx,
                      displayValue: displayVal !== '(empty)' ? displayVal : '',
                    });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                  data-testid={`data-link-row-${row.id}`}
                >
                  <span className="text-xs text-gray-400 w-6">#{idx + 1}</span>
                  <span className="truncate">{displayVal}</span>
                </button>
              );
            })}
            {rows.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-4">No rows in this table</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface ColumnBindingPickerProps {
  tables: TableNodeInfo[];
  onSelect: (columnId: string, columnName: string) => void;
  onClose: () => void;
  currentBinding?: { columnId: string; columnName: string };
}

const ColumnBindingPicker: React.FC<ColumnBindingPickerProps> = ({ tables, onSelect, onClose, currentBinding }) => {
  const [selectedTable, setSelectedTable] = useState<TableNodeInfo | null>(null);
  
  const columns = selectedTable?.table?.columns || [];
  
  return (
    <div 
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid="column-binding-picker"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 dark:bg-purple-900/30 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <Columns size={14} className="text-purple-500" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Bind to Column</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          <X size={14} className="text-gray-500" />
        </button>
      </div>
      
      {currentBinding && (
        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-600 dark:text-purple-400">
              Currently bound to: <strong>{currentBinding.columnName}</strong>
            </span>
            <button
              onClick={() => onSelect('', '')}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Unbind
            </button>
          </div>
        </div>
      )}
      
      <div className="max-h-48 overflow-y-auto">
        {!selectedTable ? (
          <div className="p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">Select a table:</div>
            {tables.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">No tables available</div>
            ) : (
              tables.map((t) => (
                <button
                  key={t.tableId}
                  onClick={() => setSelectedTable(t)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                  data-testid={`column-bind-table-${t.tableId}`}
                >
                  <Table2 size={14} className="text-purple-500 flex-shrink-0" />
                  <span className="truncate">{t.tableName}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {t.table?.columns?.length || 0} cols
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-2">
            <button
              onClick={() => setSelectedTable(null)}
              className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline mb-2"
            >
              ← Back to tables
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">
              Select a column from <span className="font-medium">{selectedTable.tableName}</span>:
            </div>
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => onSelect(col.id, col.name)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md transition-colors",
                  currentBinding?.columnId === col.id 
                    ? "bg-purple-100 dark:bg-purple-900/50" 
                    : "hover:bg-purple-50 dark:hover:bg-purple-900/30"
                )}
                data-testid={`column-bind-col-${col.id}`}
              >
                <Columns size={14} className="text-purple-500 flex-shrink-0" />
                <span className="truncate">{col.name}</span>
                {col.type && (
                  <span className="text-xs text-gray-400 ml-auto">{col.type}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface SaveAsTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => void;
  defaultName?: string;
}

const SaveAsTemplateDialog: React.FC<SaveAsTemplateDialogProps> = ({ isOpen, onClose, onSave, defaultName }) => {
  const [name, setName] = useState(defaultName || '');
  const [description, setDescription] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      setName(defaultName || '');
      setDescription('');
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultName]);
  
  if (!isOpen) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), description.trim() || undefined);
      onClose();
    }
  };
  
  const dialogContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[320px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        data-testid="save-template-dialog"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bookmark size={16} className="text-purple-500" />
            <span className="font-medium text-gray-900 dark:text-white">Save as Template</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Name *
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Card, User Profile..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              data-testid="template-name-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template is for..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              data-testid="template-description-input"
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="save-template-submit"
            >
              Save Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  
  return createPortal(dialogContent, document.body);
};

interface SubcomponentRendererProps {
  subcomponent: CompoundSubcomponent;
  onUpdate: (id: string, data: any) => void;
  onRemove: (id: string) => void;
  isDragging: boolean;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  dropIndicator: 'above' | 'below' | null;
  isSelected: boolean;
  onImageUpload?: (subcomponentId: string, file: File) => Promise<string>;
  showingUrlInputFor: string | null;
  setShowingUrlInputFor: (id: string | null) => void;
  onHeightChange?: (id: string, height: number) => void;
  tables?: TableNodeInfo[];
  onFocusNode?: (nodeId: string) => void;
  showDataLinkPickerFor: string | null;
  setShowDataLinkPickerFor: (id: string | null) => void;
}

const SubcomponentRenderer: React.FC<SubcomponentRendererProps> = ({
  subcomponent,
  onUpdate,
  onRemove,
  isDragging,
  onDragStart,
  dropIndicator,
  isSelected,
  onImageUpload,
  showingUrlInputFor,
  setShowingUrlInputFor,
  onHeightChange,
  tables,
  onFocusNode,
  showDataLinkPickerFor,
  setShowDataLinkPickerFor
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const showUrlInput = showingUrlInputFor === subcomponent.id;
  
  // Measure actual DOM height and report to parent
  useEffect(() => {
    if (!containerRef.current || !onHeightChange) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onHeightChange(subcomponent.id, entry.contentRect.height);
      }
    });
    
    observer.observe(containerRef.current);
    
    // Report initial height
    onHeightChange(subcomponent.id, containerRef.current.offsetHeight);
    
    return () => observer.disconnect();
  }, [subcomponent.id, onHeightChange]);
  
  const renderContent = () => {
    switch (subcomponent.type) {
      case 'text':
        const textData = subcomponent as CompoundTextSubcomponent;
        const currentFontSize = textData.data.fontSize || 14;
        const isBold = textData.data.fontWeight === 'bold';
        const isItalic = textData.data.fontStyle === 'italic';
        const isStrikethrough = textData.data.textDecoration === 'line-through';
        const currentAlign = textData.data.textAlign || 'left';
        
        if (!isSelected) {
          return (
            <p
              className="text-sm text-gray-700 dark:text-gray-300"
              style={{
                fontSize: currentFontSize,
                fontWeight: textData.data.fontWeight || 'normal',
                fontStyle: textData.data.fontStyle || 'normal',
                textDecoration: textData.data.textDecoration || 'none',
                textAlign: currentAlign,
                color: textData.data.textColor,
              }}
              data-testid={`subcomponent-text-display-${subcomponent.id}`}
            >
              {textData.data.content || 'Empty text'}
            </p>
          );
        }
        return (
          <div className="flex flex-col border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            <textarea
              value={textData.data.content}
              onChange={(e) => onUpdate(subcomponent.id, { content: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Enter text..."
              className="w-full bg-transparent resize-none text-sm text-gray-700 dark:text-gray-300 focus:outline-none p-2"
              style={{
                fontSize: currentFontSize,
                fontWeight: textData.data.fontWeight || 'normal',
                fontStyle: textData.data.fontStyle || 'normal',
                textDecoration: textData.data.textDecoration || 'none',
                textAlign: currentAlign,
                color: textData.data.textColor,
              }}
              rows={2}
              data-testid={`subcomponent-text-${subcomponent.id}`}
            />
            <div className="flex items-center gap-1 px-2 py-1.5 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-0.5 mr-1">
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onUpdate(subcomponent.id, { fontSize: Math.max(10, currentFontSize - 2) });
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="Decrease font size"
                >
                  <MinusIcon size={12} />
                </button>
                <span className="text-xs text-gray-500 w-5 text-center">{currentFontSize}</span>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onUpdate(subcomponent.id, { fontSize: Math.min(48, currentFontSize + 2) });
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="Increase font size"
                >
                  <PlusIcon size={12} />
                </button>
              </div>
              
              <div className="w-px h-4 bg-gray-300 dark:bg-gray-500" />
              
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onUpdate(subcomponent.id, { fontWeight: isBold ? 'normal' : 'bold' });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded transition-colors",
                  isBold 
                    ? "bg-blue-500 text-white" 
                    : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
                title="Bold"
              >
                <Bold size={12} />
              </button>
              
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onUpdate(subcomponent.id, { fontStyle: isItalic ? 'normal' : 'italic' });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded transition-colors",
                  isItalic 
                    ? "bg-blue-500 text-white" 
                    : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
                title="Italic"
              >
                <Italic size={12} />
              </button>
              
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onUpdate(subcomponent.id, { textDecoration: isStrikethrough ? 'none' : 'line-through' });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded transition-colors",
                  isStrikethrough 
                    ? "bg-blue-500 text-white" 
                    : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
                title="Strikethrough"
              >
                <Strikethrough size={12} />
              </button>
              
              <div className="w-px h-4 bg-gray-300 dark:bg-gray-500" />
              
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(subcomponent.id, { textAlign: 'left' }); }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded transition-colors",
                  currentAlign === 'left' 
                    ? "bg-blue-500 text-white" 
                    : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
                title="Align left"
              >
                <AlignLeft size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(subcomponent.id, { textAlign: 'center' }); }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded transition-colors",
                  currentAlign === 'center' 
                    ? "bg-blue-500 text-white" 
                    : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
                title="Align center"
              >
                <AlignCenter size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate(subcomponent.id, { textAlign: 'right' }); }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded transition-colors",
                  currentAlign === 'right' 
                    ? "bg-blue-500 text-white" 
                    : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                )}
                title="Align right"
              >
                <AlignRight size={12} />
              </button>
              
              <div className="w-px h-4 bg-gray-300 dark:bg-gray-500" />
              
              <input
                type="color"
                value={textData.data.textColor || '#374151'}
                onChange={(e) => { 
                  e.stopPropagation(); 
                  onUpdate(subcomponent.id, { textColor: e.target.value }); 
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded cursor-pointer border border-gray-300 dark:border-gray-500"
                title="Text color"
              />
            </div>
          </div>
        );
      
      case 'image':
        const imgData = (subcomponent as CompoundImageSubcomponent).data;
        
        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          
          if (onImageUpload) {
            setIsUploading(true);
            try {
              const url = await onImageUpload(subcomponent.id, file);
              if (url) {
                onUpdate(subcomponent.id, { src: url, sourceType: 'upload' });
              }
            } catch (err) {
              console.error('Image upload failed:', err);
            } finally {
              setIsUploading(false);
            }
          } else {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              onUpdate(subcomponent.id, { src: dataUrl, sourceType: 'upload' });
            };
            reader.readAsDataURL(file);
          }
        };
        
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
              className="w-full bg-gray-100 dark:bg-gray-700 rounded flex flex-col items-center justify-center text-gray-400 py-3"
              style={{ minHeight: imgData.height || 80 }}
              data-testid={`subcomponent-image-placeholder-${subcomponent.id}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                onClick={(e) => e.stopPropagation()}
              />
              
              {isUploading ? (
                <div className="text-center">
                  <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full mx-auto mb-1" />
                  <span className="text-xs">Uploading...</span>
                </div>
              ) : showUrlInput ? (
                <div className="text-center w-full px-3">
                  <input
                    type="text"
                    placeholder="Enter image URL..."
                    className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value) {
                          onUpdate(subcomponent.id, { src: value, sourceType: 'url' });
                        }
                        setShowingUrlInputFor(null);
                      } else if (e.key === 'Escape') {
                        setShowingUrlInputFor(null);
                      }
                    }}
                  />
                  <div className="flex justify-center gap-2 mt-1">
                    <button
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                        const value = input?.value?.trim();
                        if (value) {
                          onUpdate(subcomponent.id, { src: value, sourceType: 'url' });
                        }
                        setShowingUrlInputFor(null);
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={(e) => { e.stopPropagation(); setShowingUrlInputFor(null); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors shadow-md"
                    title="Upload image"
                    data-testid={`subcomponent-image-upload-btn-${subcomponent.id}`}
                  >
                    <Upload size={18} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowingUrlInputFor(subcomponent.id); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-10 h-10 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors shadow-md"
                    title="Add image URL"
                    data-testid={`subcomponent-image-url-btn-${subcomponent.id}`}
                  >
                    <Globe size={18} />
                  </button>
                </div>
              )}
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
        const hasLinkContent = linkData.url || linkData.text;
        
        const getHostname = (url: string) => {
          try {
            const fullUrl = url.startsWith('http') ? url : `https://${url}`;
            return new URL(fullUrl).hostname;
          } catch {
            return url;
          }
        };
        
        if (!isSelected) {
          const hostname = getHostname(linkData.url || '');
          
          if (linkData.showPreview && linkData.url) {
            return (
              <a 
                href={linkData.url.startsWith('http') ? linkData.url : `https://${linkData.url}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                data-testid={`subcomponent-link-preview-${subcomponent.id}`}
                style={{
                  display: 'block',
                  padding: '10px 12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#1f2937', marginBottom: '6px' }}>
                  {linkData.text || linkData.metadata?.title || 'Link'}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                }}>
                  {linkData.metadata?.favicon && (
                    <img 
                      src={linkData.metadata.favicon} 
                      alt="" 
                      style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0 }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {hostname}
                  </span>
                  <ExternalLink size={12} style={{ color: '#9ca3af', marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              </a>
            );
          }
          return (
            <a
              href={linkData.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
              data-testid={`subcomponent-link-display-${subcomponent.id}`}
            >
              {linkData.text || 'Link'}
              <ExternalLink size={12} className="flex-shrink-0" />
            </a>
          );
        }
        
        return (
          <div className="flex flex-col gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            <input
              type="text"
              value={linkData.text}
              onChange={(e) => onUpdate(subcomponent.id, { text: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Link text..."
              className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid={`subcomponent-link-text-${subcomponent.id}`}
            />
            
            <input
              type="text"
              value={linkData.url}
              onChange={(e) => onUpdate(subcomponent.id, { url: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="https://example.com"
              className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid={`subcomponent-link-url-${subcomponent.id}`}
            />
            
            <div className="flex items-center justify-between py-1">
              <label className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                <Eye size={12} />
                Show link preview
              </label>
              <button
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onUpdate(subcomponent.id, { showPreview: !linkData.showPreview });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "relative w-8 h-4 rounded-full transition-colors flex-shrink-0",
                  linkData.showPreview 
                    ? "bg-cyan-500" 
                    : "bg-gray-300 dark:bg-gray-600"
                )}
                data-testid={`subcomponent-link-preview-toggle-${subcomponent.id}`}
              >
                <span 
                  className={cn(
                    "absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm",
                    linkData.showPreview && "translate-x-4"
                  )}
                />
              </button>
            </div>
            
            {hasLinkContent && (
              <a
                href={linkData.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={12} />
                Open link
              </a>
            )}
          </div>
        );
      
      case 'input':
        const inputData = (subcomponent as CompoundInputSubcomponent).data;
        const hasDataLink = !!inputData.dataLink;
        const displayValue = hasDataLink 
          ? (inputData.dataLink?.displayValue || `${inputData.dataLink?.tableName} → ${inputData.dataLink?.columnName}`)
          : (inputData.value || inputData.placeholder || 'Empty');
        const showDataLinkPicker = showDataLinkPickerFor === subcomponent.id;
        
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
                className={cn(
                  "w-full px-2 py-1.5 text-sm border rounded",
                  hasDataLink 
                    ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" 
                    : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
                )}
                data-testid={`subcomponent-input-display-${subcomponent.id}`}
              >
                {hasDataLink ? (
                  <div className="flex items-center gap-1.5">
                    <Database size={12} className="text-indigo-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 truncate">{displayValue}</span>
                  </div>
                ) : (
                  <span className="text-gray-700 dark:text-gray-300">{displayValue}</span>
                )}
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
            
            {hasDataLink ? (
              <div className="flex flex-col gap-1.5">
                <div 
                  className="flex items-center gap-2 px-2 py-1.5 text-sm border border-indigo-300 dark:border-indigo-600 rounded bg-indigo-50 dark:bg-indigo-900/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Database size={14} className="text-indigo-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium truncate">
                      {inputData.dataLink?.tableName}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {inputData.dataLink?.displayValue || `Row ${(inputData.dataLink?.rowIndex || 0) + 1} → ${inputData.dataLink?.columnName}`}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusNode?.(inputData.dataLink!.tableNodeId);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded"
                    title="Go to table"
                    data-testid={`subcomponent-input-goto-table-${subcomponent.id}`}
                  >
                    <Table2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate(subcomponent.id, { dataLink: undefined, value: inputData.dataLink?.displayValue || '' });
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    title="Unlink from table"
                    data-testid={`subcomponent-input-unlink-${subcomponent.id}`}
                  >
                    <Unlink size={14} />
                  </button>
                </div>
              </div>
            ) : showDataLinkPicker && tables && tables.length > 0 ? (
              <DataLinkPicker
                tables={tables}
                onSelect={(link) => {
                  onUpdate(subcomponent.id, { dataLink: link, value: link.displayValue || '' });
                  setShowDataLinkPickerFor(null);
                }}
                onClose={() => setShowDataLinkPickerFor(null)}
              />
            ) : (
              <div className="flex gap-1">
                <input
                  type={inputData.inputType || 'text'}
                  value={inputData.value}
                  onChange={(e) => onUpdate(subcomponent.id, { value: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  placeholder={inputData.placeholder || 'Enter value...'}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  data-testid={`subcomponent-input-${subcomponent.id}`}
                />
                {tables && tables.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDataLinkPickerFor(subcomponent.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="px-2 py-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-600 rounded transition-colors"
                    title="Link to table data"
                    data-testid={`subcomponent-input-link-btn-${subcomponent.id}`}
                  >
                    <LinkIcon size={14} />
                  </button>
                )}
              </div>
            )}
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
        ref={containerRef}
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
      ref={containerRef}
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
  isStatusEnabled = false,
  onStatusClick,
  readOnly = false,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
  onImageUpload,
  tables,
  onFocusNode,
  showDragPlaceholder = false,
  isAnyDragActive = false,
  onSaveAsTemplate,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.label || 'Compound');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [draggingSubcomponent, setDraggingSubcomponent] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);
  const [isMenuDragging, setIsMenuDragging] = useState(false);
  const [menuDragOffset, setMenuDragOffset] = useState({ x: 0, y: 0 });
  const [showingUrlInputFor, setShowingUrlInputFor] = useState<string | null>(null);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [showDataLinkPickerFor, setShowDataLinkPickerFor] = useState<string | null>(null);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Prevent canvas zoom from intercepting scroll events on the compound content
  useScrollIsolation(containerRef);
  
  // Callback for subcomponents to report their measured heights
  const handleHeightChange = useCallback((id: string, height: number) => {
    setMeasuredHeights(prev => {
      if (prev[id] === height) return prev; // Avoid unnecessary re-renders
      return { ...prev, [id]: height };
    });
  }, []);
  
  const subcomponents = useMemo(() => 
    [...(node.data.subcomponents || [])].sort((a, b) => a.order - b.order),
    [node.data.subcomponents]
  );
  
  const nodeWidth = toPxNumber(node.style?.width ?? node.width, DEFAULT_COMPOUND_WIDTH);
  
  // Calculate height from measured DOM heights when available
  const measuredContentHeight = useMemo(() => {
    const headerHeight = 48;
    const padding = 24; // 12px top + 12px bottom
    const gap = node.data.gap || 8;
    
    if (subcomponents.length === 0) {
      return headerHeight + 100; // Empty state with add button
    }
    
    // Sum measured heights for all subcomponents
    let totalMeasured = 0;
    let allMeasured = true;
    
    subcomponents.forEach((sub) => {
      const measured = measuredHeights[sub.id];
      if (measured !== undefined && measured > 0) {
        totalMeasured += measured + gap;
      } else {
        allMeasured = false;
        // Fallback estimate if not yet measured
        totalMeasured += 60 + gap;
      }
    });
    
    // Add extra space when editing for add button at bottom
    const editingBuffer = isEditing ? 50 : 10;
    
    return headerHeight + padding + totalMeasured + editingBuffer;
  }, [subcomponents, measuredHeights, isEditing, node.data.gap]);
  
  // Height calculation:
  // - If user has manually resized (tracked via userResized flag OR explicit height differs from defaults), 
  //   use their explicit height
  // - Otherwise, use measured content height capped at MAX_COMPOUND_HEIGHT (600px)
  // - Content scrolls if it exceeds the container height
  // Use toPxNumber to normalize string values like "420px" to numbers
  const explicitHeight = toPxNumber(node.style?.height ?? node.height, 0);
  // Detect user resize: explicit flag OR explicit height exists that differs from default
  // This ensures backward compatibility with nodes resized before the flag was introduced
  const hasUserResized = node.data.userResized === true || 
    (explicitHeight > 0 && explicitHeight !== DEFAULT_COMPOUND_HEIGHT);
  
  const nodeHeight = hasUserResized
    ? Math.max(explicitHeight, MIN_COMPOUND_HEIGHT) // User resized: respect their setting
    : Math.min(Math.max(measuredContentHeight, MIN_COMPOUND_HEIGHT), MAX_COMPOUND_HEIGHT); // Auto: cap at 600px
  
  const headerColor = node.data.colors?.headerBackground || '#059669';
  const bodyColor = node.data.colors?.bodyBackground || '#ffffff';
  const borderColor = node.data.colors?.borderColor || getBorderColorFromHeader(headerColor);
  const headerTextColor = node.data.colors?.headerTextColor || '#ffffff';

  // Reset editing state when node is deselected
  useEffect(() => {
    if (!node.selected) {
      if (menuOpen) setMenuOpen(false);
      if (isEditing) setIsEditing(false);
    }
  }, [node.selected]);
  
  // Sync calculated dimensions to node store for edge positioning
  // This ensures edges have correct dimensions on first render before ResizeObserver fires
  useLayoutEffect(() => {
    // Only sync if dimensions differ significantly from stored values
    const storedWidth = node.measuredWidth ?? node.width ?? DEFAULT_COMPOUND_WIDTH;
    const storedHeight = node.measuredHeight ?? node.height ?? DEFAULT_COMPOUND_HEIGHT;
    
    const widthDiff = Math.abs(storedWidth - nodeWidth);
    const heightDiff = Math.abs(storedHeight - nodeHeight);
    
    // Update if dimensions differ by more than 1px (avoid floating point noise)
    if ((widthDiff > 1 || heightDiff > 1) && onUpdate) {
      onUpdate(node.id, {
        measuredWidth: nodeWidth,
        measuredHeight: nodeHeight,
      });
    }
  }, [node.id, nodeWidth, nodeHeight, node.measuredWidth, node.measuredHeight, node.width, node.height, onUpdate]);

  const calculateMenuPosition = useCallback((rect: DOMRect) => {
    const menuWidth = 200;
    const menuHeight = 180;
    const padding = 16;
    
    // Position above the node, centered horizontally (like linear toolbar)
    let x = rect.left + (rect.width / 2) - (menuWidth / 2);
    let y = rect.top - menuHeight - padding;
    
    // Check if menu would go off the left edge
    if (x < padding) {
      x = padding;
    }
    
    // Check if menu would go off the right edge
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    
    // If menu would go above the top, position below the node instead
    if (y < padding) {
      y = rect.bottom + padding;
    }
    
    // If still off bottom, clamp to visible area
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }
    
    return { x, y };
  }, []);

  useEffect(() => {
    const handleOpenComponentMenu = (e: CustomEvent<{ nodeId: string }>) => {
      if (e.detail.nodeId === node.id) {
        setIsEditing(true);
        const rect = nodeRef.current?.getBoundingClientRect();
        if (rect) {
          setMenuPosition(calculateMenuPosition(rect));
          setMenuOpen(true);
        }
      }
    };

    window.addEventListener('openCompoundComponentMenu', handleOpenComponentMenu as EventListener);
    return () => {
      window.removeEventListener('openCompoundComponentMenu', handleOpenComponentMenu as EventListener);
    };
  }, [node.id, calculateMenuPosition]);

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
    
    // Double-click enters editing mode only (doesn't open menu - that's via + button only)
    setIsEditing(true);
    
    // Close the linear toolbar if it's open
    window.dispatchEvent(new CustomEvent('closeLinearToolbar'));
    
    // Also call the original double-click handler if provided
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
        data: { ...node.data, userResized: true },
      });
    }
  }, [node.id, node.style, node.data, onUpdate]);

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
        data-testid={`compound-node-${node.id}`}
      >
        {/* Drag placeholder - renders lightweight version during drag for performance */}
        {showDragPlaceholder ? (
          <DragPlaceholder
            nodeType="compound"
            width={nodeWidth}
            height={nodeHeight}
            label={node.data.label || 'Compound'}
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
                borderWidth: node.data.colors?.borderColor ? 2 : 2,
                borderStyle: node.data.borderStyle || 'solid',
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
              <span 
                className="px-1.5 py-0.5 bg-white/20 rounded text-xs"
                style={{ color: headerTextColor }}
              >
                {subcomponents.length} items
              </span>
              {onSaveAsTemplate && subcomponents.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSaveTemplateDialog(true);
                  }}
                  className="p-1.5 bg-white/20 rounded hover:bg-white/30 transition-colors"
                  title="Save as Template"
                  data-testid={`compound-save-template-btn-${node.id}`}
                >
                  <Bookmark size={14} style={{ color: headerTextColor }} />
                </button>
              )}
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // If not selected, trigger selection first
                    if (!node.selected && onClick) {
                      onClick(e, node);
                    }
                    setIsEditing(true);
                    const rect = nodeRef.current?.getBoundingClientRect();
                    if (rect) {
                      setMenuPosition(calculateMenuPosition(rect));
                      setMenuOpen(true);
                    }
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // If not selected, trigger selection first
                    if (!node.selected && onClick) {
                      onClick(e as any, node);
                    }
                    setIsEditing(true);
                    const rect = nodeRef.current?.getBoundingClientRect();
                    if (rect) {
                      setMenuPosition(calculateMenuPosition(rect));
                      setMenuOpen(true);
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  data-testid={`compound-add-btn-empty-${node.id}`}
                >
                  <Plus size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
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
                    isSelected={isEditing}
                    onImageUpload={onImageUpload ? (subId, file) => onImageUpload(node.id, file) : undefined}
                    showingUrlInputFor={showingUrlInputFor}
                    setShowingUrlInputFor={setShowingUrlInputFor}
                    onHeightChange={handleHeightChange}
                    tables={tables}
                    onFocusNode={onFocusNode}
                    showDataLinkPickerFor={showDataLinkPickerFor}
                    setShowDataLinkPickerFor={setShowDataLinkPickerFor}
                  />
                ))}
                {isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = nodeRef.current?.getBoundingClientRect();
                      if (rect) {
                        setMenuPosition(calculateMenuPosition(rect));
                        setMenuOpen(true);
                      }
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = nodeRef.current?.getBoundingClientRect();
                      if (rect) {
                        setMenuPosition(calculateMenuPosition(rect));
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

          </>
        )}

        {/* Status Badge Footer - positioned at bottom-right */}
        {isStatusEnabled && (
          <div 
            className="px-3 py-1.5 border-t flex items-center justify-end"
            style={{ borderColor: borderColor }}
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
            minWidth={MIN_COMPOUND_WIDTH}
            minHeight={MIN_COMPOUND_HEIGHT}
          />
        )}
      </div>

      <ComponentMenu
        isOpen={menuOpen}
        position={menuPosition}
        onAddComponent={handleAddComponent}
        onClose={() => setMenuOpen(false)}
        onDragStart={handleMenuDragStart}
      />
      
      <SaveAsTemplateDialog
        isOpen={showSaveTemplateDialog}
        onClose={() => setShowSaveTemplateDialog(false)}
        onSave={(name, description) => {
          onSaveAsTemplate?.(node.id, name, description);
        }}
        defaultName={node.data.label || 'Compound'}
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
