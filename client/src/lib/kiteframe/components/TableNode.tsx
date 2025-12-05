import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from "react";
import { cn } from "@/lib/utils";
import { Table2, Pencil, ExternalLink, Plus, ChevronRight, Upload } from "lucide-react";
import { NodeHandles } from "./NodeHandles";
import { ResizeHandle } from "./ResizeHandle";
import type { Node, TableNodeData, DataTable, DataTableColumn, DataTableRow } from "../types";
import { sanitizeText, validateColor } from "../utils/validation";
import { getDynamicClassName, getNodeStyleClasses } from "../utils/styles";
import { getBorderColorFromHeader } from "@/lib/themes";

const MAX_PREVIEW_ROWS = 3;
const MAX_PREVIEW_COLUMNS = 4;

interface TableNodeComponentProps {
  node: Node & { data: TableNodeData };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onConnect?: (connection: { source: string; target: string }) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onOpenTablePanel?: (tableId: string) => void;
  onImportData?: (nodeId: string) => void;
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
  onOpenTablePanel,
  onImportData,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.data.label || "");
  const [isHovering, setIsHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

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

  const handleOpenTable = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.data.tableId) {
      onOpenTablePanel?.(node.data.tableId);
    }
  }, [node.data.tableId, onOpenTablePanel]);

  const handleImportClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onImportData?.(node.id);
  }, [node.id, onImportData]);

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

  const styleClasses = useMemo(() => {
    return getNodeStyleClasses({
      headerBackground: colors.headerBg,
      bodyBackground: colors.bodyBg,
      borderColor: colors.borderColor,
      headerTextColor: colors.headerTextColor,
      bodyTextColor: colors.bodyTextColor,
    });
  }, [colors]);

  const nodeWidth = node.style?.width || node.width || 280;
  const nodeHeight = node.style?.height || node.height || 200;

  const nodePositionClass = useMemo(() => {
    const filteredStyle = style ? Object.fromEntries(
      Object.entries(style).filter(([key]) => 
        !['position', 'left', 'top', 'right', 'bottom', 'transform', 'width', 'height'].includes(key)
      )
    ) : {};
    
    return getDynamicClassName(
      {
        position: "absolute",
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${nodeWidth}px`,
        height: `${nodeHeight}px`,
        zIndex: node.zIndex || 0,
        ...filteredStyle,
      },
      `table-node-${node.id}`,
    );
  }, [
    node.position.x,
    node.position.y,
    nodeWidth,
    nodeHeight,
    node.zIndex,
    node.id,
    style,
  ]);

  const previewColumns = table?.columns?.slice(0, node.data.previewColumnCount || MAX_PREVIEW_COLUMNS) || [];
  const previewRows = table?.rows?.slice(0, node.data.previewRowCount || MAX_PREVIEW_ROWS) || [];
  const hasMoreRows = (table?.rows?.length || 0) > previewRows.length;
  const hasMoreColumns = (table?.columns?.length || 0) > previewColumns.length;

  const dropShadow = isHovering ? '0 4px 12px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.08)';
  
  const nodeStyle: React.CSSProperties = {
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: colors.borderColor,
    boxShadow: dropShadow,
    background: 'transparent',
    overflow: 'visible',
  };

  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
        <Upload size={24} className="text-gray-400" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No data imported</p>
      <button
        onClick={handleImportClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
        data-testid={`table-import-button-${node.id}`}
      >
        <Plus size={14} />
        Import CSV/JSON
      </button>
    </div>
  );

  const renderTablePreview = () => (
    <div className="flex-1 overflow-hidden p-2">
      <div className="border border-gray-200 dark:border-gray-600 rounded overflow-hidden text-xs">
        {/* Header row */}
        <div className="flex bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          {node.data.showRowNumbers && (
            <div className="w-8 px-1.5 py-1 text-gray-400 font-medium border-r border-gray-200 dark:border-gray-600 text-center flex-shrink-0">
              #
            </div>
          )}
          {previewColumns.map((col: DataTableColumn, idx: number) => (
            <div 
              key={col.id} 
              className={cn(
                "flex-1 px-2 py-1 font-medium truncate",
                "text-gray-700 dark:text-gray-300",
                idx < previewColumns.length - 1 && "border-r border-gray-200 dark:border-gray-600"
              )}
              style={{ minWidth: col.width || 60, maxWidth: col.width || 100 }}
              title={col.name}
            >
              {sanitizeText(col.name)}
            </div>
          ))}
          {hasMoreColumns && (
            <div className="w-8 px-1 py-1 text-gray-400 text-center flex-shrink-0">
              +{(table?.columns?.length || 0) - previewColumns.length}
            </div>
          )}
        </div>
        
        {/* Data rows */}
        {previewRows.map((row: DataTableRow, rowIndex: number) => (
          <div 
            key={row.id} 
            className={cn(
              "flex",
              rowIndex < previewRows.length - 1 && "border-b border-gray-100 dark:border-gray-700",
              "hover:bg-gray-50 dark:hover:bg-gray-700/50"
            )}
          >
            {node.data.showRowNumbers && (
              <div className="w-8 px-1.5 py-1 text-gray-400 border-r border-gray-100 dark:border-gray-700 text-center flex-shrink-0">
                {rowIndex + 1}
              </div>
            )}
            {previewColumns.map((col: DataTableColumn, idx: number) => (
              <div 
                key={col.id} 
                className={cn(
                  "flex-1 px-2 py-1 truncate",
                  "text-gray-600 dark:text-gray-400",
                  idx < previewColumns.length - 1 && "border-r border-gray-100 dark:border-gray-700"
                )}
                style={{ minWidth: col.width || 60, maxWidth: col.width || 100 }}
                title={String(row.values[col.id] ?? "")}
              >
                {String(row.values[col.id] ?? "")}
              </div>
            ))}
            {hasMoreColumns && (
              <div className="w-8 px-1 py-1 text-gray-300 text-center flex-shrink-0">
                ...
              </div>
            )}
          </div>
        ))}
        
        {/* More rows indicator */}
        {hasMoreRows && (
          <div className="px-2 py-1 text-center text-gray-400 bg-gray-50/50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
            +{(table?.rows?.length || 0) - previewRows.length} more rows
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={nodeRef}
      className={cn(
        "kiteframe-node kiteframe-table-node group",
        "rounded-lg flex flex-col",
        "transition-all duration-200",
        "cursor-move",
        node.selected && "outline outline-2 outline-blue-500",
        node.hidden ? "opacity-0 pointer-events-none" : "",
        nodePositionClass,
        className,
      )}
      style={nodeStyle}
      role="article"
      aria-label={`Table node: ${node.data.label || "Untitled"}. ${table?.rows?.length || 0} rows, ${table?.columns?.length || 0} columns`}
      aria-selected={node.selected}
      tabIndex={node.selected ? 0 : -1}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-testid={`table-node-${node.id}`}
    >
      {/* Header */}
      <div
        className={cn(
          "h-9 px-3 flex items-center justify-between rounded-t-md gap-2",
          styleClasses.headerClass,
        )}
        role="heading"
        aria-level={3}
        style={{ backgroundColor: colors.headerBg }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Table2 size={16} className="flex-shrink-0" style={{ color: colors.headerTextColor }} />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleLabelSubmit}
              onKeyDown={handleKeyDown}
              className={cn(
                "bg-transparent border-none outline-none text-sm font-medium w-full",
                getDynamicClassName(
                  { color: colors.headerTextColor },
                  `input-text-${node.id}`,
                ),
              )}
              aria-label="Table name"
              data-testid="table-node-label-input"
            />
          ) : (
            <span
              className="text-sm font-medium truncate"
              style={{ color: colors.headerTextColor }}
              title={node.data.label}
            >
              {sanitizeText(node.data.label || "Table")}
            </span>
          )}
        </div>

        {/* Row count badge */}
        {table && (
          <div 
            className="px-1.5 py-0.5 rounded text-xs font-medium bg-white/20"
            style={{ color: colors.headerTextColor }}
          >
            {table.rows.length} rows
          </div>
        )}
      </div>

      {/* Body - Table Preview or Empty State */}
      <div
        className={cn(
          "flex-1 flex flex-col rounded-b-md overflow-hidden",
          styleClasses.bodyClass,
        )}
        style={{ backgroundColor: colors.bodyBg }}
        role="region"
        aria-label="Table preview"
      >
        {table && table.columns.length > 0 ? renderTablePreview() : renderEmptyState()}
        
        {/* Footer with Open Table button */}
        {table && table.columns.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
            <button
              onClick={handleOpenTable}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              data-testid={`table-open-button-${node.id}`}
            >
              <ChevronRight size={14} />
              Open Table
            </button>
            
            <button
              onClick={handleImportClick}
              className="inline-flex items-center gap-1 p-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Import data"
              data-testid={`table-reimport-button-${node.id}`}
            >
              <Upload size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Connection Handles */}
      {showHandles && (
        <NodeHandles
          node={node}
          scale={1}
          onHandleConnect={useCallback(
            (pos: "top" | "bottom" | "left" | "right", e: React.MouseEvent) => {
              console.log("Table node handle connect:", pos, e);
            },
            [],
          )}
        />
      )}

      {/* Resize Handle */}
      {showResizeHandle && node.resizable !== false && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={handleResize}
          minWidth={200}
          minHeight={150}
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
    previewRowCount: data.previewRowCount || MAX_PREVIEW_ROWS,
    previewColumnCount: data.previewColumnCount || MAX_PREVIEW_COLUMNS,
    showRowNumbers: data.showRowNumbers ?? true,
    colors: data.colors || {
      headerBackground: "#4f46e5",
      bodyBackground: "#ffffff",
      headerTextColor: "#ffffff",
      bodyTextColor: "#374151",
    },
  },
  width: 280,
  height: 200,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true,
});
