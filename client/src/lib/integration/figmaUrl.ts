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
