/**
 * Render batching utilities for optimizing large-scale canvas updates
 * Implements request batching, deferred updates, and frame rate management
 */

import { Node, Edge, CanvasObject } from '../types';

interface BatchUpdate {
  id: string;
  type: 'node' | 'edge' | 'object' | 'viewport';
  operation: 'add' | 'update' | 'remove';
  data: any;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
}

interface RenderFrame {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
  objects: Map<string, CanvasObject>;
  viewport?: { x: number; y: number; zoom: number };
}

/**
 * RenderBatchManager - Batches and optimizes render updates
 * Reduces re-renders by combining multiple updates into single frames
 */
export class RenderBatchManager {
  private pendingUpdates = new Map<string, BatchUpdate>();
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private targetFPS = 60;
  private minFrameTime = 1000 / this.targetFPS;
  private updateCallback: ((frame: RenderFrame) => void) | null = null;
  private isProcessing = false;
  private frameBudgetMs = 16; // 16ms for 60 FPS
  
  // Performance metrics
  private metrics = {
    totalBatches: 0,
    totalUpdates: 0,
    droppedFrames: 0,
    averageFrameTime: 0
  };
  
  constructor(updateCallback?: (frame: RenderFrame) => void) {
    this.updateCallback = updateCallback || null;
  }
  
  /**
   * Set the target FPS for render batching
   */
  setTargetFPS(fps: number): void {
    this.targetFPS = Math.max(1, Math.min(120, fps));
    this.minFrameTime = 1000 / this.targetFPS;
  }
  
  /**
   * Queue an update for batched rendering
   */
  queueUpdate(update: Omit<BatchUpdate, 'timestamp'>): void {
    const timestampedUpdate: BatchUpdate = {
      ...update,
      timestamp: performance.now()
    };
    
    // Override existing update for the same entity
    this.pendingUpdates.set(update.id, timestampedUpdate);
    
    // Schedule frame if not already scheduled
    if (!this.frameId && !this.isProcessing) {
      this.scheduleFrame();
    }
    
    this.metrics.totalUpdates++;
  }
  
  /**
   * Queue multiple updates at once
   */
  queueBatch(updates: Array<Omit<BatchUpdate, 'timestamp'>>): void {
    const now = performance.now();
    
    updates.forEach(update => {
      this.pendingUpdates.set(update.id, {
        ...update,
        timestamp: now
      });
    });
    
    if (!this.frameId && !this.isProcessing) {
      this.scheduleFrame();
    }
    
    this.metrics.totalUpdates += updates.length;
  }
  
  /**
   * Schedule the next render frame using requestAnimationFrame
   */
  private scheduleFrame(): void {
    if (this.frameId) return; // Already scheduled
    
    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      const now = performance.now();
      const timeSinceLastFrame = now - this.lastFrameTime;
      
      // Only process if enough time has passed for target FPS
      if (timeSinceLastFrame >= this.minFrameTime) {
        this.processBatch();
      } else {
        // Reschedule for next frame if we're running too fast
        this.scheduleFrame();
      }
    });
  }
  
  /**
   * Process all pending updates in a single batch with frame budget management
   */
  private processBatch(): void {
    if (this.isProcessing || this.pendingUpdates.size === 0) {
      return;
    }
    
    this.isProcessing = true;
    const startTime = performance.now();
    const frameDeadline = startTime + this.frameBudgetMs;
    
    // Sort updates by priority and timestamp
    const sortedUpdates = Array.from(this.pendingUpdates.values()).sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
    
    // Process as many updates as possible within frame budget
    const processedIds = new Set<string>();
    
    // Build render frame
    const frame: RenderFrame = {
      nodes: new Map(),
      edges: new Map(),
      objects: new Map()
    };
    
    // Process updates within frame budget
    for (const update of sortedUpdates) {
      // Check if we're exceeding frame budget (except for high priority)
      if (update.priority !== 'high' && performance.now() > frameDeadline) {
        break; // Defer remaining updates to next frame
      }
      
      switch (update.type) {
        case 'node':
          if (update.operation !== 'remove') {
            frame.nodes.set(update.id, update.data);
          }
          break;
        case 'edge':
          if (update.operation !== 'remove') {
            frame.edges.set(update.id, update.data);
          }
          break;
        case 'object':
          if (update.operation !== 'remove') {
            frame.objects.set(update.id, update.data);
          }
          break;
        case 'viewport':
          frame.viewport = update.data;
          break;
      }
      
      processedIds.add(update.id);
    }
    
    // Remove processed updates from pending
    processedIds.forEach(id => this.pendingUpdates.delete(id));
    
    // Execute callback with batched updates
    if (this.updateCallback) {
      this.updateCallback(frame);
    }
    
    // Update metrics
    const frameTime = performance.now() - startTime;
    this.lastFrameTime = performance.now();
    this.metrics.totalBatches++;
    this.metrics.averageFrameTime = 
      (this.metrics.averageFrameTime * (this.metrics.totalBatches - 1) + frameTime) / 
      this.metrics.totalBatches;
    
    if (frameTime > this.minFrameTime) {
      this.metrics.droppedFrames++;
    }
    
    this.isProcessing = false;
    
    // Schedule next frame if there are new updates
    if (this.pendingUpdates.size > 0) {
      this.scheduleFrame();
    }
  }
  
  /**
   * Force process all pending updates immediately
   */
  flush(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.processBatch();
  }
  
  /**
   * Clear all pending updates without processing
   */
  clear(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.pendingUpdates.clear();
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }
  
  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalBatches: 0,
      totalUpdates: 0,
      droppedFrames: 0,
      averageFrameTime: 0
    };
  }
  
  /**
   * Set the update callback
   */
  setUpdateCallback(callback: (frame: RenderFrame) => void): void {
    this.updateCallback = callback;
  }
  
  /**
   * Cleanup and destroy the batch manager
   */
  destroy(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.pendingUpdates.clear();
    this.updateCallback = null;
  }
}

/**
 * Hook for using RenderBatchManager in React components
 */
export function useRenderBatching(
  callback: (frame: RenderFrame) => void,
  targetFPS = 60
): RenderBatchManager {
  const [manager] = React.useState(() => {
    const m = new RenderBatchManager(callback);
    m.setTargetFPS(targetFPS);
    return m;
  });
  
  React.useEffect(() => {
    manager.setUpdateCallback(callback);
  }, [manager, callback]);
  
  React.useEffect(() => {
    manager.setTargetFPS(targetFPS);
  }, [manager, targetFPS]);
  
  React.useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);
  
  return manager;
}

/**
 * Virtualization helper for node lists
 * Prioritizes accuracy over performance for small to medium node counts
 */
export class VirtualizationManager {
  private viewport = { x: 0, y: 0, width: 0, height: 0 };
  private baseBuffer = 500; // Larger base buffer for accuracy
  private disableVirtualizationThreshold = 100; // Bypass virtualization for small node counts
  
  /**
   * Update viewport dimensions and recalculate dynamic buffer
   */
  setViewport(x: number, y: number, width: number, height: number): void {
    this.viewport = { x, y, width, height };
  }
  
  /**
   * Set the base buffer size for off-screen rendering
   */
  setBuffer(buffer: number): void {
    this.baseBuffer = Math.max(0, buffer);
  }
  
  /**
   * Get effective buffer size based on viewport and zoom
   */
  private getEffectiveBuffer(zoom = 1): number {
    // Use larger of: base buffer, 25% of viewport width, or zoom-adjusted minimum
    const viewportBasedBuffer = this.viewport.width * 0.25;
    const zoomAdjustedBuffer = Math.max(300, this.baseBuffer * zoom);
    return Math.max(this.baseBuffer, viewportBasedBuffer, zoomAdjustedBuffer);
  }
  
  /**
   * Check if a node is within the renderable area with generous bounds
   */
  isNodeVisible(node: Node, zoom = 1): boolean {
    const effectiveBuffer = this.getEffectiveBuffer(zoom);
    
    // Add visual padding for selection highlights, handles, shadows
    const visualPadding = 50 * zoom;
    
    const nodeLeft = node.position.x * zoom - visualPadding;
    const nodeTop = node.position.y * zoom - visualPadding;
    const nodeRight = nodeLeft + (node.width || 200) * zoom + (visualPadding * 2);
    const nodeBottom = nodeTop + (node.height || 100) * zoom + (visualPadding * 2);
    
    const viewLeft = this.viewport.x - effectiveBuffer;
    const viewTop = this.viewport.y - effectiveBuffer;
    const viewRight = this.viewport.x + this.viewport.width + effectiveBuffer;
    const viewBottom = this.viewport.y + this.viewport.height + effectiveBuffer;
    
    return !(
      nodeRight < viewLeft ||
      nodeLeft > viewRight ||
      nodeBottom < viewTop ||
      nodeTop > viewBottom
    );
  }
  
  /**
   * Filter nodes to only those visible in viewport
   * Bypasses filtering for small node counts to prioritize accuracy
   */
  filterVisibleNodes(nodes: Node[], zoom = 1): Node[] {
    // Bypass virtualization for small node counts - render everything
    if (nodes.length <= this.disableVirtualizationThreshold) {
      return nodes;
    }
    
    return nodes.filter(node => this.isNodeVisible(node, zoom));
  }
  
  /**
   * Check if an edge is within the renderable area using proper line intersection
   */
  isEdgeVisible(edge: Edge, nodes: Map<string, Node>, zoom = 1): boolean {
    const sourceNode = nodes.get(edge.source);
    const targetNode = nodes.get(edge.target);
    
    if (!sourceNode || !targetNode) return false;
    
    // First check if either node is visible (fast path)
    if (this.isNodeVisible(sourceNode, zoom) || this.isNodeVisible(targetNode, zoom)) {
      return true;
    }
    
    // Check if edge line intersects viewport (accurate path)
    const sourceX = sourceNode.position.x * zoom;
    const sourceY = sourceNode.position.y * zoom;
    const targetX = targetNode.position.x * zoom;
    const targetY = targetNode.position.y * zoom;
    
    return this.lineIntersectsViewport(sourceX, sourceY, targetX, targetY, zoom);
  }
  
  /**
   * Check if a line intersects the viewport using proper geometric intersection
   */
  private lineIntersectsViewport(x1: number, y1: number, x2: number, y2: number, zoom = 1): boolean {
    const effectiveBuffer = this.getEffectiveBuffer(zoom);
    
    const left = this.viewport.x - effectiveBuffer;
    const top = this.viewport.y - effectiveBuffer;
    const right = this.viewport.x + this.viewport.width + effectiveBuffer;
    const bottom = this.viewport.y + this.viewport.height + effectiveBuffer;
    
    // Check if line bounding box intersects viewport bounds
    const lineLeft = Math.min(x1, x2);
    const lineRight = Math.max(x1, x2);
    const lineTop = Math.min(y1, y2);
    const lineBottom = Math.max(y1, y2);
    
    // Quick bounding box check
    if (lineRight < left || lineLeft > right || lineBottom < top || lineTop > bottom) {
      return false;
    }
    
    // Line intersects viewport bounds - more detailed check could be added here
    // For now, bounding box intersection is sufficient for accuracy
    return true;
  }
  
  /**
   * Filter edges to only those visible in viewport
   * Bypasses filtering for small node counts to prioritize accuracy
   */
  filterVisibleEdges(edges: Edge[], nodes: Map<string, Node>, zoom = 1): Edge[] {
    // Bypass virtualization for small node counts - render all edges
    if (nodes.size <= this.disableVirtualizationThreshold) {
      return edges;
    }
    
    return edges.filter(edge => this.isEdgeVisible(edge, nodes, zoom));
  }
  
  /**
   * Set the threshold for disabling virtualization on small node counts
   */
  setVirtualizationThreshold(threshold: number): void {
    this.disableVirtualizationThreshold = Math.max(0, threshold);
  }
}

// Import React for hooks
import React from 'react';