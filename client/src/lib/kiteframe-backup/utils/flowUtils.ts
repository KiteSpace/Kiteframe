import type { Node } from '../types';

export function getBounds(nodes: Node[]) {
  if (!nodes.length) return { minX:0, minY:0, maxX:0, maxY:0 };
  return nodes.reduce((acc, n) => {
    const w = n.style?.width ?? n.width ?? 200;
    const h = n.style?.height ?? n.height ?? 100;
    return {
      minX: Math.min(acc.minX, n.position.x),
      minY: Math.min(acc.minY, n.position.y),
      maxX: Math.max(acc.maxX, n.position.x + w),
      maxY: Math.max(acc.maxY, n.position.y + h)
    };
  }, { minX: nodes[0].position.x, minY: nodes[0].position.y, maxX: nodes[0].position.x + (nodes[0].style?.width ?? 200), maxY: nodes[0].position.y + (nodes[0].style?.height ?? 100) });
}