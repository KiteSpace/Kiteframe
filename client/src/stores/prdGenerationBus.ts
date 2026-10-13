import { useState, useEffect, useCallback } from 'react';

export interface PRDGenerationEvent {
  type: 'generation-started' | 'generation-completed' | 'prd-updated' | 'project-details-updated';
  projectId?: string;
  workflowId?: string;
}

type PRDGenerationHandler = (event: PRDGenerationEvent) => void;

class PRDGenerationBusImpl {
  private handlers: Set<PRDGenerationHandler> = new Set();
  private generating = new Map<string, number>();

  get isGenerating(): boolean {
    return this.generating.size > 0;
  }

  get generatingProjectId(): string | null {
    return this.generating.keys().next().value ?? null;
  }

  isGeneratingFor(projectId?: string): boolean {
    return projectId ? this.generating.has(projectId) : this.isGenerating;
  }

  subscribe(handler: PRDGenerationHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private publish(event: PRDGenerationEvent): void {
    this.handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.warn('Error in PRDGenerationBus handler:', error);
      }
    });
  }

  startGeneration(projectId: string): void {
    this.generating.set(projectId, (this.generating.get(projectId) ?? 0) + 1);
    this.publish({ type: 'generation-started', projectId });
  }

  completeGeneration(projectId: string): void {
    const count = (this.generating.get(projectId) ?? 1) - 1;
    if (count > 0) this.generating.set(projectId, count);
    else this.generating.delete(projectId);
    this.publish({ type: 'generation-completed', projectId });
  }

  notifyPRDUpdated(projectId: string, workflowId?: string): void {
    this.publish({ type: 'prd-updated', projectId, workflowId });
  }

  notifyProjectDetailsUpdated(projectId: string): void {
    this.publish({ type: 'project-details-updated', projectId });
  }
}

export const prdGenerationBus = new PRDGenerationBusImpl();

export function usePRDGenerationState(projectId?: string) {
  const [isGenerating, setIsGenerating] = useState(prdGenerationBus.isGeneratingFor(projectId));
  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    setIsGenerating(prdGenerationBus.isGeneratingFor(projectId));
    const unsubscribe = prdGenerationBus.subscribe((event) => {
      if (!projectId || event.projectId === projectId) {
        if (event.type === 'generation-started') {
          setIsGenerating(true);
        } else if (event.type === 'generation-completed') {
          setIsGenerating(prdGenerationBus.isGeneratingFor(projectId));
          setUpdateKey(prev => prev + 1);
        } else if (event.type === 'prd-updated' || event.type === 'project-details-updated') {
          setUpdateKey(prev => prev + 1);
        }
      }
    });
    return unsubscribe;
  }, [projectId]);

  const triggerRefresh = useCallback(() => {
    setUpdateKey(prev => prev + 1);
  }, []);

  return { isGenerating, updateKey, triggerRefresh };
}
