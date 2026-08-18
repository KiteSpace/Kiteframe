/**
 * LayersStateManager - Central controller for project-scoped layers panel state
 * 
 * This module provides:
 * 1. Project-scoped state management for collapse, visibility, lock, and workflow names
 * 2. Automatic reset when switching between projects
 * 3. localStorage persistence with project-specific keys
 */

import { nodeToWorkflowStore } from './nodeToWorkflowStore';

// Type definitions
export type FlagMap = {
  hidden: Record<string, boolean>;
  locked: Record<string, boolean>;
};

type CollapseState = Map<string, boolean>;

// Current project tracking
let currentProjectId: string | null = null;

// ============================================
// VISIBILITY/LOCK STORE (Project-Scoped)
// ============================================

const VLStoreImpl = (() => {
  let state: FlagMap = { hidden: {}, locked: {} };
  const listeners = new Set<() => void>();

  const getStorageKey = (projectId: string | null) => 
    `kiteframe-vl-state-${projectId || 'default'}`;

  const load = (projectId: string | null) => {
    const key = getStorageKey(projectId);
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        state = JSON.parse(saved);
      } else {
        state = { hidden: {}, locked: {} };
      }
    } catch {
      state = { hidden: {}, locked: {} };
    }
    listeners.forEach(l => l());
  };

  const save = () => {
    const key = getStorageKey(currentProjectId);
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save VL state:', e);
    }
  };

  const get = () => state;
  
  const set = (next: Partial<FlagMap>) => {
    state = {
      hidden: { ...state.hidden, ...(next.hidden ?? {}) },
      locked: { ...state.locked, ...(next.locked ?? {}) },
    };
    save();
    listeners.forEach(l => l());
  };

  const reset = () => {
    state = { hidden: {}, locked: {} };
    listeners.forEach(l => l());
  };

  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  const toggle = (flag: 'hidden' | 'locked', id: string) => {
    set({ [flag]: { [id]: !state[flag][id] } } as any);
  };

  return { get, set, toggle, subscribe, reset, load };
})();

// ============================================
// COLLAPSE STORE (Project-Scoped)
// ============================================

const CollapseStoreImpl = (() => {
  let collapsed: CollapseState = new Map();
  const subscribers = new Set<() => void>();

  const getStorageKey = (projectId: string | null) => 
    `kiteframe-collapse-state-${projectId || 'default'}`;

  const load = (projectId: string | null) => {
    const key = getStorageKey(projectId);
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        collapsed = new Map(Array.isArray(data) ? data : []);
      } else {
        collapsed = new Map();
      }
    } catch {
      collapsed = new Map();
    }
    subscribers.forEach(callback => callback());
  };

  const save = () => {
    const key = getStorageKey(currentProjectId);
    try {
      const entries: [string, boolean][] = [];
      collapsed.forEach((value, k) => {
        entries.push([k, value]);
      });
      localStorage.setItem(key, JSON.stringify(entries));
    } catch (e) {
      console.warn('Failed to save collapse state:', e);
    }
  };

  const get = (id: string): boolean => collapsed.get(id) ?? false;

  const toggle = (id: string) => {
    const current = get(id);
    collapsed.set(id, !current);
    save();
    subscribers.forEach(callback => callback());
  };

  const reset = () => {
    collapsed = new Map();
    subscribers.forEach(callback => callback());
  };

  const subscribe = (callback: () => void): (() => void) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  };

  return { get, toggle, subscribe, reset, load };
})();

// ============================================
// WORKFLOW NAME STORE (Project-Scoped)
// ============================================

const WorkflowNameStoreImpl = (() => {
  const MAX_NAME_LENGTH = 50;
  let names: Record<string, string> = {};
  const subscribers = new Set<() => void>();

  const getStorageKey = (projectId: string | null) => 
    `kiteframe-workflow-names-${projectId || 'default'}`;

  const validateName = (name: string): string => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error('Workflow name cannot be empty');
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw new Error(`Workflow name too long (max ${MAX_NAME_LENGTH} characters)`);
    }
    const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
    if (sanitized.length === 0) {
      throw new Error('Invalid characters in workflow name');
    }
    return sanitized;
  };

  const load = (projectId: string | null) => {
    const key = getStorageKey(projectId);
    try {
      const saved = localStorage.getItem(key);
      names = saved ? JSON.parse(saved) : {};
    } catch {
      names = {};
    }
    subscribers.forEach(callback => callback());
  };

  const save = () => {
    const key = getStorageKey(currentProjectId);
    try {
      localStorage.setItem(key, JSON.stringify(names));
    } catch (e) {
      console.warn('Failed to save workflow names:', e);
    }
  };

  const get = (workflowId: string): string | null => names[workflowId] || null;

  const set = (workflowId: string, name: string) => {
    const validatedName = validateName(name);
    names[workflowId] = validatedName;
    save();
    subscribers.forEach(callback => callback());
  };

  const getAll = (): Record<string, string> => ({ ...names });

  const clear = () => {
    names = {};
    subscribers.forEach(callback => callback());
  };

  const reset = () => {
    names = {};
    subscribers.forEach(callback => callback());
  };

  const subscribe = (callback: () => void): (() => void) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  };

  return { get, set, getAll, clear, reset, subscribe, load };
})();

// ============================================
// CENTRAL RESET FUNCTION
// ============================================

/**
 * Reset all layers panel state for a new project
 * Call this when switching projects to prevent state leakage
 */
export function resetLayersState(projectId: string | null): void {
  currentProjectId = projectId;
  
  // Load project-specific state from localStorage
  VLStoreImpl.load(projectId);
  CollapseStoreImpl.load(projectId);
  WorkflowNameStoreImpl.load(projectId);
  
  // Clear in-memory stores (will be repopulated by LayersPanel)
  nodeToWorkflowStore.clear();
}

/**
 * Get the current project ID for debugging
 */
export function getCurrentProjectId(): string | null {
  return currentProjectId;
}

// ============================================
// EXPORTS (Drop-in replacements for old stores)
// ============================================

export const VLStore = VLStoreImpl;
export const collapseStore = CollapseStoreImpl;
export const projectWorkflowNameStore = WorkflowNameStoreImpl;

// React hook for workflow names
import { useState, useEffect } from 'react';

export function useProjectWorkflowNames() {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    const unsubscribe = projectWorkflowNameStore.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);
  
  return {
    get: projectWorkflowNameStore.get,
    set: projectWorkflowNameStore.set,
    getAll: projectWorkflowNameStore.getAll
  };
}

/**
 * Generate deterministic workflow names based on visual position
 */
export function generateDefaultWorkflowNames(
  workflowsById: Record<string, string[]>,
  nodes: any[]
): Record<string, string> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  const workflowPositions = Object.entries(workflowsById).map(([wfId, nodeIds]) => {
    const workflowNodes = nodeIds.map(id => nodeMap.get(id)).filter(Boolean);
    if (workflowNodes.length === 0) return { wfId, minY: 0, minX: 0 };
    
    const minY = Math.min(...workflowNodes.map(n => n.position?.y || 0));
    const minX = Math.min(...workflowNodes.filter(n => (n.position?.y || 0) === minY).map(n => n.position?.x || 0));
    
    return { wfId, minY, minX };
  });
  
  workflowPositions.sort((a, b) => a.minY - b.minY || a.minX - b.minX);
  
  const defaultNames: Record<string, string> = {};
  workflowPositions.forEach(({ wfId }, index) => {
    defaultNames[`wf:${wfId}`] = `Workflow ${index + 1}`;
  });
  
  return defaultNames;
}
