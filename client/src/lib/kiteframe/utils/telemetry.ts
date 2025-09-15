/**
 * Telemetry and monitoring utilities for enterprise observability
 * Provides hooks for tracking performance, errors, and usage patterns
 */

import React from 'react';

// Telemetry event types
export enum TelemetryEventType {
  // Performance events
  RENDER_TIME = 'render_time',
  BATCH_PROCESS = 'batch_process',
  VIEWPORT_UPDATE = 'viewport_update',
  NODE_OPERATION = 'node_operation',
  EDGE_OPERATION = 'edge_operation',
  
  // User interaction events
  USER_ACTION = 'user_action',
  CANVAS_INTERACTION = 'canvas_interaction',
  PLUGIN_ACTION = 'plugin_action',
  
  // Error events
  ERROR = 'error',
  WARNING = 'warning',
  VALIDATION_ERROR = 'validation_error',
  
  // System events
  INITIALIZATION = 'initialization',
  CLEANUP = 'cleanup',
  MEMORY_USAGE = 'memory_usage',
  PERFORMANCE_METRIC = 'performance_metric'
}

// Telemetry event data
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
  error?: Error;
  duration?: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

// Telemetry configuration
export interface TelemetryConfig {
  enabled: boolean;
  bufferSize: number;
  flushInterval: number;
  endpoint?: string;
  apiKey?: string;
  sampling: {
    rate: number; // 0.0 to 1.0
    enabledEvents: TelemetryEventType[];
  };
  performance: {
    trackRenderTime: boolean;
    trackMemory: boolean;
    trackFPS: boolean;
  };
  privacy: {
    anonymizeUser: boolean;
    excludeMetadata: string[];
  };
}

// Default configuration
const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: true,
  bufferSize: 100,
  flushInterval: 30000, // 30 seconds
  sampling: {
    rate: 1.0,
    enabledEvents: Object.values(TelemetryEventType)
  },
  performance: {
    trackRenderTime: true,
    trackMemory: true,
    trackFPS: true
  },
  privacy: {
    anonymizeUser: true,
    excludeMetadata: ['password', 'token', 'apiKey', 'secret']
  }
};

/**
 * TelemetryManager - Central telemetry management system
 */
export class TelemetryManager {
  private config: TelemetryConfig;
  private buffer: TelemetryEvent[] = [];
  private flushTimer: number | null = null;
  private listeners: Set<(event: TelemetryEvent) => void> = new Set();
  private sessionId: string;
  private startTime: number;
  private performanceObserver: PerformanceObserver | null = null;
  private fpsInterval: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private currentFPS = 0;
  
  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    
    if (this.config.enabled) {
      this.initialize();
    }
  }
  
  /**
   * Initialize telemetry systems
   */
  private initialize(): void {
    // Set up flush timer
    if (this.config.flushInterval > 0) {
      this.flushTimer = window.setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
    
    // Set up performance observer
    if (this.config.performance.trackRenderTime && 'PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
              this.track(TelemetryEventType.PERFORMANCE_METRIC, {
                category: 'performance',
                action: 'measure',
                label: entry.name,
                value: entry.duration,
                duration: entry.duration
              });
            }
          }
        });
        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (e) {
        console.warn('Failed to initialize PerformanceObserver:', e);
      }
    }
    
    // Set up FPS tracking
    if (this.config.performance.trackFPS) {
      this.startFPSTracking();
    }
    
    // Track initialization
    this.track(TelemetryEventType.INITIALIZATION, {
      category: 'system',
      action: 'telemetry_initialized',
      metadata: {
        sessionId: this.sessionId,
        config: this.config
      }
    });
  }
  
  /**
   * Start FPS tracking
   */
  private startFPSTracking(): void {
    const trackFrame = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        this.frameCount++;
        
        // Calculate FPS every second
        if (this.frameCount >= 60) {
          this.currentFPS = Math.round(1000 / (delta / this.frameCount));
          this.track(TelemetryEventType.PERFORMANCE_METRIC, {
            category: 'performance',
            action: 'fps',
            value: this.currentFPS,
            metadata: { fps: this.currentFPS }
          });
          this.frameCount = 0;
        }
      }
      
      this.lastFrameTime = timestamp;
      this.fpsInterval = requestAnimationFrame(trackFrame);
    };
    
    this.fpsInterval = requestAnimationFrame(trackFrame);
  }
  
  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Track a telemetry event
   */
  track(
    type: TelemetryEventType,
    data: Partial<Omit<TelemetryEvent, 'type' | 'timestamp'>>
  ): void {
    if (!this.config.enabled) return;
    
    // Check sampling
    if (Math.random() > this.config.sampling.rate) return;
    if (!this.config.sampling.enabledEvents.includes(type)) return;
    
    // Create event
    const event: TelemetryEvent = {
      type,
      timestamp: Date.now(),
      category: data.category || 'unknown',
      action: data.action || 'unknown',
      ...data
    };
    
    // Add memory usage if tracking
    if (this.config.performance.trackMemory && 'memory' in performance) {
      event.memoryUsage = {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      };
    }
    
    // Sanitize metadata
    if (event.metadata && this.config.privacy.excludeMetadata.length > 0) {
      event.metadata = this.sanitizeMetadata(event.metadata);
    }
    
    // Add to buffer
    this.buffer.push(event);
    
    // Trim buffer if needed
    if (this.buffer.length > this.config.bufferSize) {
      this.buffer.shift();
    }
    
    // Notify listeners
    this.listeners.forEach(listener => listener(event));
    
    // Auto-flush on errors
    if (type === TelemetryEventType.ERROR && this.buffer.length > 10) {
      this.flush();
    }
  }
  
  /**
   * Sanitize metadata to exclude sensitive fields
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    
    this.config.privacy.excludeMetadata.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
  
  /**
   * Track performance timing
   */
  measurePerformance(name: string, fn: () => void): void {
    if (!this.config.enabled || !this.config.performance.trackRenderTime) {
      fn();
      return;
    }
    
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    
    performance.mark(startMark);
    fn();
    performance.mark(endMark);
    performance.measure(name, startMark, endMark);
  }
  
  /**
   * Track async performance timing
   */
  async measurePerformanceAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.enabled || !this.config.performance.trackRenderTime) {
      return fn();
    }
    
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.track(TelemetryEventType.PERFORMANCE_METRIC, {
        category: 'performance',
        action: 'async_measure',
        label: name,
        duration,
        value: duration
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.track(TelemetryEventType.ERROR, {
        category: 'performance',
        action: 'async_measure_error',
        label: name,
        duration,
        error: error as Error
      });
      
      throw error;
    }
  }
  
  /**
   * Flush buffered events
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.endpoint) return;
    
    const events = [...this.buffer];
    this.buffer = [];
    
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey })
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events
        })
      });
      
      if (!response.ok) {
        console.warn('Failed to flush telemetry events:', response.status);
        // Re-add events to buffer on failure
        this.buffer.unshift(...events);
      }
    } catch (error) {
      console.warn('Failed to flush telemetry events:', error);
      // Re-add events to buffer on failure
      this.buffer.unshift(...events);
    }
  }
  
  /**
   * Add event listener
   */
  addEventListener(listener: (event: TelemetryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): {
    sessionId: string;
    uptime: number;
    eventCount: number;
    bufferSize: number;
    currentFPS: number;
    memoryUsage?: any;
  } {
    return {
      sessionId: this.sessionId,
      uptime: Date.now() - this.startTime,
      eventCount: this.buffer.length,
      bufferSize: this.config.bufferSize,
      currentFPS: this.currentFPS,
      memoryUsage: 'memory' in performance ? (performance as any).memory : undefined
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart if needed
    if (config.enabled === false) {
      this.cleanup();
    } else if (config.enabled === true && !this.flushTimer) {
      this.initialize();
    }
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    
    if (this.fpsInterval) {
      cancelAnimationFrame(this.fpsInterval);
      this.fpsInterval = null;
    }
    
    this.flush();
    this.listeners.clear();
    
    this.track(TelemetryEventType.CLEANUP, {
      category: 'system',
      action: 'telemetry_cleanup',
      metadata: {
        sessionId: this.sessionId,
        uptime: Date.now() - this.startTime
      }
    });
  }
}

// Global telemetry instance
let globalTelemetry: TelemetryManager | null = null;

export function getGlobalTelemetry(): TelemetryManager {
  if (!globalTelemetry) {
    globalTelemetry = new TelemetryManager();
  }
  return globalTelemetry;
}

export function initializeTelemetry(config: Partial<TelemetryConfig>): TelemetryManager {
  if (globalTelemetry) {
    globalTelemetry.cleanup();
  }
  globalTelemetry = new TelemetryManager(config);
  return globalTelemetry;
}

/**
 * React hook for telemetry
 */
export function useTelemetry(): TelemetryManager {
  const [telemetry] = React.useState(() => getGlobalTelemetry());
  
  React.useEffect(() => {
    return () => {
      // Don't cleanup global telemetry on component unmount
    };
  }, []);
  
  return telemetry;
}

/**
 * HOC for tracking component performance
 */
export function withTelemetry<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return React.memo((props: P) => {
    const telemetry = useTelemetry();
    const renderCount = React.useRef(0);
    
    React.useEffect(() => {
      renderCount.current++;
      telemetry.track(TelemetryEventType.RENDER_TIME, {
        category: 'component',
        action: 'render',
        label: componentName,
        value: renderCount.current,
        metadata: {
          component: componentName,
          renderCount: renderCount.current
        }
      });
    });
    
    return React.createElement(Component, props);
  });
}