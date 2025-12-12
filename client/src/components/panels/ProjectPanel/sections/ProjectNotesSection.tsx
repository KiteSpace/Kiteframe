import { useState, useEffect, useCallback } from 'react';
import { FileText, Save, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ProjectNotesSectionProps {
  projectId?: string;
}

function getNotesStorageKey(projectId?: string): string {
  return `kiteframe-notes-${projectId || 'default'}`;
}

export function ProjectNotesSection({ projectId }: ProjectNotesSectionProps) {
  const [notes, setNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOpen, setIsOpen] = useState(true);

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
        
        <CollapsibleContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about your project..."
            className="min-h-[100px] resize-none text-sm"
            data-testid="input-notes"
          />
          {notes.length > 0 && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {notes.length} characters
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
