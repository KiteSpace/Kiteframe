const DEBUG_AI_EXPERIMENTS = true;

function safeJSONParse(text: string): unknown {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    return { parseError: (e as Error).message, rawLength: text.length };
  }
}

export function logGenerationInput(params: {
  triggerType: 'experiment' | 'explore';
  originNode: { id: string; type: string; header?: string; body?: string };
  experimentNode?: { id: string; header?: string; body?: string } | null;
  userSelectedMode: string | null;
  systemDetectedIssue?: string | null;
  workflowSnapshot: { nodeCount: number; edgeCount: number };
}) {
  if (!DEBUG_AI_EXPERIMENTS) return;
  console.groupCollapsed(`[AI][${params.triggerType === 'experiment' ? 'Experiment' : 'Explore'}] Generation Input`);
  console.log(params);
  console.groupEnd();
}

export function logRawAIOutput(params: {
  triggerType: 'experiment' | 'explore';
  rawText: string;
}) {
  if (!DEBUG_AI_EXPERIMENTS) return;
  console.groupCollapsed(`[AI][${params.triggerType === 'experiment' ? 'Experiment' : 'Explore'}] Raw Output`);
  console.log({
    rawText: params.rawText,
    parsedJSONAttempt: safeJSONParse(params.rawText),
  });
  console.groupEnd();
}

export function logParsedProposal(params: {
  triggerType: 'experiment' | 'explore';
  nodes: Array<{ id: string; type: string; header?: string; body?: string }>;
  edges: Array<{ id: string; source: string; target: string }>;
}) {
  if (!DEBUG_AI_EXPERIMENTS) return;
  console.groupCollapsed(`[AI][${params.triggerType === 'experiment' ? 'Experiment' : 'Explore'}] Parsed Proposal`);
  console.log({
    nodes: params.nodes,
    edges: params.edges,
  });
  console.groupEnd();
}

export function logPreviewTopology(params: {
  previewAnchorNodeId: string;
  originNodeId: string;
  previewBranchNodeIds: string[];
  expectedEdgePattern: string;
}) {
  if (!DEBUG_AI_EXPERIMENTS) return;
  console.groupCollapsed('[Preview] Topology Intent');
  console.log(params);
  console.groupEnd();
}

export function logRenderedGraph(params: {
  nodes: Array<{ id: string; type: string; header?: string; body?: string }>;
  edges: Array<{ source: string; target: string }>;
}) {
  if (!DEBUG_AI_EXPERIMENTS) return;
  console.groupCollapsed('[Preview] Rendered Graph');
  console.log(params);
  console.groupEnd();
}

export function logCommitAccept(params: {
  removedNodeId: string;
  reattachedBranches: string[];
  newParentNodeId: string;
}) {
  if (!DEBUG_AI_EXPERIMENTS) return;
  console.groupCollapsed('[Commit] Experiment Accept');
  console.log(params);
  console.groupEnd();
}

export function logCommitFinalGraph(params: {
  nodes: string[];
  edges: Array<{ source: string; target: string }>;
}) {
  if (!DEBUG_AI_EXPERIMENTS) return;
  console.groupCollapsed('[Commit] Final Graph');
  console.log(params);
  console.groupEnd();
}

export function warnContentContractViolation(params: {
  nodeId: string;
  header?: string;
  body?: string;
  isAIGenerated: boolean;
}) {
  if (!DEBUG_AI_EXPERIMENTS) return;
  if (params.isAIGenerated && (!params.header || !params.body)) {
    console.warn('[AI][Content Contract Violation]', {
      nodeId: params.nodeId,
      header: params.header,
      body: params.body,
    });
  }
}
