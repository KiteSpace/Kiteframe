import { useState } from "react";
import {
  ArrowRight,
  Cog,
  HelpCircle,
  ArrowLeft,
  Bot,
  Image,
  Type,
  StickyNote,
  Square,
} from "lucide-react";
import { clientToWorld } from "@/lib/kiteframe/utils/geometry";

interface NodeTypesPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNode: (type: string) => void;
  onCreateNodeAtPosition?: (
    type: string,
    position: { x: number; y: number },
  ) => void;
  viewport: { x: number; y: number; zoom: number };
}

export function NodeTypesPopout({
  isOpen,
  onClose,
  onCreateNode,
  onCreateNodeAtPosition,
  viewport,
}: NodeTypesPopoutProps) {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    nodeType: string | null;
    startPos: { x: number; y: number } | null;
    currentPos: { x: number; y: number } | null;
  }>({ isDragging: false, nodeType: null, startPos: null, currentPos: null });

  const nodeTypes = [
    { type: "input", icon: ArrowRight, color: "text-blue-500", label: "Input" },
    { type: "process", icon: Cog, color: "text-green-500", label: "Process" },
    {
      type: "condition",
      icon: HelpCircle,
      color: "text-yellow-500",
      label: "Condition",
    },
    { type: "output", icon: ArrowLeft, color: "text-red-500", label: "Output" },
    { type: "ai", icon: Bot, color: "text-purple-500", label: "AI Task" },
    //{ type: 'image', icon: Image, color: 'text-indigo-500', label: 'Image' },
  ];

  // Drag and drop handlers
  const handleNodeTypeMouseDown = (e: React.MouseEvent, nodeType: string) => {
    // Only handle left mouse button
    if (e.button !== 0) return;

    console.log("🎯 POPOUT DRAG START:", {
      nodeType,
      startPos: { x: e.clientX, y: e.clientY },
    });

    e.preventDefault();
    e.stopPropagation();

    const startPos = { x: e.clientX, y: e.clientY };
    let hasMoved = false;

    setDragState({
      isDragging: false, // Don't set dragging until we actually move
      nodeType,
      startPos,
      currentPos: startPos,
    });

    const handleMouseMove = (e: MouseEvent) => {
      const distance = Math.sqrt(
        Math.pow(e.clientX - startPos.x, 2) +
          Math.pow(e.clientY - startPos.y, 2),
      );

      // Only start dragging if moved more than 5 pixels
      if (distance > 5) {
        hasMoved = true;
        setDragState((prev) => ({
          ...prev,
          isDragging: true,
          currentPos: { x: e.clientX, y: e.clientY },
        }));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      console.log("🎯 POPOUT DRAG END:", {
        nodeType,
        endPos: { x: e.clientX, y: e.clientY },
        hasMoved,
      });

      if (hasMoved) {
        // This was a drag operation - try to place at mouse position
        const canvasElement = document.querySelector(
          '[data-testid="workflow-canvas"]',
        );

        if (canvasElement && onCreateNodeAtPosition) {
          const canvasRect = canvasElement.getBoundingClientRect();
          const canvasX = e.clientX - canvasRect.left;
          const canvasY = e.clientY - canvasRect.top;

          // Only create node if dropped on canvas
          if (
            canvasX >= 0 &&
            canvasX <= canvasRect.width &&
            canvasY >= 0 &&
            canvasY <= canvasRect.height
          ) {
            // Convert screen coordinates to world coordinates using viewport transformation
            const worldPos = clientToWorld(
              e.clientX,
              e.clientY,
              viewport,
              canvasRect,
            );
            console.log("🎯 CALLING onCreateNodeAtPosition from popout:", {
              nodeType,
              worldPosition: worldPos,
              screenPos: { x: e.clientX, y: e.clientY },
            });
            onCreateNodeAtPosition(nodeType, worldPos);
            // Don't close popout after drag-and-drop - only on outside click or toggle
          } else {
            console.log("🎯 DROP OUTSIDE CANVAS - NO NODE CREATED");
          }
        }
      }
      // If not moved, the click handler will take care of center placement

      // Reset drag state
      setDragState({
        isDragging: false,
        nodeType: null,
        startPos: null,
        currentPos: null,
      });

      // Remove event listeners
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    // Add event listeners
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop to close popout when clicking outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        data-testid="popout-backdrop"
      />

      {/* Popout Panel */}
      <div
        className="absolute left-16 top-32 w-40 bg-card border border-border rounded-md shadow-lg p-3"
        style={{ zIndex: 60 }}
        data-testid="node-types-popout"
      >
        <h3 className="text-sm font-semibold mb-3">Node Types</h3>
        <div className="flex flex-col gap-2">
          {nodeTypes.map((nodeType) => {
            const IconComponent = nodeType.icon;
            return (
              <div
                key={nodeType.type}
                className="p-2 border border-border rounded-md cursor-pointer text-center hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                onClick={(e) => {
                  // Only handle click if no drag occurred
                  if (!dragState.isDragging) {
                    onCreateNode(nodeType.type);
                    // Don't close popout on click - only on outside click or toggle
                  }
                }}
                onMouseDown={(e) => handleNodeTypeMouseDown(e, nodeType.type)}
                data-testid={`popout-node-type-${nodeType.type}`}
              >
                <IconComponent
                  className={`${nodeType.color} mb-1 mx-auto`}
                  size={16}
                />
                <div className="text-xs font-medium">{nodeType.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag Visual Indicator - matches expanded sidebar style */}
      {dragState.isDragging && dragState.currentPos && dragState.nodeType && (
        <div
          className="fixed pointer-events-none bg-white/90 dark:bg-gray-800/90 border border-border rounded-md p-2 shadow-lg backdrop-blur-sm"
          style={{
            zIndex: 60,
            left: dragState.currentPos.x + 10,
            top: dragState.currentPos.y - 20,
            transform: "translate(0, 0)",
          }}
        >
          <div className="flex items-center gap-2 text-sm">
            {(() => {
              const nodeTypeData = nodeTypes.find(
                (nt) => nt.type === dragState.nodeType,
              );
              if (nodeTypeData) {
                const IconComponent = nodeTypeData.icon;
                return (
                  <>
                    <IconComponent
                      className={`${nodeTypeData.color}`}
                      size={16}
                    />
                    <span className="font-medium">{nodeTypeData.label}</span>
                  </>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}
    </>
  );
}
