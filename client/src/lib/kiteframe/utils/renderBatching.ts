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
 * Virtualization helper for large node lists
 * Only renders nodes within the viewport
 */
export class VirtualizationManager {
  private viewport = { x: 0, y: 0, width: 0, height: 0 };
  private buffer = 100; // Extra pixels to render outside viewport
  
  /**
   * Update viewport dimensions
   */
  setViewport(x: number, y: number, width: number, height: number): void {
    this.viewport = { x, y, width, height };
  }
  
  /**
   * Set the buffer size for off-screen rendering
   */
  setBuffer(buffer: number): void {
    this.buffer = Math.max(0, buffer);
  }
  
  /**
   * Check if a node is within the renderable area
   */
  isNodeVisible(node: Node, zoom = 1): boolean {
    const nodeLeft = node.position.x * zoom;
    const nodeTop = node.position.y * zoom;
    const nodeRight = nodeLeft + (node.width || 200) * zoom;
    const nodeBottom = nodeTop + (node.height || 100) * zoom;
    
    const viewLeft = this.viewport.x - this.buffer;
    const viewTop = this.viewport.y - this.buffer;
    const viewRight = this.viewport.x + this.viewport.width + this.buffer;
    const viewBottom = this.viewport.y + this.viewport.height + this.buffer;
    
    return !(
      nodeRight < viewLeft ||
      nodeLeft > viewRight ||
      nodeBottom < viewTop ||
      nodeTop > viewBottom
    );
  }
  
  /**
   * Filter nodes to only those visible in viewport
   */
  filterVisibleNodes(nodes: Node[], zoom = 1): Node[] {
    return nodes.filter(node => this.isNodeVisible(node, zoom));
  }
  
  /**
   * Check if an edge is within the renderable area
   */
  isEdgeVisible(edge: Edge, nodes: Map<string, Node>, zoom = 1): boolean {
    const sourceNode = nodes.get(edge.source);
    const targetNode = nodes.get(edge.target);
    
    if (!sourceNode || !targetNode) return false;
    
    // Check if either connected node is visible
    return this.isNodeVisible(sourceNode, zoom) || this.isNodeVisible(targetNode, zoom);
  }
  
  /**
   * Filter edges to only those visible in viewport
   */
  filterVisibleEdges(edges: Edge[], nodes: Map<string, Node>, zoom = 1): Edge[] {
    return edges.filter(edge => this.isEdgeVisible(edge, nodes, zoom));
  }
}

// Import React for hooks
import React from 'react';