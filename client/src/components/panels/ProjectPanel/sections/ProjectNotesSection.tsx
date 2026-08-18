import { useState, useEffect, useCallback } from 'react';
import { FileText, Save, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { notifyPanelDocsChanged } from '@/lib/kiteframe/utils/prdStorage';

interface ProjectNotesSectionProps {
  projectId?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function getNotesStorageKey(projectId?: string): string {
  return `kiteframe-notes-${projectId || 'default'}`;
}

function getPromptTranscriptKey(projectId?: string): string {
  return `kiteframe-prompt-transcript-${projectId || 'default'}`;
}

export function ProjectNotesSection({ projectId }: ProjectNotesSectionProps) {
  const [notes, setNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [promptTranscript, setPromptTranscript] = useState<Message[]>([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  useEffect(() => {
    const key = getNotesStorageKey(projectId);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setNotes(data.content || '');
        setSavedNotes(data.content || '');
        if (data.lastSaved) {
          setLastSaved(new Date(data.lastSaved));
        }
      } catch (e) {
        setNotes(saved);
        setSavedNotes(saved);
      }
    } else {
      setNotes('');
      setSavedNotes('');
      setLastSaved(null);
    }

    // Load prompt transcript
    const transcriptKey = getPromptTranscriptKey(projectId);
    const savedTranscript = localStorage.getItem(transcriptKey);
    if (savedTranscript) {
      try {
        setPromptTranscript(JSON.parse(savedTranscript));
      } catch (e) {
        setPromptTranscript([]);
      }
    }
  }, [projectId]);

  const saveNotes = useCallback(() => {
    setIsSaving(true);
    const key = getNotesStorageKey(projectId);
    const now = new Date();
    const data = {
      content: notes,
      lastSaved: now.toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(data));
    notifyPanelDocsChanged(projectId || '');
    setSavedNotes(notes);
    setLastSaved(now);
    setTimeout(() => setIsSaving(false), 500);
  }, [notes, projectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (notes !== savedNotes && notes.length > 0) {
        saveNotes();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [notes, savedNotes, saveNotes]);

  const hasUnsavedChanges = notes !== savedNotes;

  const formatLastSaved = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <section className="border-t border-border pt-4 mt-4" data-testid="project-notes-section">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between mb-3">
          <CollapsibleTrigger className="flex items-center gap-2">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText size={12} />
              Notes
            </h2>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            {lastSaved && !hasUnsavedChanges && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CheckCircle size={10} className="text-green-500" />
                {formatLastSaved(lastSaved)}
              </span>
            )}
            {hasUnsavedChanges && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={saveNotes}
                disabled={isSaving}
                className="h-6 text-[10px]"
                data-testid="button-save-notes"
              >
                <Save size={10} className="mr-1" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        </div>
        
        <CollapsibleContent className="space-y-4">
          <div
            className={cn(
              "rounded-md transition-colors duration-100 -mx-1 px-1",
              "hover:bg-accent/30",
              !isEditingNotes && "cursor-text"
            )}
            onClick={() => setIsEditingNotes(true)}
            data-testid="notes-field"
          >
            {isEditingNotes ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => setIsEditingNotes(false)}
                placeholder="Add notes about your project..."
                autoFocus
                className={cn("min-h-[100px] resize-none text-sm border-primary/20 focus:border-primary/40")}
                data-testid="input-notes"
              />
            ) : (
              <div className={cn("text-sm min-h-[100px] py-2", !notes && "italic text-muted-foreground")}>
                {notes || "Add notes about your project..."}
              </div>
            )}
          </div>
          {notes.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              {notes.length} characters
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {promptTranscript.length > 0 && (
        <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
          <div className="flex items-center gap-2 border-t border-border pt-4 mt-4">
            <CollapsibleTrigger className="flex items-center gap-2">
              {isTranscriptOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <FileText size={12} />
                Prompt Transcript
              </h2>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-3">
            <div className="space-y-3 rounded-md border border-border/50 p-3 bg-muted/20 max-h-[300px] overflow-y-auto text-sm" data-testid="prompt-transcript">
              {promptTranscript.map((msg, idx) => (
                <div key={idx} className={cn("text-xs", msg.role === 'user' ? "text-foreground" : "text-muted-foreground")}>
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
