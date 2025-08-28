import React from 'react';
import type { Node } from '../types';

export const NodeHandles: React.FC<{ node: Node; onHandleConnect?: (pos: 'top'|'bottom'|'left'|'right', e: React.MouseEvent) => void; }> = ({ node, onHandleConnect }) => {
  const w = node.style?.width ?? node.width ?? 200;
  const h = node.style?.height ?? node.height ?? 100;
  const size = 12, r = size/2;
  const pos = {
    top:    { cx: w/2, cy: 0 },
    bottom: { cx: w/2, cy: h },
    left:   { cx: 0,   cy: h/2 },
    right:  { cx: w,   cy: h/2 }
  } as const;

  return (
    <svg width={w} height={h} className="absolute top-0 left-0 overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
      {(['top','bottom','left','right'] as const).map((p) => (
        <circle
          key={p}
          cx={pos[p].cx} cy={pos[p].cy} r={r}
          className="pointer-events-auto cursor-crosshair"
          fill="white" stroke="#3b82f6" strokeWidth={2}
          onMouseDown={(e)=>{ e.stopPropagation(); onHandleConnect?.(p, e); }}
        />
      ))}
    </svg>
  );
};