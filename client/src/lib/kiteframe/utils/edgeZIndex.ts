import type { Edge, Node } from '../types';

/**
 * Calculate the z-index for an edge based on its connected nodes
 * An edge inherits the minimum z-index of its connected nodes
 * When either connected node is selected, the edge gets a +1000 boost
 */
export function calculateEdgeZIndex(edge: Edge, nodes: Node[]): number {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  // If nodes are missing, use default z-index
  if (!sourceNode || !targetNode) {
    return edge.zIndex || 0;
  }
  
  // Use the minimum z-index of the connected nodes
  const sourceZIndex = sourceNode.zIndex || 0;
  const targetZIndex = targetNode.zIndex || 0;
  const minZIndex = Math.min(sourceZIndex, targetZIndex);
  
  // Add selection boost if either node is selected
  const selectedBoost = (sourceNode.selected || targetNode.selected) ? 1000 : 0;
  
  return minZIndex + selectedBoost;
}

/**
 * Recalculate z-index for all edges based on current node states
 */
export function recalculateAllEdgeZIndexes(edges: Edge[], nodes: Node[]): Edge[] {
  return edges.map(edge => ({
    ...edge,
    zIndex: calculateEdgeZIndex(edge, nodes)
  }));
}

/**
 * Sort edges by z-index for proper rendering order (lower z-index renders first)
 */
export function sortEdgesByZIndex(edges: Edge[]): Edge[] {
  return [...edges].sort((a, b) => {
    const aZIndex = a.zIndex || 0;
    const bZIndex = b.zIndex || 0;
    return aZIndex - bZIndex;
  });
}