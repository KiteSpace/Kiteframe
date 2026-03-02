import { useState, useEffect, useCallback } from 'react';
import { FileText, Save, CheckCircle, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface NotesTabProps {
  projectId?: string;
  isReadOnly?: boolean;
}

interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date | string;
}

interface ConversationTranscript {
  id: string;
  name: string;
  messages: TranscriptMessage[];
  timestamp: Date;
}

function getNotesStorageKey(projectId?: string): string {
  return `kiteframe-notes-${projectId || 'default'}`;
}

function getPromptTranscriptKey(projectId?: string): string {
  return `kiteframe-prompt-transcript-${projectId || 'default'}`;
}

function getKiteAIChatKey(projectId?: string): string {
  return `kiteframe-kiteai-chat-${projectId || 'default'}`;
}

function formatMessageContent(content: string): string {
  return content.replace(/\n/g, ' ').slice(0, 200) + (content.length > 200 ? '...' : '');
}

function formatTimestamp(timestamp: Date | string | undefined): string {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function NotesTab({ projectId, isReadOnly = false }: NotesTabProps) {
  const [notes, setNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [transcripts, setTranscripts] = useState<ConversationTranscript[]>([]);
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
    }

    // Load all transcripts
    const loadedTranscripts: ConversationTranscript[] = [];

    // Load prompt transcript
    const promptKey = getPromptTranscriptKey(projectId);
    const savedPrompt = localStorage.getItem(promptKey);
    if (savedPrompt) {
      try {
        const promptMessages = JSON.parse(savedPrompt);
        if (Array.isArray(promptMessages) && promptMessages.length > 0) {
          const firstTimestamp = promptMessages[0]?.timestamp;
          loadedTranscripts.push({
            id: 'prompt',
            name: 'Pre-Project Conversation',
            messages: promptMessages,
            timestamp: firstTimestamp ? new Date(firstTimestamp) : new Date()
          });
        }
      } catch (e) {
        console.error('Failed to load prompt transcript:', e);
      }
    }

    // Load KiteAI chat history
    const chatKey = getKiteAIChatKey(projectId);
    const savedChat = localStorage.getItem(chatKey);
    if (savedChat) {
      try {
        const chatMessages = JSON.parse(savedChat);
        if (Array.isArray(chatMessages) && chatMessages.length > 1) { // Skip if only welcome message
          const userMessages = chatMessages.filter((m: any) => m.role === 'user');
          if (userMessages.length > 0) {
            const firstTimestamp = chatMessages[0]?.timestamp;
            loadedTranscripts.push({
              id: 'kiteai',
              name: 'In-Project Chat',
              messages: chatMessages.filter((m: any) => m.role !== 'system' && m.id !== 'welcome'),
              timestamp: firstTimestamp ? new Date(firstTimestamp) : new Date()
            });
          }
        }
      } catch (e) {
        console.error('Failed to load KiteAI chat:', e);
      }
    }

    // Sort by timestamp, newest first
    loadedTranscripts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setTranscripts(loadedTranscripts);
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
    if (isReadOnly) return; // Don't auto-save in read-only mode
    
    const timer = setTimeout(() => {
      if (notes !== savedNotes && notes.length > 0) {
        saveNotes();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [notes, savedNotes, saveNotes, isReadOnly]);

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
    <div className="h-full flex flex-col" data-testid="notes-tab">
      {/* Notes Section */}
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <FileText size={12} />
            <span>Project Notes</span>
          </div>
          <div className="flex items-center gap-2">
            {lastSaved && !hasUnsavedChanges && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CheckCircle size={10} className="text-green-500" />
                {formatLastSaved(lastSaved)}
              </span>
            )}
            {hasUnsavedChanges && !isReadOnly && (
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
        
        <div
          className={cn(
            "rounded-md transition-colors duration-100 -mx-1 px-1",
            !isReadOnly && "hover:bg-accent/30 cursor-text"
          )}
          onClick={() => !isReadOnly && setIsEditingNotes(true)}
          data-testid="notes-field"
        >
          {isEditingNotes && !isReadOnly ? (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => setIsEditingNotes(false)}
              placeholder={"Add notes about your project here...\n\n• Design decisions\n• TODO items\n• Meeting notes\n• Reference links"}
              className="min-h-[150px] resize-none text-sm border-primary/20 focus:border-primary/40"
              autoFocus
              data-testid="input-notes"
            />
          ) : (
            <div
              className={cn(
                "text-sm min-h-[150px] py-2 whitespace-pre-wrap",
                !notes && "italic text-muted-foreground"
              )}
            >
              {notes || (isReadOnly ? "No notes available" : "Add notes about your project here...\n\n• Design decisions\n• TODO items\n• Meeting notes\n• Reference links")}
            </div>
          )}
        </div>
        
        <div className="mt-3 text-[10px] text-muted-foreground">
          {notes.length > 0 ? `${notes.length} characters` : 'No notes yet'}
        </div>
      </div>

      {/* Transcript Section */}
      <div className="border-t border-border flex-1 flex flex-col min-h-0">
        <button
          onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
          className="flex items-center gap-2 px-4 py-3 w-full text-left hover:bg-accent/30 transition-colors"
          data-testid="transcript-toggle"
        >
          {isTranscriptOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <MessageSquare size={12} />
            <span>Transcript</span>
          </div>
          {transcripts.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {transcripts.length} conversation{transcripts.length !== 1 ? 's' : ''}
            </span>
          )}
        </button>

        {isTranscriptOpen && (
          <ScrollArea className="flex-1 px-4 pb-4">
            {transcripts.length === 0 ? (
              <div className="text-sm text-muted-foreground italic py-4">
                No conversation transcripts yet. Use KiteAI to start a conversation.
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {transcripts.map((transcript) => (
                  <AccordionItem 
                    key={transcript.id} 
                    value={transcript.id}
                    className="border-border/50"
                  >
                    <AccordionTrigger className="text-sm hover:no-underline py-2">
                      <div className="flex items-center gap-2 text-left">
                        <MessageSquare size={14} className="text-primary flex-shrink-0" />
                        <div>
                          <div className="font-medium">{transcript.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {transcript.messages.length} message{transcript.messages.length !== 1 ? 's' : ''}
                            {transcript.timestamp && ` • ${formatTimestamp(transcript.timestamp)}`}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto">
                        {transcript.messages.map((msg, idx) => (
                          <div 
                            key={idx} 
                            className={cn(
                              "text-xs rounded-md p-2",
                              msg.role === 'user' 
                                ? "bg-primary/10 text-foreground" 
                                : "bg-muted/50 text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-[10px] uppercase">
                                {msg.role === 'user' ? 'You' : 'AI'}
                              </span>
                              {msg.timestamp && (
                                <span className="text-[9px] text-muted-foreground">
                                  {formatTimestamp(msg.timestamp)}
                                </span>
                              )}
                            </div>
                            <div className="whitespace-pre-wrap break-words">
                              {msg.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

export default NotesTab;
