import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { extractSemanticWorkflowModel } from '@/lib/kiteframe/utils/extractSemanticWorkflowModel';
import { FlowDetection } from '@/lib/kiteframe/utils/FlowDetection';
import { 
  loadProjectPRD, saveProjectPRD, saveProjectPRDBackup, 
  updatePRDSection, clearManualEdit 
} from '@/lib/kiteframe/utils/prdStorage';
import { type ProjectPRD, generateProjectPRD } from '@/ai/prdEngine';
import { useAi } from '@/ai/AiProvider';
import { useToast } from '@/hooks/use-toast';
import { DocSection, WorkflowDocument } from '@/components/docs';

interface ProjectPRDSectionProps {
  projectId: string;
  projectName: string;
  nodes: Node[];
  edges: Edge[];
  onPRDGenerated?: () => void;
}

export function ProjectPRDSection({ 
  projectId, 
  projectName,
  nodes,
  edges,
  onPRDGenerated
}: ProjectPRDSectionProps) {
  const [prd, setPrd] = useState<ProjectPRD | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const ai = useAi();
  const { toast } = useToast();

  useEffect(() => {
    if (projectId) {
      const loaded = loadProjectPRD(projectId);
      if (loaded) {
        setPrd(loaded);
      } else {
        setPrd(null);
      }
    }
  }, [projectId]);

  const handleGenerate = useCallback(async () => {
    if (!projectId || !projectName) return;

    setIsGenerating(true);

    try {
      if (prd) {
        saveProjectPRDBackup(projectId, prd);
        toast({ title: 'Backup saved', description: 'Previous spec saved as backup.' });
      }

      const flows = FlowDetection.detectFlows(nodes, edges);
      const workflowModels = flows
        .filter(flow => flow.nodes.length >= 2 && flow.edges.length >= 1)
        .map((flow, index) => extractSemanticWorkflowModel(
          flow.id,
          `Workflow ${index + 1}`,
          flow.nodes,
          flow.edges
        ));

      const newPrd = await generateProjectPRD(ai, projectId, projectName, workflowModels, prd || undefined);
      
      saveProjectPRD(projectId, newPrd);
      setPrd(newPrd);
      onPRDGenerated?.();

      toast({ title: 'Spec generated', description: 'Project spec has been created.' });
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, projectName, nodes, edges, prd, ai, toast, onPRDGenerated]);

  const handleSectionSave = useCallback((sectionKey: string, content: string) => {
    if (!prd || !projectId) return;

    const updated = updatePRDSection(prd, sectionKey, content, true) as ProjectPRD;
    setPrd(updated);
    saveProjectPRD(projectId, updated);
  }, [prd, projectId]);

  const handleResetSection = useCallback((sectionKey: string) => {
    if (!prd || !projectId) return;

    const updated = clearManualEdit(prd, sectionKey) as ProjectPRD;
    setPrd(updated);
    saveProjectPRD(projectId, updated);
  }, [prd, projectId]);

  return (
    <div data-testid="project-prd-section">
      {!prd && !isGenerating && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">
            No project spec generated yet.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="generate-project-prd"
          >
            <Sparkles size={14} className="mr-2" />
            Generate Project Spec
          </Button>
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Generating project spec...</span>
        </div>
      )}

      {prd && !isGenerating && (
        <WorkflowDocument>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">{projectName} Spec</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid="regenerate-project-prd"
            >
              <RefreshCw size={12} className="mr-1" />
              Regenerate
            </Button>
          </div>

          {prd.sections.map((section) => (
            <DocSection
              key={section.id}
              title={section.title}
              content={section.content}
              sectionKey={section.id}
              manuallyEdited={!!prd.manualEditedAt[section.id]}
              onSave={handleSectionSave}
              onResetToAI={handleResetSection}
            />
          ))}
        </WorkflowDocument>
      )}
    </div>
  );
}
