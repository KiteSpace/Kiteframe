/**
 * WorkflowNameStore - Manages persistent, editable workflow names
 * Stores custom names in localStorage and provides subscription system
 */

interface WorkflowNameStore {
  get(workflowId: string): string | null;
  set(workflowId: string, name: string): void;
  getAll(): Record<string, string>;
  clear(): void;
  subscribe(callback: () => void): () => void;
}

class WorkflowNameStoreImpl implements WorkflowNameStore {
  private static readonly STORAGE_KEY = 'kiteframe-workflow-names';
  private static readonly MAX_NAME_LENGTH = 50;
  private subscribers: Set<() => void> = new Set();

  private validateName(name: string): string {
    // Trim and limit length
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Workflow name cannot be empty');
    }
    if (trimmed.length > WorkflowNameStoreImpl.MAX_NAME_LENGTH) {
      throw new Error(`Workflow name too long (max ${WorkflowNameStoreImpl.MAX_NAME_LENGTH} characters)`);
    }
    
    // Remove control characters to prevent issues
    const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
    if (sanitized.length === 0) {
      throw new Error('Invalid characters in workflow name');
    }
    
    return sanitized;
  }

  private getData(): Record<string, string> {
    try {
      const stored = localStorage.getItem(WorkflowNameStoreImpl.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private saveData(data: Record<string, string>): void {
    try {
      localStorage.setItem(WorkflowNameStoreImpl.STORAGE_KEY, JSON.stringify(data));
      // Notify all subscribers
      this.subscribers.forEach(callback => callback());
    } catch (error) {
      console.warn('Failed to save workflow names:', error);
    }
  }

  get(workflowId: string): string | null {
    const data = this.getData();
    return data[workflowId] || null;
  }

  set(workflowId: string, name: string): void {
    const validatedName = this.validateName(name);
    const data = this.getData();
    data[workflowId] = validatedName;
    this.saveData(data);
  }

  getAll(): Record<string, string> {
    return this.getData();
  }

  clear(): void {
    localStorage.removeItem(WorkflowNameStoreImpl.STORAGE_KEY);
    this.subscribers.forEach(callback => callback());
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

// Singleton instance
export const workflowNameStore: WorkflowNameStore = new WorkflowNameStoreImpl();

/**
 * Generate deterministic workflow names based on visual position
 * Sorts workflows by min Y position of their nodes, then by min X
 */
export function generateDefaultWorkflowNames(
  workflowsById: Record<string, string[]>,
  nodes: any[]
): Record<string, string> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Calculate min position for each workflow
  const workflowPositions = Object.entries(workflowsById).map(([wfId, nodeIds]) => {
    const workflowNodes = nodeIds.map(id => nodeMap.get(id)).filter(Boolean);
    if (workflowNodes.length === 0) return { wfId, minY: 0, minX: 0 };
    
    const minY = Math.min(...workflowNodes.map(n => n.position?.y || 0));
    const minX = Math.min(...workflowNodes.filter(n => (n.position?.y || 0) === minY).map(n => n.position?.x || 0));
    
    return { wfId, minY, minX };
  });
  
  // Sort by position and assign numbers
  workflowPositions.sort((a, b) => a.minY - b.minY || a.minX - b.minX);
  
  const defaultNames: Record<string, string> = {};
  workflowPositions.forEach(({ wfId }, index) => {
    defaultNames[`wf:${wfId}`] = `Workflow ${index + 1}`;
  });
  
  return defaultNames;
}

import { useState, useEffect } from 'react';

/**
 * React hook for workflow name store
 */

export function useWorkflowNames() {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    const unsubscribe = workflowNameStore.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);
  
  return {
    get: workflowNameStore.get.bind(workflowNameStore),
    set: workflowNameStore.set.bind(workflowNameStore),
    getAll: workflowNameStore.getAll.bind(workflowNameStore)
  };
}