/**
 * Semantic Workflow Generator v2
 * 
 * Generates Kiteframe workflow nodes from Figma semantic metadata.
 * Supports three generation modes: summary, detailed, and ai_refined.
 * 
 * Usage: Select a Figma ImageNode with semantic data, click "Generate Workflow" in toolbar.
 */

/**
 * Semantic Debug Logger - logs structured debug info in development only.
 */
function logSemanticDebug(...args: unknown[]) {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console
  console.log('[SemanticDebug]', ...args);
}

import type { Node, Edge } from '../kiteframe/types';
import type { 
  FigmaSemanticMetadata, 
  FigmaSemanticElement,
  FigmaSemanticFormCandidate,
  FigmaScreenStep, 
  FigmaWorkflowGraph,
  WorkflowGenerationOptions,
  WorkflowGenerationMode,
} from './figmaSemanticTypes';
import { buildWorkflowGraphFromSemantic } from './figmaWorkflowGraphBuilder';
import { createProcessNode } from '../kiteframe/factory/NodeFactory';

const NODE_HEIGHT = 120;
const NODE_WIDTH = 200;
const VERTICAL_SPACING = 50;
const HORIZONTAL_OFFSET = 100;
const BRANCH_HORIZONTAL_OFFSET = 250;

const MODE_DEFAULTS: Record<WorkflowGenerationMode, { maxSteps: number }> = {
  summary: { maxSteps: 10 },
  detailed: { maxSteps: 30 },
  ai_refined: { maxSteps: 50 },
};

const MAX_CLUSTERS = 8;

interface StateCluster {
  id: string;
  label: string;
  elementIds: string[];
}

/**
 * Infer logical state clusters from a single frame's semantic data.
 * Used for single-frame state splitting in detailed workflow generation.
 */
function inferStateClustersFromSemantic(semantic: FigmaSemanticMetadata): { clusters: StateCluster[] } {
  const elements = semantic.elements ?? [];
  const forms = semantic.forms ?? [];
  const navigationTargets = semantic.navigationTargets ?? [];
  const clusters: StateCluster[] = [];

  if (elements.length === 0) {
    return { clusters };
  }

  if (forms.length > 1) {
    forms.forEach((form, index) => {
      clusters.push({
        id: `form-${index + 1}`,
        label: form.name || `Form state ${index + 1}`,
        elementIds: [...form.fieldIds, ...form.submitButtonIds],
      });
    });
  }

  const sectionElements = elements.filter(e => e.type === 'section');
  if (sectionElements.length > 1) {
    sectionElements.forEach((section, index) => {
      clusters.push({
        id: `section-${index + 1}`,
        label: section.name || `Section ${index + 1}`,
        elementIds: [section.id],
      });
    });
  }

  const navGroupsByTarget = new Map<string, string[]>();
  for (const target of navigationTargets) {
    if (!target.inferredTargetName) continue;
    const key = target.inferredTargetName;
    const arr = navGroupsByTarget.get(key) ?? [];
    arr.push(target.elementId);
    navGroupsByTarget.set(key, arr);
  }
  if (navGroupsByTarget.size > 1) {
    let idx = 1;
    navGroupsByTarget.forEach((elementIds, name) => {
      clusters.push({
        id: `nav-${idx}`,
        label: `State: ${name}`,
        elementIds,
      });
      idx += 1;
    });
  }

  if (clusters.length > MAX_CLUSTERS) {
    logSemanticDebug('WorkflowGenerator cluster count exceeds max, truncating', {
      originalCount: clusters.length,
      maxClusters: MAX_CLUSTERS,
    });
    return { clusters: clusters.slice(0, MAX_CLUSTERS) };
  }

  return { clusters };
}

function generateNodeId(): string {
  return `wf-node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateEdgeId(): string {
  return `wf-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface WorkflowGenerationResult {
  nodes: Node[];
  edges: Edge[];
  workflowGroupId: string;
  workflowName: string;
  mode: WorkflowGenerationMode;
  stepLabels: string[];
}

export interface GeneratedWorkflow {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Pure function to build workflow from semantic metadata.
 * Does NOT mutate the semantic object.
 * Deterministic for the same semantic + options input.
 */
export function buildWorkflowFromSemantic(
  semantic: FigmaSemanticMetadata,
  options: WorkflowGenerationOptions,
  startPosition: { x: number; y: number }
): GeneratedWorkflow {
  const mode = options.mode;
  const maxSteps = options.maxSteps ?? MODE_DEFAULTS[mode].maxSteps;
  
  const workflowGroupId = `wf-${semantic.frameId || Date.now()}`;
  
  if (mode === 'summary') {
    return buildSummaryWorkflow(semantic, workflowGroupId, startPosition, maxSteps);
  } else if (mode === 'detailed') {
    return buildDetailedWorkflow(semantic, workflowGroupId, startPosition, maxSteps);
  } else {
    return buildDetailedWorkflow(semantic, workflowGroupId, startPosition, maxSteps);
  }
}

function buildSummaryWorkflow(
  semantic: FigmaSemanticMetadata,
  workflowGroupId: string,
  startPosition: { x: number; y: number },
  maxSteps: number
): GeneratedWorkflow {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let currentY = startPosition.y;
  
  const screenLabel = formatScreenLabel(semantic.frameName, semantic.screenType);
  const viewNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
    label: `User sees ${screenLabel}`,
    description: getScreenDescription(semantic),
    colors: { headerBackground: '#4f46e5', bodyBackground: '#eef2ff', headerTextColor: '#ffffff' },
  });
  viewNode.data.workflowGroupId = workflowGroupId;
  nodes.push(viewNode);
  currentY += NODE_HEIGHT + VERTICAL_SPACING;
  
  if (semantic.forms.length > 0 && nodes.length < maxSteps) {
    const form = semantic.forms[0];
    const formNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
      label: `User fills ${form.name || 'form'}`,
      description: getFormFieldsSummary(form, semantic.elements),
      colors: { headerBackground: '#0891b2', bodyBackground: '#cffafe', headerTextColor: '#ffffff' },
    });
    formNode.data.workflowGroupId = workflowGroupId;
    nodes.push(formNode);
    
    edges.push(createEdge(nodes[nodes.length - 2].id, formNode.id, workflowGroupId));
    currentY += NODE_HEIGHT + VERTICAL_SPACING;
  }
  
  const primaryActions = semantic.elements.filter(e => e.isPrimaryAction && e.role === 'action');
  if (primaryActions.length > 0 && nodes.length < maxSteps) {
    const action = primaryActions[0];
    const actionLabel = action.text || action.name || 'primary action';
    const actionNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
      label: `User taps "${actionLabel}"`,
      colors: { headerBackground: '#059669', bodyBackground: '#d1fae5', headerTextColor: '#ffffff' },
    });
    actionNode.data.workflowGroupId = workflowGroupId;
    nodes.push(actionNode);
    
    edges.push(createEdge(nodes[nodes.length - 2].id, actionNode.id, workflowGroupId));
    currentY += NODE_HEIGHT + VERTICAL_SPACING;
    
    if (nodes.length < maxSteps) {
      const validateNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
        label: 'System validates',
        colors: { headerBackground: '#f59e0b', bodyBackground: '#fef3c7', headerTextColor: '#ffffff' },
      });
      validateNode.data.workflowGroupId = workflowGroupId;
      nodes.push(validateNode);
      
      edges.push(createEdge(nodes[nodes.length - 2].id, validateNode.id, workflowGroupId));
      currentY += NODE_HEIGHT + VERTICAL_SPACING;
    }
  }
  
  if (nodes.length < maxSteps) {
    const stateLabel = semantic.stateType === 'success' ? 'Success' : 
                       semantic.stateType === 'error' ? 'Error' :
                       'Result';
    const resultNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
      label: `System shows ${stateLabel}`,
      colors: getStateColors(semantic.stateType || 'default'),
    });
    resultNode.data.workflowGroupId = workflowGroupId;
    nodes.push(resultNode);
    
    edges.push(createEdge(nodes[nodes.length - 2].id, resultNode.id, workflowGroupId));
  }
  
  return { nodes, edges };
}

function buildDetailedWorkflow(
  semantic: FigmaSemanticMetadata,
  workflowGroupId: string,
  startPosition: { x: number; y: number },
  maxSteps: number
): GeneratedWorkflow {
  const { clusters } = inferStateClustersFromSemantic(semantic);
  
  if (clusters.length > 1) {
    logSemanticDebug('WorkflowGenerator multi-state heuristic triggered', {
      clusterCount: clusters.length,
      clusters: clusters.map(c => ({
        id: c.id,
        label: c.label,
        elementCount: c.elementIds.length,
      })),
    });

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let currentY = startPosition.y;

    for (let i = 0; i < clusters.length && nodes.length < maxSteps; i++) {
      const cluster = clusters[i];
      const node = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
        label: cluster.label || `State ${i + 1}`,
        colors: { headerBackground: '#4f46e5', bodyBackground: '#eef2ff', headerTextColor: '#ffffff' },
      });
      node.data.workflowGroupId = workflowGroupId;
      node.data.sourceElementIds = cluster.elementIds;
      nodes.push(node);

      if (i > 0) {
        edges.push(createEdge(nodes[i - 1].id, node.id, workflowGroupId, 'inferred-sequence'));
      }
      currentY += NODE_HEIGHT + VERTICAL_SPACING;
    }

    return { nodes, edges };
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let currentY = startPosition.y;
  let branchX = startPosition.x + BRANCH_HORIZONTAL_OFFSET;
  
  const screenLabel = formatScreenLabel(semantic.frameName, semantic.screenType);
  const viewNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
    label: `User sees ${screenLabel}`,
    description: getScreenDescription(semantic),
    colors: { headerBackground: '#4f46e5', bodyBackground: '#eef2ff', headerTextColor: '#ffffff' },
  });
  viewNode.data.workflowGroupId = workflowGroupId;
  nodes.push(viewNode);
  currentY += NODE_HEIGHT + VERTICAL_SPACING;
  
  for (const form of semantic.forms) {
    if (nodes.length >= maxSteps) break;
    
    const formNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
      label: form.name || 'Form',
      description: getFormFieldsSummary(form, semantic.elements),
      colors: { headerBackground: '#0891b2', bodyBackground: '#cffafe', headerTextColor: '#ffffff' },
    });
    formNode.data.workflowGroupId = workflowGroupId;
    (formNode.data as any).formFields = getFormFields(form, semantic.elements);
    nodes.push(formNode);
    
    edges.push(createEdge(nodes[nodes.length - 2].id, formNode.id, workflowGroupId));
    currentY += NODE_HEIGHT + VERTICAL_SPACING;
  }
  
  const primaryActions = semantic.elements.filter(e => e.isPrimaryAction && e.role === 'action');
  const secondaryActions = semantic.elements.filter(e => e.isSecondaryAction && e.role === 'action');
  
  for (const action of primaryActions) {
    if (nodes.length >= maxSteps) break;
    
    const actionLabel = action.text || action.name || 'action';
    const actionNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
      label: `User taps "${actionLabel}"`,
      colors: { headerBackground: '#059669', bodyBackground: '#d1fae5', headerTextColor: '#ffffff' },
    });
    actionNode.data.workflowGroupId = workflowGroupId;
    nodes.push(actionNode);
    
    edges.push(createEdge(nodes[nodes.length - 2].id, actionNode.id, workflowGroupId));
    currentY += NODE_HEIGHT + VERTICAL_SPACING;
  }
  
  let lastMainNodeId = nodes[nodes.length - 1]?.id;
  
  for (const secondary of secondaryActions.slice(0, 3)) {
    if (nodes.length >= maxSteps) break;
    
    const label = secondary.text || secondary.name || 'action';
    const branchNode = createProcessNode(generateNodeId(), { x: branchX, y: currentY - NODE_HEIGHT - VERTICAL_SPACING }, {
      label: `User taps "${label}"`,
      description: secondary.screenRefName ? `→ ${secondary.screenRefName}` : undefined,
      colors: { headerBackground: '#64748b', bodyBackground: '#f1f5f9', headerTextColor: '#ffffff' },
    });
    branchNode.data.workflowGroupId = workflowGroupId;
    nodes.push(branchNode);
    
    if (lastMainNodeId) {
      edges.push(createEdge(lastMainNodeId, branchNode.id, workflowGroupId, 'secondary'));
    }
    branchX += 150;
  }
  
  const navTargets = semantic.navigationTargets.filter(n => n.inferredTargetName);
  for (const nav of navTargets.slice(0, 2)) {
    if (nodes.length >= maxSteps) break;
    
    const navElement = semantic.elements.find(e => e.id === nav.elementId);
    if (navElement?.role === 'action') continue;
    
    const navNode = createProcessNode(generateNodeId(), { x: branchX, y: startPosition.y + NODE_HEIGHT + VERTICAL_SPACING }, {
      label: `User taps "${nav.label}"`,
      description: `→ ${nav.inferredTargetName}`,
      colors: { headerBackground: '#8b5cf6', bodyBackground: '#f5f3ff', headerTextColor: '#ffffff' },
    });
    navNode.data.workflowGroupId = workflowGroupId;
    nodes.push(navNode);
    
    edges.push(createEdge(nodes[0].id, navNode.id, workflowGroupId, 'navigation'));
    branchX += 150;
  }
  
  if (nodes.length < maxSteps && primaryActions.length > 0) {
    const validateNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
      label: 'System validates',
      colors: { headerBackground: '#f59e0b', bodyBackground: '#fef3c7', headerTextColor: '#ffffff' },
    });
    validateNode.data.workflowGroupId = workflowGroupId;
    nodes.push(validateNode);
    
    const mainFlowNodes = nodes.filter(n => n.position.x === startPosition.x);
    const lastMainNode = mainFlowNodes[mainFlowNodes.length - 2];
    if (lastMainNode) {
      edges.push(createEdge(lastMainNode.id, validateNode.id, workflowGroupId));
    }
    currentY += NODE_HEIGHT + VERTICAL_SPACING;
    
    if (nodes.length < maxSteps) {
      const successNode = createProcessNode(generateNodeId(), { x: startPosition.x, y: currentY }, {
        label: 'Success state',
        colors: { headerBackground: '#16a34a', bodyBackground: '#dcfce7', headerTextColor: '#ffffff' },
      });
      successNode.data.workflowGroupId = workflowGroupId;
      nodes.push(successNode);
      edges.push(createEdge(validateNode.id, successNode.id, workflowGroupId, 'success'));
      
      if (nodes.length < maxSteps) {
        const errorNode = createProcessNode(generateNodeId(), { x: startPosition.x + BRANCH_HORIZONTAL_OFFSET, y: currentY }, {
          label: 'Error state',
          colors: { headerBackground: '#dc2626', bodyBackground: '#fee2e2', headerTextColor: '#ffffff' },
        });
        errorNode.data.workflowGroupId = workflowGroupId;
        nodes.push(errorNode);
        edges.push(createEdge(validateNode.id, errorNode.id, workflowGroupId, 'error'));
      }
    }
  }
  
  return { nodes, edges };
}

function createEdge(sourceId: string, targetId: string, workflowGroupId: string, label?: string): Edge {
  return {
    id: generateEdgeId(),
    source: sourceId,
    target: targetId,
    type: 'smoothstep',
    label,
    data: { workflowGroupId },
  };
}

function formatScreenLabel(frameName: string, screenType?: string): string {
  const cleanName = frameName.replace(/[-_]/g, ' ').trim();
  if (screenType && screenType !== 'unknown') {
    return `${cleanName} (${screenType})`;
  }
  return cleanName;
}

function getScreenDescription(semantic: FigmaSemanticMetadata): string | undefined {
  const parts: string[] = [];
  
  if (semantic.screenType && semantic.screenType !== 'unknown') {
    parts.push(`Type: ${semantic.screenType}`);
  }
  if (semantic.stateType && semantic.stateType !== 'default' && semantic.stateType !== 'unknown') {
    parts.push(`State: ${semantic.stateType}`);
  }
  if (semantic.forms.length > 0) {
    parts.push(`${semantic.forms.length} form(s)`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : undefined;
}

function getFormFieldsSummary(form: FigmaSemanticFormCandidate, elements: FigmaSemanticElement[]): string {
  const fieldElements = elements.filter(e => form.fieldIds.includes(e.id));
  const fieldNames = fieldElements.slice(0, 4).map(e => e.name || e.text || 'field');
  
  if (fieldElements.length > 4) {
    return `Fields: ${fieldNames.join(', ')} +${fieldElements.length - 4} more`;
  }
  return `Fields: ${fieldNames.join(', ')}`;
}

function getFormFields(form: FigmaSemanticFormCandidate, elements: FigmaSemanticElement[]): Array<{ name: string; type: string; required?: boolean }> {
  return elements
    .filter(e => form.fieldIds.includes(e.id))
    .map(e => ({
      name: e.name || e.text || 'field',
      type: e.controlType || 'text',
      required: e.isRequiredField,
    }));
}

function getStateColors(stateType: string): { headerBackground: string; bodyBackground: string; headerTextColor: string } {
  switch (stateType) {
    case 'success':
      return { headerBackground: '#16a34a', bodyBackground: '#dcfce7', headerTextColor: '#ffffff' };
    case 'error':
      return { headerBackground: '#dc2626', bodyBackground: '#fee2e2', headerTextColor: '#ffffff' };
    case 'loading':
      return { headerBackground: '#f59e0b', bodyBackground: '#fef3c7', headerTextColor: '#ffffff' };
    case 'empty':
      return { headerBackground: '#64748b', bodyBackground: '#f1f5f9', headerTextColor: '#ffffff' };
    default:
      return { headerBackground: '#3b82f6', bodyBackground: '#eff6ff', headerTextColor: '#ffffff' };
  }
}

export function generateWorkflowFromFigmaSemantic(
  semantic: FigmaSemanticMetadata,
  frameName: string,
  sourceNode: Node,
  options?: WorkflowGenerationOptions
): WorkflowGenerationResult {
  const mode = options?.mode ?? 'summary';
  const maxSteps = options?.maxSteps ?? MODE_DEFAULTS[mode].maxSteps;
  
  logSemanticDebug('WorkflowGenerator input', {
    nodeId: sourceNode.id,
    label: sourceNode.data?.label,
    hasSemantic: !!semantic,
    elementCount: semantic?.elements?.length ?? 0,
    formCount: semantic?.forms?.length ?? 0,
    navTargetCount: semantic?.navigationTargets?.length ?? 0,
    mode,
    maxSteps,
  });
  
  const sourceWidth = (sourceNode.style?.width as number) || sourceNode.width || 400;
  const startPosition = {
    x: sourceNode.position.x + sourceWidth + HORIZONTAL_OFFSET,
    y: sourceNode.position.y,
  };
  
  const { nodes, edges } = buildWorkflowFromSemantic(semantic, { mode, maxSteps }, startPosition);
  const workflowGroupId = nodes[0]?.data?.workflowGroupId || `wf-${semantic.frameId || Date.now()}`;
  
  const stepLabels = nodes.map(n => n.data?.label || 'Step');
  
  logSemanticDebug('WorkflowGenerator final graph', {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeLabels: stepLabels,
    mode,
  });
  
  return {
    nodes,
    edges,
    workflowGroupId,
    workflowName: frameName || semantic.frameName || 'Figma Workflow',
    mode,
    stepLabels,
  };
}

export function generateWorkflowFromFigmaImageNode(
  sourceImageNode: Node,
  options?: WorkflowGenerationOptions
): WorkflowGenerationResult | null {
  if (sourceImageNode.type !== 'image') {
    return null;
  }
  
  const semantic = sourceImageNode.data?.figmaSemantic as FigmaSemanticMetadata | undefined;
  if (!semantic) {
    return null;
  }
  
  const frameName = semantic.frameName || sourceImageNode.data?.label || 'Figma Frame';
  return generateWorkflowFromFigmaSemantic(semantic, frameName, sourceImageNode, options);
}

export function getWorkflowPreview(
  semantic: FigmaSemanticMetadata,
  mode: WorkflowGenerationMode
): { estimatedNodes: number; estimatedEdges: number; stepLabels: string[] } {
  const maxSteps = MODE_DEFAULTS[mode].maxSteps;
  const { nodes, edges } = buildWorkflowFromSemantic(
    semantic, 
    { mode, maxSteps }, 
    { x: 0, y: 0 }
  );
  
  return {
    estimatedNodes: nodes.length,
    estimatedEdges: edges.length,
    stepLabels: nodes.map(n => n.data?.label || 'Step'),
  };
}

export async function generateAIRefinedWorkflow(
  semantics: FigmaSemanticMetadata[],
  startPosition: { x: number; y: number },
  maxSteps: number = 30
): Promise<GeneratedWorkflow> {
  const detailedResults: GeneratedWorkflow = { nodes: [], edges: [] };
  let currentY = startPosition.y;
  
  for (const semantic of semantics) {
    const result = buildWorkflowFromSemantic(
      semantic,
      { mode: 'detailed', maxSteps: Math.floor(maxSteps / semantics.length) },
      { x: startPosition.x, y: currentY }
    );
    detailedResults.nodes.push(...result.nodes);
    detailedResults.edges.push(...result.edges);
    currentY += (result.nodes.length * (NODE_HEIGHT + VERTICAL_SPACING)) + 100;
  }

  const semanticSummary = semantics.map(s => ({
    frameName: s.frameName,
    screenType: s.screenType,
    stateType: s.stateType,
    elements: s.elements.slice(0, 10).map(e => ({
      name: e.name,
      role: e.role,
      text: e.text?.slice(0, 50),
      isPrimaryAction: e.isPrimaryAction,
      isSecondaryAction: e.isSecondaryAction,
    })),
    forms: s.forms.map(f => f.name),
    navigationTargets: s.navigationTargets.slice(0, 5).map(n => n.inferredTargetName),
  }));

  const prompt = `Analyze this Figma design semantic data and suggest optimizations for a user flow workflow.

Current semantic data for ${semantics.length} screens:
${JSON.stringify(semanticSummary, null, 2)}

Current workflow has ${detailedResults.nodes.length} steps.

Please respond with a JSON object containing:
1. "refinedSteps": Array of step labels that better represent the user flow (max ${maxSteps} steps)
2. "optimization": Brief explanation of improvements made
3. "groupings": Suggested logical groupings of steps

Example response format:
{
  "refinedSteps": ["User lands on Login", "User enters credentials", "System validates", "User sees Dashboard"],
  "optimization": "Consolidated redundant navigation steps and clarified action labels",
  "groupings": [{"name": "Authentication", "steps": [0, 1, 2]}, {"name": "Main Flow", "steps": [3]}]
}`;

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 2048,
      }),
    });

    if (!response.ok) {
      logSemanticDebug('AIWorkflow request failed, falling back to detailed workflow', {
        status: response.status,
      });
      return detailedResults;
    }

    const data = await response.json();
    const text = data.text || '';
    
    logSemanticDebug('AIWorkflow response received', {
      responseLength: text.length,
      promptPreview: prompt.slice(0, 300),
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logSemanticDebug('AIWorkflow empty/invalid result, falling back to detailed workflow');
      return detailedResults;
    }

    const aiResult = JSON.parse(jsonMatch[0]);
    const refinedSteps = aiResult.refinedSteps || [];

    logSemanticDebug('AIWorkflow parsed steps', {
      stepCount: refinedSteps.length,
      steps: refinedSteps.slice(0, 10),
      optimization: aiResult.optimization,
    });

    if (refinedSteps.length === 0) {
      logSemanticDebug('AIWorkflow returned 0 steps, falling back to detailed workflow');
      return detailedResults;
    }

    const workflowGroupId = `wf-ai-${Date.now()}`;
    const refinedNodes: Node[] = [];
    const refinedEdges: Edge[] = [];
    let y = startPosition.y;

    for (let i = 0; i < refinedSteps.length && i < maxSteps; i++) {
      const stepLabel = refinedSteps[i];
      const node = createProcessNode(generateNodeId(), { x: startPosition.x, y }, {
        label: stepLabel,
        colors: getStepColors(stepLabel),
      });
      node.data.workflowGroupId = workflowGroupId;
      refinedNodes.push(node);

      if (i > 0) {
        refinedEdges.push(createEdge(refinedNodes[i - 1].id, node.id, workflowGroupId));
      }
      y += NODE_HEIGHT + VERTICAL_SPACING;
    }

    return { nodes: refinedNodes, edges: refinedEdges };
  } catch (error) {
    logSemanticDebug('AIWorkflow error, falling back to detailed workflow', { error });
    return detailedResults;
  }
}

function getStepColors(label: string): { headerBackground: string; bodyBackground: string; headerTextColor: string } {
  const lowerLabel = label.toLowerCase();
  
  if (lowerLabel.includes('error') || lowerLabel.includes('fail')) {
    return { headerBackground: '#dc2626', bodyBackground: '#fee2e2', headerTextColor: '#ffffff' };
  }
  if (lowerLabel.includes('success') || lowerLabel.includes('complete')) {
    return { headerBackground: '#16a34a', bodyBackground: '#dcfce7', headerTextColor: '#ffffff' };
  }
  if (lowerLabel.includes('validate') || lowerLabel.includes('check')) {
    return { headerBackground: '#f59e0b', bodyBackground: '#fef3c7', headerTextColor: '#ffffff' };
  }
  if (lowerLabel.includes('user') && (lowerLabel.includes('tap') || lowerLabel.includes('click'))) {
    return { headerBackground: '#059669', bodyBackground: '#d1fae5', headerTextColor: '#ffffff' };
  }
  if (lowerLabel.includes('fill') || lowerLabel.includes('enter') || lowerLabel.includes('input')) {
    return { headerBackground: '#0891b2', bodyBackground: '#cffafe', headerTextColor: '#ffffff' };
  }
  if (lowerLabel.includes('system') || lowerLabel.includes('process')) {
    return { headerBackground: '#7c3aed', bodyBackground: '#f5f3ff', headerTextColor: '#ffffff' };
  }
  return { headerBackground: '#4f46e5', bodyBackground: '#eef2ff', headerTextColor: '#ffffff' };
}
