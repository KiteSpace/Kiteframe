import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { type ParsedFigmaUrl, buildFigmaEmbedUrl } from '@/lib/integration/figmaUrl';

export interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  viewport?: { x: number; y: number; zoom: number };
}

export function buildFigmaWebviewWorkflow(parsed: ParsedFigmaUrl): WorkflowData {
  const id = `figma-${parsed.fileKey}-${parsed.nodeId ?? 'root'}-${Date.now()}`;
  
  // Use the Figma embed URL for proper iframe embedding
  const embedUrl = buildFigmaEmbedUrl(parsed);

  const node: Node = {
    id,
    type: 'webview',
    position: { x: 100, y: 100 },
    data: {
      url: embedUrl,
      title: 'Figma Import',
      kind: 'figma-frame',
      fileKey: parsed.fileKey,
      nodeId: parsed.nodeId,
      rawFigmaUrl: parsed.rawUrl,
      colors: {
        headerBackground: '#F24E1E',
        headerTextColor: '#ffffff',
        bodyBackground: '#ffffff',
        borderColor: '#E04332',
      },
    },
    style: {
      width: 640,
      height: 480,
    },
    draggable: true,
    selectable: true,
    showHandles: true,
  };

  return {
    nodes: [node],
    edges: [],
    canvasObjects: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

// TODO: In a future iteration, use MCP Figma tools (get_design_context, get_metadata)
// to analyze this frame and generate a workflow graph from it.
// This would convert Figma frames into multiple interconnected nodes.
