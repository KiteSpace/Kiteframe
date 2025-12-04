/**
 * FocusBus - Event system for layer-to-canvas focus and selection communication
 */

export interface FocusEvent {
  type: 'focus-nodes' | 'focus-edges' | 'focus-mixed' | 'focus-canvas-object';
  nodeIds?: string[];
  edgeIds?: string[];
  canvasObjectId?: string;
  selectNodes?: string[];
  selectEdges?: string[];
  selectCanvasObject?: string;
  animate?: boolean;
  padding?: number;
}

type FocusEventHandler = (event: FocusEvent) => void;

class FocusBusImpl {
  private handlers: Set<FocusEventHandler> = new Set();

  subscribe(handler: FocusEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  publish(event: FocusEvent): void {
    this.handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.warn('Error in FocusBus handler:', error);
      }
    });
  }

  // Convenience methods for common focus scenarios
  focusNodes(nodeIds: string[], options: { select?: boolean; animate?: boolean; padding?: number } = {}): void {
    this.publish({
      type: 'focus-nodes',
      nodeIds,
      selectNodes: options.select ? nodeIds : undefined,
      animate: options.animate !== false,
      padding: options.padding || 50
    });
  }

  focusEdges(edgeIds: string[], options: { select?: boolean; animate?: boolean; padding?: number } = {}): void {
    this.publish({
      type: 'focus-edges',
      edgeIds,
      selectEdges: options.select ? edgeIds : undefined,
      animate: options.animate !== false,
      padding: options.padding || 50
    });
  }

  focusWorkflow(nodeIds: string[], options: { animate?: boolean; padding?: number } = {}): void {
    if (nodeIds.length === 0) return;
    
    this.publish({
      type: 'focus-nodes',
      nodeIds,
      selectNodes: [nodeIds[0]], // Select first node of workflow
      animate: options.animate !== false,
      padding: options.padding || 100
    });
  }

  focusCanvasObject(objectId: string, options: { select?: boolean; animate?: boolean; padding?: number } = {}): void {
    this.publish({
      type: 'focus-canvas-object',
      canvasObjectId: objectId,
      selectCanvasObject: options.select ? objectId : undefined,
      animate: options.animate !== false,
      padding: options.padding || 50
    });
  }
}

export const focusBus = new FocusBusImpl();

import { useState, useEffect } from 'react';

/**
 * React hook for FocusBus
 */

export function useFocusBus() {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    const unsubscribe = focusBus.subscribe(() => {
      // Optional: trigger re-render if needed
    });
    return unsubscribe;
  }, []);
  
  return focusBus;
}