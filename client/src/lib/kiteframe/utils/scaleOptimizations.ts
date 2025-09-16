/**
 * Scale-Specific Optimizations
 * Web Workers, progressive loading, memory limits, and performance management
 */

import { Node, Edge } from '../types';

interface MemoryMetrics {
  used: number;
  limit: number;
  percentage: number;
  timestamp: number;
}

interface LoadingStrategy {
  chunkSize: number;
  priority: 'viewport' | 'recent' | 'all';
  maxConcurrent: number;
}

/**
 * Memory Management System
 */
export class MemoryManager {
  private static instance: MemoryManager | null = null;
  private memoryLimit = 512 * 1024 * 1024; // 512MB default limit
  private warningThreshold = 0.8; // Warn at 80% usage
  private criticalThreshold = 0.95; // Critical at 95%
  private callbacks: ((metrics: MemoryMetrics) => void)[] = [];
  private monitorInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.startMonitoring();
  }
  
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }
  
  private startMonitoring() {
    // Monitor memory usage every 5 seconds
    this.monitorInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 5000);
  }
  
  private async checkMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize;
      const limit = memory.jsHeapSizeLimit;
      const percentage = used / limit;
      
      const metrics: MemoryMetrics = {
        used,
        limit,
        percentage,
        timestamp: Date.now()
      };
      
      // Notify callbacks
      this.callbacks.forEach(cb => cb(metrics));
      
      // Handle thresholds
      if (percentage > this.criticalThreshold) {
        this.handleCriticalMemory();
      } else if (percentage > this.warningThreshold) {
        this.handleHighMemory();
      }
    }
  }
  
  private handleHighMemory() {
    console.warn('High memory usage detected. Consider reducing canvas elements.');
    // Trigger garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
  }
  
  private handleCriticalMemory() {
    console.error('Critical memory usage! Initiating emergency cleanup.');
    // Force cleanup of non-essential resources
    this.emergencyCleanup();
  }
  
  private emergencyCleanup() {
    // Clear caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Trigger custom cleanup event
    window.dispatchEvent(new CustomEvent('kiteframe:memory-critical'));
  }
  
  onMemoryUpdate(callback: (metrics: MemoryMetrics) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }
  
  cleanup() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
  
  getMemoryMetrics(): MemoryMetrics | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };
    }
    return null;
  }
}

/**
 * Progressive Loading Manager
 */
export class ProgressiveLoader {
  private loadQueue: (() => Promise<void>)[] = [];
  private loading = false;
  private concurrentLoads = 3;
  private activeLoads = 0;
  
  constructor(private strategy: LoadingStrategy = {
    chunkSize: 50,
    priority: 'viewport',
    maxConcurrent: 3
  }) {
    this.concurrentLoads = strategy.maxConcurrent;
  }
  
  /**
   * Load nodes progressively based on priority
   */
  async loadNodes(
    nodes: Node[],
    viewport: { x: number; y: number; width: number; height: number; zoom: number },
    onBatch: (batch: Node[]) => void
  ) {
    // Sort nodes by priority
    const sortedNodes = this.prioritizeNodes(nodes, viewport);
    
    // Split into chunks
    const chunks = this.chunkArray(sortedNodes, this.strategy.chunkSize);
    
    // Load chunks progressively
    for (const chunk of chunks) {
      await this.loadChunk(chunk, onBatch);
      
      // Small delay between chunks to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 16));
    }
  }
  
  private prioritizeNodes(
    nodes: Node[],
    viewport: { x: number; y: number; width: number; height: number; zoom: number }
  ): Node[] {
    if (this.strategy.priority === 'viewport') {
      // Prioritize nodes in viewport
      return nodes.sort((a, b) => {
        const aInView = this.isInViewport(a, viewport);
        const bInView = this.isInViewport(b, viewport);
        if (aInView && !bInView) return -1;
        if (!aInView && bInView) return 1;
        return 0;
      });
    } else if (this.strategy.priority === 'recent') {
      // Assume nodes have timestamps or use array order
      return nodes.slice().reverse();
    }
    return nodes;
  }
  
  private isInViewport(
    node: Node,
    viewport: { x: number; y: number; width: number; height: number; zoom: number }
  ): boolean {
    const nodeLeft = node.position.x * viewport.zoom + viewport.x;
    const nodeTop = node.position.y * viewport.zoom + viewport.y;
    const nodeRight = nodeLeft + (node.width || 200) * viewport.zoom;
    const nodeBottom = nodeTop + (node.height || 100) * viewport.zoom;
    
    return !(
      nodeRight < 0 ||
      nodeLeft > viewport.width ||
      nodeBottom < 0 ||
      nodeTop > viewport.height
    );
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  private async loadChunk<T>(chunk: T, callback: (chunk: T) => void) {
    return new Promise<void>((resolve) => {
      // Use requestIdleCallback for non-blocking loading
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          callback(chunk);
          resolve();
        });
      } else {
        // Fallback to setTimeout
        setTimeout(() => {
          callback(chunk);
          resolve();
        }, 0);
      }
    });
  }
}

/**
 * Web Worker Manager for Heavy Computations
 */
export class WorkerManager {
  private static instance: WorkerManager | null = null;
  private workers: Map<string, Worker> = new Map();
  private workerPool: Worker[] = [];
  private poolSize = navigator.hardwareConcurrency || 4;
  private taskQueue: Array<{ task: any; resolve: (value: any) => void; reject: (error: any) => void }> = [];
  
  private constructor() {
    this.initializeWorkerPool();
  }
  
  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }
  
  private initializeWorkerPool() {
    // Create worker pool for parallel processing
    for (let i = 0; i < this.poolSize; i++) {
      try {
        const workerCode = this.getWorkerCode();
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);
        
        worker.onmessage = this.handleWorkerMessage.bind(this);
        worker.onerror = this.handleWorkerError.bind(this);
        
        this.workerPool.push(worker);
      } catch (error) {
        console.warn('Failed to create worker:', error);
      }
    }
  }
  
  private getWorkerCode(): string {
    return `
      // Worker for heavy computations
      self.onmessage = function(e) {
        const { type, data, id } = e.data;
        
        try {
          let result;
          
          switch(type) {
            case 'calculate-layout':
              result = calculateLayout(data);
              break;
            case 'validate-connections':
              result = validateConnections(data);
              break;
            case 'optimize-paths':
              result = optimizePaths(data);
              break;
            case 'process-batch':
              result = processBatch(data);
              break;
            default:
              throw new Error('Unknown task type: ' + type);
          }
          
          self.postMessage({ id, result, success: true });
        } catch (error) {
          self.postMessage({ id, error: error.message, success: false });
        }
      };
      
      function calculateLayout(data) {
        // Complex layout calculations
        const { nodes, edges, algorithm } = data;
        // Simplified layout calculation
        return nodes.map((node, index) => ({
          ...node,
          position: {
            x: (index % 5) * 250,
            y: Math.floor(index / 5) * 150
          }
        }));
      }
      
      function validateConnections(data) {
        const { nodes, edges } = data;
        const nodeIds = new Set(nodes.map(n => n.id));
        return edges.filter(edge => 
          nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );
      }
      
      function optimizePaths(data) {
        // Path optimization logic
        return data;
      }
      
      function processBatch(data) {
        // Batch processing logic
        return data.map(item => ({
          ...item,
          processed: true,
          timestamp: Date.now()
        }));
      }
    `;
  }
  
  private handleWorkerMessage(event: MessageEvent) {
    const { id, result, success } = event.data;
    const task = this.taskQueue.find(t => t.task.id === id);
    
    if (task) {
      if (success) {
        task.resolve(result);
      } else {
        task.reject(new Error(event.data.error));
      }
      
      // Remove from queue
      this.taskQueue = this.taskQueue.filter(t => t.task.id !== id);
    }
  }
  
  private handleWorkerError(error: ErrorEvent) {
    console.error('Worker error:', error);
  }
  
  /**
   * Execute task in worker
   */
  async executeTask<T>(type: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      const task = { type, data, id };
      
      // Find available worker
      const worker = this.getAvailableWorker();
      
      if (worker) {
        this.taskQueue.push({ task, resolve, reject });
        worker.postMessage(task);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          const taskIndex = this.taskQueue.findIndex(t => t.task.id === id);
          if (taskIndex !== -1) {
            this.taskQueue[taskIndex].reject(new Error('Task timeout'));
            this.taskQueue.splice(taskIndex, 1);
          }
        }, 30000);
      } else {
        reject(new Error('No workers available'));
      }
    });
  }
  
  private getAvailableWorker(): Worker | null {
    // Simple round-robin selection
    return this.workerPool[Math.floor(Math.random() * this.workerPool.length)];
  }
  
  /**
   * Calculate layout in worker
   */
  async calculateLayout(nodes: Node[], edges: Edge[], algorithm = 'force'): Promise<Node[]> {
    return this.executeTask('calculate-layout', { nodes, edges, algorithm });
  }
  
  /**
   * Validate connections in worker
   */
  async validateConnections(nodes: Node[], edges: Edge[]): Promise<Edge[]> {
    return this.executeTask('validate-connections', { nodes, edges });
  }
  
  /**
   * Process batch operations in worker
   */
  async processBatch<T>(items: T[]): Promise<T[]> {
    return this.executeTask('process-batch', items);
  }
  
  cleanup() {
    this.workerPool.forEach(worker => worker.terminate());
    this.workerPool = [];
    this.workers.clear();
  }
}

// Export singleton instances
export const memoryManager = MemoryManager.getInstance();
export const workerManager = WorkerManager.getInstance();

// React hooks
export function useMemoryMonitor() {
  const [metrics, setMetrics] = React.useState<MemoryMetrics | null>(null);
  
  React.useEffect(() => {
    const unsubscribe = memoryManager.onMemoryUpdate(setMetrics);
    
    // Get initial metrics
    const initial = memoryManager.getMemoryMetrics();
    if (initial) {
      setMetrics(initial);
    }
    
    return unsubscribe;
  }, []);
  
  return metrics;
}

export function useProgressiveLoader(strategy?: LoadingStrategy) {
  const loader = React.useRef(new ProgressiveLoader(strategy));
  
  return {
    loadNodes: loader.current.loadNodes.bind(loader.current)
  };
}

export function useWorkerManager() {
  return {
    calculateLayout: workerManager.calculateLayout.bind(workerManager),
    validateConnections: workerManager.validateConnections.bind(workerManager),
    processBatch: workerManager.processBatch.bind(workerManager)
  };
}

import React from 'react';