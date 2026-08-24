import { useState, useEffect, useRef, useCallback, KeyboardEvent, ChangeEvent, RefObject } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, Tag, X, Plus, ChevronDown, ChevronRight, Edit3, Sparkles, Loader2, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate as sharedFormatDate } from '@/lib/utils/formatDate';
import { useAi } from '@/ai/AiProvider';
import { usePRDGenerationState, prdGenerationBus } from '@/stores/prdGenerationBus';
import { notifyPanelDocsChanged } from '@/lib/kiteframe/utils/prdStorage';
import { schedulePanelDocsSave } from '@/lib/documents/panelDocsClient';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { getRouter, extractJSON } from '@/ai/router';

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
  nodes?: Node[];
  edges?: Edge[];
  isReadOnly?: boolean;
  /**
   * Server-side last-modified time for the cloud project, used when this
   * browser has never written the local details record (which is the only
   * thing that sets `details.updatedAt`). Without it the metadata line reads
   * "Updated: Unknown" for every project saved on another device.
   */
  serverUpdatedAt?: Date | string | number | null;
}

const DEFAULT_DETAILS: ProjectDetails = {
  name: '',
  description: '',
  categories: []
};

interface RefinementState {
  field: 'name' | 'description' | null;
  suggested: string;
  isRefining: boolean;
}

interface RefinementPreviewProps {
  original: string;
  suggested: string;
  isRefining: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  testId: string;
}

function RefinementPreview({ original, suggested, isRefining, onAccept, onReject, onRegenerate, testId }: RefinementPreviewProps) {
  if (isRefining) {
    return (
      <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-3" data-testid={`${testId}-refining`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          <span>Refining with AI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2" data-testid={`${testId}-preview`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Sparkles size={10} />
        <span>AI Suggestion</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{suggested}</p>
      <div className="flex items-center gap-1.5 pt-1">
        <Button
          size="sm"
          variant="default"
          className="h-6 text-xs px-2 gap-1"
          onClick={onAccept}
          data-testid={`${testId}-accept`}
        >
          <Check size={10} />
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2 gap-1"
          onClick={onReject}
          data-testid={`${testId}-reject`}
        >
          <X size={10} />
          Dismiss
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2 gap-1"
          onClick={onRegenerate}
          data-testid={`${testId}-regenerate`}
        >
          <RefreshCw size={10} />
          Regenerate
        </Button>
      </div>
    </div>
  );
}

interface InlineEditFieldProps {
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
  onRefine?: () => void;
  showRefineButton?: boolean;
  isRefineDisabled?: boolean;
  className?: string;
  multiline?: boolean;
  testId: string;
  isReadOnly?: boolean;
}

function InlineEditField({ value, placeholder, onSave, onRefine, showRefineButton = false, isRefineDisabled = false, className, multiline = false, testId, isReadOnly = false }: InlineEditFieldProps) {
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

  if (isReadOnly) {
    return (
      <div
        className={cn("rounded-md", !value && "italic text-muted-foreground", className)}
        data-testid={testId}
      >
        {value || placeholder}
      </div>
    );
  }

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
      <div className={cn(
        "absolute right-0 top-0 flex items-center gap-0.5",
        "transition-opacity duration-150",
        isHovered ? "opacity-100" : "opacity-0"
      )}>
        {showRefineButton && value && onRefine && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs text-primary hover:text-primary gap-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onRefine();
            }}
            disabled={isRefineDisabled}
            data-testid={`${testId}-refine-btn`}
            title="Refine with AI"
          >
            {isRefineDisabled ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Sparkles size={10} />
            )}
            <span className="text-[10px]">Refine</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setIsEditing(true)}
          data-testid={`${testId}-edit-btn`}
        >
          <Edit3 size={10} />
        </Button>
      </div>
    </div>
  );
}

export function ProjectOverviewSection({ projectId, projectName, onProjectNameChange, nodes = [], edges = [], isReadOnly = false, serverUpdatedAt }: ProjectOverviewSectionProps) {
  const [details, setDetails] = useState<ProjectDetails>(DEFAULT_DETAILS);
  const [newCategory, setNewCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isCategoriesHovered, setIsCategoriesHovered] = useState(false);
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [refinement, setRefinement] = useState<RefinementState>({ field: null, suggested: '', isRefining: false });
  const prevProjectId = useRef<string | undefined>(undefined);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const aiClient = useAi();

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    setRefinement({ field: null, suggested: '', isRefining: false });
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [projectId]);
  
  const { isGenerating: isGeneratingFromBus, updateKey } = usePRDGenerationState(projectId);

  const storageKey = projectId ? `kiteframe-details-${projectId}` : null;

  const loadFromStorage = useCallback(() => {
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
  }, [storageKey, projectName]);

  useEffect(() => {
    if (projectId !== prevProjectId.current) {
      prevProjectId.current = projectId;
      loadFromStorage();
    } else if (projectName !== details.name && projectName !== undefined) {
      setDetails(prev => ({ ...prev, name: projectName }));
    }
  }, [projectId, projectName, loadFromStorage]);

  useEffect(() => {
    if (updateKey > 0) {
      loadFromStorage();
    }
  }, [updateKey, loadFromStorage]);

  useEffect(() => {
    if (!storageKey) return;
    
    const toSave = { ...details, updatedAt: Date.now() };
    const detailsData = JSON.stringify(toSave);
    localStorage.setItem(storageKey, detailsData);
    if (!isReadOnly && projectId) {
      notifyPanelDocsChanged(projectId);
      // Persist independently of canvas autosave so shared viewers see overview
      // edits without requiring a full project save. No-ops unless projectId is
      // a real projectUuid (share viewers / local tabs are skipped).
      schedulePanelDocsSave(projectId, {
        detailsData,
        name: details.name || undefined,
        description: details.description ?? null,
      });
    }
  }, [details, storageKey, isReadOnly, projectId]);

  useEffect(() => {
    if (isAddingCategory && categoryInputRef.current) {
      categoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  const updateName = useCallback((name: string) => {
    setDetails(prev => ({ ...prev, name }));
    onProjectNameChange?.(name);
  }, [onProjectNameChange]);

  const updateDescription = useCallback((description: string) => {
    setDetails(prev => ({ ...prev, description }));
  }, []);

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

  const formatDate = (timestamp?: Date | string | number | null) =>
    sharedFormatDate(timestamp, { fallback: 'Unknown' });

  const buildWorkflowContext = useCallback(() => {
    if (!nodes || nodes.length === 0) return '';

    const nodeDescriptions = nodes.map(n => {
      const label = n.data?.label || n.type || 'Unnamed';
      const desc = n.data?.description ? `: ${n.data.description}` : '';
      return `  - [${n.type}] ${label}${desc}`;
    }).join('\n');

    const edgeDescriptions = (edges || []).map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      const sourceLabel = sourceNode?.data?.label || 'Node';
      const targetLabel = targetNode?.data?.label || 'Node';
      const edgeLabel = e.data?.label || e.label || '';
      return `  - ${sourceLabel} → ${targetLabel}${edgeLabel ? ` [${edgeLabel}]` : ''}`;
    }).join('\n');

    return `Nodes (${nodes.length}):\n${nodeDescriptions}\n\nConnections (${edges?.length || 0}):\n${edgeDescriptions}`;
  }, [nodes, edges]);

  const persistDetailsPatch = useCallback((patch: Partial<ProjectDetails>) => {
    if (!storageKey) return;
    try {
      const existingRaw = localStorage.getItem(storageKey);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const merged = { ...DEFAULT_DETAILS, ...existing, ...patch, updatedAt: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(merged));
    } catch (e) {
      console.warn('[ProjectOverviewSection] Failed to persist details:', e);
    }
  }, [storageKey]);

  const generateProjectInfo = useCallback(async () => {
    if (!nodes || nodes.length === 0 || !aiClient || !projectId) return;

    const requestProjectId = projectId;
    const signal = abortControllerRef.current?.signal;

    setIsGeneratingLocal(true);
    prdGenerationBus.startGeneration(requestProjectId);
    try {
      const workflowContext = buildWorkflowContext();
      
      const workflowSummary = `Analyze the following workflow and generate a concise, specific project name and description based on what the workflow actually does.

${workflowContext}

Based on the node labels, descriptions, and connections above, determine what this workflow is about and respond in JSON format:
{"name": "specific project name reflecting the actual workflow purpose (3-6 words)", "description": "2-3 sentence description of what this workflow specifically does, referencing the key steps and user journey"}`;

      const router = getRouter();
      const response = await router.chat({
        taskType: 'prd_generation',
        messages: [
          { role: 'system', content: 'You are a product manager. Analyze the workflow content carefully — read the node labels and descriptions to understand what the workflow is actually about. Be specific and concrete. Do not produce generic descriptions. Output only valid JSON.' },
          { role: 'user', content: workflowSummary }
        ],
        temperature: 0.4,
        maxTokens: 300,
        signal,
      });

      if (signal?.aborted || requestProjectId !== prevProjectId.current) {
        console.log('[ProjectOverviewSection] Project changed during AI fill — discarding result');
        return;
      }

      const jsonStr = extractJSON(response.text);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        const patch: Partial<ProjectDetails> = {};
        if (parsed.name) {
          patch.name = parsed.name;
          updateName(parsed.name);
        }
        if (parsed.description) {
          patch.description = parsed.description;
          updateDescription(parsed.description);
        }
        if (Object.keys(patch).length > 0) {
          persistDetailsPatch(patch);
          prdGenerationBus.notifyProjectDetailsUpdated(requestProjectId);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[ProjectOverviewSection] AI fill aborted');
        return;
      }
      console.error('Error generating project info:', error);
    } finally {
      setIsGeneratingLocal(false);
      prdGenerationBus.completeGeneration(requestProjectId);
    }
  }, [nodes, edges, aiClient, buildWorkflowContext, updateName, updateDescription, projectId, persistDetailsPatch]);

  const refineField = useCallback(async (field: 'name' | 'description') => {
    if (!nodes || nodes.length === 0) return;
    
    const currentValue = field === 'name' ? details.name : details.description;
    if (!currentValue.trim()) return;

    const requestProjectId = projectId;
    const signal = abortControllerRef.current?.signal;

    setRefinement({ field, suggested: '', isRefining: true });
    
    try {
      const workflowContext = buildWorkflowContext();
      const fieldLabel = field === 'name' ? 'project name' : 'project description';
      
      const prompt = `The user wrote the following ${fieldLabel}:

"${currentValue}"

Here is the actual workflow content this project is based on:

${workflowContext}

Refine the user's ${fieldLabel} to be more specific and descriptive based on the actual workflow content. Keep the user's intent and voice, but make it more accurate and concrete.

Return ONLY valid JSON:
{"refined": "the refined ${fieldLabel}"}`;

      const router = getRouter();
      const response = await router.chat({
        taskType: 'prd_generation',
        messages: [
          { role: 'system', content: `You are a product writing assistant. Refine the user's ${fieldLabel} to be more specific and descriptive based on the actual workflow content. Preserve the user's intent and voice. Be concise. Output only valid JSON.` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        maxTokens: 300,
        signal,
      });

      if (signal?.aborted || requestProjectId !== prevProjectId.current) {
        console.log('[ProjectOverviewSection] Project changed during refine — discarding result');
        return;
      }

      const jsonStr = extractJSON(response.text);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (parsed.refined) {
          setRefinement({ field, suggested: parsed.refined, isRefining: false });
          return;
        }
      }
      setRefinement({ field: null, suggested: '', isRefining: false });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[ProjectOverviewSection] Refine aborted');
        setRefinement({ field: null, suggested: '', isRefining: false });
        return;
      }
      console.error('Error refining field:', error);
      setRefinement({ field: null, suggested: '', isRefining: false });
    }
  }, [details, nodes, edges, buildWorkflowContext, projectId]);

  const acceptRefinement = useCallback(() => {
    if (!refinement.field || !refinement.suggested) return;
    if (refinement.field === 'name') {
      updateName(refinement.suggested);
      persistDetailsPatch({ name: refinement.suggested });
    } else {
      updateDescription(refinement.suggested);
      persistDetailsPatch({ description: refinement.suggested });
    }
    if (projectId) {
      prdGenerationBus.notifyProjectDetailsUpdated(projectId);
    }
    setRefinement({ field: null, suggested: '', isRefining: false });
  }, [refinement, updateName, updateDescription, projectId, persistDetailsPatch]);

  const rejectRefinement = useCallback(() => {
    setRefinement({ field: null, suggested: '', isRefining: false });
  }, []);

  const regenerateRefinement = useCallback(() => {
    if (refinement.field) {
      refineField(refinement.field);
    }
  }, [refinement.field, refineField]);

  const isGenerating = isGeneratingLocal || isGeneratingFromBus;
  const hasNodes = nodes && nodes.length > 0;

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
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left mb-3 group">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
            Project Overview
          </h2>
          {!isReadOnly && nodes && nodes.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                generateProjectInfo();
              }}
              disabled={isGenerating}
              data-testid="button-ai-fill"
              title="Fill project details with AI"
            >
              {isGenerating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
            </Button>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          {isGeneratingFromBus ? (
            <div className="space-y-4" data-testid="overview-skeleton">
              <Skeleton className="h-7 w-3/4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ) : (
            <>
              <div>
                <InlineEditField
                  value={details.name}
                  placeholder="Click to add project name..."
                  onSave={updateName}
                  onRefine={() => refineField('name')}
                  showRefineButton={!isReadOnly && hasNodes}
                  isRefineDisabled={refinement.isRefining}
                  className="text-lg font-semibold"
                  testId="project-name"
                  isReadOnly={isReadOnly}
                />
                {refinement.field === 'name' && (
                  <RefinementPreview
                    original={details.name}
                    suggested={refinement.suggested}
                    isRefining={refinement.isRefining}
                    onAccept={acceptRefinement}
                    onReject={rejectRefinement}
                    onRegenerate={regenerateRefinement}
                    testId="project-name-refinement"
                  />
                )}
              </div>

              <div>
                <InlineEditField
                  value={details.description}
                  placeholder="Click to add a description..."
                  onSave={updateDescription}
                  onRefine={() => refineField('description')}
                  showRefineButton={!isReadOnly && hasNodes}
                  isRefineDisabled={refinement.isRefining}
                  className="text-sm text-muted-foreground leading-relaxed"
                  multiline
                  testId="project-description"
                  isReadOnly={isReadOnly}
                />
                {refinement.field === 'description' && (
                  <RefinementPreview
                    original={details.description}
                    suggested={refinement.suggested}
                    isRefining={refinement.isRefining}
                    onAccept={acceptRefinement}
                    onReject={rejectRefinement}
                    onRegenerate={regenerateRefinement}
                    testId="project-description-refinement"
                  />
                )}
              </div>

          <div 
            className="space-y-2"
            onMouseEnter={() => !isReadOnly && setIsCategoriesHovered(true)}
            onMouseLeave={() => setIsCategoriesHovered(false)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag size={10} />
                Categories
              </span>
              {!isReadOnly && (
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
              )}
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {details.categories.length === 0 && !isAddingCategory && (
                <span 
                  className={cn(
                    "text-xs text-muted-foreground italic px-1 rounded",
                    !isReadOnly && "cursor-pointer hover:bg-accent/30"
                  )}
                  onClick={() => !isReadOnly && setIsAddingCategory(true)}
                >
                  {isReadOnly ? 'No categories' : 'Click to add categories...'}
                </span>
              )}
              {details.categories.map(category => (
                <Badge 
                  key={category} 
                  variant="secondary"
                  className={cn("text-xs gap-1", !isReadOnly && "pr-1")}
                  data-testid={`category-${category}`}
                >
                  {category}
                  {!isReadOnly && (
                    <button
                      onClick={() => removeCategory(category)}
                      className="ml-1 hover:text-destructive"
                      data-testid={`remove-category-${category}`}
                    >
                      <X size={10} />
                    </button>
                  )}
                </Badge>
              ))}
              {!isReadOnly && isAddingCategory && (
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
                  Updated: {formatDate(details.updatedAt ?? serverUpdatedAt)}
                </span>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
