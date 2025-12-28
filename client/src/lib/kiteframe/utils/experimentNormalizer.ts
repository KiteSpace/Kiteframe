import type { Node, Edge, ExperimentNodeData, ExperimentGeneration, ExperimentUI, ExperimentAnchor, ExperimentMode } from '../types';

const VALID_EXPERIMENT_MODES: ExperimentMode[] = ['whatif', 'enhancement', 'open_exploration'];

function coerceLegacyMode(mode: string | undefined): ExperimentMode {
  if (!mode) return 'whatif';
  if (VALID_EXPERIMENT_MODES.includes(mode as ExperimentMode)) {
    return mode as ExperimentMode;
  }
  if (mode === 'risk') return 'whatif';
  if (mode === 'prompt') return 'open_exploration';
  return 'whatif';
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

export function ensureExperimentDefaults(node: Node, workflowId: string = 'default'): Node {
  if (node.type !== 'experiment') return node;
  
  const data = node.data as Partial<ExperimentNodeData>;
  
  const normalizedData: ExperimentNodeData = {
    label: data.label || 'Experiment',
    mode: coerceLegacyMode(data.mode as string | undefined),
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
          strokeOpacity: 0.8,
        },
      };
    }
    return edge;
  });
}

export function normalizeNodeForMutation(node: Node, workflowId: string = 'default'): Node {
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
