import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from "react";
import { cn } from "@/lib/utils";
import { 
  Table2, 
  Plus, 
  Upload, 
  ChevronDown, 
  ChevronUp,
  GripHorizontal,
  Search,
  X
} from "lucide-react";
import { NodeHandles } from "./NodeHandles";
import { ResizeHandle } from "./ResizeHandle";
import type { Node, TableNodeData, DataTable, DataTableColumn, DataTableRow } from "../types";
import { sanitizeText, validateColor } from "../utils/validation";
import { getBorderColorFromHeader } from "@/lib/themes";

const MAX_VISIBLE_ROWS = 50;
const MAX_ROW_TO_NODE = 25;
const MIN_TABLE_WIDTH = 280;
const MIN_TABLE_HEIGHT = 200;
const DEFAULT_TABLE_WIDTH = 560;
const DEFAULT_TABLE_HEIGHT = 400;

interface TableNodeComponentProps {
  node: Node & { data: TableNodeData };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onConnect?: (connection: { source: string; target: string }) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onUpdateTable?: (tableId: string, table: DataTable) => void;
  onCreateNodeFromRow?: (tableId: string, row: Record<string, unknown>, rowIndex: number) => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onHandleConnect?: (position: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  showHandles?: boolean;
  showResizeHandle?: boolean;
}

const TableNodeComponent: React.FC<TableNodeComponentProps> = ({
  node,
  onUpdate,
  onConnect,
  onDoubleClick,
  onUpdateTable,
  onCreateNodeFromRow,
  onStartDrag,
  onClick,
  onHandleConnect,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.data.label || "");
  const [isHovering, setIsHovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const table = node.data.table;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      onDoubleClick?.(e);
    },
    [onDoubleClick],
  );

  const handleLabelSubmit = useCallback(() => {
    if (onUpdate) {
      const sanitizedLabel = sanitizeText(editValue.trim() || "Table");
      onUpdate(node.id, {
        data: { ...node.data, label: sanitizedLabel },
      });
    }
    setIsEditing(false);
  }, [editValue, node.id, node.data, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLabelSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditValue(node.data.label || "");
        setIsEditing(false);
      }
    },
    [handleLabelSubmit, node.data.label],
  );

  const handleResize = useCallback(
    (width: number, height: number) => {
      if (onUpdate) {
        onUpdate(node.id, {
          style: { ...node.style, width, height },
        });
      }
    },
    [node.id, node.style, onUpdate],
  );

  const handleColumnSort = useCallback((columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const filteredAndSortedRows = useMemo(() => {
    if (!table) return [];
    
    let rows = [...table.rows];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter(row => 
        Object.values(row.values).some(value => 
          String(value ?? '').toLowerCase().includes(query)
        )
      );
    }
    
    if (sortColumn) {
      rows.sort((a, b) => {
        const aVal = a.values[sortColumn];
        const bVal = b.values[sortColumn];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    return rows.slice(0, MAX_VISIBLE_ROWS);
  }, [table, searchQuery, sortColumn, sortDirection]);

  const canCreateFromRow = useCallback((index: number) => index < MAX_ROW_TO_NODE, []);

  const handleCreateNode = useCallback((row: DataTableRow, rowIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateNodeFromRow?.(node.data.tableId, row.values as Record<string, unknown>, rowIndex);
  }, [node.data.tableId, onCreateNodeFromRow]);

  const handleImportClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const { importFromFile } = await import('../utils/dataImport');
      const parsedTable = await importFromFile(file);
      
      const tableWithId: DataTable = {
        ...parsedTable,
        id: node.data.tableId,
      };
      
      onUpdateTable?.(node.data.tableId, tableWithId);
      
      if (onUpdate) {
        onUpdate(node.id, {
          data: { 
            ...node.data, 
            table: tableWithId,
            label: tableWithId.name || node.data.label,
          },
        });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [node.id, node.data, onUpdate, onUpdateTable]);

  const colors = useMemo(() => {
    const nodeColors = node.data.colors || {};
    const headerBg = validateColor(nodeColors.headerBackground || "")
      ? nodeColors.headerBackground
      : "#4f46e5";
    
    const borderColor = getBorderColorFromHeader(headerBg);
    
    return {
      headerBg,
      bodyBg: validateColor(nodeColors.bodyBackground || "")
        ? nodeColors.bodyBackground
        : "#ffffff",
      borderColor,
      headerTextColor: validateColor(nodeColors.headerTextColor || "")
        ? nodeColors.headerTextColor
        : "#ffffff",
      bodyTextColor: validateColor(nodeColors.bodyTextColor || "")
        ? nodeColors.bodyTextColor
        : "#374151",
    };
  }, [node.data.colors]);

  const nodeWidth = node.style?.width || node.width || DEFAULT_TABLE_WIDTH;
  const nodeHeight = node.style?.height || node.height || DEFAULT_TABLE_HEIGHT;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[role="button"]') || target.closest('th')) {
      return;
    }
    e.stopPropagation();
    onStartDrag?.(e);
  }, [onStartDrag]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[role="button"]') || target.closest('th')) {
      return;
    }
    e.stopPropagation();
    onClick?.(e);
  }, [onClick]);

  const tableName = node.data.label || table?.name || 'Table';
  const rowCount = table?.rows?.length || 0;
  const colCount = table?.columns?.length || 0;

  const dropShadow = isHovering ? '0 8px 24px rgba(0,0,0,0.15)' : '0 4px 16px rgba(0,0,0,0.1)';

  const containerStyle: React.CSSProperties = {
    ...style,
    width: nodeWidth,
    height: nodeHeight,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: colors.borderColor,
    boxShadow: dropShadow,
    background: colors.bodyBg,
    overflow: 'hidden',
  };

  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
        <Upload size={28} className="text-gray-400" />
      </div>
      <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">No data imported</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Import a CSV or JSON file to get started</p>
      <button
        onClick={handleImportClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
        data-testid={`table-import-empty-${node.id}`}
      >
        <Plus size={14} />
        Import CSV/JSON
      </button>
    </div>
  );

  const renderTableContent = () => (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
          <tr>
            <th className="w-8 px-2 py-1.5 text-left text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
              #
            </th>
            {table!.columns.map((col: DataTableColumn) => (
              <th 
                key={col.id}
                onClick={(e) => { e.stopPropagation(); handleColumnSort(col.id); }}
                className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                style={{ minWidth: col.width || 80 }}
              >
                <div className="flex items-center gap-1">
                  <span className="truncate">{sanitizeText(col.name)}</span>
                  {sortColumn === col.id && (
                    sortDirection === 'asc' 
                      ? <ChevronUp size={12} className="text-indigo-500 flex-shrink-0" />
                      : <ChevronDown size={12} className="text-indigo-500 flex-shrink-0" />
                  )}
                </div>
              </th>
            ))}
            <th className="w-10 px-2 py-1.5 text-center font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedRows.map((row: DataTableRow, rowIndex: number) => (
            <tr 
              key={row.id}
              className={cn(
                "border-b border-gray-100 dark:border-gray-800 transition-colors",
                hoveredRowId === row.id && "bg-indigo-50 dark:bg-indigo-900/20"
              )}
              onMouseEnter={() => setHoveredRowId(row.id)}
              onMouseLeave={() => setHoveredRowId(null)}
            >
              <td className="px-2 py-1.5 text-gray-400">
                {rowIndex + 1}
              </td>
              {table!.columns.map((col: DataTableColumn) => (
                <td 
                  key={col.id}
                  className="px-2 py-1.5 text-gray-600 dark:text-gray-400"
                  title={String(row.values[col.id] ?? "")}
                >
                  <div className="truncate max-w-[150px]">
                    {String(row.values[col.id] ?? "")}
                  </div>
                </td>
              ))}
              <td className="px-2 py-1.5 text-center">
                {canCreateFromRow(rowIndex) ? (
                  <button
                    onClick={(e) => handleCreateNode(row, rowIndex, e)}
                    className={cn(
                      "p-0.5 rounded transition-all",
                      hoveredRowId === row.id 
                        ? "bg-indigo-500 text-white shadow-sm" 
                        : "text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                    )}
                    title="Create node from this row"
                    data-testid={`table-row-create-node-${row.id}`}
                  >
                    <Plus size={14} />
                  </button>
                ) : (
                  <span className="text-gray-300 dark:text-gray-600" title="Row limit reached">
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div
      ref={nodeRef}
      className={cn(
        "kiteframe-node kiteframe-table-node group",
        "rounded-xl flex flex-col",
        "transition-all duration-200",
        "cursor-move",
        node.selected && "ring-2 ring-blue-500 ring-offset-2",
        node.hidden ? "opacity-0 pointer-events-none" : "",
        className,
      )}
      style={containerStyle}
      role="article"
      aria-label={`Table: ${tableName}. ${rowCount} rows, ${colCount} columns`}
      aria-selected={node.selected}
      tabIndex={node.selected ? 0 : -1}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-testid={`table-node-${node.id}`}
      data-node-id={node.id}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        onChange={handleFileChange}
        className="hidden"
        data-testid={`table-file-input-${node.id}`}
      />

      {/* Header - Draggable */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-xl cursor-grab"
        style={{ 
          background: `linear-gradient(135deg, ${colors.headerBg} 0%, ${colors.headerBg}dd 100%)`,
          color: colors.headerTextColor,
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripHorizontal size={14} className="opacity-50 flex-shrink-0" />
          <Table2 size={16} className="flex-shrink-0" />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleLabelSubmit}
              onKeyDown={handleKeyDown}
              className="bg-white/20 border-none outline-none text-sm font-medium w-full px-1.5 py-0.5 rounded"
              style={{ color: colors.headerTextColor }}
              aria-label="Table name"
              data-testid="table-node-label-input"
            />
          ) : (
            <span
              className="text-sm font-medium truncate"
              title={tableName}
            >
              {sanitizeText(tableName)}
            </span>
          )}
          <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs flex-shrink-0">
            {rowCount} rows × {colCount} cols
          </span>
        </div>
        
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="p-1 hover:bg-white/20 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Close"
          data-testid={`table-close-${node.id}`}
        >
          <X size={14} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { e.stopPropagation(); setSearchQuery(e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Search..."
            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            data-testid={`table-search-${node.id}`}
          />
        </div>
        
        <button
          onClick={handleImportClick}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          data-testid={`table-import-${node.id}`}
        >
          <Upload size={12} />
          Import
        </button>
        
        <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {filteredAndSortedRows.length} of {table?.meta?.totalRowCount ?? rowCount}
        </div>
      </div>

      {/* Table Content or Empty State */}
      {table && table.columns && table.columns.length > 0 ? renderTableContent() : renderEmptyState()}

      {/* Footer */}
      {rowCount > MAX_ROW_TO_NODE && (
        <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
          Row-to-node limited to first {MAX_ROW_TO_NODE} rows
        </div>
      )}
      
      {table?.meta?.sourceFileName && (
        <div className="px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs truncate">
          {table.meta.sourceFileName}
          {table.meta.importedAt && ` • ${new Date(table.meta.importedAt).toLocaleDateString()}`}
        </div>
      )}

      {/* Connection Handles */}
      {showHandles && (
        <NodeHandles
          node={node}
          scale={1}
          onHandleConnect={onHandleConnect}
        />
      )}

      {/* Resize Handle */}
      {showResizeHandle && node.resizable !== false && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={handleResize}
          minWidth={MIN_TABLE_WIDTH}
          minHeight={MIN_TABLE_HEIGHT}
        />
      )}
    </div>
  );
};

export const TableNode = memo(TableNodeComponent);

export const createTableNode = (
  id: string,
  position: { x: number; y: number },
  data: Partial<TableNodeData> = {},
): Node & { data: TableNodeData } => ({
  id,
  type: "table",
  position,
  data: {
    label: data.label || "Table",
    tableId: data.tableId || `table-${id}`,
    table: data.table,
    previewRowCount: data.previewRowCount || MAX_VISIBLE_ROWS,
    previewColumnCount: data.previewColumnCount || 10,
    showRowNumbers: data.showRowNumbers ?? true,
    colors: data.colors || {
      headerBackground: "#4f46e5",
      bodyBackground: "#ffffff",
      headerTextColor: "#ffffff",
      bodyTextColor: "#374151",
    },
  },
  width: DEFAULT_TABLE_WIDTH,
  height: DEFAULT_TABLE_HEIGHT,
  style: {
    width: DEFAULT_TABLE_WIDTH,
    height: DEFAULT_TABLE_HEIGHT,
  },
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true,
});
