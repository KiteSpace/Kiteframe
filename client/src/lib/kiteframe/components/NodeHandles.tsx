import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Node, ProFeaturesConfig } from '../types';
import { useEventCleanup } from '../utils/eventCleanup';

const toPxNumber = (v: unknown, fallback: number): number => {
  if (typeof v === 'number') return isNaN(v) ? fallback : v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
};

interface NodeHandlesProps {
  node: Node;
  scale: number;
  onHandleConnect?: (pos: 'top'|'bottom'|'left'|'right', e: React.MouseEvent) => void;
  proFeatures?: ProFeaturesConfig;
  onQuickAdd?: (sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left') => void;
}

export const NodeHandles: React.FC<NodeHandlesProps> = ({ 
  node, 
  scale,
  onHandleConnect, 
  proFeatures,
  onQuickAdd
}) => {
  const [hoveredHandle, setHoveredHandle] = useState<'top'|'bottom'|'left'|'right' | null>(null);
  const [showQuickAddButton, setShowQuickAddButton] = useState<'top'|'bottom'|'left'|'right' | null>(null);
  const [showGhostPreview, setShowGhostPreview] = useState<'top'|'bottom'|'left'|'right' | null>(null);
  const [isMouseInNodeArea, setIsMouseInNodeArea] = useState(false);
  const [screenDimensions, setScreenDimensions] = useState<{width: number, height: number} | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const cleanupManager = useEventCleanup();
  
  const fallbackW = toPxNumber((node as any).width ?? node.style?.width, 200);
  const fallbackH = toPxNumber((node as any).height ?? node.style?.height, 100);

  useEffect(() => {
    const measureNode = () => {
      if (nodeRef.current) {
        const nodeElement = nodeRef.current.closest('.kiteframe-node');
        if (nodeElement) {
          const rect = nodeElement.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setScreenDimensions({ 
              width: rect.width, 
              height: rect.height 
            });
          }
        }
      }
    };

    measureNode();
    
    if (nodeRef.current && window.ResizeObserver) {
      const nodeElement = nodeRef.current.closest('.kiteframe-node');
      if (nodeElement) {
        const resizeObserver = cleanupManager.createResizeObserver(() => {
          measureNode();
        });
        resizeObserver.observe(nodeElement);
        
        return () => resizeObserver.disconnect();
      }
    }
  }, [node.data.label, node.data.description, scale, cleanupManager]);
  
  const screenW = screenDimensions?.width ?? (fallbackW * scale);
  const screenH = screenDimensions?.height ?? (fallbackH * scale);
  
  const handleSize = 12;
  const handleRadius = handleSize / 2;
  const quickAddOffset = 17;
  const quickAddSize = 24;
  const ghostSpacing = proFeatures?.quickAdd?.defaultSpacing ?? 250;
  
  // Quick-add is only enabled for basic node types (step, input, process, condition, output, ai)
  // Note: Code nodes have handles for connections but NOT quick-add
  const quickAddDisabledNodeTypes = ['image', 'table', 'form', 'compound', 'code'];
  const isQuickAddEnabled = proFeatures?.quickAdd?.enabled !== false && !quickAddDisabledNodeTypes.includes(node.type || '');
  
  const handlePositions = {
    top:    { cx: screenW / 2, cy: 0 },
    bottom: { cx: screenW / 2, cy: screenH },
    left:   { cx: 0, cy: screenH / 2 },
    right:  { cx: screenW, cy: screenH / 2 }
  } as const;

  const getQuickAddButtonStyle = (position: 'top'|'bottom'|'left'|'right'): React.CSSProperties => {
    const offset = quickAddOffset;
    switch (position) {
      case 'top':
        return { 
          position: 'absolute',
          top: -offset - quickAddSize / 2, 
          left: screenW / 2 - quickAddSize / 2
        };
      case 'bottom':
        return { 
          position: 'absolute',
          top: screenH + offset - quickAddSize / 2, 
          left: screenW / 2 - quickAddSize / 2
        };
      case 'left':
        return { 
          position: 'absolute',
          left: -offset - quickAddSize / 2, 
          top: screenH / 2 - quickAddSize / 2
        };
      case 'right':
        return { 
          position: 'absolute',
          left: screenW + offset - quickAddSize / 2, 
          top: screenH / 2 - quickAddSize / 2
        };
    }
  };

  const getGhostPreviewStyle = (position: 'top'|'bottom'|'left'|'right'): React.CSSProperties => {
    const spacing = ghostSpacing;
    const ghostW = screenW;
    const ghostH = screenH;
    switch (position) {
      case 'top':
        return { position: 'absolute', top: -spacing - ghostH, left: 0 };
      case 'bottom':
        return { position: 'absolute', top: screenH + spacing, left: 0 };
      case 'left':
        return { position: 'absolute', left: -spacing - ghostW, top: 0 };
      case 'right':
        return { position: 'absolute', left: screenW + spacing, top: 0 };
    }
  };

  const getConnectionLinePoints = (position: 'top'|'bottom'|'left'|'right') => {
    const handlePos = handlePositions[position];
    const spacing = ghostSpacing;
    
    switch (position) {
      case 'top':
        return { x1: handlePos.cx, y1: handlePos.cy, x2: screenW / 2, y2: -spacing };
      case 'bottom':
        return { x1: handlePos.cx, y1: handlePos.cy, x2: screenW / 2, y2: screenH + spacing };
      case 'left':
        return { x1: handlePos.cx, y1: handlePos.cy, x2: -spacing, y2: screenH / 2 };
      case 'right':
        return { x1: handlePos.cx, y1: handlePos.cy, x2: screenW + spacing, y2: screenH / 2 };
    }
  };

  const clearAllTimeouts = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearAllTimeouts();
    hideTimeoutRef.current = setTimeout(() => {
      setIsMouseInNodeArea(false);
      setHoveredHandle(null);
      setShowQuickAddButton(null);
      setShowGhostPreview(null);
    }, 200);
  }, [clearAllTimeouts]);

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleShow = useCallback((position: 'top'|'bottom'|'left'|'right') => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }
    showTimeoutRef.current = setTimeout(() => {
      if (isQuickAddEnabled) {
        setShowQuickAddButton(position);
      }
    }, 270);
  }, [isQuickAddEnabled]);

  const cancelShow = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  const handleQuickAddClick = (position: 'top'|'bottom'|'left'|'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    clearAllTimeouts();
    setShowGhostPreview(null);
    setShowQuickAddButton(null);
    setIsMouseInNodeArea(false);
    
    if (onQuickAdd) {
      onQuickAdd(node, position);
    }
  };

  return (
    <>
      {/* Invisible ref element to measure node */}
      <div 
        ref={nodeRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
      
      {/* Counter-scaled overlay for constant screen-space sizing */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0,
          left: 0,
          width: screenW,
          height: screenH,
          transform: `scale(${1 / scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Node hover area for handles - pointer-events-none to allow click-through to node content */}
        <div 
          className="node-handles absolute top-0 left-0 pointer-events-none"
          style={{ width: screenW, height: screenH }}
          onMouseEnter={() => {
            setIsMouseInNodeArea(true);
            cancelHide();
          }}
          onMouseLeave={() => {
            setIsMouseInNodeArea(false);
            scheduleHide();
          }}
        >
          {/* Edge handles SVG */}
          <svg 
            width={screenW} 
            height={screenH} 
            className="absolute top-0 left-0 overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {(['top','bottom','left','right'] as const).map((p) => (
              <circle
                key={p}
                cx={handlePositions[p].cx} 
                cy={handlePositions[p].cy} 
                r={handleRadius}
                className="pointer-events-auto cursor-crosshair"
                fill="white" 
                stroke="#3b82f6" 
                strokeWidth={2}
                onMouseDown={(e) => { 
                  e.stopPropagation(); 
                  onHandleConnect?.(p, e); 
                }}
                onMouseEnter={() => {
                  setHoveredHandle(p);
                  cancelHide();
                  scheduleShow(p);
                }}
                onMouseLeave={() => {
                  setHoveredHandle(null);
                  cancelShow();
                  scheduleHide();
                }}
              />
            ))}
          </svg>
        </div>

        {/* Expanded hover area for button zones */}
        <div 
          className="absolute pointer-events-none"
          style={{
            top: -50,
            left: -50,
            width: screenW + 100,
            height: screenH + 100,
          }}
          onMouseEnter={() => {
            cancelHide();
          }}
          onMouseLeave={() => {
            cancelShow();
            scheduleHide();
          }}
        />
        
        {/* Quick-add button */}
        {isQuickAddEnabled && showQuickAddButton && (
          <button
            className="bg-green-500 hover:bg-green-600 text-white border-2 border-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all duration-200 hover:scale-110 z-10 pointer-events-auto"
            style={{
              ...getQuickAddButtonStyle(showQuickAddButton),
              width: quickAddSize,
              height: quickAddSize,
            }}
            onClick={(e) => handleQuickAddClick(showQuickAddButton, e)}
            onMouseEnter={() => {
              cancelHide();
              cancelShow();
              setShowGhostPreview(showQuickAddButton);
            }}
            onMouseLeave={() => {
              setShowGhostPreview(null);
              scheduleHide();
            }}
            data-testid={`quick-add-${showQuickAddButton}`}
          >
            +
          </button>
        )}
        
        {/* Ghost preview */}
        {isQuickAddEnabled && showGhostPreview && (
          <>
            {/* Ghost connection line */}
            <svg 
              className="absolute top-0 left-0 overflow-visible pointer-events-none z-15"
              width={screenW} 
              height={screenH}
            >
              {(() => {
                const linePoints = getConnectionLinePoints(showGhostPreview);
                return (
                  <line 
                    x1={linePoints.x1} 
                    y1={linePoints.y1} 
                    x2={linePoints.x2} 
                    y2={linePoints.y2} 
                    stroke="#cbd5e1" 
                    strokeWidth="2" 
                    strokeDasharray="4 4" 
                  />
                );
              })()}
            </svg>
            
            {/* Ghost node preview */}
            <div
              className="pointer-events-none z-20"
              style={getGhostPreviewStyle(showGhostPreview)}
            >
              <div
                className="relative bg-white border border-dashed border-gray-400 rounded-lg shadow-lg opacity-60"
                style={{ width: screenW, height: screenH }}
              >
                <div className="absolute top-2 left-2 right-2 text-sm font-medium text-gray-600 truncate">
                  {proFeatures?.quickAdd?.defaultNodeTemplate?.label || 'New Process'}
                </div>
                <div className="absolute top-8 left-2 right-2 bottom-2 text-xs text-gray-500 overflow-hidden">
                  {proFeatures?.quickAdd?.defaultNodeTemplate?.description || 'Configure process settings'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
