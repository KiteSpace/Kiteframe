import { useState, useMemo, useEffect } from 'react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const DEFAULT_W = 160;
const DEFAULT_H = 60;
const PADDING = 24;

const STYLE_ID = 'workflow-thumbnail-css-vars';
const CSS_VARS = `
:root {
  --wf-edge: #94a3b8;
  --wf-arrow: #94a3b8;
  --wf-proc-fill: #dbeafe;  --wf-proc-stroke: #2563eb;  --wf-proc-text: #1d4ed8;
  --wf-cond-fill: #fef3c7;  --wf-cond-stroke: #d97706;  --wf-cond-text: #92400e;
  --wf-in-fill:   #dcfce7;  --wf-in-stroke:   #16a34a;  --wf-in-text:   #15803d;
  --wf-out-fill:  #f1f5f9;  --wf-out-stroke:  #475569;  --wf-out-text:  #334155;
  --wf-ai-fill:   #f3e8ff;  --wf-ai-stroke:   #9333ea;  --wf-ai-text:   #7e22ce;
  --wf-exp-fill:  #ffedd5;  --wf-exp-stroke:  #ea580c;  --wf-exp-text:  #9a3412;
  --wf-img-fill:  #fce7f3;  --wf-img-stroke:  #db2777;  --wf-img-text:  #9d174d;
  --wf-def-fill:  #f4f4f5;  --wf-def-stroke:  #71717a;  --wf-def-text:  #3f3f46;
}
.dark {
  --wf-edge: #475569;
  --wf-arrow: #475569;
  --wf-proc-fill: #1e3a5f;  --wf-proc-stroke: #60a5fa;  --wf-proc-text: #93c5fd;
  --wf-cond-fill: #451a03;  --wf-cond-stroke: #f59e0b;  --wf-cond-text: #fcd34d;
  --wf-in-fill:   #052e16;  --wf-in-stroke:   #4ade80;  --wf-in-text:   #86efac;
  --wf-out-fill:  #1e293b;  --wf-out-stroke:  #94a3b8;  --wf-out-text:  #cbd5e1;
  --wf-ai-fill:   #2e1065;  --wf-ai-stroke:   #c084fc;  --wf-ai-text:   #e9d5ff;
  --wf-exp-fill:  #431407;  --wf-exp-stroke:  #fb923c;  --wf-exp-text:  #fdba74;
  --wf-img-fill:  #500724;  --wf-img-stroke:  #f472b6;  --wf-img-text:  #fbcfe8;
  --wf-def-fill:  #18181b;  --wf-def-stroke:  #a1a1aa;  --wf-def-text:  #d4d4d8;
}
`;

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS_VARS;
  document.head.appendChild(el);
}

const TYPE_PREFIX: Record<string, string> = {
  process: 'proc', condition: 'cond', input: 'in', output: 'out',
  ai: 'ai', experiment: 'exp', image: 'img',
};

function nodeVars(type?: string): { fill: string; stroke: string; text: string } {
  const p = TYPE_PREFIX[type ?? ''] ?? 'def';
  return {
    fill:   `var(--wf-${p}-fill)`,
    stroke: `var(--wf-${p}-stroke)`,
    text:   `var(--wf-${p}-text)`,
  };
}

function getNodeLabel(node: Node): string {
  const d = node.data as { label?: string; title?: string };
  return d?.label || d?.title || node.type || 'Node';
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function rectBorderPoint(
  sx: number, sy: number,
  tx: number, ty: number,
  tw: number, th: number,
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
          <polygon
            points="0 0, 7 2.5, 0 5"
            style={{ fill: 'var(--wf-arrow)' }}
          />
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
            style={{ stroke: 'var(--wf-edge)' }}
            strokeWidth="1.5"
            markerEnd="url(#wf-arrow)"
          />
        );
      })}

      {nodes.map((node) => {
        const pos = nodeMap.get(node.id);
        if (!pos) return null;
        const { cx, cy, w, h } = pos;
        const vars = nodeVars(node.type);
        const maxChars = Math.max(4, Math.floor(w / 7));
        const label = truncate(getNodeLabel(node), maxChars);
        return (
          <g key={node.id}>
            <rect
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={6}
              style={{ fill: vars.fill, stroke: vars.stroke }}
              strokeWidth={1.5}
            />
            <text
              x={cx}
              y={cy + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              style={{ fill: vars.text }}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {label}
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

  useEffect(() => { injectStyles(); }, []);

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
