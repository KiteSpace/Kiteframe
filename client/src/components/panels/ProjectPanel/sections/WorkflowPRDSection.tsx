import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sparkles, RefreshCw, Loader2, AlertTriangle, X, Eye, Check, Lightbulb, AlertCircle, Clock, MoreHorizontal, Copy, Download, Upload } from 'lucide-react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { extractSemanticWorkflowModel } from '@/lib/kiteframe/utils/extractSemanticWorkflowModel';
import { isWorkflowStale, storeHash, computeWorkflowHash } from '@/lib/kiteframe/utils/semanticHash';
import { 
  loadWorkflowPRD, saveWorkflowPRD, saveWorkflowPRDBackup, 
  updatePRDSection, clearManualEdit 
} from '@/lib/kiteframe/utils/prdStorage';
import { 
  exportWorkflowPRDToMarkdown, 
  copyToClipboard, 
  downloadMarkdownFile, 
  generatePRDFilename 
} from '@/lib/kiteframe/utils/prdExport';
import { type WorkflowPRD } from '@/ai/prdEngine';
import { useAi } from '@/ai/AiProvider';
import { generateWorkflowPRD } from '@/ai/prdEngine';
import { reviewPRD, type PRDReviewResult, type PRDSuggestion } from '@/ai/prdSteward';
import { useToast } from '@/hooks/use-toast';
import { DocSection, WorkflowDocument } from '@/components/docs';
import { usePRDNodeLinks } from '@/stores/prdNodeLinkStore';
import { focusBus } from '@/stores/focusBus';
import { ImportPRDModal } from '@/components/ImportPRDModal';
import { addImportedDocumentSource } from '@/lib/kiteframe/utils/sourceTracking';
import { getInsightsForTarget, dismissInsight } from '@/stores/aiInsightStore';
import { getInsightIcon, type AIInsight } from '@/ai/insights';

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

function SuggestionCard({ 
  suggestion, 
  onApply,
  onDismiss 
}: { 
  suggestion: PRDSuggestion; 
  onApply: () => void;
  onDismiss: () => void;
}) {
  const typeIcons = {
    improvement: <Lightbulb size={14} className="text-blue-500" />,
    missing: <AlertCircle size={14} className="text-orange-500" />,
    stale: <Clock size={14} className="text-yellow-500" />
  };

  const typeBorders = {
    improvement: 'border-blue-200 dark:border-blue-800',
    missing: 'border-orange-200 dark:border-orange-800',
    stale: 'border-yellow-200 dark:border-yellow-800'
  };

  return (
    <div 
      className={`border rounded-md p-3 mb-2 bg-white dark:bg-gray-800 ${typeBorders[suggestion.type]}`}
      data-testid={`suggestion-${suggestion.sectionId}-${suggestion.type}`}
    >
      <div className="flex items-start gap-2">
        {typeIcons[suggestion.type]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{suggestion.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase">
              {suggestion.type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
          {suggestion.suggestedContent && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs font-mono max-h-24 overflow-y-auto">
              {suggestion.suggestedContent.substring(0, 200)}
              {suggestion.suggestedContent.length > 200 && '...'}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            {suggestion.suggestedContent && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={onApply}
                data-testid={`apply-suggestion-${suggestion.sectionId}`}
              >
                <Check size={12} className="mr-1" />
                Apply
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={onDismiss}
              data-testid={`dismiss-suggestion-${suggestion.sectionId}`}
            >
              <X size={12} className="mr-1" />
              Dismiss
            </Button>
          </div>
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
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<PRDReviewResult | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [linkingSectionId, setLinkingSectionId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sectionInsights, setSectionInsights] = useState<Record<string, AIInsight[]>>({});
  const ai = useAi();
  const { toast } = useToast();
  const prdLinks = usePRDNodeLinks(projectId);
  
  const loadSectionInsights = useCallback(() => {
    if (!prd) return;
    const insightMap: Record<string, AIInsight[]> = {};
    prd.sections.forEach(section => {
      insightMap[section.id] = getInsightsForTarget(projectId, 'prd-section', section.id);
    });
    setSectionInsights(insightMap);
  }, [projectId, prd]);
  
  useEffect(() => {
    loadSectionInsights();
  }, [loadSectionInsights]);
  
  const handleDismissInsight = useCallback((insightId: string) => {
    dismissInsight(projectId, insightId);
    loadSectionInsights();
  }, [projectId, loadSectionInsights]);

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

  const handleReview = useCallback(async () => {
    if (!workflowId || !projectId || !prd) return;

    setIsReviewing(true);
    setReviewResult(null);

    try {
      const model = extractSemanticWorkflowModel(
        workflowId,
        workflowName,
        nodes,
        edges
      );

      const result = await reviewPRD(ai, model, prd);
      setReviewResult(result);

      if (result.suggestions.length === 0) {
        toast({ title: 'Review complete', description: 'No suggestions - your spec looks good!' });
      } else {
        toast({ title: 'Review complete', description: `${result.suggestions.length} suggestion(s) found.` });
      }
    } catch (error) {
      toast({
        title: 'Review failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsReviewing(false);
    }
  }, [workflowId, projectId, workflowName, nodes, edges, prd, ai, toast]);

  const handleApplySuggestion = useCallback((suggestion: PRDSuggestion) => {
    if (!prd || !projectId || !workflowId || !suggestion.suggestedContent) return;

    const updated = updatePRDSection(prd, suggestion.sectionId, suggestion.suggestedContent, true) as WorkflowPRD;
    setPrd(updated);
    saveWorkflowPRD(projectId, workflowId, updated);

    setReviewResult(prev => prev ? {
      ...prev,
      suggestions: prev.suggestions.filter(s => 
        !(s.sectionId === suggestion.sectionId && s.type === suggestion.type)
      )
    } : null);

    toast({ title: 'Applied', description: `Updated ${suggestion.sectionId} section.` });
  }, [prd, projectId, workflowId, toast]);

  const handleDismissSuggestion = useCallback((suggestion: PRDSuggestion) => {
    setReviewResult(prev => prev ? {
      ...prev,
      suggestions: prev.suggestions.filter(s => 
        !(s.sectionId === suggestion.sectionId && s.type === suggestion.type)
      )
    } : null);
  }, []);

  const handleCopyMarkdown = useCallback(async () => {
    if (!prd) return;
    const markdown = exportWorkflowPRDToMarkdown(prd);
    const success = await copyToClipboard(markdown);
    if (success) {
      toast({ title: 'Copied', description: 'Spec copied to clipboard as markdown.' });
    } else {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  }, [prd, toast]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!prd) return;
    const markdown = exportWorkflowPRDToMarkdown(prd);
    const filename = generatePRDFilename(workflowName);
    downloadMarkdownFile(markdown, filename);
    toast({ title: 'Downloaded', description: `Saved as ${filename}` });
  }, [prd, workflowName, toast]);

  const handleImportPRD = useCallback((importedPrd: WorkflowPRD) => {
    if (!projectId || !workflowId) return;
    
    if (prd) {
      saveWorkflowPRDBackup(projectId, workflowId, prd);
    }
    
    saveWorkflowPRD(projectId, workflowId, importedPrd);
    setPrd(importedPrd);
    setIsImportModalOpen(false);
    
    addImportedDocumentSource(
      projectId,
      workflowId,
      `Imported PRD: ${workflowName}`,
      importedPrd.sections.length
    );
  }, [projectId, workflowId, workflowName, prd]);

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
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleReview}
                disabled={isReviewing || isGenerating}
                data-testid="review-prd-btn"
              >
                {isReviewing ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <Eye size={12} className="mr-1" />
                )}
                Review with AI
              </Button>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    data-testid="prd-menu-btn"
                  >
                    <MoreHorizontal size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyMarkdown} data-testid="copy-prd-markdown">
                    <Copy size={14} className="mr-2" />
                    Copy as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadMarkdown} data-testid="download-prd-markdown">
                    <Download size={14} className="mr-2" />
                    Download .md
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsImportModalOpen(true)} data-testid="import-prd">
                    <Upload size={14} className="mr-2" />
                    Import PRD
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {reviewResult && reviewResult.suggestions.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-blue-600" />
                  <span className="text-sm font-medium">AI Review Suggestions</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setReviewResult(null)}
                  data-testid="dismiss-all-suggestions"
                >
                  <X size={12} className="mr-1" />
                  Dismiss All
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{reviewResult.summary}</p>
              {reviewResult.suggestions.map((suggestion, idx) => (
                <SuggestionCard
                  key={`${suggestion.sectionId}-${suggestion.type}-${idx}`}
                  suggestion={suggestion}
                  onApply={() => handleApplySuggestion(suggestion)}
                  onDismiss={() => handleDismissSuggestion(suggestion)}
                />
              ))}
            </div>
          )}

          {prd.sections.map((section) => {
            const insights = sectionInsights[section.id] || [];
            return (
              <div key={section.id}>
                {insights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {insights.map((insight) => (
                      <div
                        key={insight.id}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                          insight.level === 'risk' 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                            : insight.level === 'warning'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}
                        data-testid={`insight-chip-${insight.id}`}
                      >
                        <span>{getInsightIcon(insight.level)}</span>
                        <span className="max-w-[200px] truncate">{insight.message}</span>
                        <button
                          onClick={() => handleDismissInsight(insight.id)}
                          className="ml-1 hover:opacity-70"
                          data-testid={`dismiss-insight-${insight.id}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <DocSection
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
              </div>
            );
          })}
        </WorkflowDocument>
      )}

      {linkingSectionId && (
        <NodePickerModal
          nodes={nodes}
          onSelect={handleNodeSelected}
          onClose={() => setLinkingSectionId(null)}
        />
      )}

      <ImportPRDModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportPRD}
        workflowId={workflowId}
        workflowName={workflowName}
      />
    </div>
  );
}
