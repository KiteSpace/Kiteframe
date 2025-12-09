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
  AlertCircle,
  Key,
  Lock,
  LayoutTemplate,
  Sparkles,
  Check,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Rows,
  Columns
} from "lucide-react";
import { NodeHandles } from "./NodeHandles";
import { ResizeHandle } from "./ResizeHandle";
import DragPlaceholder from "./DragPlaceholder";
import type { 
  Node, 
  TableNodeData, 
  DataTable, 
  DataTableColumn, 
  DataTableRow,
  TableNodeComponentProps,
  TableApiConfig,
  TableApiAuthType,
  SavedCompoundTemplate
} from "../types";
import { sanitizeText, validateColor } from "../utils/validation";
import { getBorderColorFromHeader } from "@/lib/themes";
import { StatusBadge } from "./StatusBadge";

const MAX_VISIBLE_ROWS = 50;
const MAX_ROW_TO_NODE = 25;
const MIN_TABLE_WIDTH = 280;
const MIN_TABLE_HEIGHT = 200;
const DEFAULT_TABLE_WIDTH = 560;
const DEFAULT_TABLE_HEIGHT = 400;
const COLLAPSED_TABLE_HEIGHT = 56;
const MIN_COLLAPSED_WIDTH = 240;

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
  isStatusEnabled = false,
  onStatusClick,
  readOnly = false,
  viewport,
  showDragPlaceholder = false,
  isAnyDragActive = false,
  savedTemplates = [],
  onGenerateFromTemplate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.data.label || "");
  const [isHovering, setIsHovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  
  // Cell editing state (Google Sheets-like behavior)
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(node.data.isLoading || false);
  const [refreshError, setRefreshError] = useState<string | null>(node.data.lastError || null);
  const [showInlineApiForm, setShowInlineApiForm] = useState(false);
  const [inlineApiUrl, setInlineApiUrl] = useState("");
  const [inlineApiDataPath, setInlineApiDataPath] = useState("");
  const [inlineApiAuthType, setInlineApiAuthType] = useState<TableApiAuthType>('none');
  const [inlineApiKey, setInlineApiKey] = useState("");
  const [inlineApiKeyHeaderName, setInlineApiKeyHeaderName] = useState("X-API-Key");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowId: string;
    colId: string;
    rowIndex: number;
    colIndex: number;
  } | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const collapsedTitleRef = useRef<HTMLSpanElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const [collapsedWidth, setCollapsedWidth] = useState(MIN_COLLAPSED_WIDTH);

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

  // Note: handleTitleDoubleClick is defined later and used only on the title element
  // This prevents double-clicking anywhere on the table from triggering title edit

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

  // Cell editing handlers (Google Sheets-like behavior)
  const handleCellDoubleClick = useCallback((e: React.MouseEvent, rowId: string, colId: string, currentValue: unknown) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingCell({ rowId, colId });
    setCellEditValue(String(currentValue ?? ""));
  }, []);

  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

  const handleCellSubmit = useCallback(() => {
    if (!editingCell || !table || !onUpdateTable) {
      setEditingCell(null);
      return;
    }

    const updatedRows = table.rows.map((row: DataTableRow) => {
      if (row.id === editingCell.rowId) {
        return {
          ...row,
          values: {
            ...row.values,
            [editingCell.colId]: cellEditValue,
          },
        };
      }
      return row;
    });

    const updatedTable: DataTable = {
      ...table,
      rows: updatedRows,
    };

    onUpdateTable(node.data.tableId, updatedTable);

    if (onUpdate) {
      onUpdate(node.id, {
        data: {
          ...node.data,
          table: updatedTable,
        },
      });
    }

    setEditingCell(null);
    setCellEditValue("");
  }, [editingCell, cellEditValue, table, node.id, node.data, onUpdate, onUpdateTable]);

  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditing(true);
    onDoubleClick?.(e);
  }, [onDoubleClick]);

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

  // getNextCell and handleCellKeyDown must be defined after filteredAndSortedRows
  const getNextCell = useCallback((rowId: string, colId: string, direction: 'next' | 'prev' | 'down' | 'up'): { rowId: string; colId: string; value: unknown } | null => {
    if (!table) return null;
    
    const colIndex = table.columns.findIndex((c: DataTableColumn) => c.id === colId);
    const rowIndex = filteredAndSortedRows.findIndex((r: DataTableRow) => r.id === rowId);
    
    if (colIndex === -1 || rowIndex === -1) return null;
    
    let nextColIndex = colIndex;
    let nextRowIndex = rowIndex;
    
    if (direction === 'next') {
      nextColIndex = colIndex + 1;
      if (nextColIndex >= table.columns.length) {
        nextColIndex = 0;
        nextRowIndex = rowIndex + 1;
      }
    } else if (direction === 'prev') {
      nextColIndex = colIndex - 1;
      if (nextColIndex < 0) {
        nextColIndex = table.columns.length - 1;
        nextRowIndex = rowIndex - 1;
      }
    } else if (direction === 'down') {
      nextRowIndex = rowIndex + 1;
    } else if (direction === 'up') {
      nextRowIndex = rowIndex - 1;
    }
    
    if (nextRowIndex < 0 || nextRowIndex >= filteredAndSortedRows.length) return null;
    
    const nextRow = filteredAndSortedRows[nextRowIndex];
    const nextCol = table.columns[nextColIndex];
    
    return {
      rowId: nextRow.id,
      colId: nextCol.id,
      value: nextRow.values[nextCol.id],
    };
  }, [table, filteredAndSortedRows]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    
    if (!editingCell) return;
    
    if (e.key === "Enter") {
      e.preventDefault();
      handleCellSubmit();
      
      // Move to next row (like Google Sheets)
      if (!e.shiftKey) {
        const nextCell = getNextCell(editingCell.rowId, editingCell.colId, 'down');
        if (nextCell) {
          setEditingCell({ rowId: nextCell.rowId, colId: nextCell.colId });
          setCellEditValue(String(nextCell.value ?? ""));
        }
      } else {
        const nextCell = getNextCell(editingCell.rowId, editingCell.colId, 'up');
        if (nextCell) {
          setEditingCell({ rowId: nextCell.rowId, colId: nextCell.colId });
          setCellEditValue(String(nextCell.value ?? ""));
        }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleCellSubmit();
      
      // Move to next/prev cell (like Google Sheets)
      const direction = e.shiftKey ? 'prev' : 'next';
      const nextCell = getNextCell(editingCell.rowId, editingCell.colId, direction);
      if (nextCell) {
        setEditingCell({ rowId: nextCell.rowId, colId: nextCell.colId });
        setCellEditValue(String(nextCell.value ?? ""));
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingCell(null);
      setCellEditValue("");
    }
  }, [editingCell, handleCellSubmit, getNextCell]);

  // Context menu handlers
  const handleCellContextMenu = useCallback((
    e: React.MouseEvent, 
    rowId: string, 
    colId: string, 
    rowIndex: number, 
    colIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get position relative to the node
    const nodeRect = nodeRef.current?.getBoundingClientRect();
    if (!nodeRect) return;
    
    setContextMenu({
      x: e.clientX - nodeRect.left,
      y: e.clientY - nodeRect.top,
      rowId,
      colId,
      rowIndex,
      colIndex,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu when clicking outside (only on left-click, not right-click)
  // Right-click is handled by handleCellContextMenu which will open a new menu
  useEffect(() => {
    if (contextMenu) {
      const handleClickOutside = () => setContextMenu(null);
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  // Row operations
  const handleDeleteRow = useCallback(() => {
    if (!contextMenu || !table || !onUpdateTable) return;
    
    const updatedRows = table.rows.filter((row: DataTableRow) => row.id !== contextMenu.rowId);
    const updatedTable: DataTable = { ...table, rows: updatedRows };
    
    onUpdateTable(node.data.tableId, updatedTable);
    if (onUpdate) {
      onUpdate(node.id, { data: { ...node.data, table: updatedTable } });
    }
    closeContextMenu();
  }, [contextMenu, table, node.id, node.data, onUpdate, onUpdateTable, closeContextMenu]);

  const handleAddRowAbove = useCallback(() => {
    if (!contextMenu || !table || !onUpdateTable) return;
    
    // Find actual row index in table.rows (not filtered/sorted index)
    const actualRowIndex = table.rows.findIndex((r: DataTableRow) => r.id === contextMenu.rowId);
    if (actualRowIndex === -1) return;
    
    const newRow: DataTableRow = {
      id: `row-${Date.now()}`,
      values: table.columns.reduce((acc: Record<string, unknown>, col: DataTableColumn) => {
        acc[col.id] = '';
        return acc;
      }, {}),
    };
    
    const newRows = [...table.rows];
    newRows.splice(actualRowIndex, 0, newRow);
    const updatedTable: DataTable = { ...table, rows: newRows };
    
    onUpdateTable(node.data.tableId, updatedTable);
    if (onUpdate) {
      onUpdate(node.id, { data: { ...node.data, table: updatedTable } });
    }
    closeContextMenu();
  }, [contextMenu, table, node.id, node.data, onUpdate, onUpdateTable, closeContextMenu]);

  const handleAddRowBelow = useCallback(() => {
    if (!contextMenu || !table || !onUpdateTable) return;
    
    // Find actual row index in table.rows (not filtered/sorted index)
    const actualRowIndex = table.rows.findIndex((r: DataTableRow) => r.id === contextMenu.rowId);
    if (actualRowIndex === -1) return;
    
    const newRow: DataTableRow = {
      id: `row-${Date.now()}`,
      values: table.columns.reduce((acc: Record<string, unknown>, col: DataTableColumn) => {
        acc[col.id] = '';
        return acc;
      }, {}),
    };
    
    const newRows = [...table.rows];
    newRows.splice(actualRowIndex + 1, 0, newRow);
    const updatedTable: DataTable = { ...table, rows: newRows };
    
    onUpdateTable(node.data.tableId, updatedTable);
    if (onUpdate) {
      onUpdate(node.id, { data: { ...node.data, table: updatedTable } });
    }
    closeContextMenu();
  }, [contextMenu, table, node.id, node.data, onUpdate, onUpdateTable, closeContextMenu]);

  const handleSelectRow = useCallback(() => {
    if (!contextMenu) return;
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      next.add(contextMenu.rowId);
      return next;
    });
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  // Column operations
  const handleDeleteColumn = useCallback(() => {
    if (!contextMenu || !table || !onUpdateTable) return;
    
    // Don't allow deleting the last column
    if (table.columns.length <= 1) return;
    
    const updatedColumns = table.columns.filter((col: DataTableColumn) => col.id !== contextMenu.colId);
    const updatedRows = table.rows.map((row: DataTableRow) => {
      const newValues = { ...row.values };
      delete newValues[contextMenu.colId];
      return { ...row, values: newValues };
    });
    
    const updatedTable: DataTable = { ...table, columns: updatedColumns, rows: updatedRows };
    
    onUpdateTable(node.data.tableId, updatedTable);
    if (onUpdate) {
      onUpdate(node.id, { data: { ...node.data, table: updatedTable } });
    }
    closeContextMenu();
  }, [contextMenu, table, node.id, node.data, onUpdate, onUpdateTable, closeContextMenu]);

  const handleAddColumnBefore = useCallback(() => {
    if (!contextMenu || !table || !onUpdateTable) return;
    
    // Find actual column index in table.columns
    const actualColIndex = table.columns.findIndex((c: DataTableColumn) => c.id === contextMenu.colId);
    if (actualColIndex === -1) return;
    
    const newColId = `col-${Date.now()}`;
    const newColumn: DataTableColumn = {
      id: newColId,
      name: 'New Column',
      type: 'string',
    };
    
    const newColumns = [...table.columns];
    newColumns.splice(actualColIndex, 0, newColumn);
    
    const updatedRows = table.rows.map((row: DataTableRow) => ({
      ...row,
      values: { ...row.values, [newColId]: '' },
    }));
    
    const updatedTable: DataTable = { ...table, columns: newColumns, rows: updatedRows };
    
    onUpdateTable(node.data.tableId, updatedTable);
    if (onUpdate) {
      onUpdate(node.id, { data: { ...node.data, table: updatedTable } });
    }
    closeContextMenu();
  }, [contextMenu, table, node.id, node.data, onUpdate, onUpdateTable, closeContextMenu]);

  const handleAddColumnAfter = useCallback(() => {
    if (!contextMenu || !table || !onUpdateTable) return;
    
    // Find actual column index in table.columns
    const actualColIndex = table.columns.findIndex((c: DataTableColumn) => c.id === contextMenu.colId);
    if (actualColIndex === -1) return;
    
    const newColId = `col-${Date.now()}`;
    const newColumn: DataTableColumn = {
      id: newColId,
      name: 'New Column',
      type: 'string',
    };
    
    const newColumns = [...table.columns];
    newColumns.splice(actualColIndex + 1, 0, newColumn);
    
    const updatedRows = table.rows.map((row: DataTableRow) => ({
      ...row,
      values: { ...row.values, [newColId]: '' },
    }));
    
    const updatedTable: DataTable = { ...table, columns: newColumns, rows: updatedRows };
    
    onUpdateTable(node.data.tableId, updatedTable);
    if (onUpdate) {
      onUpdate(node.id, { data: { ...node.data, table: updatedTable } });
    }
    closeContextMenu();
  }, [contextMenu, table, node.id, node.data, onUpdate, onUpdateTable, closeContextMenu]);

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
          authType: apiConfig.authType,
          apiKey: apiConfig.apiKey,
          apiKeyHeaderName: apiConfig.apiKeyHeaderName,
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

  const handleInlineApiFetch = useCallback(async () => {
    if (!inlineApiUrl.trim()) return;
    
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      const response = await fetch('/api/table/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: inlineApiUrl.trim(),
          method: 'GET',
          headers: [],
          responseDataPath: inlineApiDataPath.trim() || undefined,
          authType: inlineApiAuthType,
          apiKey: inlineApiKey.trim() || undefined,
          apiKeyHeaderName: inlineApiKeyHeaderName.trim() || 'X-API-Key',
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }
      
      if (result.success && result.data) {
        const newApiConfig: TableApiConfig = {
          enabled: true,
          url: inlineApiUrl.trim(),
          method: 'GET',
          headers: [],
          responseDataPath: inlineApiDataPath.trim() || undefined,
          authType: inlineApiAuthType !== 'none' ? inlineApiAuthType : undefined,
          apiKey: inlineApiKey.trim() || undefined,
          apiKeyHeaderName: inlineApiAuthType === 'apiKey' ? (inlineApiKeyHeaderName.trim() || 'X-API-Key') : undefined,
        };
        
        const updatedTable: DataTable = {
          id: node.data.tableId,
          name: node.data.label || 'API Data',
          columns: result.data.columns,
          rows: result.data.rows,
          meta: {
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
              apiConfig: newApiConfig,
              isLoading: false,
              lastError: undefined,
            },
          });
        }
        
        setShowInlineApiForm(false);
        setInlineApiUrl("");
        setInlineApiDataPath("");
        setInlineApiAuthType('none');
        setInlineApiKey("");
        setInlineApiKeyHeaderName("X-API-Key");
      }
    } catch (error: any) {
      console.error('API fetch error:', error);
      setRefreshError(error.message || 'Failed to fetch');
    } finally {
      setIsRefreshing(false);
    }
  }, [inlineApiUrl, inlineApiDataPath, inlineApiAuthType, inlineApiKey, inlineApiKeyHeaderName, node.id, node.data, onUpdate, onUpdateTable]);

  const handleToggleRowSelection = useCallback((rowId: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const handleSelectAllRows = useCallback(() => {
    if (!table?.rows) return;
    const allRowIds = table.rows.slice(0, MAX_ROW_TO_NODE).map((r: DataTableRow) => r.id);
    setSelectedRowIds(new Set(allRowIds));
  }, [table?.rows]);

  const handleClearRowSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  const handleGenerateFromTemplate = useCallback(() => {
    if (!selectedTemplateId || !onGenerateFromTemplate) return;
    const template = savedTemplates.find(t => t.id === selectedTemplateId);
    if (!template) return;
    
    const rowIdsArray = selectedRowIds.size > 0 
      ? Array.from(selectedRowIds) 
      : undefined;
    
    onGenerateFromTemplate(node.data.tableId, template, rowIdsArray);
    setShowTemplateDialog(false);
    setSelectedTemplateId(null);
    setSelectedRowIds(new Set());
  }, [selectedTemplateId, savedTemplates, selectedRowIds, node.data.tableId, onGenerateFromTemplate]);

  const hasTemplates = savedTemplates.length > 0;
  const hasTableData = table && table.rows && table.rows.length > 0;

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

  // Measure collapsed title width dynamically and update node dimensions
  useEffect(() => {
    if (collapsedTitleRef.current) {
      const textWidth = collapsedTitleRef.current.scrollWidth;
      // Calculate total width: padding (32px) + icon (20px) + gap (12px) + text + gap (12px) + divider padding (12px) + buttons (80px) + padding (16px)
      const totalWidth = 32 + 20 + 12 + textWidth + 12 + 12 + 80 + 16;
      const newCollapsedWidth = Math.max(MIN_COLLAPSED_WIDTH, totalWidth);
      setCollapsedWidth(newCollapsedWidth);
      
      // Update node dimensions to trigger edge recalculation
      if (isCollapsed && onUpdate) {
        const currentNodeWidth = node.style?.width || node.width || DEFAULT_TABLE_WIDTH;
        const currentNodeHeight = node.style?.height || node.height || DEFAULT_TABLE_HEIGHT;
        
        // Only update if dimensions actually changed
        if (currentNodeWidth !== newCollapsedWidth || currentNodeHeight !== COLLAPSED_TABLE_HEIGHT) {
          onUpdate(node.id, {
            width: newCollapsedWidth,
            height: COLLAPSED_TABLE_HEIGHT,
            style: { 
              ...node.style, 
              width: newCollapsedWidth, 
              height: COLLAPSED_TABLE_HEIGHT,
            },
          });
        }
      }
    }
  }, [isCollapsed, tableName, node.id]);

  // Store expanded dimensions before collapsing
  const expandedWidthRef = useRef(nodeWidth);
  const expandedHeightRef = useRef(nodeHeight);
  
  useEffect(() => {
    // When not collapsed, store the current dimensions for later restoration
    if (!isCollapsed) {
      expandedWidthRef.current = nodeWidth;
      expandedHeightRef.current = nodeHeight;
    }
  }, [isCollapsed, nodeWidth, nodeHeight]);

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdate) {
      const willBeCollapsed = !isCollapsed;
      
      if (willBeCollapsed) {
        // Collapsing - dimensions will be updated by the useEffect after measurement
        onUpdate(node.id, {
          data: { 
            ...node.data, 
            isCollapsed: true,
            // Store expanded dimensions for restoration
            expandedWidth: nodeWidth,
            expandedHeight: nodeHeight,
          },
        });
      } else {
        // Expanding - restore original dimensions
        const restoreWidth = node.data.expandedWidth || expandedWidthRef.current || DEFAULT_TABLE_WIDTH;
        const restoreHeight = node.data.expandedHeight || expandedHeightRef.current || DEFAULT_TABLE_HEIGHT;
        
        onUpdate(node.id, {
          data: { ...node.data, isCollapsed: false },
          width: restoreWidth,
          height: restoreHeight,
          style: { 
            ...node.style, 
            width: restoreWidth, 
            height: restoreHeight,
          },
        });
      }
    }
  }, [node.id, node.data, node.style, isCollapsed, nodeWidth, nodeHeight, onUpdate]);

  const dropShadow = isHovering ? '0 8px 24px rgba(0,0,0,0.15)' : '0 4px 16px rgba(0,0,0,0.1)';

  const actualHeight = isCollapsed ? COLLAPSED_TABLE_HEIGHT : nodeHeight;
  
  const actualWidth = isCollapsed ? collapsedWidth : nodeWidth;
  
  const outerWrapperStyle: React.CSSProperties = {
    ...style,
    width: actualWidth,
    height: actualHeight,
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
    position: 'relative', // Anchor for internal absolutely-positioned overlays
  };

  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      {isRefreshing ? (
        <>
          <Loader2 size={32} className="text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Fetching data...</p>
        </>
      ) : refreshError && showInlineApiForm ? (
        <>
          <AlertCircle size={32} className="text-red-500 mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{refreshError}</p>
          <div className="w-full max-w-xs space-y-2">
            <input
              type="text"
              value={inlineApiUrl}
              onChange={(e) => setInlineApiUrl(e.target.value)}
              placeholder="API URL"
              className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              data-testid={`table-inline-api-url-${node.id}`}
            />
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleInlineApiFetch(); }}
                className="flex-1 px-3 py-1.5 text-sm font-medium bg-indigo-500 text-white rounded hover:bg-indigo-600"
                data-testid={`table-inline-api-fetch-${node.id}`}
              >
                Retry
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowInlineApiForm(false); setRefreshError(null); }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : showInlineApiForm ? (
        <div className="w-full max-w-xs space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Globe size={20} className="text-green-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Connect API</span>
          </div>
          <input
            type="text"
            value={inlineApiUrl}
            onChange={(e) => setInlineApiUrl(e.target.value)}
            placeholder="API URL (e.g. https://api.example.com/data)"
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && inlineApiAuthType === 'none') handleInlineApiFetch();
              else if (e.key === 'Escape') { 
                setShowInlineApiForm(false); 
                setInlineApiUrl(""); 
                setInlineApiDataPath(""); 
                setInlineApiAuthType('none');
                setInlineApiKey("");
              }
            }}
            data-testid={`table-inline-api-url-${node.id}`}
          />
          <input
            type="text"
            value={inlineApiDataPath}
            onChange={(e) => setInlineApiDataPath(e.target.value)}
            placeholder="Data path (optional, e.g. data.items)"
            className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') { 
                setShowInlineApiForm(false); 
                setInlineApiUrl(""); 
                setInlineApiDataPath(""); 
                setInlineApiAuthType('none');
                setInlineApiKey("");
              }
            }}
            data-testid={`table-inline-api-path-${node.id}`}
          />
          
          {/* Authentication Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Key size={14} className="text-amber-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Authentication (optional)</span>
            </div>
            <select
              value={inlineApiAuthType}
              onChange={(e) => setInlineApiAuthType(e.target.value as TableApiAuthType)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
              data-testid={`table-inline-api-auth-type-${node.id}`}
            >
              <option value="none">No Authentication</option>
              <option value="apiKey">API Key (Header)</option>
              <option value="bearer">Bearer Token</option>
            </select>
            
            {inlineApiAuthType !== 'none' && (
              <>
                {inlineApiAuthType === 'apiKey' && (
                  <input
                    type="text"
                    value={inlineApiKeyHeaderName}
                    onChange={(e) => setInlineApiKeyHeaderName(e.target.value)}
                    placeholder="Header name (e.g. X-API-Key)"
                    className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    data-testid={`table-inline-api-header-name-${node.id}`}
                  />
                )}
                <div className="relative">
                  <input
                    type="password"
                    value={inlineApiKey}
                    onChange={(e) => setInlineApiKey(e.target.value)}
                    placeholder={inlineApiAuthType === 'bearer' ? "Bearer token" : "API key value"}
                    className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') handleInlineApiFetch();
                    }}
                    data-testid={`table-inline-api-key-${node.id}`}
                  />
                  <Lock size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Key is stored locally, not on server
                </p>
              </>
            )}
          </div>
          
          <div className="flex justify-center gap-2 pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleInlineApiFetch(); }}
              disabled={!inlineApiUrl.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid={`table-inline-api-fetch-${node.id}`}
            >
              Fetch Data
            </button>
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setShowInlineApiForm(false); 
                setInlineApiUrl(""); 
                setInlineApiDataPath(""); 
                setInlineApiAuthType('none');
                setInlineApiKey("");
                setInlineApiKeyHeaderName("X-API-Key");
              }}
              className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <Table2 size={32} className="text-gray-400 mb-3 opacity-60" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No data</p>
          <div className="flex gap-4 mb-3">
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-12 h-12 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors shadow-md"
              title="Upload CSV or JSON file"
              data-testid={`table-upload-btn-${node.id}`}
            >
              <Upload size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowInlineApiForm(true); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-12 h-12 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors shadow-md"
              title="Connect to API"
              data-testid={`table-api-btn-${node.id}`}
            >
              <Globe size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Upload CSV/JSON or connect API
          </p>
        </>
      )}
    </div>
  );

  const renderTableContent = () => (
    <div 
      className="flex-1 overflow-auto"
      data-table-scrollable="true"
    >
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
              {table!.columns.map((col: DataTableColumn, colIndex: number) => {
                const isEditingThisCell = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                const cellValue = row.values[col.id];
                
                return (
                  <td 
                    key={col.id}
                    className={cn(
                      "px-2 py-1.5 text-gray-600 dark:text-gray-400 cursor-text",
                      isEditingThisCell && "p-0"
                    )}
                    title={!isEditingThisCell ? String(cellValue ?? "") : undefined}
                    onDoubleClick={(e) => handleCellDoubleClick(e, row.id, col.id, cellValue)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onContextMenu={(e) => handleCellContextMenu(e, row.id, col.id, rowIndex, colIndex)}
                  >
                    {isEditingThisCell ? (
                      <input
                        ref={cellInputRef}
                        type="text"
                        value={cellEditValue}
                        onChange={(e) => setCellEditValue(e.target.value)}
                        onBlur={handleCellSubmit}
                        onKeyDown={handleCellKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full h-full px-2 py-1.5 text-xs bg-white dark:bg-gray-900 border-2 border-indigo-500 outline-none"
                        style={{ minWidth: col.width || 80 }}
                        data-testid={`table-cell-input-${row.id}-${col.id}`}
                      />
                    ) : (
                      <div className="truncate max-w-[150px]">
                        {String(cellValue ?? "")}
                      </div>
                    )}
                  </td>
                );
              })}
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
        "kiteframe-node kiteframe-table-node group absolute",
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
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-testid={`table-node-${node.id}`}
      data-node-id={node.id}
    >
      {/* Hidden file input - always rendered to preserve state during drag */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        onChange={handleFileChange}
        className="hidden"
        data-testid={`table-file-input-${node.id}`}
      />

      {/* Hidden span for measuring collapsed title width - always rendered */}
      <span
        ref={collapsedTitleRef}
        className="absolute opacity-0 pointer-events-none text-base font-medium whitespace-nowrap"
        style={{ visibility: 'hidden' }}
        aria-hidden="true"
      >
        {sanitizeText(tableName)}
      </span>

      {/* Drag placeholder - renders lightweight version during drag for performance */}
      {showDragPlaceholder ? (
        <DragPlaceholder
          nodeType="table"
          width={actualWidth}
          height={actualHeight}
          label={tableName}
          selected={node.selected}
        />
      ) : (
        <>
          {/* Collapsed View - Clean compact bar */}
          {isCollapsed ? (
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 cursor-grab h-full",
            node.selected && "ring-2 ring-blue-500 ring-offset-2"
          )}
          style={{ 
            background: colors.headerBg,
            color: colors.headerTextColor,
            borderRadius: '12px',
          }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Table2 size={20} className="flex-shrink-0 opacity-80" />
            <span
              className="text-base font-medium whitespace-nowrap cursor-pointer hover:underline"
              title={`${tableName} (double-click to edit)`}
              onDoubleClick={handleTitleDoubleClick}
              onClick={(e) => e.stopPropagation()}
            >
              {sanitizeText(tableName)}
            </span>
          </div>
          
          <div className="flex items-center gap-1 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
            <button
              onClick={handleApiRefresh}
              disabled={isRefreshing}
              className={cn(
                "p-1.5 rounded transition-colors relative",
                isRefreshing ? "opacity-50 cursor-wait" : "hover:bg-white/20"
              )}
              title={
                isRefreshing 
                  ? "Refreshing..." 
                  : apiConfig?.enabled
                    ? (lastRefreshedText ? `Last refreshed: ${lastRefreshedText}\nClick to refresh` : "Refresh from API")
                    : "No API configured"
              }
              data-testid={`table-refresh-${node.id}`}
            >
              {isRefreshing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : refreshError ? (
                <AlertCircle size={16} className="text-red-300" />
              ) : (
                <RefreshCw size={16} />
              )}
              {apiConfig?.enabled && !isRefreshing && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border border-white/30" />
              )}
            </button>
            <button
              onClick={handleToggleCollapse}
              className="p-1.5 hover:bg-white/20 rounded transition-colors"
              title="Expand table"
              data-testid={`table-toggle-collapse-${node.id}`}
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded View - Full table container */
        <div
          className={cn(
            "flex flex-col cursor-move",
            node.selected && "ring-2 ring-blue-500 ring-offset-2"
          )}
          style={containerStyle}
        >
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
                className="text-sm font-medium truncate cursor-pointer hover:underline"
                title={`${tableName} (double-click to edit)`}
                onDoubleClick={handleTitleDoubleClick}
                onClick={(e) => e.stopPropagation()}
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
              title="Collapse table"
              data-testid={`table-toggle-collapse-${node.id}`}
            >
              <Minimize2 size={14} />
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
        
        {/* Generate from template button - only show when table has data and templates exist */}
        {hasTableData && hasTemplates && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowTemplateDialog(true); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-purple-500 text-white hover:bg-purple-600 transition-colors shadow-sm"
            title="Generate nodes from template"
            data-testid={`table-generate-template-${node.id}`}
          >
            <Sparkles size={12} />
            Generate
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
      )}
        </>
      )}

      {/* Connection Handles - positioned outside visual container, hidden during any drag operation */}
      {showHandles && !isAnyDragActive && (
        <NodeHandles
          node={{ ...node, width: actualWidth, height: actualHeight }}
          scale={viewport?.zoom || 1}
          onHandleConnect={onHandleConnect}
        />
      )}

      {/* Resize Handle - only visible when selected and not collapsed, always rendered */}
      {showResizeHandle && node.resizable !== false && node.selected && !isCollapsed && !showDragPlaceholder && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={handleResize}
          minWidth={MIN_TABLE_WIDTH}
          minHeight={MIN_TABLE_HEIGHT}
        />
      )}

      {/* Generate from Template Dialog */}
      {showTemplateDialog && (
        <div
          className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-xl"
          onClick={(e) => { e.stopPropagation(); setShowTemplateDialog(false); }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[320px] max-h-[400px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutTemplate size={16} className="text-purple-500" />
                <span className="font-medium text-sm">Generate from Template</span>
              </div>
              <button
                onClick={() => setShowTemplateDialog(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="p-3 space-y-3 max-h-[280px] overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">
                  Select Template
                </label>
                <div className="space-y-1.5">
                  {savedTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded border text-sm transition-colors",
                        selectedTemplateId === template.id
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
                          : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      )}
                      data-testid={`template-option-${template.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{template.name}</span>
                        {selectedTemplateId === template.id && (
                          <Check size={14} className="text-purple-500 flex-shrink-0" />
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {template.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Rows to Generate ({selectedRowIds.size > 0 ? selectedRowIds.size : 'All'})
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={handleSelectAllRows}
                      className="text-xs text-purple-500 hover:text-purple-600"
                    >
                      All
                    </button>
                    <span className="text-xs text-gray-400">|</span>
                    <button
                      onClick={handleClearRowSelection}
                      className="text-xs text-gray-500 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedRowIds.size > 0 
                    ? `${selectedRowIds.size} rows selected`
                    : `All ${Math.min(rowCount, MAX_ROW_TO_NODE)} rows will be used`
                  }
                </p>
              </div>
            </div>
            
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowTemplateDialog(false)}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateFromTemplate}
                disabled={!selectedTemplateId}
                className="px-3 py-1.5 text-sm font-medium bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                data-testid={`table-generate-confirm-${node.id}`}
              >
                <Sparkles size={14} />
                Generate Nodes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cell Context Menu */}
      {contextMenu && (
        <div
          className="absolute z-[100] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          data-testid="table-context-menu"
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Row
          </div>
          <button
            onClick={handleSelectRow}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid="context-menu-select-row"
          >
            <Rows size={14} className="text-gray-500" />
            Select Row
          </button>
          <button
            onClick={handleAddRowAbove}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid="context-menu-add-row-above"
          >
            <ArrowUp size={14} className="text-gray-500" />
            Add Row Above
          </button>
          <button
            onClick={handleAddRowBelow}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid="context-menu-add-row-below"
          >
            <ArrowDown size={14} className="text-gray-500" />
            Add Row Below
          </button>
          <button
            onClick={handleDeleteRow}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            data-testid="context-menu-delete-row"
          >
            <Trash2 size={14} />
            Delete Row
          </button>
          
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          
          <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Column
          </div>
          <button
            onClick={handleAddColumnBefore}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid="context-menu-add-column-before"
          >
            <ArrowLeft size={14} className="text-gray-500" />
            Add Column Before
          </button>
          <button
            onClick={handleAddColumnAfter}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            data-testid="context-menu-add-column-after"
          >
            <ArrowRight size={14} className="text-gray-500" />
            Add Column After
          </button>
          <button
            onClick={handleDeleteColumn}
            disabled={table && table.columns.length <= 1}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors",
              table && table.columns.length <= 1
                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            )}
            title={table && table.columns.length <= 1 ? "Cannot delete the last column" : undefined}
            data-testid="context-menu-delete-column"
          >
            <Trash2 size={14} />
            Delete Column
          </button>
        </div>
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
