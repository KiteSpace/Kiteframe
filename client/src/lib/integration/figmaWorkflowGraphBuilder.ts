/**
 * Figma Workflow Graph Builder
 * 
 * Builds a FigmaWorkflowGraph from FigmaSemanticMetadata.
 * Clusters semantic elements into logical "screens/steps" and infers edges.
 * 
 * This module operates ONLY on FigmaSemanticMetadata and never touches React.
 */

import type {
  FigmaSemanticMetadata,
  FigmaSemanticElement,
  FigmaSemanticBounds,
  FigmaScreenStep,
  FigmaWorkflowEdgeHint,
  FigmaWorkflowGraph,
} from './figmaSemanticTypes';

const HORIZONTAL_GAP_THRESHOLD_MULTIPLIER = 1.5;
const VERTICAL_GAP_THRESHOLD_MULTIPLIER = 1.5;
const MAX_DESCRIPTION_ELEMENTS = 3;
const MAX_DESCRIPTION_LENGTH = 200;

function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getElementCenter(bounds: FigmaSemanticBounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

function getAverageWidth(elements: FigmaSemanticElement[]): number {
  if (elements.length === 0) return 100;
  const total = elements.reduce((sum, el) => sum + el.bounds.width, 0);
  return total / elements.length;
}

function getAverageHeight(elements: FigmaSemanticElement[]): number {
  if (elements.length === 0) return 100;
  const total = elements.reduce((sum, el) => sum + el.bounds.height, 0);
  return total / elements.length;
}

function getClusterBounds(elements: FigmaSemanticElement[]): FigmaSemanticBounds | undefined {
  if (elements.length === 0) return undefined;
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const el of elements) {
    minX = Math.min(minX, el.bounds.x);
    minY = Math.min(minY, el.bounds.y);
    maxX = Math.max(maxX, el.bounds.x + el.bounds.width);
    maxY = Math.max(maxY, el.bounds.y + el.bounds.height);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function detectLayoutDirection(elements: FigmaSemanticElement[]): 'horizontal' | 'vertical' {
  if (elements.length < 2) return 'horizontal';
  
  const bounds = getClusterBounds(elements);
  if (!bounds) return 'horizontal';
  
  return bounds.width > bounds.height * 1.5 ? 'horizontal' : 'vertical';
}

function clusterByHorizontalGaps(
  elements: FigmaSemanticElement[],
  gapThreshold: number
): FigmaSemanticElement[][] {
  if (elements.length === 0) return [];
  
  const sorted = [...elements].sort((a, b) => 
    getElementCenter(a.bounds).x - getElementCenter(b.bounds).x
  );
  
  const clusters: FigmaSemanticElement[][] = [[sorted[0]]];
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.bounds.x - (prev.bounds.x + prev.bounds.width);
    
    if (gap > gapThreshold) {
      clusters.push([curr]);
    } else {
      clusters[clusters.length - 1].push(curr);
    }
  }
  
  return clusters;
}

function clusterByVerticalGaps(
  elements: FigmaSemanticElement[],
  gapThreshold: number
): FigmaSemanticElement[][] {
  if (elements.length === 0) return [];
  
  const sorted = [...elements].sort((a, b) => 
    getElementCenter(a.bounds).y - getElementCenter(b.bounds).y
  );
  
  const clusters: FigmaSemanticElement[][] = [[sorted[0]]];
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.bounds.y - (prev.bounds.y + prev.bounds.height);
    
    if (gap > gapThreshold) {
      clusters.push([curr]);
    } else {
      clusters[clusters.length - 1].push(curr);
    }
  }
  
  return clusters;
}

function clusterBySections(
  elements: FigmaSemanticElement[]
): FigmaSemanticElement[][] | null {
  const sections = elements.filter(el => el.type === 'section');
  
  if (sections.length === 0) return null;
  
  const clusters: FigmaSemanticElement[][] = [];
  const sectionIds = new Set(sections.map(s => s.id));
  const assignedIds = new Set<string>();
  
  for (const section of sections) {
    const cluster: FigmaSemanticElement[] = [section];
    assignedIds.add(section.id);
    
    for (const el of elements) {
      if (el.id === section.id || assignedIds.has(el.id)) continue;
      
      if (el.parentId === section.id || 
          (section.childrenIds && section.childrenIds.includes(el.id))) {
        cluster.push(el);
        assignedIds.add(el.id);
      }
    }
    
    if (cluster.length > 0) {
      clusters.push(cluster);
    }
  }
  
  const unassigned = elements.filter(el => !assignedIds.has(el.id) && !sectionIds.has(el.id));
  if (unassigned.length > 0) {
    clusters.push(unassigned);
  }
  
  return clusters.length > 0 ? clusters : null;
}

function clusterElements(elements: FigmaSemanticElement[]): FigmaSemanticElement[][] {
  if (elements.length === 0) return [];
  if (elements.length === 1) return [[elements[0]]];
  
  const sectionClusters = clusterBySections(elements);
  if (sectionClusters && sectionClusters.length > 1) {
    return sectionClusters;
  }
  
  const direction = detectLayoutDirection(elements);
  
  if (direction === 'horizontal') {
    const avgWidth = getAverageWidth(elements);
    const threshold = avgWidth * HORIZONTAL_GAP_THRESHOLD_MULTIPLIER;
    const clusters = clusterByHorizontalGaps(elements, threshold);
    if (clusters.length > 1) return clusters;
  } else {
    const avgHeight = getAverageHeight(elements);
    const threshold = avgHeight * VERTICAL_GAP_THRESHOLD_MULTIPLIER;
    const clusters = clusterByVerticalGaps(elements, threshold);
    if (clusters.length > 1) return clusters;
  }
  
  return [elements];
}

function findTitle(elements: FigmaSemanticElement[]): string | null {
  const headings = elements.filter(el => el.type === 'heading' && el.text);
  if (headings.length > 0) {
    headings.sort((a, b) => a.bounds.y - b.bounds.y);
    return headings[0].text || null;
  }
  
  const textElements = elements.filter(el => 
    (el.type === 'text' || el.type === 'label') && el.text
  );
  if (textElements.length > 0) {
    textElements.sort((a, b) => {
      const aFontSize = a.bounds.height;
      const bFontSize = b.bounds.height;
      return bFontSize - aFontSize;
    });
    return textElements[0].text || null;
  }
  
  return null;
}

function findSubtitle(elements: FigmaSemanticElement[], title: string | null): string | null {
  if (!title) return null;
  
  const headings = elements.filter(el => 
    el.type === 'heading' && el.text && el.text !== title
  );
  
  if (headings.length > 0) {
    headings.sort((a, b) => a.bounds.y - b.bounds.y);
    return headings[0].text || null;
  }
  
  return null;
}

function buildDescription(elements: FigmaSemanticElement[], title: string | null, subtitle: string | null): string {
  const textElements = elements.filter(el => 
    (el.type === 'text' || el.type === 'label') && 
    el.text && 
    el.text !== title && 
    el.text !== subtitle
  );
  
  textElements.sort((a, b) => a.bounds.y - b.bounds.y);
  
  const texts = textElements
    .slice(0, MAX_DESCRIPTION_ELEMENTS)
    .map(el => el.text!)
    .filter(t => t.length > 2);
  
  const description = texts.join(' ');
  
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return description.substring(0, MAX_DESCRIPTION_LENGTH) + '...';
  }
  
  return description;
}

function extractActions(elements: FigmaSemanticElement[]): { primary: string[]; secondary: string[] } {
  const buttons = elements.filter(el => el.type === 'button' && el.text);
  const links = elements.filter(el => el.type === 'link' && el.text);
  
  const primary: string[] = [];
  const secondary: string[] = [];
  
  for (const btn of buttons) {
    if (btn.isPrimaryAction) {
      primary.push(btn.text!);
    } else {
      secondary.push(btn.text!);
    }
  }
  
  for (const link of links) {
    secondary.push(link.text!);
  }
  
  return { primary, secondary };
}

function buildScreenStep(
  cluster: FigmaSemanticElement[],
  frameId: string,
  index: number,
  frameName: string
): FigmaScreenStep {
  const title = findTitle(cluster);
  const subtitle = findSubtitle(cluster, title);
  const description = buildDescription(cluster, title, subtitle);
  const actions = extractActions(cluster);
  const bounds = getClusterBounds(cluster);
  
  return {
    id: generateStepId(),
    frameId,
    title: title || `${frameName} - Step ${index + 1}`,
    subtitle: subtitle || undefined,
    description: description || undefined,
    bounds,
    primaryActions: actions.primary,
    secondaryActions: actions.secondary,
    elementIds: cluster.map(el => el.id),
  };
}

function normalizeString(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function stringSimilarity(a: string, b: string): boolean {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;
  if (normA.startsWith(normB) || normB.startsWith(normA)) return true;
  
  return false;
}

function inferEdges(
  steps: FigmaScreenStep[],
  semantic: FigmaSemanticMetadata
): FigmaWorkflowEdgeHint[] {
  const edges: FigmaWorkflowEdgeHint[] = [];
  const edgeKeys = new Set<string>();
  
  const addEdge = (edge: FigmaWorkflowEdgeHint) => {
    const key = `${edge.sourceStepId}->${edge.targetStepId}:${edge.label || ''}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push(edge);
    }
  };
  
  const sortedSteps = [...steps].sort((a, b) => {
    const aCenter = a.bounds ? a.bounds.x + a.bounds.width / 2 : 0;
    const bCenter = b.bounds ? b.bounds.x + b.bounds.width / 2 : 0;
    if (Math.abs(aCenter - bCenter) > 50) return aCenter - bCenter;
    
    const aY = a.bounds ? a.bounds.y : 0;
    const bY = b.bounds ? b.bounds.y : 0;
    return aY - bY;
  });
  
  for (let i = 0; i < sortedSteps.length - 1; i++) {
    addEdge({
      sourceStepId: sortedSteps[i].id,
      targetStepId: sortedSteps[i + 1].id,
      reason: 'spatial-sequence',
      label: sortedSteps[i].primaryActions[0] || undefined,
    });
  }
  
  const elementToStep = new Map<string, FigmaScreenStep>();
  for (const step of steps) {
    for (const elId of step.elementIds) {
      elementToStep.set(elId, step);
    }
  }
  
  for (const navTarget of semantic.navigationTargets) {
    const sourceStep = elementToStep.get(navTarget.elementId);
    if (!sourceStep) continue;
    
    if (navTarget.inferredTargetName) {
      for (const targetStep of steps) {
        if (targetStep.id === sourceStep.id) continue;
        
        if (stringSimilarity(targetStep.title, navTarget.inferredTargetName)) {
          addEdge({
            sourceStepId: sourceStep.id,
            targetStepId: targetStep.id,
            reason: 'matching-label',
            label: navTarget.label,
          });
          break;
        }
      }
    }
  }
  
  for (const form of semantic.forms) {
    let formStep: FigmaScreenStep | null = null;
    
    for (const fieldId of form.fieldIds) {
      const step = elementToStep.get(fieldId);
      if (step) {
        formStep = step;
        break;
      }
    }
    
    if (!formStep) continue;
    
    const formStepIndex = sortedSteps.findIndex(s => s.id === formStep!.id);
    if (formStepIndex >= 0 && formStepIndex < sortedSteps.length - 1) {
      const submitButton = semantic.elements.find(el => 
        form.submitButtonIds.includes(el.id) && el.text
      );
      
      addEdge({
        sourceStepId: formStep.id,
        targetStepId: sortedSteps[formStepIndex + 1].id,
        reason: 'form-submit',
        label: submitButton?.text || 'Submit',
      });
    }
  }
  
  return edges;
}

export function buildWorkflowGraphFromSemantic(
  semantic: FigmaSemanticMetadata,
  frameId: string,
  frameName: string,
  pageName?: string
): FigmaWorkflowGraph {
  if (!semantic.elements || semantic.elements.length === 0) {
    return {
      frameId,
      frameName,
      pageName,
      steps: [{
        id: generateStepId(),
        frameId,
        title: frameName,
        primaryActions: [],
        secondaryActions: [],
        elementIds: [],
      }],
      edges: [],
    };
  }
  
  const clusters = clusterElements(semantic.elements);
  
  const steps: FigmaScreenStep[] = clusters.map((cluster, index) => 
    buildScreenStep(cluster, frameId, index, frameName)
  );
  
  const edges = inferEdges(steps, semantic);
  
  return {
    frameId,
    frameName,
    pageName,
    steps,
    edges,
  };
}
