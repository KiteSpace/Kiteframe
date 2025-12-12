import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2, AlertTriangle, X } from 'lucide-react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { extractSemanticWorkflowModel } from '@/lib/kiteframe/utils/extractSemanticWorkflowModel';
import { isWorkflowStale, storeHash, computeWorkflowHash } from '@/lib/kiteframe/utils/semanticHash';
import { 
  loadWorkflowPRD, saveWorkflowPRD, saveWorkflowPRDBackup, 
  updatePRDSection, clearManualEdit 
} from '@/lib/kiteframe/utils/prdStorage';
import { type WorkflowPRD } from '@/ai/prdEngine';
import { useAi } from '@/ai/AiProvider';
import { generateWorkflowPRD } from '@/ai/prdEngine';
import { useToast } from '@/hooks/use-toast';
import { DocSection, WorkflowDocument } from '@/components/docs';
import { usePRDNodeLinks } from '@/stores/prdNodeLinkStore';
import { focusBus } from '@/stores/focusBus';

interface WorkflowPRDSectionProps {
  projectId: string;
  workflowId: string;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
}

function NodePickerModal({ 
  nodes, 
  onSelect, 
  onClose 
}: { 
  nodes: Node[]; 
  onSelect: (nodeId: string) => void; 
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold">Select Node to Link</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto max-h-72 p-2">
          {nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No nodes available</p>
          ) : (
            nodes.map(node => (
              <button
                key={node.id}
                onClick={() => onSelect(node.id)}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                data-testid={`pick-node-${node.id}`}
              >
                <span className="text-xs text-muted-foreground">{node.type || 'node'}</span>
                <span>{node.data?.label || node.id}</span>
              </button>
            ))
          )}
        </div>
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
  const [linkingSectionId, setLinkingSectionId] = useState<string | null>(null);
  const ai = useAi();
  const { toast } = useToast();
  const prdLinks = usePRDNodeLinks(projectId);

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

  const handleSectionSave = useCallback((sectionKey: string, content: string) => {
    if (!prd || !projectId || !workflowId) return;

    const updated = updatePRDSection(prd, sectionKey, content, true) as WorkflowPRD;
    setPrd(updated);
    saveWorkflowPRD(projectId, workflowId, updated);
  }, [prd, projectId, workflowId]);

  const handleResetSection = useCallback((sectionKey: string) => {
    if (!prd || !projectId || !workflowId) return;

    const updated = clearManualEdit(prd, sectionKey) as WorkflowPRD;
    setPrd(updated);
    saveWorkflowPRD(projectId, workflowId, updated);
  }, [prd, projectId, workflowId]);

  const handleLinkNode = useCallback((sectionId: string) => {
    setLinkingSectionId(sectionId);
  }, []);

  const handleNodeSelected = useCallback((nodeId: string) => {
    if (!linkingSectionId) return;
    prdLinks.addLink(nodeId, workflowId, linkingSectionId);
    setLinkingSectionId(null);
    toast({ title: 'Node linked', description: 'Node connected to this section.' });
  }, [linkingSectionId, workflowId, prdLinks, toast]);

  const handleUnlinkNode = useCallback((nodeId: string, sectionId: string) => {
    prdLinks.removeLink(nodeId, workflowId, sectionId);
    toast({ title: 'Node unlinked', description: 'Link removed.' });
  }, [workflowId, prdLinks, toast]);

  const handleFocusNode = useCallback((nodeId: string) => {
    focusBus.focusNodes([nodeId], { select: true });
  }, []);

  return (
    <div data-testid="workflow-prd-section">
      {isStale && prd && (
        <div className="flex items-center gap-2 mb-4 text-xs text-yellow-600 dark:text-yellow-500">
          <AlertTriangle size={12} />
          <span>Workflow changed since last update.</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs underline"
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="regenerate-prd"
          >
            Regenerate
          </Button>
        </div>
      )}

      {!prd && !isGenerating && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">
            No spec generated yet for this workflow.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            data-testid="generate-prd"
          >
            <Sparkles size={14} className="mr-2" />
            Generate Spec
          </Button>
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Generating spec...</span>
        </div>
      )}

      {prd && !isGenerating && (
        <WorkflowDocument>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">{workflowName} Spec</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid="regenerate-btn"
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
              linkedNodes={prdLinks.getLinksForSection(workflowId, section.id)}
              onLinkNode={() => handleLinkNode(section.id)}
              onUnlinkNode={(nodeId) => handleUnlinkNode(nodeId, section.id)}
              onFocusNode={handleFocusNode}
            />
          ))}
        </WorkflowDocument>
      )}

      {linkingSectionId && (
        <NodePickerModal
          nodes={nodes}
          onSelect={handleNodeSelected}
          onClose={() => setLinkingSectionId(null)}
        />
      )}
    </div>
  );
}
