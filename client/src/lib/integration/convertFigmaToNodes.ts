import type { FigmaFrame } from './figmaApi';
import type { FigmaSemanticMetadata } from './figmaSemanticTypes';
import { generateId as generateIdBase } from '@/lib/utils/generateId';

export interface KiteframeNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  data: Record<string, any>;
}

export interface ConversionResult {
  nodes: KiteframeNode[];
  edges: any[];
}

const generateId = () => generateIdBase('figma');

export function convertFigmaFrameToNodes(
  frame: FigmaFrame,
  thumbnailUrl: string | null,
  canvasOffset: { x: number; y: number } = { x: 100, y: 100 },
  figmaSemantic?: FigmaSemanticMetadata | null,
  figmaFileKey?: string
): ConversionResult {
  const nodes: KiteframeNode[] = [];
  const edges: any[] = [];

  const nodeId = generateId();

  nodes.push({
    id: nodeId,
    type: 'image',
    position: {
      x: canvasOffset.x,
      y: canvasOffset.y,
    },
    width: Math.min(frame.width, 800),
    height: Math.min(frame.height, 600),
    data: {
      label: frame.name,
      src: thumbnailUrl || '',
      // Core Figma metadata
      figmaFileKey: figmaFileKey || '',
      figmaNodeId: frame.id,
      figmaNodeName: frame.name,
      // Reference frame flags
      isReferenceFrame: false,
      sourceType: 'figma-frame',
      importedFrom: 'figma',
      // Legacy fields (kept for backward compatibility)
      figmaId: frame.id,
      figmaType: frame.type,
      figmaPageName: frame.pageName,
      originalWidth: frame.width,
      originalHeight: frame.height,
      figmaSemantic: figmaSemantic ?? null,
    },
  });

  return { nodes, edges };
}

export interface FrameWithSemantics {
  frame: FigmaFrame;
  thumbnailUrl: string | null;
  figmaSemantic?: FigmaSemanticMetadata | null;
}

export function convertMultipleFramesToNodes(
  frames: Array<FrameWithSemantics>,
  canvasOffset: { x: number; y: number } = { x: 100, y: 100 },
  spacing: number = 50,
  figmaFileKey?: string
): ConversionResult {
  const allNodes: KiteframeNode[] = [];
  const allEdges: any[] = [];

  let currentX = canvasOffset.x;

  for (const { frame, thumbnailUrl, figmaSemantic } of frames) {
    const result = convertFigmaFrameToNodes(frame, thumbnailUrl, { x: currentX, y: canvasOffset.y }, figmaSemantic, figmaFileKey);
    allNodes.push(...result.nodes);
    allEdges.push(...result.edges);

    const nodeWidth = Math.min(frame.width, 800);
    currentX += nodeWidth + spacing;
  }

  return { nodes: allNodes, edges: allEdges };
}
