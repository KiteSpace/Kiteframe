import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocSectionProps {
  title: string;
  content: string;
  sectionKey: string;
  manuallyEdited?: boolean;
  onSave: (sectionKey: string, value: string) => void;
  onResetToAI?: (sectionKey: string) => void;
}

export function DocSection({
  title,
  content,
  sectionKey,
  manuallyEdited = false,
  onSave,
  onResetToAI
}: DocSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [isHovered, setIsHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <section
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
          isHovered || isEditing ? "opacity-100" : "opacity-0"
        )}>
          {manuallyEdited && onResetToAI && (
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
          {!isEditing && (
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
        <div
          onClick={handleContentClick}
          className={cn(
            "text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap cursor-text",
            "hover:bg-accent/30 rounded-md transition-colors duration-100 -mx-2 px-2 py-1",
            !content && "italic"
          )}
          data-testid={`content-${sectionKey}`}
        >
          {content || "Click to add content..."}
        </div>
      )}
    </section>
  );
}
