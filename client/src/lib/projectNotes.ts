import { notifyPanelDocsChanged } from '@/lib/kiteframe/utils/prdStorage';

export interface ProjectNote {
  id: string;
  title: string;
  content: string;
  /** The visible note author. Legacy notes use the established local owner label. */
  author: string;
  /** Monotonic note revision used by the reader caption. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNotesData {
  notes: ProjectNote[];
  lastSaved?: string;
}

export interface LoadedProjectNotes {
  data: ProjectNotesData;
  migrated: boolean;
}

export function getNotesStorageKey(projectId?: string): string {
  return `kiteframe-notes-${projectId || 'default'}`;
}

export function getPromptTranscriptKey(projectId?: string): string {
  return `kiteframe-prompt-transcript-${projectId || 'default'}`;
}

function noteTitle(content: string): string {
  const firstLine = content.split('\n').map(line => line.trim()).find(Boolean);
  if (!firstLine) return 'Untitled note';
  return firstLine.replace(/^#+\s*/, '').slice(0, 72) || 'Untitled note';
}

function isoOrNow(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
  return new Date().toISOString();
}

function noteFromLegacy(content: unknown, lastSaved: unknown, projectId?: string): ProjectNote {
  const text = typeof content === 'string' ? content : '';
  const updatedAt = isoOrNow(lastSaved);
  return {
    // Stable across readers so a legacy note remains addressable after migration.
    id: `legacy-${projectId || 'default'}`,
    title: noteTitle(text),
    content: text,
    author: 'You',
    version: 1,
    createdAt: updatedAt,
    updatedAt,
  };
}

function normalizeNote(value: unknown, index: number, projectId?: string): ProjectNote | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ProjectNote>;
  const content = typeof source.content === 'string' ? source.content : '';
  const updatedAt = isoOrNow(source.updatedAt);
  return {
    id: typeof source.id === 'string' && source.id ? source.id : `note-${projectId || 'default'}-${index}`,
    title: typeof source.title === 'string' && source.title.trim() ? source.title.trim().slice(0, 120) : noteTitle(content),
    content,
    author: typeof source.author === 'string' && source.author.trim() ? source.author.trim().slice(0, 80) : 'You',
    version: typeof source.version === 'number' && Number.isInteger(source.version) && source.version > 0 ? source.version : 1,
    createdAt: isoOrNow(source.createdAt ?? updatedAt),
    updatedAt,
  };
}

/**
 * Reads both generations of the notes payload. The old `{ content, lastSaved }`
 * payload is represented as the first note before it is written back, so callers
 * can render it safely even on a shared/read-only surface.
 */
export function loadProjectNotes(projectId?: string): LoadedProjectNotes {
  if (typeof window === 'undefined') return { data: { notes: [] }, migrated: false };
  try {
    const stored = localStorage.getItem(getNotesStorageKey(projectId));
    if (!stored) return { data: { notes: [] }, migrated: false };

    try {
      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.notes)) {
        return {
          data: {
            notes: parsed.notes
              .map((note: unknown, index: number) => normalizeNote(note, index, projectId))
              .filter((note: ProjectNote | null): note is ProjectNote => note !== null),
            lastSaved: typeof parsed.lastSaved === 'string' ? parsed.lastSaved : undefined,
          },
          migrated: false,
        };
      }
      if (parsed && typeof parsed === 'object' && ('content' in parsed || 'lastSaved' in parsed)) {
        const legacy = parsed as { content?: unknown; lastSaved?: unknown };
        const note = noteFromLegacy(legacy.content, legacy.lastSaved, projectId);
        return { data: { notes: [note], lastSaved: note.updatedAt }, migrated: true };
      }
      // The historical editor also accepted raw strings. A note body can itself
      // be valid JSON (for example "null" or a pasted array), so any parsed
      // value outside the two recognized payloads is still legacy note text.
      const note = noteFromLegacy(stored, undefined, projectId);
      return { data: { notes: [note], lastSaved: note.updatedAt }, migrated: true };
    } catch {
      const note = noteFromLegacy(stored, undefined, projectId);
      return { data: { notes: [note], lastSaved: note.updatedAt }, migrated: true };
    }
  } catch {
    // Storage can be unavailable in a private browser context; treat it as empty.
  }
  return { data: { notes: [] }, migrated: false };
}

export function saveProjectNotes(projectId: string | undefined, data: ProjectNotesData): void {
  if (typeof window === 'undefined') return;
  const now = new Date().toISOString();
  const normalized: ProjectNotesData = {
    notes: data.notes.map((note, index) => normalizeNote(note, index, projectId)).filter(
      (note: ProjectNote | null): note is ProjectNote => note !== null,
    ),
    lastSaved: now,
  };
  try {
    localStorage.setItem(getNotesStorageKey(projectId), JSON.stringify(normalized));
    notifyPanelDocsChanged(projectId || '');
  } catch (error) {
    console.error('Failed to save project notes:', error);
  }
}

export function createProjectNote(projectId?: string): ProjectNote {
  const now = new Date().toISOString();
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Untitled note',
    content: '',
    author: 'You',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}