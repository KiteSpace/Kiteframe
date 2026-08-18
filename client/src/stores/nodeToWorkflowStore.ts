import { useState, useEffect } from 'react';

/**
 * NodeToWorkflowStore - Maps node IDs to their workflow group IDs and names
 * This connects the flow detection system to the layers panel workflow groups
 */

interface NodeWorkflowMapping {
  nodeId: string;
  workflowGroupId: string;
  workflowName: string;
}

class NodeToWorkflowStoreImpl {
  private mappings = new Map<string, NodeWorkflowMapping>();
  private subscribers = new Set<() => void>();

  set(nodeId: string, workflowGroupId: string, workflowName: string): void {
    this.mappings.set(nodeId, { nodeId, workflowGroupId, workflowName });
    this.notifySubscribers();
  }

  getWorkflowNameForNode(nodeId: string): string | null {
    return this.mappings.get(nodeId)?.workflowName || null;
  }

  getWorkflowGroupIdForNode(nodeId: string): string | null {
    return this.mappings.get(nodeId)?.workflowGroupId || null;
  }

  setMultiple(mappings: NodeWorkflowMapping[]): void {
    this.mappings.clear();
    mappings.forEach(m => {
      this.mappings.set(m.nodeId, m);
    });
    this.notifySubscribers();
  }

  clear(): void {
    this.mappings.clear();
    this.notifySubscribers();
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(cb => cb());
  }
}

export const nodeToWorkflowStore = new NodeToWorkflowStoreImpl();

export function useNodeToWorkflow() {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    const unsubscribe = nodeToWorkflowStore.subscribe(() => {
      forceUpdate({});
    });
    return unsubscribe;
  }, []);

  return {
    getWorkflowNameForNode: nodeToWorkflowStore.getWorkflowNameForNode.bind(nodeToWorkflowStore),
    getWorkflowGroupIdForNode: nodeToWorkflowStore.getWorkflowGroupIdForNode.bind(nodeToWorkflowStore),
    setMultiple: nodeToWorkflowStore.setMultiple.bind(nodeToWorkflowStore),
    clear: nodeToWorkflowStore.clear.bind(nodeToWorkflowStore),
  };
}
