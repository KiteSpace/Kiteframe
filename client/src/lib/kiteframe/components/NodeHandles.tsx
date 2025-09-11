import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Node, ProFeaturesConfig } from '../types';

interface NodeHandlesProps {
  node: Node;
  onHandleConnect?: (pos: 'top'|'bottom'|'left'|'right', e: React.MouseEvent) => void;
  proFeatures?: ProFeaturesConfig;
  onQuickAdd?: (sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left') => void;
}

export const NodeHandles: React.FC<NodeHandlesProps> = ({ 
  node, 
  onHandleConnect, 
  proFeatures,
  onQuickAdd
}) => {
  const [hoveredHandle, setHoveredHandle] = useState<'top'|'bottom'|'left'|'right' | null>(null);
  const [showQuickAddButton, setShowQuickAddButton] = useState<'top'|'bottom'|'left'|'right' | null>(null);
  const [showGhostPreview, setShowGhostPreview] = useState<'top'|'bottom'|'left'|'right' | null>(null);
  const [isMouseInNodeArea, setIsMouseInNodeArea] = useState(false);
  const [actualDimensions, setActualDimensions] = useState<{width: number, height: number} | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  
  // Use actual rendered dimensions if available, fallback to node properties
  const w = actualDimensions?.width ?? node.style?.width ?? node.width ?? 200;
  const h = actualDimensions?.height ?? node.style?.height ?? node.height ?? 100;

  // Measure actual node dimensions
  useEffect(() => {
    const measureNode = () => {
      // Find the parent node element using DOM traversal
      if (nodeRef.current) {
        const nodeElement = nodeRef.current.closest('.kiteframe-node');
        if (nodeElement) {
          const rect = nodeElement.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setActualDimensions({ width: rect.width, height: rect.height });
          }
        }
      }
    };

    // Measure on mount and when content might change
    measureNode();
    
    // Use ResizeObserver if available to track size changes
    if (nodeRef.current && window.ResizeObserver) {
      const nodeElement = nodeRef.current.closest('.kiteframe-node');
      if (nodeElement) {
        const resizeObserver = new ResizeObserver(() => {
          measureNode();
        });
        resizeObserver.observe(nodeElement);
        
        return () => resizeObserver.disconnect();
      }
    }
  }, [node.data.label, node.data.description]); // Re-measure when content changes
  const size = 12, r = size/2;
  
  const isQuickAddEnabled = proFeatures?.quickAdd?.enabled !== false;
  
  const pos = {
    top:    { cx: w/2, cy: 0 },
    bottom: { cx: w/2, cy: h },
    left:   { cx: 0,   cy: h/2 },
    right:  { cx: w,   cy: h/2 }
  } as const;

  const getQuickAddButtonPosition = (position: 'top'|'bottom'|'left'|'right') => {
    const offset = 35;
    switch (position) {
      case 'top':
        return { top: -offset, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom':
        return { bottom: -offset, left: '50%', transform: 'translateX(-50%)' };
      case 'left':
        return { left: -offset, top: '50%', transform: 'translateY(-50%)' };
      case 'right':
        return { right: -offset, top: '50%', transform: 'translateY(-50%)' };
    }
  };

  const getGhostPreviewPosition = (position: 'top'|'bottom'|'left'|'right') => {
    const spacing = proFeatures?.quickAdd?.defaultSpacing ?? 250;
    switch (position) {
      case 'top':
        return { top: -spacing, left: 0 };
      case 'bottom':
        return { top: spacing, left: 0 };
      case 'left':
        return { left: -spacing, top: 0 };
      case 'right':
        return { left: spacing, top: 0 };
    }
  };

  const getConnectionLinePoints = (position: 'top'|'bottom'|'left'|'right') => {
    const handlePos = pos[position];
    const spacing = proFeatures?.quickAdd?.defaultSpacing ?? 250;
    
    switch (position) {
      case 'top':
        return { x1: handlePos.cx, y1: handlePos.cy, x2: w/2, y2: -spacing + h };
      case 'bottom':
        return { x1: handlePos.cx, y1: handlePos.cy, x2: w/2, y2: spacing };
      case 'left':
        return { x1: handlePos.cx, y1: handlePos.cy, x2: -spacing + w, y2: h/2 };
      case 'right':
        return { x1: handlePos.cx, y1: handlePos.cy, x2: spacing, y2: h/2 };
    }
  };

  // Clean up all timeouts and state
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

  // Debounced hide function to prevent buttons from disappearing too quickly
  const scheduleHide = useCallback(() => {
    clearAllTimeouts();
    hideTimeoutRef.current = setTimeout(() => {
      setIsMouseInNodeArea(false);
      setHoveredHandle(null);
      setShowQuickAddButton(null);
      setShowGhostPreview(null);
    }, 200); // 200ms delay before hiding
  }, [clearAllTimeouts]);

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Delayed show function to prevent buttons from appearing too quickly
  const scheduleShow = useCallback((position: 'top'|'bottom'|'left'|'right') => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }
    showTimeoutRef.current = setTimeout(() => {
      if (isQuickAddEnabled) {
        setShowQuickAddButton(position);
      }
    }, 270); // 270ms delay before showing
  }, [isQuickAddEnabled]);

  const cancelShow = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  const handleQuickAddClick = (position: 'top'|'bottom'|'left'|'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear all timeouts and state immediately
    clearAllTimeouts();
    setShowGhostPreview(null);
    setShowQuickAddButton(null);
    setIsMouseInNodeArea(false);
    
    // Create actual node through callback
    if (onQuickAdd) {
      onQuickAdd(node, position);
    }
  };

  return (
    <>
      {/* Original node area for handles */}
      <div 
        ref={nodeRef}
        className="absolute top-0 left-0 w-full h-full"
        onMouseEnter={() => {
          setIsMouseInNodeArea(true);
          cancelHide();
        }}
        onMouseLeave={() => {
          setIsMouseInNodeArea(false);
          // Start hide process when leaving node area
          scheduleHide();
        }}
      >
        <svg 
          width={w} 
          height={h} 
          className="absolute top-0 left-0 overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {(['top','bottom','left','right'] as const).map((p) => (
            <circle
              key={p}
              cx={pos[p].cx} 
              cy={pos[p].cy} 
              r={r}
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
                // Start hide process when leaving handle
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
          width: w + 100,
          height: h + 100,
        }}
        onMouseEnter={() => {
          cancelHide();
        }}
        onMouseLeave={() => {
          cancelShow();
          scheduleHide();
        }}
      />
      
      {/* Quick-add buttons */}
      {isQuickAddEnabled && showQuickAddButton && (
        <button
          className="absolute w-6 h-6 bg-green-500 hover:bg-green-600 text-white border-2 border-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all duration-200 hover:scale-110 z-10 pointer-events-auto"
          style={getQuickAddButtonPosition(showQuickAddButton)}
          onClick={(e) => handleQuickAddClick(showQuickAddButton, e)}
          onMouseEnter={() => {
            cancelHide();
            cancelShow(); // Stop any pending show operations
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
      
      {/* Ghost preview of the new node */}
      {isQuickAddEnabled && showGhostPreview && (
        <>
          {/* Ghost connection line - positioned in parent coordinate system */}
          <svg 
            className="absolute top-0 left-0 overflow-visible pointer-events-none z-15"
            width={w} 
            height={h}
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
            className="absolute pointer-events-none z-20"
            style={getGhostPreviewPosition(showGhostPreview)}
          >
            <div
              className="relative bg-white border border-dashed border-gray-400 rounded-lg shadow-lg opacity-60"
              style={{ width: w, height: h }}
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
    </>
  );
};