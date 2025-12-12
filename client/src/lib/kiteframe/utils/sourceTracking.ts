interface Source {
  id: string;
  url: string;
  title: string;
  type: 'link' | 'file' | 'image' | 'figma' | 'document';
  addedAt: number;
  metadata?: {
    figmaFileKey?: string;
    figmaFileName?: string;
    frameCount?: number;
    isReference?: boolean;
    origin?: 'manual' | 'import';
    workflowId?: string;
    sectionCount?: number;
  };
}

export const SOURCES_UPDATED_EVENT = 'kiteframe-sources-updated';

export function addSource(projectId: string | undefined, source: Omit<Source, 'id' | 'addedAt'>): void {
  const storageKey = projectId ? `kiteframe-sources-${projectId}` : 'kiteframe-sources-default';
  
  let sources: Source[] = [];
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      sources = JSON.parse(saved);
    }
  } catch {
    sources = [];
  }

  const exists = sources.some(s => s.url === source.url);
  if (exists) return;

  const newSource: Source = {
    ...source,
    id: `source-${Date.now()}`,
    addedAt: Date.now()
  };

  sources = [newSource, ...sources];
  localStorage.setItem(storageKey, JSON.stringify(sources));
  
  window.dispatchEvent(new CustomEvent(SOURCES_UPDATED_EVENT, { detail: { projectId } }));
}

export function addFigmaSource(
  projectId: string | undefined, 
  figmaUrl: string, 
  figmaFileName: string,
  figmaFileKey: string,
  frameCount: number,
  isReference: boolean = false
): void {
  addSource(projectId, {
    url: figmaUrl,
    title: figmaFileName || 'Figma Import',
    type: 'figma',
    metadata: {
      figmaFileKey,
      figmaFileName,
      frameCount,
      isReference
    }
  });
}

export function updateSourceReferenceStatus(
  projectId: string | undefined,
  figmaFileKey: string,
  isReference: boolean
): void {
  const storageKey = projectId ? `kiteframe-sources-${projectId}` : 'kiteframe-sources-default';
  
  let sources: Source[] = [];
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      sources = JSON.parse(saved);
    }
  } catch {
    return;
  }

  const updated = sources.map(s => {
    if (s.type === 'figma' && s.metadata?.figmaFileKey === figmaFileKey) {
      return { ...s, metadata: { ...s.metadata, isReference } };
    }
    return s;
  });

  localStorage.setItem(storageKey, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent(SOURCES_UPDATED_EVENT, { detail: { projectId } }));
}

export function addImportedDocumentSource(
  projectId: string | undefined,
  workflowId: string,
  title: string,
  sectionCount: number
): void {
  addSource(projectId, {
    url: `imported://prd/${workflowId}/${Date.now()}`,
    title: title || 'Imported PRD',
    type: 'document',
    metadata: {
      origin: 'import',
      workflowId,
      sectionCount
    }
  });
}
