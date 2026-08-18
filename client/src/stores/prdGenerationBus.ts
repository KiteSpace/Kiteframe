import { useState, useEffect, useCallback } from 'react';

export interface PRDGenerationEvent {
  type: 'generation-started' | 'generation-completed' | 'prd-updated' | 'project-details-updated';
  projectId?: string;
  workflowId?: string;
}

type PRDGenerationHandler = (event: PRDGenerationEvent) => void;

class PRDGenerationBusImpl {
  private handlers: Set<PRDGenerationHandler> = new Set();
  private _isGenerating: boolean = false;
  private _generatingProjectId: string | null = null;

  get isGenerating(): boolean {
    return this._isGenerating;
  }

  get generatingProjectId(): string | null {
    return this._generatingProjectId;
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
    this._isGenerating = true;
    this._generatingProjectId = projectId;
    this.publish({ type: 'generation-started', projectId });
  }

  completeGeneration(projectId: string): void {
    this._isGenerating = false;
    this._generatingProjectId = null;
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
  const [isGenerating, setIsGenerating] = useState(prdGenerationBus.isGenerating);
  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    const unsubscribe = prdGenerationBus.subscribe((event) => {
      if (!projectId || event.projectId === projectId) {
        if (event.type === 'generation-started') {
          setIsGenerating(true);
        } else if (event.type === 'generation-completed') {
          setIsGenerating(false);
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
