import { useState, useRef, useEffect, useCallback, KeyboardEvent, useMemo, ReactNode } from 'react';
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

function renderFormattedContent(content: string): ReactNode {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let currentList: { number: number; text: string }[] = [];
  let listStartIndex = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ol key={`list-${listStartIndex}`} className="list-decimal list-inside space-y-1.5 my-2">
          {currentList.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed">
              {item.text}
            </li>
          ))}
        </ol>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    
    if (numberedMatch) {
      if (currentList.length === 0) {
        listStartIndex = index;
      }
      currentList.push({
        number: parseInt(numberedMatch[1], 10),
        text: numberedMatch[2]
      });
    } else {
      flushList();
      
      if (line.trim()) {
        elements.push(
          <p key={index} className="text-sm leading-relaxed">
            {line}
          </p>
        );
      } else if (index > 0 && index < lines.length - 1) {
        elements.push(<div key={index} className="h-2" />);
      }
    }
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
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

  const formattedContent = useMemo(() => renderFormattedContent(content), [content]);

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
            "text-muted-foreground cursor-text",
            "hover:bg-accent/30 rounded-md transition-colors duration-100 -mx-2 px-2 py-1",
            !content && "italic text-sm"
          )}
          data-testid={`content-${sectionKey}`}
        >
          {formattedContent || "Click to add content..."}
        </div>
      )}
    </section>
  );
}
