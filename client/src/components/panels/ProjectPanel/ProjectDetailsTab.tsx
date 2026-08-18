import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, Calendar, Tag, X, Plus } from 'lucide-react';
import { formatDate as sharedFormatDate } from '@/lib/utils/formatDate';

interface ProjectDetails {
  name: string;
  description: string;
  categories: string[];
  createdAt?: number;
  updatedAt?: number;
}

interface ProjectDetailsTabProps {
  projectId?: string;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
}

const DEFAULT_DETAILS: ProjectDetails = {
  name: '',
  description: '',
  categories: []
};

export function ProjectDetailsTab({ projectId, projectName, onProjectNameChange }: ProjectDetailsTabProps) {
  const [details, setDetails] = useState<ProjectDetails>(DEFAULT_DETAILS);
  const [newCategory, setNewCategory] = useState('');
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

  const formatDate = (timestamp?: number) =>
    sharedFormatDate(timestamp, { includeTime: true, fallback: 'Unknown' });

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <FolderOpen size={32} className="mb-2 opacity-50" />
        <p className="text-sm text-center">No project selected.</p>
        <p className="text-xs text-center mt-1">Open a workflow to see project details.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
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
            className="min-h-[80px] text-sm resize-none"
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
              <span className="text-xs text-muted-foreground">No categories added</span>
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

        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar size={12} />
              Created
            </span>
            <span>{formatDate(details.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar size={12} />
              Last Updated
            </span>
            <span>{formatDate(details.updatedAt)}</span>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
