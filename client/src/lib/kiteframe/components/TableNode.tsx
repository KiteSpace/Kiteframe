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
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Globe,
  Loader2,
  AlertCircle
} from "lucide-react";
import { NodeHandles } from "./NodeHandles";
import { ResizeHandle } from "./ResizeHandle";
import type { 
  Node, 
  TableNodeData, 
  DataTable, 
  DataTableColumn, 
  DataTableRow,
  TableNodeComponentProps,
  TableApiConfig
} from "../types";
import { sanitizeText, validateColor } from "../utils/validation";
import { getBorderColorFromHeader } from "@/lib/themes";

const MAX_VISIBLE_ROWS = 50;
const MAX_ROW_TO_NODE = 25;
const MIN_TABLE_WIDTH = 280;
const MIN_TABLE_HEIGHT = 200;
const DEFAULT_TABLE_WIDTH = 560;
const DEFAULT_TABLE_HEIGHT = 400;
const COLLAPSED_TABLE_HEIGHT = 56;

const TableNodeComponent: React.FC<TableNodeComponentProps> = ({
  node,
  onUpdate,
  onConnect,
  onDoubleClick,
  onFocusNode,
  onUpdateTable,
  onCreateNodeFromRow,
  onStartDrag,
  onClick,
  onHandleConnect,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  viewport,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.data.label || "");
  const [isHovering, setIsHovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(node.data.isLoading || false);
  const [refreshError, setRefreshError] = useState<string | null>(node.data.lastError || null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const table = node.data.table;
  const apiConfig = node.data.apiConfig;

  useEffect(() => {
    if (node.data.isLoading !== undefined && node.data.isLoading !== isRefreshing) {
      setIsRefreshing(node.data.isLoading);
    }
    if (node.data.lastError !== undefined && node.data.lastError !== refreshError) {
      setRefreshError(node.data.lastError || null);
    }
  }, [node.data.isLoading, node.data.lastError]);

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

  const handleApiRefresh = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!apiConfig?.enabled || !apiConfig.url || isRefreshing) {
      return;
    }
    
    setIsRefreshing(true);
    setRefreshError(null);
    
    if (onUpdate) {
      onUpdate(node.id, {
        data: {
          ...node.data,
          isLoading: true,
          lastError: undefined,
        },
      });
    }
    
    try {
      const response = await fetch('/api/table/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: apiConfig.url,
          method: apiConfig.method || 'GET',
          headers: apiConfig.headers || [],
          responseDataPath: apiConfig.responseDataPath,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }
      
      if (result.success && result.data) {
        const updatedTable: DataTable = {
          id: node.data.tableId,
          name: table?.name || node.data.label || 'API Data',
          columns: result.data.columns,
          rows: result.data.rows,
          meta: {
            ...table?.meta,
            ...result.data.meta,
            lastRefreshedAt: new Date().toISOString(),
          },
        };
        
        onUpdateTable?.(node.data.tableId, updatedTable);
        
        if (onUpdate) {
          onUpdate(node.id, {
            data: {
              ...node.data,
              table: updatedTable,
              isLoading: false,
              lastError: undefined,
            },
          });
        }
      }
    } catch (error: any) {
      console.error('API refresh error:', error);
      const errorMessage = error.message || 'Failed to refresh';
      setRefreshError(errorMessage);
      
      if (onUpdate) {
        onUpdate(node.id, {
          data: {
            ...node.data,
            isLoading: false,
            lastError: errorMessage,
          },
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [apiConfig, isRefreshing, node.id, node.data, table, onUpdate, onUpdateTable]);

  const formatLastRefreshed = useCallback((isoString: string | undefined) => {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return null;
    }
  }, []);

  const lastRefreshedText = formatLastRefreshed(table?.meta?.lastRefreshedAt);

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
    onStartDrag?.(e, node);
  }, [onStartDrag, node]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[role="button"]') || target.closest('th')) {
      return;
    }
    e.stopPropagation();
    onClick?.(e, node);
  }, [onClick, node]);

  const tableName = node.data.label || table?.name || 'Table';
  const rowCount = table?.rows?.length || 0;
  const colCount = table?.columns?.length || 0;
  const isCollapsed = node.data.isCollapsed || false;

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdate) {
      onUpdate(node.id, {
        data: { ...node.data, isCollapsed: !isCollapsed },
      });
    }
  }, [node.id, node.data, isCollapsed, onUpdate]);

  const dropShadow = isHovering ? '0 8px 24px rgba(0,0,0,0.15)' : '0 4px 16px rgba(0,0,0,0.1)';

  const actualHeight = isCollapsed ? COLLAPSED_TABLE_HEIGHT : nodeHeight;
  
  const outerWrapperStyle: React.CSSProperties = {
    ...style,
    width: nodeWidth,
    height: actualHeight,
    position: 'relative',
    overflow: 'visible',
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: colors.borderColor,
    boxShadow: dropShadow,
    background: colors.bodyBg,
    overflow: 'hidden',
    borderRadius: '12px',
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
        "transition-all duration-200",
        node.hidden ? "opacity-0 pointer-events-none" : "",
        className,
      )}
      style={outerWrapperStyle}
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
      {/* Visual table container */}
      <div
        className={cn(
          "flex flex-col cursor-move",
          node.selected && "ring-2 ring-blue-500 ring-offset-2"
        )}
        style={containerStyle}
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
          className="flex items-center justify-between px-3 py-2 cursor-grab"
          style={{ 
            background: `linear-gradient(135deg, ${colors.headerBg} 0%, ${colors.headerBg}dd 100%)`,
            color: colors.headerTextColor,
            borderTopLeftRadius: '10px',
            borderTopRightRadius: '10px',
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
        
        <div className="flex items-center gap-1">
          {apiConfig?.enabled && (
            <button
              onClick={handleApiRefresh}
              disabled={isRefreshing}
              className={cn(
                "p-1 rounded transition-colors relative group",
                isRefreshing ? "opacity-50 cursor-wait" : "hover:bg-white/20"
              )}
              title={
                isRefreshing 
                  ? "Refreshing..." 
                  : lastRefreshedText 
                    ? `Last refreshed: ${lastRefreshedText}\nClick to refresh` 
                    : "Refresh from API"
              }
              data-testid={`table-refresh-${node.id}`}
            >
              {isRefreshing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : refreshError ? (
                <AlertCircle size={14} className="text-red-300" />
              ) : (
                <RefreshCw size={14} />
              )}
              {apiConfig.enabled && !isRefreshing && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full" />
              )}
            </button>
          )}
          <button
            onClick={handleToggleCollapse}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isCollapsed ? "Expand table" : "Collapse table"}
            data-testid={`table-toggle-collapse-${node.id}`}
          >
            {isCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Toolbar - hidden when collapsed */}
      {!isCollapsed && (
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
        
        {/* Only show import button when table has no data */}
        {(!table || !table.rows || table.rows.length === 0) && (
          <button
            onClick={handleImportClick}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid={`table-import-${node.id}`}
          >
            <Upload size={12} />
            Import
          </button>
        )}
        
        <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {filteredAndSortedRows.length} of {table?.meta?.totalRowCount ?? rowCount}
        </div>
      </div>
      )}

      {/* Table Content or Empty State - hidden when collapsed */}
      {!isCollapsed && (
        table && table.columns && table.columns.length > 0 ? renderTableContent() : renderEmptyState()
      )}

      {/* Footer - hidden when collapsed */}
      {!isCollapsed && rowCount > MAX_ROW_TO_NODE && (
        <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
          Row-to-node limited to first {MAX_ROW_TO_NODE} rows
        </div>
      )}
      
      {!isCollapsed && table?.meta?.sourceFileName && (
        <div className="px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs truncate">
          {table.meta.sourceFileName}
          {table.meta.importedAt && ` • ${new Date(table.meta.importedAt).toLocaleDateString()}`}
        </div>
      )}
      
      {!isCollapsed && table?.meta?.wasTruncated && (
        <div className="px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs">
          {table.meta.truncationMessage || 'Data was truncated due to size limits'}
        </div>
      )}
      
      {!isCollapsed && apiConfig?.enabled && table?.meta?.lastRefreshedAt && (
        <div className="px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs flex items-center gap-1.5">
          <Globe size={10} />
          <span>API: {lastRefreshedText}</span>
        </div>
      )}
      
      {!isCollapsed && (refreshError || node.data.lastError) && (
        <div className="px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs flex items-center gap-1.5">
          <AlertCircle size={10} />
          <span className="truncate">{refreshError || node.data.lastError}</span>
        </div>
      )}
      </div>

      {/* Connection Handles - positioned outside visual container */}
      {showHandles && (
        <NodeHandles
          node={{ ...node, width: nodeWidth, height: actualHeight }}
          scale={viewport?.zoom || 1}
          onHandleConnect={onHandleConnect}
        />
      )}

      {/* Resize Handle - only visible when selected and not collapsed */}
      {showResizeHandle && node.resizable !== false && node.selected && !isCollapsed && (
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
