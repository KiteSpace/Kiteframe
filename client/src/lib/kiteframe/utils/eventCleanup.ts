/**
 * Event handler cleanup utilities for preventing memory leaks
 * Tracks and manages event listeners with automatic cleanup
 */

import { useState, useEffect } from 'react';

interface EventListenerInfo {
  element: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

interface TimeoutInfo {
  id: ReturnType<typeof setTimeout>;
  callback: () => void;
}

interface IntervalInfo {
  id: ReturnType<typeof setInterval>;
  callback: () => void;
}

interface AnimationFrameInfo {
  id: number;
  callback: FrameRequestCallback;
}

/**
 * EventCleanupManager - Manages event listeners and timers for components
 * Ensures all listeners and timers are properly cleaned up to prevent memory leaks
 */
export class EventCleanupManager {
  private listeners = new Set<EventListenerInfo>();
  private timeouts = new Set<TimeoutInfo>();
  private intervals = new Set<IntervalInfo>();
  private animationFrames = new Set<AnimationFrameInfo>();
  private resizeObservers = new Set<ResizeObserver>();
  private mutationObservers = new Set<MutationObserver>();
  private intersectionObservers = new Set<IntersectionObserver>();
  
  /**
   * Add an event listener with automatic cleanup tracking
   */
  addEventListener(
    element: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): () => void {
    element.addEventListener(type, listener, options);
    
    const info: EventListenerInfo = { element, type, listener, options };
    this.listeners.add(info);
    
    // Return cleanup function
    return () => {
      element.removeEventListener(type, listener, options);
      this.listeners.delete(info);
    };
  }
  
  /**
   * Add a setTimeout with automatic cleanup tracking
   */
  setTimeout(callback: () => void, delay: number): () => void {
    const id = setTimeout(() => {
      callback();
      // Auto-remove after execution
      this.timeouts.forEach(t => {
        if (t.id === id) {
          this.timeouts.delete(t);
        }
      });
    }, delay);
    
    const info: TimeoutInfo = { id, callback };
    this.timeouts.add(info);
    
    // Return cleanup function
    return () => {
      clearTimeout(id);
      this.timeouts.delete(info);
    };
  }
  
  /**
   * Add a setInterval with automatic cleanup tracking
   */
  setInterval(callback: () => void, delay: number): () => void {
    const id = setInterval(callback, delay);
    
    const info: IntervalInfo = { id, callback };
    this.intervals.add(info);
    
    // Return cleanup function
    return () => {
      clearInterval(id);
      this.intervals.delete(info);
    };
  }
  
  /**
   * Add a requestAnimationFrame with automatic cleanup tracking
   */
  requestAnimationFrame(callback: FrameRequestCallback): () => void {
    const id = requestAnimationFrame(callback);
    
    const info: AnimationFrameInfo = { id, callback };
    this.animationFrames.add(info);
    
    // Return cleanup function
    return () => {
      cancelAnimationFrame(id);
      this.animationFrames.delete(info);
    };
  }
  
  /**
   * Add a ResizeObserver with automatic cleanup tracking
   */
  createResizeObserver(callback: ResizeObserverCallback): ResizeObserver {
    const observer = new ResizeObserver(callback);
    this.resizeObservers.add(observer);
    return observer;
  }
  
  /**
   * Add a MutationObserver with automatic cleanup tracking
   */
  createMutationObserver(callback: MutationCallback): MutationObserver {
    const observer = new MutationObserver(callback);
    this.mutationObservers.add(observer);
    return observer;
  }
  
  /**
   * Add an IntersectionObserver with automatic cleanup tracking
   */
  createIntersectionObserver(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ): IntersectionObserver {
    const observer = new IntersectionObserver(callback, options);
    this.intersectionObservers.add(observer);
    return observer;
  }
  
  /**
   * Clean up all tracked resources
   */
  cleanup(): void {
    // Remove all event listeners
    this.listeners.forEach(({ element, type, listener, options }) => {
      element.removeEventListener(type, listener, options);
    });
    this.listeners.clear();
    
    // Clear all timeouts
    this.timeouts.forEach(({ id }) => {
      clearTimeout(id);
    });
    this.timeouts.clear();
    
    // Clear all intervals
    this.intervals.forEach(({ id }) => {
      clearInterval(id);
    });
    this.intervals.clear();
    
    // Cancel all animation frames
    this.animationFrames.forEach(({ id }) => {
      cancelAnimationFrame(id);
    });
    this.animationFrames.clear();
    
    // Disconnect all observers
    this.resizeObservers.forEach(observer => {
      observer.disconnect();
    });
    this.resizeObservers.clear();
    
    this.mutationObservers.forEach(observer => {
      observer.disconnect();
    });
    this.mutationObservers.clear();
    
    this.intersectionObservers.forEach(observer => {
      observer.disconnect();
    });
    this.intersectionObservers.clear();
  }
  
  /**
   * Get statistics about tracked resources
   */
  getStats(): {
    listeners: number;
    timeouts: number;
    intervals: number;
    animationFrames: number;
    resizeObservers: number;
    mutationObservers: number;
    intersectionObservers: number;
  } {
    return {
      listeners: this.listeners.size,
      timeouts: this.timeouts.size,
      intervals: this.intervals.size,
      animationFrames: this.animationFrames.size,
      resizeObservers: this.resizeObservers.size,
      mutationObservers: this.mutationObservers.size,
      intersectionObservers: this.intersectionObservers.size
    };
  }
}

/**
 * Hook for using EventCleanupManager in React components
 */
export function useEventCleanup(): EventCleanupManager {
  const [manager] = useState(() => new EventCleanupManager());
  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      manager.cleanup();
    };
  }, [manager]);
  
  return manager;
}

// For non-React usage
export function createEventCleanupManager(): EventCleanupManager {
  return new EventCleanupManager();
}

/**
 * Global instance for tracking cleanup across the application
 */
let globalCleanupManager: EventCleanupManager | null = null;

export function getGlobalCleanupManager(): EventCleanupManager {
  if (!globalCleanupManager) {
    globalCleanupManager = new EventCleanupManager();
  }
  return globalCleanupManager;
}

export function resetGlobalCleanupManager(): void {
  if (globalCleanupManager) {
    globalCleanupManager.cleanup();
    globalCleanupManager = null;
  }
}

