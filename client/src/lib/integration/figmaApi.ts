import { parseFigmaUrl } from './figmaUrl';

export interface FigmaFrame {
  id: string;
  name: string;
  type: string;
  pageName: string;
  width: number;
  height: number;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  thumbnailUrl?: string;
}

export interface FigmaApiError {
  error: string;
  status?: number;
  details?: string;
}

export async function callFigmaApi<T = any>(
  path: string,
  patToken?: string | null
): Promise<T> {
  const response = await fetch('/api/figma/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ 
      path, 
      usePat: !!patToken,
      patToken: patToken ?? null 
    }),
  });

  if (!response.ok) {
    const errorData: FigmaApiError = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `Figma API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchFigmaFile(fileKey: string, patToken?: string) {
  return callFigmaApi(`files/${fileKey}`, patToken);
}

export async function fetchFigmaNode(fileKey: string, nodeId: string, patToken?: string) {
  return callFigmaApi(`files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`, patToken);
}

export async function fetchFigmaThumbnails(
  fileKey: string,
  nodeIds: string[],
  patToken?: string
): Promise<{ images: Record<string, string | null> }> {
  const idsParam = nodeIds.join(',');
  return callFigmaApi(`images/${fileKey}?ids=${encodeURIComponent(idsParam)}&format=png`, patToken);
}

export function discoverFrames(fileJson: any): FigmaFrame[] {
  const frames: FigmaFrame[] = [];

  if (!fileJson?.document?.children) {
    return frames;
  }

  for (const page of fileJson.document.children) {
    if (page.type !== 'CANVAS') continue;

    const pageName = page.name || 'Untitled Page';

    for (const child of page.children || []) {
      if (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'INSTANCE') {
        const bbox = child.absoluteBoundingBox;
        frames.push({
          id: child.id,
          name: child.name || 'Untitled Frame',
          type: child.type,
          pageName,
          width: bbox?.width || 0,
          height: bbox?.height || 0,
          absoluteBoundingBox: bbox,
        });
      }
    }
  }

  return frames;
}

export function extractFileKey(url: string): string | null {
  const parsed = parseFigmaUrl(url);
  return parsed?.fileKey ?? null;
}

/**
 * Fetch multiple frame node trees in a single batched API call.
 * Returns the nodes object keyed by frame ID.
 */
export async function fetchFigmaFrameTrees(
  fileKey: string,
  frameIds: string[],
  patToken?: string
): Promise<Record<string, { document: any; components?: any }>> {
  if (frameIds.length === 0) {
    return {};
  }
  
  const idsParam = frameIds.join(',');
  const response = await callFigmaApi<{ nodes: Record<string, { document: any; components?: any }> }>(
    `files/${fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`,
    patToken
  );
  
  return response.nodes || {};
}

/**
 * Fetch a page image (flattened render of entire page).
 * Uses lower scale for performance on full-page renders.
 */
export async function fetchFigmaPageImage(
  fileKey: string,
  pageId: string,
  patToken?: string
): Promise<string | null> {
  try {
    const result = await callFigmaApi<{ images: Record<string, string | null> }>(
      `images/${fileKey}?ids=${encodeURIComponent(pageId)}&format=png&scale=1`,
      patToken
    );
    return result.images?.[pageId] || null;
  } catch (error) {
    console.error('Failed to fetch page image:', error);
    throw error;
  }
}
