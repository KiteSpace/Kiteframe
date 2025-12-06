import type { Node, Edge, CanvasObject, Position } from '../types';

/**
 * Unified Clipboard Manager for KiteFrame
 * Handles copy-paste operations for nodes, canvas objects, and mixed selections
 * Supports multi-selection, smart positioning, and proper ID generation
 */

export interface ClipboardItem {
  type: 'node' | 'canvas-object';
  data: Node | CanvasObject;
  originalPosition: Position;
}

export interface ClipboardData {
  items: ClipboardItem[];
  timestamp: number;
  selectionBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export interface ClipboardOptions {
  offsetDistance?: number;
  preserveRelativePositions?: boolean;
  generateNewIds?: boolean;
}

export class ClipboardManager {
  private static instance: ClipboardManager | null = null;
  private clipboard: ClipboardData | null = null;
  private readonly STORAGE_KEY = 'kiteframe-unified-clipboard';
  private readonly DEFAULT_OFFSET = 50;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }

  /**
   * Copy selected items to clipboard
   */
  public copy(
    selectedNodes: Node[] = [],
    selectedCanvasObjects: CanvasObject[] = []
  ): boolean {
    const items: ClipboardItem[] = [];

    // Add nodes to clipboard
    selectedNodes.forEach(node => {
      items.push({
        type: 'node',
        data: { ...node },
        originalPosition: { ...node.position }
      });
    });

    // Add canvas objects to clipboard
    selectedCanvasObjects.forEach(obj => {
      items.push({
        type: 'canvas-object',
        data: { ...obj },
        originalPosition: { ...obj.position }
      });
    });

    if (items.length === 0) {
      return false;
    }

    // Calculate selection bounds for smart positioning
    const selectionBounds = this.calculateSelectionBounds(items);

    const clipboardData: ClipboardData = {
      items,
      timestamp: Date.now(),
      selectionBounds
    };

    // Store in memory and localStorage for persistence
    this.clipboard = clipboardData;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clipboardData));
    } catch (error) {
      console.warn('Failed to save clipboard to localStorage:', error);
    }

    return true;
  }

  /**
   * Paste items from clipboard
   */
  public paste(
    currentNodes: Node[] = [],
    currentCanvasObjects: CanvasObject[] = [],
    targetPosition?: Position,
    options: ClipboardOptions = {}
  ): {
    nodes: Node[];
    canvasObjects: CanvasObject[];
    newNodeIds: string[];
    newCanvasObjectIds: string[];
  } {
    const clipboardData = this.getClipboardData();
    if (!clipboardData || clipboardData.items.length === 0) {
      return {
        nodes: [],
        canvasObjects: [],
        newNodeIds: [],
        newCanvasObjectIds: []
      };
    }

    const {
      offsetDistance = this.DEFAULT_OFFSET,
      preserveRelativePositions = true,
      generateNewIds = true
    } = options;

    const newNodes: Node[] = [];
    const newCanvasObjects: CanvasObject[] = [];
    const newNodeIds: string[] = [];
    const newCanvasObjectIds: string[] = [];

    // Calculate paste position
    const pastePosition = this.calculatePastePosition(
      clipboardData,
      targetPosition,
      currentNodes,
      currentCanvasObjects,
      offsetDistance
    );

    // Process each clipboard item
    clipboardData.items.forEach(item => {
      if (item.type === 'node') {
        const originalNode = item.data as Node;
        const newNode = this.cloneNode(
          originalNode,
          item.originalPosition,
          pastePosition,
          clipboardData.selectionBounds,
          preserveRelativePositions,
          generateNewIds
        );
        
        newNodes.push(newNode);
        newNodeIds.push(newNode.id);
      } else if (item.type === 'canvas-object') {
        const originalObject = item.data as CanvasObject;
        const newObject = this.cloneCanvasObject(
          originalObject,
          item.originalPosition,
          pastePosition,
          clipboardData.selectionBounds,
          preserveRelativePositions,
          generateNewIds
        );
        
        newCanvasObjects.push(newObject);
        newCanvasObjectIds.push(newObject.id);
      }
    });

    return {
      nodes: newNodes,
      canvasObjects: newCanvasObjects,
      newNodeIds,
      newCanvasObjectIds
    };
  }

  /**
   * Check if clipboard has data
   */
  public hasData(): boolean {
    const data = this.getClipboardData();
    return data !== null && data.items.length > 0;
  }

  /**
   * Get clipboard data summary
   */
  public getClipboardSummary(): {
    nodeCount: number;
    canvasObjectCount: number;
    totalCount: number;
    timestamp: number | null;
  } {
    const data = this.getClipboardData();
    if (!data) {
      return { nodeCount: 0, canvasObjectCount: 0, totalCount: 0, timestamp: null };
    }

    const nodeCount = data.items.filter(item => item.type === 'node').length;
    const canvasObjectCount = data.items.filter(item => item.type === 'canvas-object').length;

    return {
      nodeCount,
      canvasObjectCount,
      totalCount: data.items.length,
      timestamp: data.timestamp
    };
  }

  /**
   * Clear clipboard
   */
  public clear(): void {
    this.clipboard = null;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear clipboard from localStorage:', error);
    }
  }

  // Private helper methods

  private getClipboardData(): ClipboardData | null {
    // Try memory first, then localStorage
    if (this.clipboard) {
      return this.clipboard;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as ClipboardData;
        this.clipboard = data;
        return data;
      }
    } catch (error) {
      console.warn('Failed to load clipboard from localStorage:', error);
    }

    return null;
  }

  private calculateSelectionBounds(items: ClipboardItem[]) {
    if (items.length === 0) return undefined;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    items.forEach(item => {
      const pos = item.originalPosition;
      const width = item.data.width || 200;
      const height = item.data.height || 100;

      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + width);
      maxY = Math.max(maxY, pos.y + height);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private calculatePastePosition(
    clipboardData: ClipboardData,
    targetPosition: Position | undefined,
    currentNodes: Node[],
    currentCanvasObjects: CanvasObject[],
    offsetDistance: number
  ): Position {
    if (targetPosition) {
      return targetPosition;
    }

    // Use selection bounds to calculate offset
    const bounds = clipboardData.selectionBounds;
    if (!bounds) {
      return { x: offsetDistance, y: offsetDistance };
    }

    // Calculate offset based on existing items to avoid overlaps
    const allItems = [
      ...currentNodes.map(n => ({ x: n.position.x, y: n.position.y, width: n.width || 200, height: n.height || 100 })),
      ...currentCanvasObjects.map(o => ({ x: o.position.x, y: o.position.y, width: o.width || 200, height: o.height || 100 }))
    ];

    let offsetX = offsetDistance;
    let offsetY = offsetDistance;

    // Find a position that doesn't overlap
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const testX = bounds.minX + offsetX;
      const testY = bounds.minY + offsetY;
      
      const overlaps = allItems.some(item => 
        testX < item.x + item.width &&
        testX + bounds.width > item.x &&
        testY < item.y + item.height &&
        testY + bounds.height > item.y
      );

      if (!overlaps) {
        return { x: offsetX, y: offsetY };
      }

      offsetX += offsetDistance;
      offsetY += offsetDistance;
    }

    return { x: offsetX, y: offsetY };
  }

  private cloneNode(
    originalNode: Node,
    originalPosition: Position,
    pastePosition: Position,
    selectionBounds: ClipboardData['selectionBounds'],
    preserveRelativePositions: boolean,
    generateNewIds: boolean
  ): Node {
    const newNode: Node = {
      ...originalNode,
      id: generateNewIds ? this.generateNodeId() : originalNode.id,
      selected: false
    };

    if (preserveRelativePositions && selectionBounds) {
      // Maintain relative position within the selection
      const relativeX = originalPosition.x - selectionBounds.minX;
      const relativeY = originalPosition.y - selectionBounds.minY;
      newNode.position = {
        x: pastePosition.x + relativeX,
        y: pastePosition.y + relativeY
      };
    } else {
      newNode.position = {
        x: pastePosition.x,
        y: pastePosition.y
      };
    }

    return newNode;
  }

  private cloneCanvasObject(
    originalObject: CanvasObject,
    originalPosition: Position,
    pastePosition: Position,
    selectionBounds: ClipboardData['selectionBounds'],
    preserveRelativePositions: boolean,
    generateNewIds: boolean
  ): CanvasObject {
    const newObject: CanvasObject = {
      ...originalObject,
      id: generateNewIds ? this.generateCanvasObjectId() : originalObject.id,
      selected: false
    };

    if (preserveRelativePositions && selectionBounds) {
      // Maintain relative position within the selection
      const relativeX = originalPosition.x - selectionBounds.minX;
      const relativeY = originalPosition.y - selectionBounds.minY;
      newObject.position = {
        x: pastePosition.x + relativeX,
        y: pastePosition.y + relativeY
      };
    } else {
      newObject.position = {
        x: pastePosition.x,
        y: pastePosition.y
      };
    }

    return newObject;
  }

  private generateNodeId(): string {
    return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCanvasObjectId(): string {
    return `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const clipboardManager = ClipboardManager.getInstance();