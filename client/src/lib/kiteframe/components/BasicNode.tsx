import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { NodeHandles } from "./NodeHandles";
import { ResizeHandle } from "./ResizeHandle";
import type { Node, BasicNodeData, BasicNodeComponentProps } from "../types";
import { sanitizeText, validateColor } from "../utils/validation";
import { getDynamicClassName, getNodeStyleClasses } from "../utils/styles";
import { getBorderColorFromHeader } from "@/lib/themes";

const BasicNodeComponent: React.FC<BasicNodeComponentProps> = ({
  node,
  onUpdate,
  onConnect,
  onDoubleClick,
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
    
    console.log('🔵 BasicNode colors calculation:', {
      nodeId: node.id,
      headerBg,
      borderColor,
      nodeColors
    });
    
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

  // Log node data for debugging
  console.log('🎨 BasicNode render:', {
    nodeId: node.id,
    iconVisible: node.data.iconVisible,
    nodeIcon: node.data.nodeIcon,
    hasNoBorder,
    borderColor: colors.borderColor
  });

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
        <div className="flex gap-3">
          {/* Icon/Emoji container - only shown if iconVisible is true and nodeIcon exists */}
          {(() => {
            const shouldShowIcon = node.data.iconVisible !== false && node.data.nodeIcon;
            console.log('🎭 Icon render check:', {
              nodeId: node.id,
              iconVisible: node.data.iconVisible,
              nodeIcon: node.data.nodeIcon,
              shouldShowIcon
            });
            return shouldShowIcon;
          })() && (
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
          <div className="flex-1 min-w-0">
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
                {(() => {
                  console.log('📝 BASICNODE TEXT RENDER:', {
                    nodeId: node.id,
                    description: node.data.description,
                    textStyles: {
                      fontSize: node.data.fontSize,
                      bold: node.data.bold,
                      italic: node.data.italic,
                      strikethrough: node.data.strikethrough,
                      underline: node.data.underline,
                      textAlign: node.data.textAlign,
                    },
                    appliedClasses: cn(
                      "leading-relaxed",
                      !node.data.fontSize && "text-xs",
                      node.data.bold && "font-bold",
                      node.data.italic && "italic",
                      node.data.strikethrough && "line-through",
                      node.data.underline && "underline",
                    ),
                    appliedStyles: {
                      fontSize: node.data.fontSize ? `${node.data.fontSize}px` : undefined,
                      textAlign: node.data.textAlign || 'left',
                      color: colors.bodyTextColor,
                    }
                  });
                  return null;
                })()}
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
                  {sanitizeText(node.data.description)}
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
          </div>
        </div>
      </div>

      {/* Connection Handles */}
      {showHandles && (
        <NodeHandles
          node={node}
          scale={1} // Default scale, should be passed from canvas
          onHandleConnect={useCallback(
            (pos: "top" | "bottom" | "left" | "right", e: React.MouseEvent) => {
              // Handle connection logic
              console.log("Handle connect:", pos, e);
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
