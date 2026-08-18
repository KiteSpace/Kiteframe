/**
 * Error Recovery and Resilience System
 * Provides automatic state recovery, graceful degradation, and retry logic
 */

import { Node, Edge } from '../types';

interface RecoveryState {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  timestamp: number;
}

interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  exponential: boolean;
}

export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager | null = null;
  private lastKnownGoodState: RecoveryState | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private errorCount = 0;
  private errorThreshold = 3;
  private recoveryCallbacks: ((state: RecoveryState) => void)[] = [];
  private autoSaveEnabled = true;
  private quotaExceeded = false;
  private lastAutoSave = 0;
  private autoSaveDebounceMs = 2000;
  
  private constructor() {
    this.setupGlobalErrorHandlers();
    this.startAutoSave();
  }
  
  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }
  
  /**
   * Setup global error handlers for uncaught errors
   */
  private setupGlobalErrorHandlers() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      console.error('Uncaught error:', event.error);
      this.handleError(event.error, 'global');
      event.preventDefault();
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError(event.reason, 'promise');
      event.preventDefault();
    });
  }
  
  /**
   * Save current state as last known good state
   */
  saveState(nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) {
    this.lastKnownGoodState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      viewport: { ...viewport },
      timestamp: Date.now()
    };
    this.errorCount = 0; // Reset error count on successful save
  }
  
  /**
   * Start automatic state saving with error handling
   */
  private startAutoSave() {
    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave();
    }, 30000); // Auto-save every 30 seconds
  }

  /**
   * Perform auto-save with quota error handling and debouncing
   */
  private performAutoSave() {
    if (!this.autoSaveEnabled || this.quotaExceeded) {
      return;
    }

    // Debounce auto-save
    const now = Date.now();
    if (now - this.lastAutoSave < this.autoSaveDebounceMs) {
      return;
    }

    const currentState = this.lastKnownGoodState;
    if (!currentState) {
      return;
    }

    try {
      const serialized = JSON.stringify(currentState);
      
      // Check payload size (limit to ~1MB)
      if (serialized.length > 1024 * 1024) {
        console.warn('Auto-save payload too large, cleaning up old data');
        this.cleanupOldAutoSaves();
        return;
      }

      localStorage.setItem('kiteframe_autosave', serialized);
      this.lastAutoSave = now;
      
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, disabling auto-save for this session');
        this.quotaExceeded = true;
        this.autoSaveEnabled = false;
        
        // Try to clean up and retry once
        this.cleanupOldAutoSaves();
        this.showQuotaExceededNotification();
        
      } else {
        console.error('Auto-save failed:', error);
      }
    }
  }

  /**
   * Clean up old auto-save data to free space
   */
  private cleanupOldAutoSaves() {
    try {
      // Remove old KiteFrame related localStorage keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('kiteframe_') && key !== 'kiteframe_autosave') {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
    } catch (error) {
      console.error('Failed to cleanup old auto-saves:', error);
    }
  }

  /**
   * Show notification about quota exceeded (could be integrated with toast system)
   */
  private showQuotaExceededNotification() {
    // For now, just log - in a real app this would show a toast notification
    console.warn('⚠️ Storage quota exceeded. Auto-save disabled for this session. Consider clearing browser data or reducing workflow complexity.');
  }
  
  /**
   * Handle errors with automatic recovery
   */
  handleError(error: Error, context: string) {
    this.errorCount++;
    
    // Log error for telemetry
    console.error(`Error in ${context}:`, error);
    
    // If error threshold exceeded, attempt recovery
    if (this.errorCount >= this.errorThreshold) {
      this.attemptRecovery();
    }
  }
  
  /**
   * Attempt to recover from errors
   */
  attemptRecovery() {
    if (this.lastKnownGoodState) {
      console.warn('Attempting automatic recovery from last known good state...');
      
      // Notify all registered callbacks
      this.recoveryCallbacks.forEach(callback => {
        try {
          callback(this.lastKnownGoodState!);
        } catch (e) {
          console.error('Recovery callback failed:', e);
        }
      });
      
      // Reset error count after recovery
      this.errorCount = 0;
    } else {
      console.error('No recovery state available');
    }
  }
  
  /**
   * Register a callback for state recovery
   */
  onRecovery(callback: (state: RecoveryState) => void) {
    this.recoveryCallbacks.push(callback);
    return () => {
      this.recoveryCallbacks = this.recoveryCallbacks.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Load auto-saved state from localStorage
   */
  loadAutoSavedState(): RecoveryState | null {
    try {
      const saved = localStorage.getItem('kiteframe_autosave');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load auto-saved state:', e);
    }
    return null;
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = { maxAttempts: 3, backoffMs: 1000, exponential: true }
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < config.maxAttempts) {
        const delay = config.exponential 
          ? config.backoffMs * Math.pow(2, attempt - 1)
          : config.backoffMs;
        
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Graceful degradation wrapper for plugin operations
 */
export function withGracefulDegradation<T extends any[], R>(
  fn: (...args: T) => R,
  fallback: R,
  errorHandler?: (error: Error) => void
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      console.warn('Operation failed, using fallback:', error);
      if (errorHandler) {
        errorHandler(error as Error);
      }
      return fallback;
    }
  };
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 5,
    private timeout = 60000, // 1 minute
    private resetTimeout = 30000 // 30 seconds
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should be reset
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open - operation blocked');
      }
    }
    
    try {
      const result = await fn();
      
      // Reset on success
      if (this.state === 'half-open') {
        this.reset();
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.warn('Circuit breaker opened due to excessive failures');
      
      // Auto-reset after timeout
      setTimeout(() => {
        this.state = 'half-open';
      }, this.resetTimeout);
    }
  }
  
  private reset() {
    this.failures = 0;
    this.state = 'closed';
    console.info('Circuit breaker reset');
  }
  
  getState() {
    return this.state;
  }
}

// Export singleton instance
export const errorRecovery = ErrorRecoveryManager.getInstance();

// Hook for React components
export function useErrorRecovery() {
  const [recoveryState, setRecoveryState] = React.useState<RecoveryState | null>(null);
  
  React.useEffect(() => {
    const unsubscribe = errorRecovery.onRecovery((state) => {
      // Only set recovery state when triggered by actual error recovery
      setRecoveryState(state);
    });
    
    // Don't auto-load saved state on mount - only recover on actual errors
    // This prevents showing "Canvas Recovered" toast on every page load
    
    return unsubscribe;
  }, []);
  
  return {
    recoveryState,
    saveState: (nodes: Node[], edges: Edge[], viewport: any) => 
      errorRecovery.saveState(nodes, edges, viewport),
    handleError: (error: Error, context: string) => 
      errorRecovery.handleError(error, context)
  };
}

import React from 'react';