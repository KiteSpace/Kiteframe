import React, { useState } from 'react';
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
  
  const w = node.style?.width ?? node.width ?? 200;
  const h = node.style?.height ?? node.height ?? 100;
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
        return { top: -spacing - h/2, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom':
        return { top: spacing + h/2, left: '50%', transform: 'translateX(-50%)' };
      case 'left':
        return { left: -spacing - w/2, top: '50%', transform: 'translateY(-50%)' };
      case 'right':
        return { left: spacing + w/2, top: '50%', transform: 'translateY(-50%)' };
    }
  };

  const handleQuickAddClick = (position: 'top'|'bottom'|'left'|'right') => {
    if (onQuickAdd) {
      onQuickAdd(node, position);
    }
    setShowQuickAddButton(null);
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full">
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
              if (isQuickAddEnabled) {
                setShowQuickAddButton(p);
              }
            }}
            onMouseLeave={() => {
              setHoveredHandle(null);
              // Delay hiding to allow moving to quick-add button
              setTimeout(() => {
                if (hoveredHandle !== p) {
                  setShowQuickAddButton(null);
                }
              }, 100);
            }}
          />
        ))}
      </svg>
      
      {/* Quick-add buttons */}
      {isQuickAddEnabled && showQuickAddButton && (
        <button
          className="absolute w-6 h-6 bg-green-500 hover:bg-green-600 text-white border-2 border-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all duration-200 hover:scale-110 z-10"
          style={getQuickAddButtonPosition(showQuickAddButton)}
          onClick={() => handleQuickAddClick(showQuickAddButton)}
          onMouseEnter={() => {
            setShowQuickAddButton(showQuickAddButton);
            setShowGhostPreview(showQuickAddButton);
          }}
          onMouseLeave={() => {
            setShowQuickAddButton(null);
            setShowGhostPreview(null);
          }}
          data-testid={`quick-add-${showQuickAddButton}`}
        >
          +
        </button>
      )}
      
      {/* Ghost preview of the new node */}
      {isQuickAddEnabled && showGhostPreview && (
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
            {/* Ghost connection line */}
            <svg 
              className="absolute top-0 left-0 overflow-visible pointer-events-none"
              style={{ 
                width: w, 
                height: h,
                transform: showGhostPreview === 'top' ? 'translateY(100%)' :
                          showGhostPreview === 'bottom' ? 'translateY(-100%)' :
                          showGhostPreview === 'left' ? 'translateX(100%)' :
                          'translateX(-100%)'
              }}
            >
              {showGhostPreview === 'top' && (
                <line x1={w/2} y1={0} x2={w/2} y2={h} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
              )}
              {showGhostPreview === 'bottom' && (
                <line x1={w/2} y1={h} x2={w/2} y2={0} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
              )}
              {showGhostPreview === 'left' && (
                <line x1={0} y1={h/2} x2={w} y2={h/2} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
              )}
              {showGhostPreview === 'right' && (
                <line x1={w} y1={h/2} x2={0} y2={h/2} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};