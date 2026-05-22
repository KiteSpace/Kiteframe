import { useState, useMemo } from 'react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const DEFAULT_W = 160;
const DEFAULT_H = 60;
const PADDING = 24;

function getNodeLabel(node: Node): string {
  const d = node.data as { label?: string; title?: string };
  return d?.label || d?.title || node.type || 'Node';
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function getNodeColor(type?: string): { fill: string; stroke: string; text: string } {
  switch (type) {
    case 'input':      return { fill: '#dcfce7', stroke: '#16a34a', text: '#15803d' };
    case 'output':     return { fill: '#f1f5f9', stroke: '#475569', text: '#334155' };
    case 'process':    return { fill: '#dbeafe', stroke: '#2563eb', text: '#1d4ed8' };
    case 'condition':  return { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' };
    case 'ai':         return { fill: '#f3e8ff', stroke: '#9333ea', text: '#7e22ce' };
    case 'experiment': return { fill: '#ffedd5', stroke: '#ea580c', text: '#9a3412' };
    case 'image':      return { fill: '#fce7f3', stroke: '#db2777', text: '#9d174d' };
    default:           return { fill: '#f4f4f5', stroke: '#71717a', text: '#3f3f46' };
  }
}

function rectBorderPoint(
  sx: number, sy: number,
  tx: number, ty: number,
  tw: number, th: number
): { x: number; y: number } {
  const dx = sx - tx;
  const dy = sy - ty;
  if (dx === 0 && dy === 0) return { x: tx, y: ty };
  const scaleX = dx !== 0 ? (tw / 2) / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? (th / 2) / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: tx + dx * scale, y: ty + dy * scale };
}

interface NodeInfo { cx: number; cy: number; w: number; h: number }

function WorkflowSVG({ nodes, edges, height }: { nodes: Node[]; edges: Edge[]; height: number }) {
  const { viewBox, nodeMap } = useMemo(() => {
    if (nodes.length === 0) return { viewBox: '0 0 400 200', nodeMap: new Map<string, NodeInfo>() };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const map = new Map<string, NodeInfo>();

    for (const n of nodes) {
      const w = n.width ?? n.style?.width ?? DEFAULT_W;
      const h = n.height ?? n.style?.height ?? DEFAULT_H;
      const x = n.position.x;
      const y = n.position.y;
      map.set(n.id, { cx: x + w / 2, cy: y + h / 2, w, h });
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }

    const vw = maxX - minX + PADDING * 2;
    const vh = maxY - minY + PADDING * 2;
    return {
      viewBox: `${minX - PADDING} ${minY - PADDING} ${vw} ${vh}`,
      nodeMap: map,
    };
  }, [nodes]);

  return (
    <svg
      viewBox={viewBox}
      width="100%"
      height={height}
      style={{ display: 'block' }}
      aria-hidden
    >
      <defs>
        <marker id="wf-arrow" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#94a3b8" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t || edge.source === edge.target) return null;
        const end = rectBorderPoint(s.cx, s.cy, t.cx, t.cy, t.w, t.h);
        return (
          <line
            key={edge.id}
            x1={s.cx} y1={s.cy}
            x2={end.x} y2={end.y}
            stroke="#94a3b8"
            strokeWidth="1.5"
            markerEnd="url(#wf-arrow)"
          />
        );
      })}

      {nodes.map((node) => {
        const pos = nodeMap.get(node.id);
        if (!pos) return null;
        const { cx, cy, w, h } = pos;
        const color = getNodeColor(node.type);
        const label = truncate(getNodeLabel(node), 22);
        const maxCharsPerLine = Math.floor(w / 7);
        return (
          <g key={node.id}>
            <rect
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={6}
              fill={color.fill}
              stroke={color.stroke}
              strokeWidth={1.5}
            />
            <text
              x={cx}
              y={cy + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill={color.text}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {truncate(label, maxCharsPerLine > 4 ? maxCharsPerLine : 22)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface WorkflowThumbnailProps {
  nodes: Node[];
  edges: Edge[];
}

export function WorkflowThumbnail({ nodes, edges }: WorkflowThumbnailProps) {
  const [open, setOpen] = useState(false);
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const countLabel = `${nodeCount} node${nodeCount !== 1 ? 's' : ''} · ${edgeCount} edge${edgeCount !== 1 ? 's' : ''}`;

  return (
    <>
      <div
        className="mt-3 rounded-lg border border-border bg-muted/10 overflow-hidden cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors group"
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
        aria-label={`Workflow preview — ${countLabel}. Click to expand.`}
        data-testid="workflow-thumbnail"
      >
        <WorkflowSVG nodes={nodes} edges={edges} height={160} />
        <div className="px-3 py-1.5 border-t border-border/40 flex items-center justify-between bg-muted/20">
          <span className="text-[11px] text-muted-foreground font-medium">{countLabel}</span>
          <span className="text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground/90 transition-colors">
            click to expand ↗
          </span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0">
          <DialogTitle className="sr-only">Workflow preview</DialogTitle>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium">Workflow preview</span>
            <span className="text-xs text-muted-foreground">{countLabel}</span>
          </div>
          <div className="p-4 bg-muted/10">
            <WorkflowSVG nodes={nodes} edges={edges} height={480} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
