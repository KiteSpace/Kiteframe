import { useState, useEffect } from 'react';

export type WorkflowStatus = 'todo' | 'in-progress' | 'done';

export interface WorkflowMetadata {
  status: WorkflowStatus;
  owner?: string;
}

interface WorkflowMetadataStore {
  get(projectId: string, workflowId: string): WorkflowMetadata;
  set(projectId: string, workflowId: string, metadata: Partial<WorkflowMetadata>): void;
  setStatus(projectId: string, workflowId: string, status: WorkflowStatus): void;
  setOwner(projectId: string, workflowId: string, owner: string | undefined): void;
  getAll(projectId: string): Record<string, WorkflowMetadata>;
  subscribe(callback: () => void): () => void;
}

const STORAGE_KEY_PREFIX = 'kiteframe-workflow-metadata-';

class WorkflowMetadataStoreImpl implements WorkflowMetadataStore {
  private subscribers: Set<() => void> = new Set();

  private getStorageKey(projectId: string): string {
    return `${STORAGE_KEY_PREFIX}${projectId}`;
  }

  private getData(projectId: string): Record<string, WorkflowMetadata> {
    try {
      const stored = localStorage.getItem(this.getStorageKey(projectId));
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private saveData(projectId: string, data: Record<string, WorkflowMetadata>): void {
    try {
      localStorage.setItem(this.getStorageKey(projectId), JSON.stringify(data));
      this.subscribers.forEach(callback => callback());
    } catch (error) {
      console.warn('Failed to save workflow metadata:', error);
    }
  }

  private getDefaultMetadata(): WorkflowMetadata {
    return { status: 'todo' };
  }

  get(projectId: string, workflowId: string): WorkflowMetadata {
    const data = this.getData(projectId);
    return data[workflowId] || this.getDefaultMetadata();
  }

  set(projectId: string, workflowId: string, metadata: Partial<WorkflowMetadata>): void {
    const data = this.getData(projectId);
    const existing = data[workflowId] || this.getDefaultMetadata();
    data[workflowId] = { ...existing, ...metadata };
    this.saveData(projectId, data);
  }

  setStatus(projectId: string, workflowId: string, status: WorkflowStatus): void {
    this.set(projectId, workflowId, { status });
  }

  setOwner(projectId: string, workflowId: string, owner: string | undefined): void {
    this.set(projectId, workflowId, { owner });
  }

  getAll(projectId: string): Record<string, WorkflowMetadata> {
    return this.getData(projectId);
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

export const workflowMetadataStore: WorkflowMetadataStore = new WorkflowMetadataStoreImpl();

export function useWorkflowMetadata(projectId?: string) {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = workflowMetadataStore.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  return {
    get: (workflowId: string) => 
      projectId ? workflowMetadataStore.get(projectId, workflowId) : { status: 'todo' as WorkflowStatus },
    setStatus: (workflowId: string, status: WorkflowStatus) => 
      projectId && workflowMetadataStore.setStatus(projectId, workflowId, status),
    setOwner: (workflowId: string, owner: string | undefined) => 
      projectId && workflowMetadataStore.setOwner(projectId, workflowId, owner),
    getAll: () => projectId ? workflowMetadataStore.getAll(projectId) : {}
  };
}
