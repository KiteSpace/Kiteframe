export interface Rect { x: number; y: number; width: number; height: number }

interface PlacedNode { id: string; position: { x: number; y: number }; width?: number; height?: number; data?: any }
interface LinkedEdge { source: string; target: string; label?: unknown }

const DEFAULT_W = 200;
const DEFAULT_H = 100;

export const MOCK_NODE_WIDTH = 400;
/** 400x300 SVG plus the 32px image node header (HEADER_H in ImageNode). */
export const MOCK_NODE_HEIGHT = 332;

export function nodeRect(node: PlacedNode): Rect {
  return { x: node.position.x, y: node.position.y, width: node.width || DEFAULT_W, height: node.height || DEFAULT_H };
}

function intersects(a: Rect, b: Rect, margin: number): boolean {
  return a.x < b.x + b.width + margin && a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin && a.y + a.height + margin > b.y;
}

/**
 * Finds a spot for a new node near `source` that overlaps no existing node.
 * Tries below, right, left, above, then a column right of everything.
 */
export function findFreeRect(
  nodes: PlacedNode[], source: PlacedNode, size: { width: number; height: number }, margin = 24,
): { x: number; y: number } {
  const others = nodes.filter((n) => n.id !== source.id).map(nodeRect);
  const s = nodeRect(source);
  const fits = (x: number, y: number) => {
    const r = { x, y, width: size.width, height: size.height };
    return !intersects(r, s, margin) && others.every((o) => !intersects(r, o, margin));
  };
  const candidates = [
    { x: s.x, y: s.y + s.height + margin * 2 },
    { x: s.x + s.width + margin * 2, y: s.y },
    { x: s.x - size.width - margin * 2, y: s.y },
    { x: s.x, y: s.y - size.height - margin * 2 },
  ];
  for (const c of candidates) if (fits(c.x, c.y)) return c;

  const all = [s, ...others];
  const right = Math.max(...all.map((r) => r.x + r.width)) + margin * 2;
  let y = s.y;
  for (let i = 0; i < 200 && !fits(right, y); i++) y += size.height + margin;
  return { x: right, y };
}

/** The workflow step a mock was generated from: the source of its `mockup` edge. */
export function resolveMockSource(
  nodes: PlacedNode[], edges: LinkedEdge[], mockId: string,
): { label: string; description: string; nodeType: string } {
  const mock = nodes.find((n) => n.id === mockId);
  const edge = edges.find((e) => e.target === mockId && e.label === 'mockup') ?? edges.find((e) => e.target === mockId);
  const source = edge && nodes.find((n) => n.id === edge.source && n.id !== mockId);
  if (source) {
    return {
      label: String(source.data?.label || 'Untitled'),
      description: String(source.data?.description || ''),
      nodeType: String((source as any).type || 'process'),
    };
  }
  const label = String(mock?.data?.label || 'Untitled').replace(/\s*Mockup$/, '') || 'Untitled';
  return { label, description: '', nodeType: 'process' };
}

export function decodeSvgDataUrl(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  const m = /^data:image\/svg\+xml(;base64)?,([\s\S]*)$/.exec(src);
  if (!m) return null;
  try {
    const text = m[1] ? decodeURIComponent(escape(atob(m[2]))) : decodeURIComponent(m[2]);
    return text.trimStart().toLowerCase().startsWith('<svg') ? text : null;
  } catch {
    return null;
  }
}

export function encodeSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function withId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

export function withoutId(ids: string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}
