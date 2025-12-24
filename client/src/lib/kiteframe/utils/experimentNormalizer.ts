import type { Node, Edge, ExperimentNodeData, WildCardNodeData, ExperimentGeneration, ExperimentUI, ExperimentAnchor } from '../types';

function isWildCardData(data: any): data is WildCardNodeData {
  return data && typeof data.content === 'string' && !data.generation;
}

function createDefaultGeneration(): ExperimentGeneration {
  return {
    status: 'idle',
    generatedNodeIds: [],
    generatedEdgeIds: [],
  };
}

function createDefaultUI(isPreview: boolean = false): ExperimentUI {
  return {
    preview: isPreview,
    badge: isPreview ? 'Preview' : undefined,
  };
}

function createDefaultAnchor(workflowId: string = 'default'): ExperimentAnchor {
  return {
    workflowId,
  };
}

export function normalizeWildCardToExperiment(node: Node, workflowId: string = 'default'): Node {
  if (node.type !== 'wildcard') return node;
  
  const oldData = node.data as WildCardNodeData;
  
  let generationStatus: ExperimentGeneration['status'] = 'idle';
  let generatedNodeIds: string[] = [];
  let generatedEdgeIds: string[] = [];
  
  if (oldData.generating || oldData.isGenerating) {
    generationStatus = 'generating';
  } else if (oldData.hasGeneratedBranch || (oldData.generatedIds && oldData.generatedIds.length > 0)) {
    generationStatus = 'generated';
    generatedNodeIds = (oldData.generatedIds || []).filter(id => !id.includes('-edge-'));
    generatedEdgeIds = (oldData.generatedIds || []).filter(id => id.includes('-edge-'));
  } else if (oldData.generationError) {
    generationStatus = 'error';
  }
  
  const newData: ExperimentNodeData = {
    label: oldData.label || 'Experiment',
    mode: oldData.mode || 'whatif',
    userPrompt: oldData.content || '',
    colors: oldData.colors,
    reactions: oldData.reactions,
    status: oldData.status,
    prdRefs: oldData.prdRefs,
    anchor: createDefaultAnchor(workflowId),
    generation: {
      status: generationStatus,
      generatedNodeIds,
      generatedEdgeIds,
      errorMessage: oldData.generationError,
    },
    ui: createDefaultUI(false),
  };
  
  return {
    ...node,
    type: 'experiment',
    data: newData,
  };
}

export function ensureExperimentDefaults(node: Node, workflowId: string = 'default'): Node {
  if (node.type !== 'experiment') return node;
  
  const data = node.data as Partial<ExperimentNodeData>;
  
  const normalizedData: ExperimentNodeData = {
    label: data.label || 'Experiment',
    mode: data.mode || 'whatif',
    userPrompt: data.userPrompt,
    selectedOptionId: data.selectedOptionId,
    selectedOptionLabel: data.selectedOptionLabel,
    colors: data.colors,
    reactions: data.reactions,
    status: data.status,
    prdRefs: data.prdRefs,
    anchor: data.anchor || createDefaultAnchor(workflowId),
    generation: data.generation || createDefaultGeneration(),
    ui: data.ui || createDefaultUI(false),
  };
  
  return {
    ...node,
    data: normalizedData,
  };
}

export function normalizeNodesForExperiment(nodes: Node[], workflowId: string = 'default'): Node[] {
  return nodes.map(node => {
    if (node.type === 'wildcard') {
      return normalizeWildCardToExperiment(node, workflowId);
    }
    if (node.type === 'experiment') {
      return ensureExperimentDefaults(node, workflowId);
    }
    return node;
  });
}

export function markGeneratedNodesAsPreview(nodes: Node[]): Node[] {
  return nodes.map(node => {
    if (node.meta?.speculative) {
      return {
        ...node,
        data: {
          ...node.data,
          ui: { ...node.data?.ui, preview: true },
        },
      };
    }
    return node;
  });
}

export function markGeneratedEdgesAsPreview(edges: Edge[]): Edge[] {
  return edges.map(edge => {
    if (edge.meta?.speculative) {
      return {
        ...edge,
        style: {
          ...edge.style,
          strokeDasharray: '5 5',
          strokeOpacity: 0.7,
        },
      };
    }
    return edge;
  });
}

export function normalizeNodeForMutation(node: Node, workflowId: string = 'default'): Node {
  if (node.type === 'wildcard') {
    return normalizeWildCardToExperiment(node, workflowId);
  }
  if (node.type === 'experiment') {
    return ensureExperimentDefaults(node, workflowId);
  }
  return node;
}

export function clearPreviewFlags(node: Node): Node {
  const { speculative, generatedFrom, ...restMeta } = node.meta || {};
  const { ui, ...restData } = node.data || {};
  const { preview, badge, ...restUI } = ui || {};
  
  return {
    ...node,
    meta: Object.keys(restMeta).length > 0 ? restMeta : undefined,
    data: { ...restData, ui: Object.keys(restUI).length > 0 ? restUI : undefined }
  };
}

export function clearEdgePreviewFlags(edge: Edge): Edge {
  const { speculative, generatedFrom, ...restMeta } = edge.meta || {};
  const { strokeDasharray, strokeOpacity, ...restStyle } = edge.style || {};
  
  return {
    ...edge,
    meta: Object.keys(restMeta).length > 0 ? restMeta : undefined,
    style: Object.keys(restStyle).length > 0 ? restStyle : undefined
  };
}
