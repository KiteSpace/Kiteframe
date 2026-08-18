import type { Node } from '../types';

export interface SnapGuide {
  id: string;
  type: 'horizontal' | 'vertical';
  position: number;
  nodes: string[]; // Node IDs that contribute to this guide
  strength: number; // How many nodes align to this guide
}

export interface SnapResult {
  position: { x: number; y: number };
  guides: SnapGuide[];
  snapped: boolean;
}

export interface SnapSettings {
  enabled: boolean;
  threshold: number; // Distance threshold for snapping (in canvas units)
  showGuides: boolean;
  snapToNodes: boolean;
  snapToGrid: boolean;
  gridSize: number;
  snapToCanvas: boolean; // Snap to canvas edges
}

export const defaultSnapSettings: SnapSettings = {
  enabled: false,
  threshold: 10,
  showGuides: true,
  snapToNodes: true,
  snapToGrid: false,
  gridSize: 20,
  snapToCanvas: true
};

// Spatial index for performance optimization
export class SpatialIndex {
  private nodeMap = new Map<string, Node>();
  private gridSize = 100;
  private grid = new Map<string, Set<string>>();

  constructor(nodes: Node[], gridSize = 100) {
    this.gridSize = gridSize;
    this.rebuild(nodes);
  }

  rebuild(nodes: Node[]) {
    this.nodeMap.clear();
    this.grid.clear();
    
    nodes.forEach(node => {
      this.nodeMap.set(node.id, node);
      const cells = this.getNodeCells(node);
      cells.forEach(cell => {
        if (!this.grid.has(cell)) {
          this.grid.set(cell, new Set());
        }
        this.grid.get(cell)!.add(node.id);
      });
    });
  }

  private getNodeCells(node: Node): string[] {
    const width = node.width || 200;
    const height = node.height || 100;
    const cells: string[] = [];
    
    const minX = Math.floor(node.position.x / this.gridSize);
    const maxX = Math.floor((node.position.x + width) / this.gridSize);
    const minY = Math.floor(node.position.y / this.gridSize);
    const maxY = Math.floor((node.position.y + height) / this.gridSize);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        cells.push(`${x},${y}`);
      }
    }
    
    return cells;
  }

  getNearbyNodes(x: number, y: number, radius: number): Node[] {
    const cells = new Set<string>();
    const gridRadius = Math.ceil(radius / this.gridSize);
    const centerX = Math.floor(x / this.gridSize);
    const centerY = Math.floor(y / this.gridSize);
    
    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      for (let dy = -gridRadius; dy <= gridRadius; dy++) {
        cells.add(`${centerX + dx},${centerY + dy}`);
      }
    }
    
    const nearbyNodeIds = new Set<string>();
    cells.forEach(cell => {
      const nodeIds = this.grid.get(cell);
      if (nodeIds) {
        nodeIds.forEach(id => nearbyNodeIds.add(id));
      }
    });
    
    return Array.from(nearbyNodeIds)
      .map(id => this.nodeMap.get(id))
      .filter((node): node is Node => node !== undefined);
  }
}

// Cache for expensive calculations
const snapCache = new Map<string, SnapResult>();
let lastCacheKey = '';

export function calculateSnapPosition(
  draggedNode: Node,
  targetPosition: { x: number; y: number },
  allNodes: Node[],
  canvasSize: { width: number; height: number },
  settings: SnapSettings,
  spatialIndex?: SpatialIndex
): SnapResult {
  if (!settings.enabled) {
    return {
      position: targetPosition,
      guides: [],
      snapped: false
    };
  }

  // Create cache key for memoization
  const cacheKey = `${draggedNode.id}-${targetPosition.x}-${targetPosition.y}-${JSON.stringify(settings)}`;
  if (cacheKey === lastCacheKey && snapCache.has(cacheKey)) {
    return snapCache.get(cacheKey)!;
  }

  const draggedWidth = draggedNode.width || 200;
  const draggedHeight = draggedNode.height || 100;
  
  // Calculate key points for the dragged node
  const draggedPoints = {
    left: targetPosition.x,
    right: targetPosition.x + draggedWidth,
    centerX: targetPosition.x + draggedWidth / 2,
    top: targetPosition.y,
    bottom: targetPosition.y + draggedHeight,
    centerY: targetPosition.y + draggedHeight / 2
  };

  let snappedPosition = { ...targetPosition };
  const activeGuides: SnapGuide[] = [];
  let hasSnapped = false;

  // Use spatial index for performance, or fall back to all nodes
  const nearbyNodes = spatialIndex ? 
    spatialIndex.getNearbyNodes(targetPosition.x, targetPosition.y, settings.threshold * 3) :
    allNodes.filter(node => node.id !== draggedNode.id);

  // Collect snap targets from nearby nodes
  const snapTargets: { horizontal: number[]; vertical: number[] } = {
    horizontal: [],
    vertical: []
  };

  if (settings.snapToNodes) {
    nearbyNodes.forEach(node => {
      if (node.id === draggedNode.id) return; // Skip self
      
      const nodeWidth = node.width || 200;
      const nodeHeight = node.height || 100;
      
      // Add horizontal snap lines (Y positions)
      snapTargets.horizontal.push(
        node.position.y, // Top edge
        node.position.y + nodeHeight, // Bottom edge
        node.position.y + nodeHeight / 2 // Center
      );
      
      // Add vertical snap lines (X positions)
      snapTargets.vertical.push(
        node.position.x, // Left edge
        node.position.x + nodeWidth, // Right edge
        node.position.x + nodeWidth / 2 // Center
      );
    });
  }

  // Add grid snap targets (optimized - calculate only needed grid lines)
  if (settings.snapToGrid && settings.gridSize > 0) {
    const gridSize = settings.gridSize;
    const margin = settings.threshold;
    
    // Calculate grid lines in range
    const minX = Math.floor((targetPosition.x - margin) / gridSize) * gridSize;
    const maxX = Math.ceil((targetPosition.x + draggedWidth + margin) / gridSize) * gridSize;
    const minY = Math.floor((targetPosition.y - margin) / gridSize) * gridSize;
    const maxY = Math.ceil((targetPosition.y + draggedHeight + margin) / gridSize) * gridSize;
    
    for (let x = minX; x <= maxX; x += gridSize) {
      snapTargets.vertical.push(x);
    }
    for (let y = minY; y <= maxY; y += gridSize) {
      snapTargets.horizontal.push(y);
    }
  }

  // Add canvas boundary snap targets
  if (settings.snapToCanvas) {
    snapTargets.horizontal.push(0, canvasSize.height);
    snapTargets.vertical.push(0, canvasSize.width);
  }

  // Check horizontal snapping (Y positions) - prioritize by distance
  const horizontalChecks = [
    { point: draggedPoints.top, name: 'top' as const },
    { point: draggedPoints.bottom, name: 'bottom' as const },
    { point: draggedPoints.centerY, name: 'centerY' as const }
  ];

  let bestHorizontalSnap: { distance: number; snapY: number; newY: number; } | null = null;

  for (const check of horizontalChecks) {
    for (const snapY of snapTargets.horizontal) {
      const distance = Math.abs(check.point - snapY);
      if (distance <= settings.threshold) {
        let newY: number;
        if (check.name === 'top') {
          newY = snapY;
        } else if (check.name === 'bottom') {
          newY = snapY - draggedHeight;
        } else { // centerY
          newY = snapY - draggedHeight / 2;
        }
        
        if (!bestHorizontalSnap || distance < bestHorizontalSnap.distance) {
          bestHorizontalSnap = { distance, snapY, newY };
        }
      }
    }
  }

  if (bestHorizontalSnap) {
    snappedPosition.y = bestHorizontalSnap.newY;
    hasSnapped = true;
    activeGuides.push({
      id: `h-${bestHorizontalSnap.snapY}`,
      type: 'horizontal',
      position: bestHorizontalSnap.snapY,
      nodes: [draggedNode.id],
      strength: 1
    });
  }

  // Check vertical snapping (X positions) - prioritize by distance
  const verticalChecks = [
    { point: draggedPoints.left, name: 'left' as const },
    { point: draggedPoints.right, name: 'right' as const },
    { point: draggedPoints.centerX, name: 'centerX' as const }
  ];

  let bestVerticalSnap: { distance: number; snapX: number; newX: number; } | null = null;

  for (const check of verticalChecks) {
    for (const snapX of snapTargets.vertical) {
      const distance = Math.abs(check.point - snapX);
      if (distance <= settings.threshold) {
        let newX: number;
        if (check.name === 'left') {
          newX = snapX;
        } else if (check.name === 'right') {
          newX = snapX - draggedWidth;
        } else { // centerX
          newX = snapX - draggedWidth / 2;
        }
        
        if (!bestVerticalSnap || distance < bestVerticalSnap.distance) {
          bestVerticalSnap = { distance, snapX, newX };
        }
      }
    }
  }

  if (bestVerticalSnap) {
    snappedPosition.x = bestVerticalSnap.newX;
    hasSnapped = true;
    activeGuides.push({
      id: `v-${bestVerticalSnap.snapX}`,
      type: 'vertical',
      position: bestVerticalSnap.snapX,
      nodes: [draggedNode.id],
      strength: 1
    });
  }

  const result = {
    position: snappedPosition,
    guides: activeGuides,
    snapped: hasSnapped
  };

  // Cache result for performance
  snapCache.set(cacheKey, result);
  lastCacheKey = cacheKey;
  
  // Limit cache size
  if (snapCache.size > 100) {
    const firstKey = Array.from(snapCache.keys())[0];
    if (firstKey) {
      snapCache.delete(firstKey);
    }
  }

  return result;
}

// Optimized alignment guide calculation
export function findAlignmentGuides(
  nodes: Node[],
  canvasSize: { width: number; height: number },
  tolerance = 2
): SnapGuide[] {
  const guides: SnapGuide[] = [];
  
  // Group nodes by their alignment positions
  const horizontalGroups: Map<number, string[]> = new Map();
  const verticalGroups: Map<number, string[]> = new Map();
  
  nodes.forEach(node => {
    const nodeWidth = node.width || 200;
    const nodeHeight = node.height || 100;
    
    // Check horizontal alignments (Y positions)
    const yPositions = [
      { pos: node.position.y, type: 'top' },
      { pos: node.position.y + nodeHeight, type: 'bottom' },
      { pos: node.position.y + nodeHeight / 2, type: 'center' }
    ];
    
    yPositions.forEach(({ pos }) => {
      let foundGroup = false;
      for (const [groupY, nodeIds] of Array.from(horizontalGroups.entries())) {
        if (Math.abs(pos - groupY) <= tolerance) {
          nodeIds.push(node.id);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        horizontalGroups.set(pos, [node.id]);
      }
    });
    
    // Check vertical alignments (X positions)
    const xPositions = [
      { pos: node.position.x, type: 'left' },
      { pos: node.position.x + nodeWidth, type: 'right' },
      { pos: node.position.x + nodeWidth / 2, type: 'center' }
    ];
    
    xPositions.forEach(({ pos }) => {
      let foundGroup = false;
      for (const [groupX, nodeIds] of Array.from(verticalGroups.entries())) {
        if (Math.abs(pos - groupX) <= tolerance) {
          nodeIds.push(node.id);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        verticalGroups.set(pos, [node.id]);
      }
    });
  });
  
  // Create guides for groups with multiple nodes
  Array.from(horizontalGroups.entries()).forEach(([y, nodeIds]) => {
    if (nodeIds.length >= 2) {
      guides.push({
        id: `align-h-${y}`,
        type: 'horizontal',
        position: y,
        nodes: Array.from(new Set(nodeIds)), // Remove duplicates
        strength: nodeIds.length
      });
    }
  });
  
  Array.from(verticalGroups.entries()).forEach(([x, nodeIds]) => {
    if (nodeIds.length >= 2) {
      guides.push({
        id: `align-v-${x}`,
        type: 'vertical',
        position: x,
        nodes: Array.from(new Set(nodeIds)), // Remove duplicates
        strength: nodeIds.length
      });
    }
  });
  
  // Limit guides to prevent UI overload
  return guides.slice(0, 20);
}

// SpatialIndex is exported above