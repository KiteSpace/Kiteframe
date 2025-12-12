import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FolderOpen, Calendar, Tag, X, Plus, ChevronDown, ChevronRight } from 'lucide-react';

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

export function ProjectOverviewSection({ projectId, projectName, onProjectNameChange }: ProjectOverviewSectionProps) {
  const [details, setDetails] = useState<ProjectDetails>(DEFAULT_DETAILS);
  const [newCategory, setNewCategory] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const prevProjectId = useRef<string | undefined>(undefined);

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
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-xs flex items-center gap-1.5">
              <FolderOpen size={12} />
              Project Name
            </Label>
            <Input
              id="project-name"
              value={details.name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="Enter project name..."
              className="h-8 text-sm"
              data-testid="input-project-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="project-description"
              value={details.description}
              onChange={(e) => updateDescription(e.target.value)}
              placeholder="Describe your project..."
              className="min-h-[60px] text-sm resize-none"
              data-testid="input-project-description"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Tag size={12} />
              Categories
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {details.categories.length === 0 ? (
                <span className="text-xs text-muted-foreground">No categories</span>
              ) : (
                details.categories.map(category => (
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
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Add category..."
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                data-testid="input-new-category"
              />
              <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7"
                onClick={addCategory}
                data-testid="button-add-category"
              >
                <Plus size={12} />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
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
