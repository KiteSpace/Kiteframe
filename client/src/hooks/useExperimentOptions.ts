import { useState, useCallback, useRef, useEffect } from 'react';
import type { Node, Edge, ExperimentMode, ExperimentOption, ExperimentNodeData, WildCardNodeData } from '@/lib/kiteframe/types';
import type { AiClient } from '@/ai/types';
import { buildExperimentContext, getAnchorNodeId } from '@/lib/kiteframe/utils/experimentContext';
import { generateExperimentOptions } from '@/ai/workflow/generateExperimentOptions';

export interface ExperimentOptionsState {
  options: ExperimentOption[];
  loading: boolean;
  error: string | null;
  anchorNodeId: string | null;
}

export type ExperimentOptionsMap = Map<string, ExperimentOptionsState>;

interface CacheEntry {
  options: ExperimentOption[];
  anchorNodeId: string;
  timestamp: number;
}

type OptionsCache = Map<string, CacheEntry>;

function getCacheKey(experimentNodeId: string, mode: ExperimentMode, anchorNodeId: string): string {
  return `${experimentNodeId}:${mode}:${anchorNodeId}`;
}

export interface UseExperimentOptionsReturn {
  getOptionsForNode: (nodeId: string) => ExperimentOptionsState;
  generateOptions: (nodeId: string, mode: ExperimentMode) => Promise<void>;
  refreshOptions: (nodeId: string, mode: ExperimentMode) => Promise<void>;
  invalidateNode: (nodeId: string) => void;
  isGenerating: (nodeId: string) => boolean;
}

export function useExperimentOptions(
  nodes: Node[],
  edges: Edge[],
  workflowName: string,
  ai: AiClient | null
): UseExperimentOptionsReturn {
  const [optionsMap, setOptionsMap] = useState<ExperimentOptionsMap>(new Map());
  const cacheRef = useRef<OptionsCache>(new Map());
  const generatingRef = useRef<Set<string>>(new Set());

  const getOptionsForNode = useCallback((nodeId: string): ExperimentOptionsState => {
    return optionsMap.get(nodeId) || {
      options: [],
      loading: false,
      error: null,
      anchorNodeId: null,
    };
  }, [optionsMap]);

  const isGenerating = useCallback((nodeId: string): boolean => {
    return generatingRef.current.has(nodeId);
  }, []);

  const generateOptions = useCallback(async (nodeId: string, mode: ExperimentMode) => {
    if (!ai) {
      setOptionsMap(prev => {
        const next = new Map(prev);
        next.set(nodeId, {
          options: [],
          loading: false,
          error: 'AI not available',
          anchorNodeId: null,
        });
        return next;
      });
      return;
    }

    // open_exploration mode doesn't get AI suggestions - user provides freeform input
    if (mode === 'open_exploration') {
      setOptionsMap(prev => {
        const next = new Map(prev);
        next.set(nodeId, {
          options: [],
          loading: false,
          error: null,
          anchorNodeId: null,
        });
        return next;
      });
      return;
    }

    const anchorNodeId = getAnchorNodeId(nodeId, nodes, edges);
    if (!anchorNodeId) {
      setOptionsMap(prev => {
        const next = new Map(prev);
        next.set(nodeId, {
          options: [],
          loading: false,
          error: null,
          anchorNodeId: null,
        });
        return next;
      });
      return;
    }

    const cacheKey = getCacheKey(nodeId, mode, anchorNodeId);
    const cached = cacheRef.current.get(cacheKey);
    if (cached && cached.anchorNodeId === anchorNodeId) {
      setOptionsMap(prev => {
        const next = new Map(prev);
        next.set(nodeId, {
          options: cached.options,
          loading: false,
          error: null,
          anchorNodeId: cached.anchorNodeId,
        });
        return next;
      });
      return;
    }

    if (generatingRef.current.has(nodeId)) {
      return;
    }

    generatingRef.current.add(nodeId);
    setOptionsMap(prev => {
      const next = new Map(prev);
      next.set(nodeId, {
        options: [],
        loading: true,
        error: null,
        anchorNodeId,
      });
      return next;
    });

    try {
      const context = buildExperimentContext({
        experimentNodeId: nodeId,
        nodes,
        edges,
        workflowName,
      });

      if (!context) {
        setOptionsMap(prev => {
          const next = new Map(prev);
          next.set(nodeId, {
            options: [],
            loading: false,
            error: 'Could not build context',
            anchorNodeId,
          });
          return next;
        });
        generatingRef.current.delete(nodeId);
        return;
      }

      const result = await generateExperimentOptions(ai, { mode, context });

      if (result.success && result.options) {
        const options = result.options;
        cacheRef.current.set(cacheKey, {
          options,
          anchorNodeId,
          timestamp: Date.now(),
        });

        setOptionsMap(prev => {
          const next = new Map(prev);
          next.set(nodeId, {
            options,
            loading: false,
            error: options.length === 0 ? 'No suggestions found' : null,
            anchorNodeId,
          });
          return next;
        });
      } else {
        setOptionsMap(prev => {
          const next = new Map(prev);
          next.set(nodeId, {
            options: [],
            loading: false,
            error: result.error || 'Failed to generate options',
            anchorNodeId,
          });
          return next;
        });
      }
    } catch (error) {
      console.error('Error generating options:', error);
      setOptionsMap(prev => {
        const next = new Map(prev);
        next.set(nodeId, {
          options: [],
          loading: false,
          error: error instanceof Error ? error.message : 'An error occurred',
          anchorNodeId,
        });
        return next;
      });
    } finally {
      generatingRef.current.delete(nodeId);
    }
  }, [ai, nodes, edges, workflowName]);

  const refreshOptions = useCallback(async (nodeId: string, mode: ExperimentMode) => {
    const anchorNodeId = getAnchorNodeId(nodeId, nodes, edges);
    if (anchorNodeId) {
      const cacheKey = getCacheKey(nodeId, mode, anchorNodeId);
      cacheRef.current.delete(cacheKey);
    }
    
    await generateOptions(nodeId, mode);
  }, [generateOptions, nodes, edges]);

  const invalidateNode = useCallback((nodeId: string) => {
    const keysToDelete: string[] = [];
    cacheRef.current.forEach((_, key) => {
      if (key.startsWith(`${nodeId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => cacheRef.current.delete(key));
    
    setOptionsMap(prev => {
      const next = new Map(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  useEffect(() => {
    const experimentNodes = nodes.filter(n => 
      n.type === 'experiment' || n.type === 'wildcard'
    );
    
    for (const node of experimentNodes) {
      const data = node.data as ExperimentNodeData | WildCardNodeData;
      const mode = data.mode || 'whatif';
      
      // Skip open_exploration mode - no AI suggestions for freeform
      if (mode === 'open_exploration') continue;
      
      const currentAnchorId = getAnchorNodeId(node.id, nodes, edges);
      const state = optionsMap.get(node.id);
      
      if (state?.anchorNodeId && currentAnchorId !== state.anchorNodeId) {
        invalidateNode(node.id);
      }
    }
  }, [nodes, edges, optionsMap, invalidateNode]);

  return {
    getOptionsForNode,
    generateOptions,
    refreshOptions,
    invalidateNode,
    isGenerating,
  };
}
