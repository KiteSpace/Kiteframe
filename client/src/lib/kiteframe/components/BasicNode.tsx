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
    return {
      headerBg: validateColor(nodeColors.headerBackground || "")
        ? nodeColors.headerBackground
        : "#f8fafc",
      bodyBg: validateColor(nodeColors.bodyBackground || "")
        ? nodeColors.bodyBackground
        : "#ffffff",
      borderColor: validateColor(nodeColors.borderColor || "")
        ? nodeColors.borderColor
        : "#e2e8f0",
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
    return getDynamicClassName(
      {
        position: "absolute",
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${nodeWidth}px`,
        height: `${nodeHeight}px`,
        zIndex: node.zIndex || 0,
        ...style,
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

  return (
    <div
      ref={nodeRef}
      className={cn(
        "kiteframe-node group",
        "border-2 rounded-lg shadow-md transition-all duration-200",
        "hover:shadow-lg cursor-move",
        node.selected ? "ring-2 ring-blue-500 shadow-lg" : "",
        node.hidden ? "opacity-0 pointer-events-none" : "",
        nodePositionClass,
        borderClass,
        className,
      )}
      role="article"
      aria-label={`Basic node: ${node.data.label || "Untitled"}. ${node.data.description || "No description"}`}
      aria-selected={node.selected}
      tabIndex={node.selected ? 0 : -1}
      onDoubleClick={handleDoubleClick}
      data-testid={`basic-node-${node.id}`}
    >
      {/* Header */}
      <div
        className={cn(
          "h-8 px-3 flex items-center justify-between rounded-t-lg",
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
          "flex-1 p-3 rounded-b-lg",
          styleClasses.bodyClass,
          getDynamicClassName(
            { minHeight: `${nodeHeight - 32}px` },
            `body-height-${node.id}`,
          ),
        )}
        role="region"
        aria-label="Node content"
        onDoubleClick={handleDescriptionDoubleClick}
      >
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
          <p className="text-xs leading-relaxed" aria-label="Node description">
            {sanitizeText(node.data.description)}
          </p>
        ) : (
          <div
            className="text-xs opacity-60 italic"
            aria-label="Empty node. Double-click to edit"
          >
            Double-click to edit
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
