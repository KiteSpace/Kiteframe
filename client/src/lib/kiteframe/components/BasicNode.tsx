import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Pencil, Table2, Database } from "lucide-react";
import { NodeHandles } from "./NodeHandles";
import { ResizeHandle } from "./ResizeHandle";
import type { Node, BasicNodeData, BasicNodeComponentProps, NodeHyperlink, RowBindingMeta, RowDisplayConfig } from "../types";
import { sanitizeText, validateColor } from "../utils/validation";
import { getDynamicClassName, getNodeStyleClasses } from "../utils/styles";
import { getBorderColorFromHeader } from "@/lib/themes";

interface HyperlinkButtonProps {
  hyperlink: NodeHyperlink;
  onEdit?: () => void;
  borderColor?: string;
}

const HyperlinkButton: React.FC<HyperlinkButtonProps> = ({ hyperlink, onEdit, borderColor }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const handleGoToLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    let url = hyperlink.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowTooltip(false);
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.();
    setShowTooltip(false);
  };
  
  return (
    <div 
      className="relative mt-2 w-fit"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Outline Button */}
      <button
        onClick={handleGoToLink}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
          "border-2 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800",
          "text-gray-700 dark:text-gray-300"
        )}
        style={{ borderColor: borderColor || '#64748b' }}
        data-testid="node-hyperlink-button"
      >
        <ExternalLink size={12} />
        <span>{sanitizeText(hyperlink.text)}</span>
      </button>
      
      {/* Hover Tooltip */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute left-0 bottom-full mb-1 z-50 animate-in fade-in-0 zoom-in-95 duration-150"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={handleGoToLink}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              data-testid="hyperlink-go-button"
            >
              <ExternalLink size={12} />
              <span>Go to link</span>
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-600" />
            <button
              onClick={handleEdit}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              data-testid="hyperlink-edit-button"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Data Card component for nodes created from table rows
interface RowDataCardProps {
  rowBinding: RowBindingMeta;
  rowDisplay?: RowDisplayConfig;
  rowValues: Record<string, string | number | boolean | null>;
  headerBg: string;
  bodyTextColor: string;
  onFocusTable?: () => void;
}

const RowDataCard: React.FC<RowDataCardProps> = ({ 
  rowBinding, 
  rowDisplay, 
  rowValues, 
  headerBg,
  bodyTextColor,
  onFocusTable 
}) => {
  const entries = Object.entries(rowValues);
  
  // Get primary value for title
  const primaryColumnId = rowDisplay?.primaryColumnId;
  const primaryValue = primaryColumnId && rowValues[primaryColumnId] !== undefined
    ? String(rowValues[primaryColumnId] ?? '')
    : entries.length > 0 ? String(entries[0][1] ?? 'Row Data') : 'Row Data';
  
  // Get visible columns (up to 6)
  const visibleColumnIds = rowDisplay?.visibleColumnIds;
  const displayEntries = visibleColumnIds 
    ? entries.filter(([key]) => visibleColumnIds.includes(key)).slice(0, 6)
    : entries.slice(0, 6);
  
  // Format cell value for display
  const formatValue = (value: string | number | boolean | null): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    const str = String(value);
    return str.length > 50 ? str.slice(0, 47) + '...' : str;
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Data grid - 2 columns */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {displayEntries.map(([key, value]) => (
          <div key={key} className="min-w-0">
            <div 
              className="text-[10px] font-medium uppercase tracking-wide opacity-60 truncate"
              style={{ color: bodyTextColor }}
              title={key}
            >
              {key}
            </div>
            <div 
              className="text-xs truncate"
              style={{ color: bodyTextColor }}
              title={String(value ?? '')}
            >
              {formatValue(value)}
            </div>
          </div>
        ))}
      </div>
      
      {/* Table source badge */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onFocusTable?.();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          "mt-auto pt-2 inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-all self-start",
          "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700",
          "text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/40",
          "cursor-pointer"
        )}
        title={`From: ${rowBinding.tableName}. Click to focus table.`}
        data-testid="row-data-card-table-badge"
      >
        <Database size={10} className="text-indigo-500 dark:text-indigo-400" />
        <span>{sanitizeText(rowBinding.tableName)}</span>
        {(rowDisplay?.showRowIndex !== false) && (
          <span className="text-indigo-500 dark:text-indigo-400">Row {rowBinding.rowIndex + 1}</span>
        )}
      </button>
    </div>
  );
};

const renderTextWithLinks = (text: string): React.ReactNode => {
  if (!text) return null;
  
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {sanitizeText(text.slice(lastIndex, match.index))}
        </span>
      );
    }
    
    const linkText = match[1];
    let url = match[2];
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    parts.push(
      <a
        key={`link-${keyIndex++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {sanitizeText(linkText)}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${keyIndex++}`}>
        {sanitizeText(text.slice(lastIndex))}
      </span>
    );
  }
  
  return parts.length > 0 ? parts : sanitizeText(text);
};

const BasicNodeComponent: React.FC<BasicNodeComponentProps> = ({
  node,
  onUpdate,
  onConnect,
  onDoubleClick,
  onFocusNode,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.data.label || "");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState(
    node.data.description || "",
  );
  const [isHovering, setIsHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Focus description textarea when entering description edit mode
  useEffect(() => {
    if (isEditingDescription && descriptionRef.current) {
      descriptionRef.current.focus();
      descriptionRef.current.select();
    }
  }, [isEditingDescription]);

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
      const sanitizedLabel = sanitizeText(editValue.trim() || "Basic Node");
      onUpdate(node.id, {
        data: { ...node.data, label: sanitizedLabel },
      });
    }
    setIsEditing(false);
  }, [editValue, node.id, node.data, onUpdate]);

  const handleDescriptionSubmit = useCallback(() => {
    if (onUpdate) {
      const sanitizedDescription = sanitizeText(editDescriptionValue.trim());
      onUpdate(node.id, {
        data: { ...node.data, description: sanitizedDescription },
      });
    }
    setIsEditingDescription(false);
  }, [editDescriptionValue, node.id, node.data, onUpdate]);

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

  const handleDescriptionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleDescriptionSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditDescriptionValue(node.data.description || "");
        setIsEditingDescription(false);
      }
    },
    [handleDescriptionSubmit, node.data.description],
  );

  const handleDescriptionDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingDescription(true);
  }, []);

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

  // Get colors with fallbacks and validation - memoized for performance
  const colors = useMemo(() => {
    const nodeColors = node.data.colors || {};
    const headerBg = validateColor(nodeColors.headerBackground || "")
      ? nodeColors.headerBackground
      : "#f8fafc";
    
    const borderColor = getBorderColorFromHeader(headerBg);
    
    return {
      headerBg,
      bodyBg: validateColor(nodeColors.bodyBackground || "")
        ? nodeColors.bodyBackground
        : "#ffffff",
      // Border color matches header color exactly
      borderColor,
      headerTextColor: validateColor(nodeColors.headerTextColor || "")
        ? nodeColors.headerTextColor
        : "#1e293b",
      bodyTextColor: validateColor(nodeColors.bodyTextColor || "")
        ? nodeColors.bodyTextColor
        : "#64748b",
    };
  }, [node.data.colors]);

  // Get CSS classes for node styles
  const styleClasses = useMemo(() => {
    return getNodeStyleClasses({
      headerBackground: colors.headerBg,
      bodyBackground: colors.bodyBg,
      borderColor: colors.borderColor,
      headerTextColor: colors.headerTextColor,
      bodyTextColor: colors.bodyTextColor,
    });
  }, [colors]);

  const nodeWidth = node.style?.width || node.width || 200;
  const nodeHeight = node.style?.height || node.height || 120;

  // Get dynamic class for node positioning and dimensions
  const nodePositionClass = useMemo(() => {
    // Filter out positioning properties from style prop to prevent coordinate system conflicts
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
      `basic-node-${node.id}`,
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

  // Get dynamic class for border color
  const borderClass = useMemo(() => {
    return getDynamicClassName(
      {
        borderColor: colors.borderColor,
      },
      `node-border-${node.id}`,
    );
  }, [colors.borderColor, node.id]);

  const handleMockupClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Emit custom event for wireframe generation
    const event = new CustomEvent('generateWireframe', {
      detail: { nodeId: node.id, node }
    });
    window.dispatchEvent(event);
  }, [node]);

  // Check if border should be hidden
  const hasNoBorder = node.data.noStroke === true;

  // Use real CSS border like StickyNoteObject does (not box-shadow)
  // This ensures border is always visible regardless of child backgrounds
  const dropShadow = isHovering ? '0 4px 12px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.08)';
  
  const nodeStyle: React.CSSProperties = {
    // Real CSS border - always visible
    borderWidth: hasNoBorder ? '0px' : '2px',
    borderStyle: node.data.borderStyle || 'solid',
    borderColor: hasNoBorder ? 'transparent' : colors.borderColor,
    // Drop shadow for depth
    boxShadow: dropShadow,
    // Prevent any background from this container
    background: 'transparent',
    // Ensure overflow visible for handles
    overflow: 'visible',
  };

  return (
    <div
      ref={nodeRef}
      className={cn(
        "kiteframe-node group",
        "rounded-lg",
        "transition-all duration-200",
        "cursor-move",
        node.selected && "outline outline-2 outline-blue-500",
        node.hidden ? "opacity-0 pointer-events-none" : "",
        nodePositionClass,
        className,
      )}
      style={nodeStyle}
      role="article"
      aria-label={`Basic node: ${node.data.label || "Untitled"}. ${node.data.description || "No description"}`}
      aria-selected={node.selected}
      tabIndex={node.selected ? 0 : -1}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-testid={`basic-node-${node.id}`}
    >
      {/* Header */}
      <div
        className={cn(
          "h-8 px-3 flex items-center justify-between rounded-t-md",
          styleClasses.headerClass,
        )}
        role="heading"
        aria-level={3}
      >
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
            aria-label="Node label"
            aria-required="true"
            data-testid="basic-node-label-input"
          />
        ) : (
          <span
            className="text-sm font-medium truncate"
            title={node.data.label}
          >
            {sanitizeText(node.data.label || "Basic Node")}
          </span>
        )}

        {/* Node type indicator */}
        <div
          className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"
          title="Basic Node"
          aria-hidden="true"
        />
      </div>

      {/* Body */}
      <div
        className={cn(
          "flex-1 p-3 rounded-b-md",
          styleClasses.bodyClass,
          getDynamicClassName(
            { minHeight: `${nodeHeight - 32 - 4}px` }, // Account for 2px padding on each side
            `body-height-${node.id}`,
          ),
        )}
        role="region"
        aria-label="Node content"
        onDoubleClick={handleDescriptionDoubleClick}
      >
        {/* Enhanced Row Data Card - shown when rowBinding and rowValues exist */}
        {node.data.rowBinding && node.data.rowValues ? (
          <RowDataCard
            rowBinding={node.data.rowBinding}
            rowDisplay={node.data.rowDisplay}
            rowValues={node.data.rowValues}
            headerBg={colors.headerBg}
            bodyTextColor={colors.bodyTextColor}
            onFocusTable={() => {
              if (onFocusNode && node.data.rowBinding?.tableNodeId) {
                onFocusNode(node.data.rowBinding.tableNodeId);
              }
            }}
          />
        ) : (
          <div className="flex gap-3">
            {/* Icon/Emoji container - only shown if iconVisible is true and nodeIcon exists */}
            {(node.data.iconVisible !== false && node.data.nodeIcon) && (
              <div 
                className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                style={{ 
                  backgroundColor: colors.headerBg + '80',
                }}
                data-testid={`node-icon-${node.id}`}
              >
                {node.data.nodeIcon}
              </div>
            )}
            
            {/* Text content */}
            <div className="flex-1 min-w-0 flex flex-col">
              {isEditingDescription ? (
                <textarea
                  ref={descriptionRef}
                  value={editDescriptionValue}
                  onChange={(e) => setEditDescriptionValue(e.target.value)}
                  onBlur={handleDescriptionSubmit}
                  onKeyDown={handleDescriptionKeyDown}
                  className={cn(
                    "w-full h-full resize-none bg-transparent border-none outline-none text-xs leading-relaxed",
                    "focus:ring-1 focus:ring-blue-500 focus:ring-opacity-50 rounded p-1 -m-1",
                    getDynamicClassName(
                      { color: colors.bodyTextColor },
                      `description-textarea-${node.id}`,
                    ),
                  )}
                  placeholder="Enter description..."
                  aria-label="Node description"
                  data-testid="basic-node-description-textarea"
                />
              ) : node.data.description ? (
                <>
                  <p 
                    className={cn(
                      "leading-relaxed",
                      !node.data.fontSize && "text-xs",
                      node.data.bold && "font-bold",
                      node.data.italic && "italic",
                      node.data.strikethrough && "line-through",
                      node.data.underline && "underline",
                    )}
                    style={{
                      fontSize: node.data.fontSize ? `${node.data.fontSize}px` : undefined,
                      textAlign: node.data.textAlign || 'left',
                      color: colors.bodyTextColor,
                    }}
                    aria-label="Node description"
                  >
                    {renderTextWithLinks(node.data.description)}
                  </p>
                </>
              ) : (
                <div
                  className="text-xs opacity-60 italic"
                  aria-label="Empty node. Double-click to edit"
                >
                  Double-click to edit
                </div>
              )}
              
              {/* Hyperlink Button - displayed below body text */}
              {node.data.hyperlink?.text && node.data.hyperlink?.url && (
                <HyperlinkButton 
                  hyperlink={node.data.hyperlink}
                  borderColor={colors.borderColor}
                  onEdit={() => {
                    // Emit custom event to trigger edit in toolbar
                    const event = new CustomEvent('editNodeHyperlink', {
                      detail: { nodeId: node.id }
                    });
                    window.dispatchEvent(event);
                  }}
                />
              )}
              
              {/* Source Table Badge - shown when node was created from table row (legacy) */}
              {!node.data.rowBinding && node.data.sourceTableNodeId && node.data.sourceTableName && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onFocusNode && node.data.sourceTableNodeId) {
                      onFocusNode(node.data.sourceTableNodeId);
                    }
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-all",
                    "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700",
                    "text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/40",
                    "cursor-pointer"
                  )}
                  title={`Created from table: ${node.data.sourceTableName}. Click to focus on source table.`}
                  data-testid={`source-table-badge-${node.id}`}
                >
                  <Database size={12} className="text-indigo-500 dark:text-indigo-400" />
                  <span>From: {sanitizeText(node.data.sourceTableName)}</span>
                  {node.data.sourceRowIndex !== undefined && (
                    <span className="text-indigo-500 dark:text-indigo-400">(Row {node.data.sourceRowIndex + 1})</span>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connection Handles */}
      {showHandles && (
        <NodeHandles
          node={node}
          scale={1} // Default scale, should be passed from canvas
          onHandleConnect={useCallback(
            (pos: "top" | "bottom" | "left" | "right", e: React.MouseEvent) => {
              // Handle connection logic - available for extension
            },
            [],
          )}
        />
      )}

      {/* Resize Handle - only visible when selected */}
      {showResizeHandle && node.resizable !== false && node.selected && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={handleResize}
          minWidth={150}
          minHeight={80}
        />
      )}

      {/* Mockup Button (appears on hover in lower left) */}
      {isHovering && !isEditing && !isEditingDescription && (
        <button
          onClick={handleMockupClick}
          className="absolute -bottom-10 left-0 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg px-3 py-1.5 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 z-50"
          data-testid={`mockup-button-${node.id}`}
          style={{ position: 'absolute' }}
        >
          <span className="text-base">✨</span>
          <span>Mockup</span>
        </button>
      )}
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const BasicNode = React.memo(BasicNodeComponent);

// Default props for creating a basic node
export const createBasicNode = (
  id: string,
  position: { x: number; y: number },
  data: Partial<BasicNodeData> = {},
): Node & { data: BasicNodeData } => ({
  id,
  type: "basic",
  position,
  data: {
    label: data.label || "Basic Node",
    description: data.description || "",
    colors: data.colors || {},
  },
  width: 200,
  height: 120,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true,
});
