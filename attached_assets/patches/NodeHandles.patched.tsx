/* src/components/nodes/NodeHandles.tsx (patched reference) */
import React, { useMemo } from 'react';
import { toPxNumber } from '@/src/utils/size';

type HandlePos = 'top' | 'bottom' | 'left' | 'right';

export interface NodeHandlesProps {
  node: {
    id: string;
    position: { x: number; y: number };
    width?: number | string;
    height?: number | string;
    style?: Record<string, any>;
    selected?: boolean;
  };
  scale: number;
  onHandleConnect?: (pos: HandlePos, e: React.MouseEvent) => void;
}

export const NodeHandles: React.FC<NodeHandlesProps> = ({ node, scale, onHandleConnect }) => {
  const w = toPxNumber((node as any).width ?? node.style?.width, 200);
  const h = toPxNumber((node as any).height ?? node.style?.height, 100);

  const size = 10 / Math.max(scale, 0.1);
  const half = size / 2;

  const handles = useMemo(() => ([
    { pos: 'top' as HandlePos,    cx: w / 2, cy: 0 },
    { pos: 'bottom' as HandlePos, cx: w / 2, cy: h },
    { pos: 'left' as HandlePos,   cx: 0,     cy: h / 2 },
    { pos: 'right' as HandlePos,  cx: w,     cy: h / 2 },
  ]), [w, h]);

  return (
    <div className="node-handles pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ overflow: 'visible' }}>
        {handles.map(hd => (
          <circle
            key={hd.pos}
            cx={hd.cx}
            cy={hd.cy}
            r={half}
            className="fill-white stroke-blue-500 pointer-events-auto"
            onMouseDown={(e) => onHandleConnect?.(hd.pos, e)}
          />
        ))}
      </svg>
    </div>
  );
};
