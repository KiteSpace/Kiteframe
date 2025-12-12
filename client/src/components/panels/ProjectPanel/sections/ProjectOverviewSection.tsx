import { useState, useEffect, useRef, useCallback, KeyboardEvent, ChangeEvent, RefObject } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, Tag, X, Plus, ChevronDown, ChevronRight, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectDetails {
  name: string;
  description: string;
  categories: string[];
  createdAt?: number;
  updatedAt?: number;
}

interface ProjectOverviewSectionProps {
  projectId?: string;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
}

const DEFAULT_DETAILS: ProjectDetails = {
  name: '',
  description: '',
  categories: []
};

interface InlineEditFieldProps {
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
  className?: string;
  multiline?: boolean;
  testId: string;
}

function InlineEditField({ value, placeholder, onSave, className, multiline = false, testId }: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(
        inputRef.current.value.length,
        inputRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    } else if (!multiline && e.key === 'Enter') {
      handleSave();
    }
  }, [handleCancel, handleSave, multiline]);

  if (isEditing) {
    const sharedProps = {
      value: editValue,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      placeholder,
      className: cn("border-primary/20 focus:border-primary/40", className),
      "data-testid": `${testId}-input`
    };

    return multiline ? (
      <Textarea
        ref={inputRef as RefObject<HTMLTextAreaElement>}
        {...sharedProps}
        className={cn("min-h-[60px] text-sm resize-none", sharedProps.className)}
      />
    ) : (
      <Input
        ref={inputRef as RefObject<HTMLInputElement>}
        {...sharedProps}
        className={cn("h-auto text-base font-semibold p-0 border-0 border-b", sharedProps.className)}
      />
    );
  }

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        onClick={() => setIsEditing(true)}
        className={cn(
          "cursor-text rounded-md transition-colors duration-100 -mx-1 px-1",
          "hover:bg-accent/30",
          !value && "italic text-muted-foreground",
          className
        )}
        data-testid={testId}
      >
        {value || placeholder}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "absolute right-0 top-0 h-5 w-5 p-0 text-muted-foreground hover:text-foreground",
          "transition-opacity duration-150",
          isHovered ? "opacity-100" : "opacity-0"
        )}
        onClick={() => setIsEditing(true)}
        data-testid={`${testId}-edit-btn`}
      >
        <Edit3 size={10} />
      </Button>
    </div>
  );
}

export function ProjectOverviewSection({ projectId, projectName, onProjectNameChange }: ProjectOverviewSectionProps) {
  const [details, setDetails] = useState<ProjectDetails>(DEFAULT_DETAILS);
  const [newCategory, setNewCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isCategoriesHovered, setIsCategoriesHovered] = useState(false);
  const prevProjectId = useRef<string | undefined>(undefined);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const storageKey = projectId ? `kiteframe-details-${projectId}` : null;

  useEffect(() => {
    if (projectId !== prevProjectId.current) {
      prevProjectId.current = projectId;
      
      if (!storageKey) {
        setDetails({ ...DEFAULT_DETAILS, name: projectName || '' });
        return;
      }
      
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setDetails({ 
            ...DEFAULT_DETAILS, 
            ...parsed, 
            name: projectName || parsed.name || '' 
          });
        } catch {
          setDetails({ 
            ...DEFAULT_DETAILS, 
            name: projectName || '', 
            createdAt: Date.now() 
          });
        }
      } else {
        setDetails({ 
          ...DEFAULT_DETAILS, 
          name: projectName || '', 
          createdAt: Date.now() 
        });
      }
    } else if (projectName !== details.name && projectName !== undefined) {
      setDetails(prev => ({ ...prev, name: projectName }));
    }
  }, [projectId, projectName, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    
    const toSave = { ...details, updatedAt: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(toSave));
  }, [details, storageKey]);

  useEffect(() => {
    if (isAddingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  const updateName = (name: string) => {
    setDetails(prev => ({ ...prev, name }));
    onProjectNameChange?.(name);
  };

  const updateDescription = (description: string) => {
    setDetails(prev => ({ ...prev, description }));
  };

  const addCategory = () => {
    const category = newCategory.trim().toLowerCase();
    if (category && !details.categories.includes(category)) {
      setDetails(prev => ({ ...prev, categories: [...prev.categories, category] }));
      setNewCategory('');
      setIsAddingCategory(false);
    }
  };

  const removeCategory = (category: string) => {
    setDetails(prev => ({ ...prev, categories: prev.categories.filter(c => c !== category) }));
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!projectId) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No project selected.
      </div>
    );
  }

  return (
    <section data-testid="project-overview-section">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left mb-3">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Project Overview
          </h2>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          <InlineEditField
            value={details.name}
            placeholder="Click to add project name..."
            onSave={updateName}
            className="text-lg font-semibold"
            testId="project-name"
          />

          <InlineEditField
            value={details.description}
            placeholder="Click to add a description..."
            onSave={updateDescription}
            className="text-sm text-muted-foreground leading-relaxed"
            multiline
            testId="project-description"
          />

          <div 
            className="space-y-2"
            onMouseEnter={() => setIsCategoriesHovered(true)}
            onMouseLeave={() => setIsCategoriesHovered(false)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag size={10} />
                Categories
              </span>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-5 w-5 p-0 text-muted-foreground hover:text-foreground transition-opacity duration-150",
                  (isCategoriesHovered || isAddingCategory) ? "opacity-100" : "opacity-0"
                )}
                onClick={() => setIsAddingCategory(true)}
                data-testid="button-add-category"
              >
                <Plus size={10} />
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {details.categories.length === 0 && !isAddingCategory && (
                <span 
                  className="text-xs text-muted-foreground italic cursor-pointer hover:bg-accent/30 px-1 rounded"
                  onClick={() => setIsAddingCategory(true)}
                >
                  Click to add categories...
                </span>
              )}
              {details.categories.map(category => (
                <Badge 
                  key={category} 
                  variant="secondary"
                  className="text-xs pr-1 gap-1"
                  data-testid={`category-${category}`}
                >
                  {category}
                  <button
                    onClick={() => removeCategory(category)}
                    className="ml-1 hover:text-destructive"
                    data-testid={`remove-category-${category}`}
                  >
                    <X size={10} />
                  </button>
                </Badge>
              ))}
              {isAddingCategory && (
                <Input
                  ref={categoryInputRef}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Category name..."
                  className="h-6 text-xs w-24 px-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCategory();
                    } else if (e.key === 'Escape') {
                      setNewCategory('');
                      setIsAddingCategory(false);
                    }
                  }}
                  onBlur={() => {
                    if (newCategory.trim()) {
                      addCategory();
                    } else {
                      setIsAddingCategory(false);
                    }
                  }}
                  data-testid="input-new-category"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-2 border-t border-border/50">
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              Created: {formatDate(details.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              Updated: {formatDate(details.updatedAt)}
            </span>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
