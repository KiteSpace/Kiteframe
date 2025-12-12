import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Sparkles, RefreshCw, FileText, AlertTriangle, Loader2, RotateCcw,
  Edit3, Eye
} from 'lucide-react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { extractSemanticWorkflowModel } from '@/lib/kiteframe/utils/extractSemanticWorkflowModel';
import { isWorkflowStale, storeHash, computeWorkflowHash } from '@/lib/kiteframe/utils/semanticHash';
import { 
  loadWorkflowPRD, saveWorkflowPRD, saveWorkflowPRDBackup, 
  updatePRDSection, clearManualEdit 
} from '@/lib/kiteframe/utils/prdStorage';
import { type WorkflowPRD, type PRDSection } from '@/ai/prdEngine';
import { useAi } from '@/ai/AiProvider';
import { generateWorkflowPRD } from '@/ai/prdEngine';
import { useToast } from '@/hooks/use-toast';

interface WorkflowPRDSectionProps {
  projectId: string;
  workflowId: string;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
}

function PRDSectionEditor({ 
  section, 
  isManuallyEdited,
  onUpdate, 
  onResetToAI 
}: { 
  section: PRDSection;
  isManuallyEdited: boolean;
  onUpdate: (content: string) => void;
  onResetToAI: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.content);

  const handleSave = () => {
    onUpdate(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(section.content);
    setIsEditing(false);
  };

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <h4 className="text-xs font-medium">{section.title}</h4>
        <div className="flex items-center gap-1">
          {isManuallyEdited && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-[10px]"
              onClick={onResetToAI}
              data-testid={`reset-section-${section.id}`}
            >
              <RotateCcw size={10} className="mr-1" />
              Reset
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setIsEditing(!isEditing)}
            data-testid={`edit-section-${section.id}`}
          >
            {isEditing ? <Eye size={10} /> : <Edit3 size={10} />}
          </Button>
        </div>
      </div>
      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] text-xs font-mono"
              placeholder="Enter content..."
              data-testid={`textarea-section-${section.id}`}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} className="h-6 text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} className="h-6 text-xs">
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
            {section.content || <span className="italic">No content yet. Click Generate to create.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkflowPRDSection({ 
  projectId, 
  workflowId, 
  workflowName,
  nodes,
  edges 
}: WorkflowPRDSectionProps) {
  const [prd, setPrd] = useState<WorkflowPRD | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const ai = useAi();
  const { toast } = useToast();

  useEffect(() => {
    if (projectId && workflowId) {
      const loaded = loadWorkflowPRD(projectId, workflowId);
      if (loaded) {
        setPrd(loaded);
        const stale = isWorkflowStale(projectId, workflowId, nodes, edges);
        setIsStale(stale);
      } else {
        setPrd(null);
        setIsStale(false);
      }
    }
  }, [projectId, workflowId, nodes, edges]);

  const handleGenerate = useCallback(async () => {
    if (!workflowId || !projectId) return;

    if (nodes.length > 50) {
      toast({
        title: 'Large workflow',
        description: 'This workflow has over 50 nodes. Generation may take longer.',
      });
    }

    setIsGenerating(true);

    try {
      if (prd) {
        saveWorkflowPRDBackup(projectId, workflowId, prd);
        toast({ title: 'Backup saved', description: 'Previous spec saved as backup.' });
      }

      const model = extractSemanticWorkflowModel(
        workflowId,
        workflowName,
        nodes,
        edges
      );

      const newPrd = await generateWorkflowPRD(ai, model, prd || undefined);
      
      const hash = computeWorkflowHash(nodes, edges);
      storeHash(projectId, workflowId, hash);
      
      saveWorkflowPRD(projectId, workflowId, { ...newPrd, hash });
      setPrd({ ...newPrd, hash });
      setIsStale(false);

      toast({ title: 'Spec generated', description: 'Workflow spec has been created.' });
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [workflowId, projectId, workflowName, nodes, edges, prd, ai, toast]);

  const handleSectionUpdate = useCallback((sectionId: string, content: string) => {
    if (!prd || !projectId || !workflowId) return;

    const updated = updatePRDSection(prd, sectionId, content, true) as WorkflowPRD;
    setPrd(updated);
    saveWorkflowPRD(projectId, workflowId, updated);
  }, [prd, projectId, workflowId]);

  const handleResetSection = useCallback((sectionId: string) => {
    if (!prd || !projectId || !workflowId) return;

    const updated = clearManualEdit(prd, sectionId) as WorkflowPRD;
    setPrd(updated);
    saveWorkflowPRD(projectId, workflowId, updated);
  }, [prd, projectId, workflowId]);

  return (
    <div className="space-y-3" data-testid="workflow-prd-section">
      {isStale && prd && (
        <Alert className="py-2">
          <AlertTriangle size={12} className="text-yellow-500" />
          <AlertDescription className="text-xs ml-2 flex items-center justify-between">
            <span>Workflow changed. Spec may be outdated.</span>
            <Button
              variant="outline"
              size="sm"
              className="h-5 text-[10px] ml-2"
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid="regenerate-prd"
            >
              <RefreshCw size={10} className="mr-1" />
              Update
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium flex items-center gap-1.5">
          <FileText size={12} />
          Workflow Spec
        </h3>
        <Button
          variant={prd ? 'outline' : 'default'}
          size="sm"
          className="h-6 text-[10px]"
          onClick={handleGenerate}
          disabled={isGenerating}
          data-testid="generate-prd"
        >
          {isGenerating ? (
            <Loader2 size={10} className="mr-1 animate-spin" />
          ) : (
            <Sparkles size={10} className="mr-1" />
          )}
          {prd ? 'Regenerate' : 'Generate'}
        </Button>
      </div>

      {prd && (
        <div className="space-y-2">
          {prd.sections.map((section) => (
            <PRDSectionEditor
              key={section.id}
              section={section}
              isManuallyEdited={!!prd.manualEditedAt[section.id]}
              onUpdate={(content) => handleSectionUpdate(section.id, content)}
              onResetToAI={() => handleResetSection(section.id)}
            />
          ))}
        </div>
      )}

      {!prd && !isGenerating && (
        <p className="text-xs text-muted-foreground italic">
          Click Generate to create a spec for this workflow.
        </p>
      )}
    </div>
  );
}
