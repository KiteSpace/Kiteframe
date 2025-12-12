import { useState, useEffect } from 'react';
import type { PRDRef } from '@/lib/kiteframe/types';

export interface PRDNodeLink {
  nodeId: string;
  workflowId: string;
  sectionId: string;
  projectId?: string;
  linkedAt: number;
}

interface PRDNodeLinkStore {
  getLinksForSection(projectId: string, workflowId: string, sectionId: string): PRDNodeLink[];
  getLinksForNode(projectId: string, nodeId: string): PRDNodeLink[];
  addLink(projectId: string, nodeId: string, workflowId: string, sectionId: string): void;
  removeLink(projectId: string, nodeId: string, workflowId: string, sectionId: string): void;
  getAllLinks(projectId: string): PRDNodeLink[];
  subscribe(callback: () => void): () => void;
}

const STORAGE_KEY_PREFIX = 'kiteframe-prd-node-links-';

class PRDNodeLinkStoreImpl implements PRDNodeLinkStore {
  private subscribers: Set<() => void> = new Set();

  private getStorageKey(projectId: string): string {
    return `${STORAGE_KEY_PREFIX}${projectId}`;
  }

  private getData(projectId: string): PRDNodeLink[] {
    try {
      const stored = localStorage.getItem(this.getStorageKey(projectId));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveData(projectId: string, links: PRDNodeLink[]): void {
    try {
      localStorage.setItem(this.getStorageKey(projectId), JSON.stringify(links));
      this.subscribers.forEach(callback => callback());
    } catch (error) {
      console.warn('Failed to save PRD-node links:', error);
    }
  }

  getLinksForSection(projectId: string, workflowId: string, sectionId: string): PRDNodeLink[] {
    const links = this.getData(projectId);
    return links.filter(l => l.workflowId === workflowId && l.sectionId === sectionId);
  }

  getLinksForNode(projectId: string, nodeId: string): PRDNodeLink[] {
    const links = this.getData(projectId);
    return links.filter(l => l.nodeId === nodeId);
  }

  addLink(projectId: string, nodeId: string, workflowId: string, sectionId: string): void {
    const links = this.getData(projectId);
    const exists = links.some(l => 
      l.nodeId === nodeId && l.workflowId === workflowId && l.sectionId === sectionId
    );
    if (!exists) {
      links.push({
        nodeId,
        workflowId,
        sectionId,
        projectId,
        linkedAt: Date.now()
      });
      this.saveData(projectId, links);
    }
  }

  removeLink(projectId: string, nodeId: string, workflowId: string, sectionId: string): void {
    const links = this.getData(projectId);
    const filtered = links.filter(l => 
      !(l.nodeId === nodeId && l.workflowId === workflowId && l.sectionId === sectionId)
    );
    this.saveData(projectId, filtered);
  }

  getAllLinks(projectId: string): PRDNodeLink[] {
    return this.getData(projectId);
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

export const prdNodeLinkStore: PRDNodeLinkStore = new PRDNodeLinkStoreImpl();

export function usePRDNodeLinks(projectId?: string) {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = prdNodeLinkStore.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  return {
    getLinksForSection: (workflowId: string, sectionId: string) => 
      projectId ? prdNodeLinkStore.getLinksForSection(projectId, workflowId, sectionId) : [],
    getLinksForNode: (nodeId: string) => 
      projectId ? prdNodeLinkStore.getLinksForNode(projectId, nodeId) : [],
    addLink: (nodeId: string, workflowId: string, sectionId: string) => 
      projectId && prdNodeLinkStore.addLink(projectId, nodeId, workflowId, sectionId),
    removeLink: (nodeId: string, workflowId: string, sectionId: string) => 
      projectId && prdNodeLinkStore.removeLink(projectId, nodeId, workflowId, sectionId),
    getAllLinks: () => projectId ? prdNodeLinkStore.getAllLinks(projectId) : []
  };
}
