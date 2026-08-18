import { useState, useEffect } from 'react';

export type WorkflowMaturity = 'draft' | 'reviewed' | 'stable';

export interface WorkflowIntent {
  primaryGoal: string;
  userType: string;
  successSignal: string;
  failureModes: string[];
  confirmed: boolean;
  lastReviewedAt?: number;
  maturity: WorkflowMaturity;
  intentHash?: string;
  lastIntentHash?: string;
  isStale?: boolean;
}

interface WorkflowIntentStore {
  get(projectId: string, workflowId: string): WorkflowIntent | null;
  set(projectId: string, workflowId: string, intent: WorkflowIntent): void;
  update(projectId: string, workflowId: string, updates: Partial<WorkflowIntent>): void;
  markStale(projectId: string, workflowId: string): void;
  confirmIntent(projectId: string, workflowId: string): void;
  setMaturity(projectId: string, workflowId: string, maturity: WorkflowMaturity): void;
  getAll(projectId: string): Record<string, WorkflowIntent>;
  delete(projectId: string, workflowId: string): void;
  subscribe(callback: () => void): () => void;
}

const STORAGE_KEY_PREFIX = 'kiteframe-workflow-intent-';

function getStorageKey(projectId: string, workflowId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}-${workflowId}`;
}

function getProjectStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}-index`;
}

class WorkflowIntentStoreImpl implements WorkflowIntentStore {
  private subscribers: Set<() => void> = new Set();
  private cache: Map<string, WorkflowIntent> = new Map();

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback());
  }

  private getDefaultIntent(): WorkflowIntent {
    return {
      primaryGoal: '',
      userType: '',
      successSignal: '',
      failureModes: [],
      confirmed: false,
      maturity: 'draft',
      isStale: false,
    };
  }

  get(projectId: string, workflowId: string): WorkflowIntent | null {
    const key = getStorageKey(projectId, workflowId);
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const intent = JSON.parse(stored) as WorkflowIntent;
        this.cache.set(key, intent);
        return intent;
      }
      return null;
    } catch {
      return null;
    }
  }

  set(projectId: string, workflowId: string, intent: WorkflowIntent): void {
    const key = getStorageKey(projectId, workflowId);
    try {
      localStorage.setItem(key, JSON.stringify(intent));
      this.cache.set(key, intent);
      this.updateIndex(projectId, workflowId, 'add');
      this.notifySubscribers();
    } catch (error) {
      console.warn('Failed to save workflow intent:', error);
    }
  }

  update(projectId: string, workflowId: string, updates: Partial<WorkflowIntent>): void {
    const existing = this.get(projectId, workflowId) || this.getDefaultIntent();
    const updated = { ...existing, ...updates };
    this.set(projectId, workflowId, updated);
  }

  markStale(projectId: string, workflowId: string): void {
    this.update(projectId, workflowId, { isStale: true });
  }

  confirmIntent(projectId: string, workflowId: string): void {
    const intent = this.get(projectId, workflowId);
    if (intent) {
      this.update(projectId, workflowId, {
        confirmed: true,
        isStale: false,
        lastReviewedAt: Date.now(),
        lastIntentHash: intent.intentHash,
      });
    }
  }

  setMaturity(projectId: string, workflowId: string, maturity: WorkflowMaturity): void {
    this.update(projectId, workflowId, { maturity });
  }

  getAll(projectId: string): Record<string, WorkflowIntent> {
    const indexKey = getProjectStorageKey(projectId);
    try {
      const indexData = localStorage.getItem(indexKey);
      const workflowIds: string[] = indexData ? JSON.parse(indexData) : [];
      const result: Record<string, WorkflowIntent> = {};
      for (const workflowId of workflowIds) {
        const intent = this.get(projectId, workflowId);
        if (intent) {
          result[workflowId] = intent;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  delete(projectId: string, workflowId: string): void {
    const key = getStorageKey(projectId, workflowId);
    try {
      localStorage.removeItem(key);
      this.cache.delete(key);
      this.updateIndex(projectId, workflowId, 'remove');
      this.notifySubscribers();
    } catch (error) {
      console.warn('Failed to delete workflow intent:', error);
    }
  }

  private updateIndex(projectId: string, workflowId: string, action: 'add' | 'remove'): void {
    const indexKey = getProjectStorageKey(projectId);
    try {
      const indexData = localStorage.getItem(indexKey);
      let workflowIds: string[] = indexData ? JSON.parse(indexData) : [];
      if (action === 'add' && !workflowIds.includes(workflowId)) {
        workflowIds.push(workflowId);
      } else if (action === 'remove') {
        workflowIds = workflowIds.filter(id => id !== workflowId);
      }
      localStorage.setItem(indexKey, JSON.stringify(workflowIds));
    } catch (error) {
      console.warn('Failed to update workflow intent index:', error);
    }
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

export const workflowIntentStore: WorkflowIntentStore = new WorkflowIntentStoreImpl();

export interface MaturityTransitionResult {
  allowed: boolean;
  reason: string;
  requiredConditions?: string[];
}

export function canTransitionMaturity(
  currentMaturity: WorkflowMaturity,
  targetMaturity: WorkflowMaturity,
  intent: WorkflowIntent | null,
  hasFailurePath: boolean = false,
  hasStalePRD: boolean = false
): MaturityTransitionResult {
  if (currentMaturity === targetMaturity) {
    return { allowed: true, reason: 'Already at target maturity' };
  }

  if (targetMaturity === 'reviewed') {
    const issues: string[] = [];
    
    if (!intent?.confirmed) {
      issues.push('Intent must be confirmed');
    }
    if (!hasFailurePath) {
      issues.push('At least one failure path required');
    }
    
    if (issues.length > 0) {
      return {
        allowed: false,
        reason: 'Cannot transition to Reviewed',
        requiredConditions: issues,
      };
    }
    return { allowed: true, reason: 'Intent confirmed with failure paths' };
  }

  if (targetMaturity === 'stable') {
    const issues: string[] = [];
    
    if (currentMaturity !== 'reviewed') {
      issues.push('Must be in Reviewed state first');
    }
    if (hasStalePRD) {
      issues.push('PRD must not have stale sections');
    }
    
    if (issues.length > 0) {
      return {
        allowed: false,
        reason: 'Cannot transition to Stable',
        requiredConditions: issues,
      };
    }
    return { allowed: true, reason: 'PRD is up-to-date and reviewed' };
  }

  if (targetMaturity === 'draft') {
    return { allowed: true, reason: 'Can always revert to Draft' };
  }

  return { allowed: false, reason: 'Invalid maturity transition' };
}

export function getMaturityGatingRules(maturity: WorkflowMaturity): {
  canAutoExecute: boolean;
  canFastAction: boolean;
  requiresConfirmation: boolean;
} {
  switch (maturity) {
    case 'draft':
      return {
        canAutoExecute: false,
        canFastAction: false,
        requiresConfirmation: true,
      };
    case 'reviewed':
      return {
        canAutoExecute: false,
        canFastAction: false,
        requiresConfirmation: true,
      };
    case 'stable':
      return {
        canAutoExecute: true,
        canFastAction: true,
        requiresConfirmation: false,
      };
  }
}

export function useWorkflowIntent(projectId?: string, workflowId?: string) {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = workflowIntentStore.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  const intent = projectId && workflowId 
    ? workflowIntentStore.get(projectId, workflowId) 
    : null;

  return {
    intent,
    setIntent: (newIntent: WorkflowIntent) => {
      if (projectId && workflowId) {
        workflowIntentStore.set(projectId, workflowId, newIntent);
      }
    },
    updateIntent: (updates: Partial<WorkflowIntent>) => {
      if (projectId && workflowId) {
        workflowIntentStore.update(projectId, workflowId, updates);
      }
    },
    markStale: () => {
      if (projectId && workflowId) {
        workflowIntentStore.markStale(projectId, workflowId);
      }
    },
    confirmIntent: () => {
      if (projectId && workflowId) {
        workflowIntentStore.confirmIntent(projectId, workflowId);
      }
    },
    setMaturity: (maturity: WorkflowMaturity) => {
      if (projectId && workflowId) {
        workflowIntentStore.setMaturity(projectId, workflowId, maturity);
      }
    },
    getAll: () => projectId ? workflowIntentStore.getAll(projectId) : {},
    isStale: intent?.isStale ?? false,
    maturity: intent?.maturity ?? 'draft',
    isConfirmed: intent?.confirmed ?? false,
  };
}

export function createDefaultIntent(proposedGoal?: string): WorkflowIntent {
  return {
    primaryGoal: proposedGoal || '',
    userType: '',
    successSignal: '',
    failureModes: [],
    confirmed: false,
    maturity: 'draft',
    isStale: false,
  };
}
