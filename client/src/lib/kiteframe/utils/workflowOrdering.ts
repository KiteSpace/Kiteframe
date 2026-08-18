import type { Node } from '../types';

export function sortFrameNodesForWorkflow(nodes: Node[]): Node[] {
  return nodes.slice().sort((a, b) => {
    const nameA = a.data?.label || a.data?.figmaName || '';
    const nameB = b.data?.label || b.data?.figmaName || '';

    const numA = parseInt(nameA.split(/[^0-9]/)[0], 10);
    const numB = parseInt(nameB.split(/[^0-9]/)[0], 10);
    const validA = !isNaN(numA);
    const validB = !isNaN(numB);

    if (validA && validB && numA !== numB) return numA - numB;

    const xA = a.position?.x ?? 0;
    const xB = b.position?.x ?? 0;
    if (xA !== xB) return xA - xB;

    return nameA.localeCompare(nameB);
  });
}

export function filterValidWorkflowFrames(nodes: Node[]): Node[] {
  return nodes.filter(n => 
    n.type === 'image' && 
    n.data?.figmaSemantic && 
    !n.data?.isReferenceFrame
  );
}

export function getWorkflowFramesSummary(nodes: Node[]): {
  totalFrames: number;
  validFrames: number;
  referenceFrames: number;
  estimatedSteps: number;
} {
  const imageNodes = nodes.filter(n => n.type === 'image');
  const validFrames = filterValidWorkflowFrames(nodes);
  const referenceFrames = imageNodes.filter(n => n.data?.isReferenceFrame);
  
  const estimatedSteps = validFrames.reduce((sum, node) => {
    const semantic = node.data?.figmaSemantic;
    if (semantic?.workflowGraph?.steps) {
      return sum + semantic.workflowGraph.steps.length;
    }
    return sum + 1;
  }, 0);

  return {
    totalFrames: imageNodes.length,
    validFrames: validFrames.length,
    referenceFrames: referenceFrames.length,
    estimatedSteps
  };
}
