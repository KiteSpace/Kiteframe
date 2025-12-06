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
  X, 
  Table2, 
  Plus, 
  Upload, 
  ChevronDown, 
  ChevronUp,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Search,
  Filter,
  Globe,
  Trash2,
  Settings2
} from "lucide-react";
import type { DataTable, DataTableColumn, DataTableRow, TableApiConfig, TableApiHeader } from "../types";
import { sanitizeText } from "../utils/validation";

const MAX_VISIBLE_ROWS = 50;
const MAX_ROW_TO_NODE = 25;

interface TablePanelProps {
  tableId: string;
  table: DataTable | undefined;
  position?: { x: number; y: number };
  onClose: () => void;
  onUpdateTable?: (updatedTable: DataTable) => void;
  onCreateNodeFromRow?: (row: Record<string, unknown>, rowIndex: number) => void;
  onImportData?: (tableId: string) => void;
  apiConfig?: TableApiConfig;
  onUpdateApiConfig?: (config: TableApiConfig | undefined) => void;
  onRefreshApi?: () => void;
  isLoading?: boolean;
  className?: string;
}

const TablePanelComponent: React.FC<TablePanelProps> = ({
  tableId,
  table,
  position: initialPosition,
  onClose,
  onUpdateTable,
  onCreateNodeFromRow,
  onImportData,
  apiConfig,
  onUpdateApiConfig,
  onRefreshApi,
  isLoading,
  className,
}) => {
  const [position, setPosition] = useState(initialPosition || { x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(apiConfig?.url || '');
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>(apiConfig?.method || 'GET');
  const [apiHeaders, setApiHeaders] = useState<TableApiHeader[]>(apiConfig?.headers || []);
  const [apiDataPath, setApiDataPath] = useState(apiConfig?.responseDataPath || '');
  
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (apiConfig) {
      setApiUrl(apiConfig.url || '');
      setApiMethod(apiConfig.method || 'GET');
      setApiHeaders(apiConfig.headers || []);
      setApiDataPath(apiConfig.responseDataPath || '');
    }
  }, [apiConfig]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (headerRef.current && headerRef.current.contains(e.target as Node)) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [position]);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateNode = useCallback((row: DataTableRow, rowIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateNodeFromRow?.(row.values as Record<string, unknown>, rowIndex);
  }, [onCreateNodeFromRow]);

  const handleImportClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onImportData) {
      onImportData(tableId);
    } else {
      fileInputRef.current?.click();
    }
  }, [onImportData, tableId]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const { importFromFile } = await import('../utils/dataImport');
      const parsedTable = await importFromFile(file);
      
      const tableWithId: DataTable = {
        ...parsedTable,
        id: tableId,
      };
      
      onUpdateTable?.(tableWithId);
    } catch (error) {
      console.error('Error parsing file:', error);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [tableId, onUpdateTable]);

  const handleSaveApiConfig = useCallback(() => {
    if (!apiUrl.trim()) {
      onUpdateApiConfig?.(undefined);
      return;
    }
    
    const config: TableApiConfig = {
      enabled: true,
      url: apiUrl.trim(),
      method: apiMethod,
      headers: apiHeaders.filter(h => h.key.trim() && h.value.trim()),
      responseDataPath: apiDataPath.trim() || undefined,
    };
    
    onUpdateApiConfig?.(config);
    setShowApiConfig(false);
  }, [apiUrl, apiMethod, apiHeaders, apiDataPath, onUpdateApiConfig]);

  const handleRemoveApiConfig = useCallback(() => {
    onUpdateApiConfig?.(undefined);
    setApiUrl('');
    setApiMethod('GET');
    setApiHeaders([]);
    setApiDataPath('');
    setShowApiConfig(false);
  }, [onUpdateApiConfig]);

  const handleAddHeader = useCallback(() => {
    setApiHeaders(prev => [...prev, { key: '', value: '' }]);
  }, []);

  const handleUpdateHeader = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setApiHeaders(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  }, []);

  const handleRemoveHeader = useCallback((index: number) => {
    setApiHeaders(prev => prev.filter((_, i) => i !== index));
  }, []);

  const panelStyle: React.CSSProperties = isMaximized 
    ? {
        position: 'fixed',
        top: 20,
        left: 20,
        right: 20,
        bottom: 20,
        width: 'auto',
        height: 'auto',
        zIndex: 1000,
      }
    : {
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 700,
        maxHeight: '70vh',
        zIndex: 1000,
      };

  const tableName = table?.name || 'Table';
  const rowCount = table?.rows?.length || 0;
  const colCount = table?.columns?.length || 0;

  return (
    <div
      ref={panelRef}
      className={cn(
        "bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden",
        isDragging && "cursor-grabbing select-none",
        className,
      )}
      style={panelStyle}
      data-testid="table-panel"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        onChange={handleFileChange}
        className="hidden"
        data-testid="table-panel-file-input"
      />

      {/* Header - Draggable */}
      <div
        ref={headerRef}
        className={cn(
          "flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white cursor-grab",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <GripHorizontal size={18} className="opacity-50" />
          <Table2 size={20} />
          <span className="font-semibold text-lg">{sanitizeText(tableName)}</span>
          <span className="px-2 py-0.5 bg-white/20 rounded text-sm">
            {rowCount} rows × {colCount} cols
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
            data-testid="table-panel-maximize"
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="Close"
            data-testid="table-panel-close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            data-testid="table-panel-search"
          />
        </div>
        
        <button
          onClick={handleImportClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          data-testid="table-panel-import"
        >
          <Upload size={16} />
          Import
        </button>
        
        <button
          onClick={() => setShowApiConfig(!showApiConfig)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors",
            apiConfig?.enabled
              ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40"
              : "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
          data-testid="table-panel-api-config"
        >
          <Globe size={16} />
          API
          {apiConfig?.enabled && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
        </button>
        
        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredAndSortedRows.length} of {table?.meta?.totalRowCount ?? rowCount} rows
        </div>
      </div>

      {/* API Configuration Panel */}
      {showApiConfig && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Settings2 size={16} />
              API Data Source
            </h4>
            {apiConfig?.enabled && (
              <button
                onClick={handleRemoveApiConfig}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
                data-testid="table-panel-remove-api"
              >
                <Trash2 size={12} />
                Remove API
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.example.com/data"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="table-panel-api-url"
            />
            <select
              value={apiMethod}
              onChange={(e) => setApiMethod(e.target.value as 'GET' | 'POST')}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="table-panel-api-method"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>
          
          <div>
            <input
              type="text"
              value={apiDataPath}
              onChange={(e) => setApiDataPath(e.target.value)}
              placeholder="Response data path (e.g. data.items or results)"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="table-panel-api-path"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Leave empty if the response is the array directly
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Headers (optional)</span>
              <button
                onClick={handleAddHeader}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                data-testid="table-panel-add-header"
              >
                + Add Header
              </button>
            </div>
            {apiHeaders.map((header, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={header.key}
                  onChange={(e) => handleUpdateHeader(index, 'key', e.target.value)}
                  placeholder="Header name"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                  data-testid={`table-panel-header-key-${index}`}
                />
                <input
                  type="text"
                  value={header.value}
                  onChange={(e) => handleUpdateHeader(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                  data-testid={`table-panel-header-value-${index}`}
                />
                <button
                  onClick={() => handleRemoveHeader(index)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  data-testid={`table-panel-remove-header-${index}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Max: 500 rows × 40 columns
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowApiConfig(false)}
                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                data-testid="table-panel-api-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiConfig}
                disabled={!apiUrl.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="table-panel-api-save"
              >
                Save & Fetch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Content */}
      {table && table.columns && table.columns.length > 0 ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
              <tr>
                <th className="w-10 px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                  #
                </th>
                {table.columns.map((col: DataTableColumn) => (
                  <th 
                    key={col.id}
                    onClick={() => handleColumnSort(col.id)}
                    className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    style={{ minWidth: col.width || 100 }}
                  >
                    <div className="flex items-center gap-1">
                      <span>{sanitizeText(col.name)}</span>
                      {sortColumn === col.id && (
                        sortDirection === 'asc' 
                          ? <ChevronUp size={14} className="text-indigo-500" />
                          : <ChevronDown size={14} className="text-indigo-500" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-14 px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  Actions
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
                  <td className="px-3 py-2 text-gray-400">
                    {rowIndex + 1}
                  </td>
                  {table.columns.map((col: DataTableColumn) => (
                    <td 
                      key={col.id}
                      className="px-3 py-2 text-gray-600 dark:text-gray-400"
                      title={String(row.values[col.id] ?? "")}
                    >
                      <div className="truncate max-w-[200px]">
                        {String(row.values[col.id] ?? "")}
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    {canCreateFromRow(rowIndex) ? (
                      <button
                        onClick={(e) => handleCreateNode(row, rowIndex, e)}
                        className={cn(
                          "p-1 rounded transition-all",
                          hoveredRowId === row.id 
                            ? "bg-indigo-500 text-white shadow-sm" 
                            : "text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        )}
                        title="Create node from this row"
                        data-testid={`table-row-create-node-${row.id}`}
                      >
                        <Plus size={16} />
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
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <Upload size={32} className="text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No data imported</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Import a CSV or JSON file to get started</p>
          <button
            onClick={handleImportClick}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
            data-testid="table-panel-import-empty"
          >
            <Plus size={18} />
            Import CSV/JSON
          </button>
        </div>
      )}

      {/* Footer */}
      {rowCount > MAX_ROW_TO_NODE && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
          <span className="font-medium">Note:</span> Row-to-node creation is limited to the first {MAX_ROW_TO_NODE} rows for performance.
        </div>
      )}
      
      {table?.meta?.sourceFileName && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
          Source: {table.meta.sourceFileName}
          {table.meta.importedAt && ` • Imported ${new Date(table.meta.importedAt).toLocaleString()}`}
        </div>
      )}
    </div>
  );
};

export const TablePanel = memo(TablePanelComponent);
