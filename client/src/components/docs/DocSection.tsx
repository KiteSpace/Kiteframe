import { useState, useRef, useEffect, useCallback, KeyboardEvent, useMemo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, RotateCcw, Sparkles, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAi } from '@/ai/AiProvider';
import { useToast } from '@/hooks/use-toast';

interface DocSectionProps {
  title: string;
  content: string;
  sectionKey: string;
  manuallyEdited?: boolean;
  onSave: (sectionKey: string, value: string) => void;
  onResetToAI?: (sectionKey: string) => void;
  enableAISuggestions?: boolean;
}

function renderFormattedContent(content: string): ReactNode {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      i++;
      continue;
    }

    // Check if line starts with a numbered item (e.g., "1. Item")
    const startsWithNumber = /^(\d+)\.\s+(.+)$/.test(trimmedLine);
    
    if (startsWithNumber) {
      // This line is a numbered item, collect consecutive numbered items
      const items: { number: number; text: string }[] = [];
      
      while (i < lines.length) {
        const currentLine = lines[i].trim();
        if (!currentLine) break;
        
        const match = currentLine.match(/^(\d+)\.\s+(.+)$/);
        if (match) {
          items.push({
            number: parseInt(match[1], 10),
            text: match[2]
          });
          i++;
        } else {
          break;
        }
      }
      
      if (items.length > 0) {
        elements.push(
          <ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-1.5 my-2">
            {items.map((item, idx) => (
              <li key={idx} className="text-sm leading-relaxed">
                {item.text}
              </li>
            ))}
          </ol>
        );
      }
    } else {
      // Check if line contains text followed by numbered items (e.g., "Text here. 2. Item 2. 3. Item 3")
      const parts = trimmedLine.split(/\s+(\d+\.)\s+/);
      
      // Check if we actually found numbered patterns in this line
      if (parts.length > 1) {
        const items: { number: number; text: string }[] = [];
        let pendingText = '';
        
        for (let j = 0; j < parts.length; j++) {
          if (j === 0) {
            // First part is either text or empty
            pendingText = parts[j].trim();
          } else if (/^\d+\.$/.test(parts[j])) {
            // This is a number like "2."
            const numberStr = parts[j].replace('.', '');
            const itemNumber = parseInt(numberStr, 10);
            const itemText = parts[j + 1]?.trim() || '';
            
            if (itemText) {
              items.push({
                number: itemNumber,
                text: itemText
              });
              j++; // Skip the next part as we've consumed it
            }
          }
        }
        
        // If we found at least 1 numbered item, render as list
        if (items.length > 0) {
          // Add pending text as first item if it exists
          if (pendingText && pendingText !== '0.') {
            items.unshift({
              number: 1,
              text: pendingText
            });
          }
          
          elements.push(
            <ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-1.5 my-2">
              {items.map((item, idx) => (
                <li key={idx} className="text-sm leading-relaxed">
                  {item.text}
                </li>
              ))}
            </ol>
          );
          i++;
          continue;
        }
      }
      
      // No numbered pattern found, render as regular paragraph
      elements.push(
        <p key={elements.length} className="text-sm leading-relaxed">
          {trimmedLine}
        </p>
      );
      i++;
    }
  }

  return <div className="space-y-1">{elements}</div>;
}

export function DocSection({
  title,
  content,
  sectionKey,
  manuallyEdited = false,
  onSave,
  onResetToAI,
  enableAISuggestions = true
}: DocSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [isHovered, setIsHovered] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ai = useAi();
  const { toast } = useToast();

  useEffect(() => {
    setEditValue(content);
  }, [content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    if (editValue !== content) {
      onSave(sectionKey, editValue);
    }
    setIsEditing(false);
  }, [editValue, content, sectionKey, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(content);
    setIsEditing(false);
  }, [content]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    }
  }, [handleCancel, handleSave]);

  const handleContentClick = useCallback(() => {
    if (!isEditing) {
      setIsEditing(true);
    }
  }, [isEditing]);

  const handleReset = useCallback(() => {
    onResetToAI?.(sectionKey);
  }, [sectionKey, onResetToAI]);

  const handleSuggestImprovements = useCallback(async () => {
    if (!content || isGeneratingSuggestion) return;

    setIsGeneratingSuggestion(true);
    setSuggestion(null);

    try {
      const response = await ai.chat({
        messages: [
          {
            role: 'system',
            content: 'You are a technical writer improving PRD content. Return ONLY the improved text, no explanations or markdown code blocks.'
          },
          {
            role: 'user',
            content: `Improve this "${title}" section. Make it clearer, more specific, and professional. Keep a similar length.\n\nCurrent content:\n${content}`
          }
        ],
        temperature: 0.4,
        maxTokens: 1000
      });

      setSuggestion(response.text.trim());
    } catch (error) {
      toast({
        title: 'Suggestion failed',
        description: error instanceof Error ? error.message : 'Could not generate suggestion',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingSuggestion(false);
    }
  }, [content, title, ai, toast, isGeneratingSuggestion]);

  const handleAcceptSuggestion = useCallback(() => {
    if (suggestion) {
      onSave(sectionKey, suggestion);
      setSuggestion(null);
      toast({ title: 'Suggestion applied', description: 'Content updated with AI suggestion.' });
    }
  }, [suggestion, sectionKey, onSave, toast]);

  const handleRejectSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  const formattedContent = useMemo(() => renderFormattedContent(content), [content]);
  const formattedSuggestion = useMemo(() => suggestion ? renderFormattedContent(suggestion) : null, [suggestion]);

  return (
    <section
      id={`prd-section-${sectionKey}`}
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`doc-section-${sectionKey}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          {title}
        </h3>
        
        <div className={cn(
          "flex items-center gap-1 transition-opacity duration-150",
          isHovered || isEditing || suggestion ? "opacity-100" : "opacity-0"
        )}>
          {enableAISuggestions && content && !isEditing && !suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={handleSuggestImprovements}
              disabled={isGeneratingSuggestion}
              data-testid={`suggest-${sectionKey}`}
            >
              {isGeneratingSuggestion ? (
                <Loader2 size={10} className="mr-1 animate-spin" />
              ) : (
                <Sparkles size={10} className="mr-1" />
              )}
              Suggest
            </Button>
          )}
          {manuallyEdited && onResetToAI && !suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={handleReset}
              data-testid={`reset-${sectionKey}`}
            >
              <RotateCcw size={10} className="mr-1" />
              Reset
            </Button>
          )}
          {!isEditing && !suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
              data-testid={`edit-${sectionKey}`}
            >
              <Edit3 size={12} />
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="min-h-[100px] text-sm leading-relaxed resize-none border-primary/20 focus:border-primary/40"
            placeholder="Enter content..."
            data-testid={`textarea-${sectionKey}`}
          />
          <div className="flex justify-end gap-2 text-[10px] text-muted-foreground">
            <span>Esc to cancel</span>
            <span>·</span>
            <span>⌘+Enter to save</span>
          </div>
        </div>
      ) : (
        <>
          <div
            onClick={handleContentClick}
            className={cn(
              "text-muted-foreground cursor-text",
              "hover:bg-accent/30 rounded-md transition-colors duration-100 -mx-2 px-2 py-1",
              !content && "italic text-sm"
            )}
            data-testid={`content-${sectionKey}`}
          >
            {formattedContent || "Click to add content..."}
          </div>

          {suggestion && (
            <div className="mt-3 border border-primary/30 rounded-md bg-primary/5 p-3" data-testid={`suggestion-${sectionKey}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase text-primary font-medium flex items-center gap-1">
                  <Sparkles size={10} />
                  AI Suggestion
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={handleAcceptSuggestion}
                    data-testid={`accept-${sectionKey}`}
                  >
                    <Check size={10} className="mr-1" />
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-100"
                    onClick={handleRejectSuggestion}
                    data-testid={`reject-${sectionKey}`}
                  >
                    <X size={10} className="mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
              <div className="text-muted-foreground text-sm">
                {formattedSuggestion}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
