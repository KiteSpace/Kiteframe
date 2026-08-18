import { useState, useEffect } from 'react';
import type { PRDRef } from '@/lib/kiteframe/types';

export type PRDLinkTargetType = 'node' | 'edge';

export interface PRDNodeLink {
  nodeId: string; // Legacy field, kept for backwards compatibility
  targetId: string; // The node or edge ID
  targetType: PRDLinkTargetType;
  workflowId: string;
  sectionId: string;
  projectId?: string;
  linkedAt: number;
}

interface PRDNodeLinkStore {
  getLinksForSection(projectId: string, workflowId: string, sectionId: string): PRDNodeLink[];
  getLinksForNode(projectId: string, nodeId: string): PRDNodeLink[];
  getLinksForEdge(projectId: string, edgeId: string): PRDNodeLink[];
  getLinksForTarget(projectId: string, targetId: string, targetType: PRDLinkTargetType): PRDNodeLink[];
  addLink(projectId: string, targetId: string, targetType: PRDLinkTargetType, workflowId: string, sectionId: string): void;
  removeLink(projectId: string, targetId: string, targetType: PRDLinkTargetType, workflowId: string, sectionId: string): void;
  getAllLinks(projectId: string): PRDNodeLink[];
  subscribe(callback: () => void): () => void;
}

const STORAGE_KEY_PREFIX = 'kiteframe-prd-node-links-';

class PRDNodeLinkStoreImpl implements PRDNodeLinkStore {
  private subscribers: Set<() => void> = new Set();

  private isValidProjectId(projectId: string): boolean {
    return !!projectId && projectId !== 'undefined' && projectId !== 'null';
  }

  private getStorageKey(projectId: string): string {
    return `${STORAGE_KEY_PREFIX}${projectId}`;
  }

  private getData(projectId: string): PRDNodeLink[] {
    if (!this.isValidProjectId(projectId)) {
      return [];
    }
    try {
      const stored = localStorage.getItem(this.getStorageKey(projectId));
      const links: PRDNodeLink[] = stored ? JSON.parse(stored) : [];
      // Migrate legacy links that don't have targetType/targetId
      return links.map(link => ({
        ...link,
        targetId: link.targetId || link.nodeId,
        targetType: link.targetType || 'node',
        nodeId: link.nodeId || link.targetId // Keep nodeId for backwards compatibility
      }));
    } catch {
      return [];
    }
  }

  private saveData(projectId: string, links: PRDNodeLink[]): void {
    if (!this.isValidProjectId(projectId)) {
      console.warn('Cannot save PRD-node links: invalid projectId');
      return;
    }
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
    return links.filter(l => l.targetId === nodeId && l.targetType === 'node');
  }

  getLinksForEdge(projectId: string, edgeId: string): PRDNodeLink[] {
    const links = this.getData(projectId);
    return links.filter(l => l.targetId === edgeId && l.targetType === 'edge');
  }

  getLinksForTarget(projectId: string, targetId: string, targetType: PRDLinkTargetType): PRDNodeLink[] {
    const links = this.getData(projectId);
    return links.filter(l => l.targetId === targetId && l.targetType === targetType);
  }

  addLink(projectId: string, targetId: string, targetType: PRDLinkTargetType, workflowId: string, sectionId: string): void {
    if (!this.isValidProjectId(projectId)) {
      console.warn('Cannot add PRD-node link: invalid projectId');
      return;
    }
    const links = this.getData(projectId);
    const exists = links.some(l => 
      l.targetId === targetId && l.targetType === targetType && l.workflowId === workflowId && l.sectionId === sectionId
    );
    if (!exists) {
      links.push({
        nodeId: targetType === 'node' ? targetId : '', // Legacy field
        targetId,
        targetType,
        workflowId,
        sectionId,
        projectId,
        linkedAt: Date.now()
      });
      this.saveData(projectId, links);
    }
  }

  removeLink(projectId: string, targetId: string, targetType: PRDLinkTargetType, workflowId: string, sectionId: string): void {
    if (!this.isValidProjectId(projectId)) {
      return;
    }
    const links = this.getData(projectId);
    const filtered = links.filter(l => 
      !(l.targetId === targetId && l.targetType === targetType && l.workflowId === workflowId && l.sectionId === sectionId)
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
    getLinksForEdge: (edgeId: string) => 
      projectId ? prdNodeLinkStore.getLinksForEdge(projectId, edgeId) : [],
    getLinksForTarget: (targetId: string, targetType: PRDLinkTargetType) => 
      projectId ? prdNodeLinkStore.getLinksForTarget(projectId, targetId, targetType) : [],
    addLink: (targetId: string, targetType: PRDLinkTargetType, workflowId: string, sectionId: string) => 
      projectId && prdNodeLinkStore.addLink(projectId, targetId, targetType, workflowId, sectionId),
    removeLink: (targetId: string, targetType: PRDLinkTargetType, workflowId: string, sectionId: string) => 
      projectId && prdNodeLinkStore.removeLink(projectId, targetId, targetType, workflowId, sectionId),
    getAllLinks: () => projectId ? prdNodeLinkStore.getAllLinks(projectId) : []
  };
}
