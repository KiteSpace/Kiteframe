import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Node } from "../types";

interface DefaultNodeProps {
  node: Node;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onDrag?: (deltaX: number, deltaY: number) => void;
  onResize?: (width: number, height: number) => void;
}

export const DefaultNode: React.FC<DefaultNodeProps> = ({
  node,
  children,
  className,
  style,
  onDoubleClick,
  onDrag,
  onResize,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(e);
  };

  const nodeStyles: React.CSSProperties = {
    position: "absolute",
    left: node.position.x,
    top: node.position.y,
    width: node.style?.width || node.width || 200,
    height: node.style?.height || node.height || 100,
    ...style,
  };

  return (
    <div
      ref={nodeRef}
      className={cn(
        "kiteframe-node group",
        "bg-white dark:bg-gray-800",
        "border-2 border-gray-200 dark:border-gray-700",
        "rounded-lg shadow-md transition-all duration-200",
        "hover:shadow-lg cursor-move",
        node.selected ? "ring-2 ring-red-500 shadow-lg" : "",
        node.hidden ? "opacity-0 pointer-events-none" : "",
        className,
      )}
      style={nodeStyles}
      onDoubleClick={handleDoubleClick}
      data-testid={`node-${node.type}-${node.id}`}
    >
      {children}
    </div>
  );
};
