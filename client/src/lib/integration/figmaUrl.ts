export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
  rawUrl: string;
}

export function parseFigmaUrl(url: string): ParsedFigmaUrl | null {
  try {
    const u = new URL(url.trim());
    
    // Check if it's a Figma domain
    const hostname = u.hostname.toLowerCase();
    if (!hostname.includes('figma.com')) {
      return null;
    }

    // Figma patterns: /file/<fileKey>/... or /design/<fileKey>/...
    // Also handle branch URLs: /design/<fileKey>/branch/<branchKey>/...
    const segments = u.pathname.split('/').filter(Boolean);
    const fileIndex = segments.findIndex(seg => seg === 'file' || seg === 'design');
    
    if (fileIndex === -1 || !segments[fileIndex + 1]) {
      return null;
    }

    let fileKey = segments[fileIndex + 1];
    
    // Check for branch URLs - if present, use branchKey as fileKey
    const branchIndex = segments.indexOf('branch');
    if (branchIndex !== -1 && segments[branchIndex + 1]) {
      fileKey = segments[branchIndex + 1];
    }

    // Get node-id from query params (format: "1-2" or "1:2")
    const nodeIdParam = u.searchParams.get('node-id');
    const nodeId = nodeIdParam ? nodeIdParam.replace('-', ':') : undefined;

    return { 
      fileKey, 
      nodeId, 
      rawUrl: url.trim() 
    };
  } catch {
    return null;
  }
}

export function isValidFigmaUrl(url: string): boolean {
  return parseFigmaUrl(url) !== null;
}

export function buildFigmaEmbedUrl(parsed: ParsedFigmaUrl): string {
  // Build a Figma embed URL from parsed components
  let embedUrl = `https://www.figma.com/embed?embed_host=kiteframe&url=${encodeURIComponent(parsed.rawUrl)}`;
  return embedUrl;
}

export type FigmaUrlType = 'frame' | 'page' | 'file' | null;

/**
 * Detect the type of Figma URL based on node-id presence.
 * Initial detection based on URL structure only.
 * For accurate detection (frame vs page), use detectFigmaUrlTypeWithApi after fetching node data.
 * 
 * Rules:
 * 1. If URL contains node-id → 'frame' (could be page, but needs API check)
 * 2. If URL has no node-id → 'file'
 * 3. If URL is invalid → null
 */
export function detectFigmaUrlType(url: string): FigmaUrlType {
  const parsed = parseFigmaUrl(url);
  if (!parsed) {
    return null;
  }
  
  if (parsed.nodeId) {
    // Has node-id - could be frame or page (canvas)
    // For precise detection, need to call API and check node.type
    return 'frame'; // Default assumption, refined by API check
  }
  
  // No node-id means file-level URL
  return 'file';
}

/**
 * Detect Figma URL type with API data for precise frame vs page detection.
 * Call this after fetching node data to determine if nodeId points to a CANVAS (page) or FRAME.
 * 
 * @param nodeType - The type from Figma API (e.g., 'FRAME', 'CANVAS', 'COMPONENT')
 */
export function detectFigmaUrlTypeWithNodeType(
  url: string,
  nodeType: string | undefined
): FigmaUrlType {
  const parsed = parseFigmaUrl(url);
  if (!parsed) {
    return null;
  }
  
  if (!parsed.nodeId) {
    return 'file';
  }
  
  // Check node type from API
  if (nodeType === 'CANVAS') {
    return 'page';
  }
  
  // FRAME, COMPONENT, COMPONENT_SET, GROUP, etc. are treated as frames
  return 'frame';
}
