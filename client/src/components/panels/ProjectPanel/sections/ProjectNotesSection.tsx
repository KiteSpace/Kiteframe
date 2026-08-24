import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, FileText, MessageSquareText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  createProjectNote,
  getPromptTranscriptKey,
  loadProjectNotes,
  saveProjectNotes,
  type ProjectNote,
} from '@/lib/projectNotes';
import { schedulePanelDocsSave } from '@/lib/documents/panelDocsClient';
import { openInReader, useIsOpenInReader } from '@/stores/readerStore';

interface ProjectNotesSectionProps {
  projectId?: string;
  /**
   * Viewers of a shared link get the notes read-only. Without this they would
   * appear to be authoring notes that only ever reach their own browser.
   */
  isReadOnly?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Updated recently';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Updated just now';
  if (diff < 3_600_000) return `Updated ${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `Updated ${Math.floor(diff / 3_600_000)}h ago`;
  return `Updated ${date.toLocaleDateString()}`;
}

function noteExcerpt(note: ProjectNote): string {
  const text = note.content.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 150) : 'Start writing this note in the reader.';
}

export function ProjectNotesSection({ projectId, isReadOnly = false }: ProjectNotesSectionProps) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [promptTranscript, setPromptTranscript] = useState<Message[]>([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const loadFromStorage = useCallback(() => {
    const loaded = loadProjectNotes(projectId);
    setNotes(loaded.data.notes);
    // Only an author writes the upgraded shape. Read-only shares still display
    // their legacy note without leaving data in the viewer's browser.
    if (loaded.migrated && !isReadOnly) saveProjectNotes(projectId, loaded.data);

    try {
      const savedTranscript = localStorage.getItem(getPromptTranscriptKey(projectId));
      setPromptTranscript(savedTranscript ? JSON.parse(savedTranscript) : []);
    } catch {
      setPromptTranscript([]);
    }
  }, [isReadOnly, projectId]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const handlePanelRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId && detail.projectId !== (projectId || '')) return;
      loadFromStorage();
    };
    window.addEventListener('kiteframe:panelDataRefresh', handlePanelRefresh);
    return () => window.removeEventListener('kiteframe:panelDataRefresh', handlePanelRefresh);
  }, [loadFromStorage, projectId]);

  const openNote = useCallback((note: ProjectNote) => {
    openInReader({ docKind: 'note', noteId: note.id });
  }, []);

  const handleCreate = useCallback(() => {
    const note = createProjectNote(projectId);
    // Read storage at the moment of mutation, not from render state. This makes
    // a click immediately after mount (before legacy migration's effect runs)
    // safe, and makes rapid creates append rather than overwrite each other.
    const current = loadProjectNotes(projectId).data;
    const next = [...current.notes, note];
    setNotes(next);
    saveProjectNotes(projectId, { notes: next });
    openNote(note);
  }, [openNote, projectId]);

  return (
    <section className="border-t border-border pt-4 mt-4" data-testid="project-notes-section">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <FileText size={12} />
          Notes
        </h2>
        {!isReadOnly && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full border border-input bg-card px-[9px] text-[11px] font-semibold text-muted-foreground hover:border-[color:var(--brand)] hover:bg-brand-soft hover:text-[color:var(--brand-strong)]"
            onClick={handleCreate}
            data-testid="button-create-note"
          >
            <Plus size={13} className="mr-1" />
            New note
          </Button>
        )}
      </div>

      {notes.length === 0 ? (
          <div className="rounded-lg border border-border px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">No project notes yet.</p>
          {!isReadOnly && (
            <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={handleCreate}>
              Create a note
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-[6px]">
          {notes.map(note => <NoteCard key={note.id} note={note} onOpen={() => openNote(note)} />)}
        </div>
      )}

      {promptTranscript.length > 0 && (
        <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
          <div className="mt-4 border-t border-border pt-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <MessageSquareText size={12} />
              Prompt Transcript
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-3">
            <div className="max-h-[300px] space-y-3 overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-3 text-sm" data-testid="prompt-transcript">
              {promptTranscript.map((msg, index) => (
                <div key={index} className={cn('text-xs', msg.role === 'user' ? 'text-foreground' : 'text-muted-foreground')}>
                  <span className="font-semibold">{msg.role === 'user' ? 'You: ' : 'AI: '}</span>
                  {msg.content}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}

function NoteCard({ note, onOpen }: { note: ProjectNote; onOpen: () => void }) {
  const isOpen = useIsOpenInReader('note', undefined, note.id);
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border bg-card p-[10px] text-left transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isOpen ? 'border-[color:var(--brand)] bg-[color:var(--brand-wash)] shadow-[0_0_0_3px_rgba(155,107,255,.14)]' : 'border-border',
      )}
      onClick={onOpen}
      data-testid={`note-card-${note.id}`}
      aria-label={`Open ${note.title} in the reader`}
    >
      <div className="flex items-start gap-2">
        <FileText size={14} className="mt-0.5 flex-none text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[12.5px] font-semibold leading-[1.3]">{note.title}</h3>
          <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">{note.author} · {formatUpdatedAt(note.updatedAt)} · v{note.version}</p>
          <p className="mt-[7px] line-clamp-2 text-[11.5px] leading-[1.5] text-muted-foreground">{noteExcerpt(note)}</p>
        </div>
      </div>
    </button>
  );
}