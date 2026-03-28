import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sparkles, RefreshCw, Loader2, AlertTriangle, X, MoreHorizontal, Copy, Download, Upload, History, RotateCw, FileJson, Code, Printer } from 'lucide-react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { extractSemanticWorkflowModel } from '@/lib/kiteframe/utils/extractSemanticWorkflowModel';
import { isWorkflowStale, storeHash, computeWorkflowHash } from '@/lib/kiteframe/utils/semanticHash';
import { 
  computeAllSectionHashes, 
  detectStaleSections, 
  loadSectionHashes, 
  saveSectionHashes,
  type SectionHashMap,
  type StaleSectionInfo
} from '@/lib/kiteframe/utils/sectionDependencies';
import { 
  loadWorkflowPRD, saveWorkflowPRD, saveWorkflowPRDBackup, 
  updatePRDSection, clearManualEdit,
  saveWorkflowPRDVersion, loadWorkflowPRDHistory, restoreWorkflowPRDVersion,
  type PRDVersion
} from '@/lib/kiteframe/utils/prdStorage';
import { 
  exportWorkflowPRDToMarkdown, 
  copyToClipboard, 
  downloadMarkdownFile, 
  generatePRDFilename 
} from '@/lib/kiteframe/utils/prdExport';
import { type WorkflowPRD } from '@/ai/prdEngine';
import { getRouter } from '@/ai/router';
import { generateWorkflowPRD, generateSingleSection, elaborateSection } from '@/ai/prdEngine';
import { reviewPRD, type PRDReviewResult, type PRDSuggestion } from '@/ai/prdSteward';
import { useToast } from '@/hooks/use-toast';
import { DocSection, WorkflowDocument } from '@/components/docs';
import { usePRDNodeLinks } from '@/stores/prdNodeLinkStore';
import { focusBus } from '@/stores/focusBus';
import { ImportPRDModal } from '@/components/ImportPRDModal';
import { addImportedDocumentSource } from '@/lib/kiteframe/utils/sourceTracking';
import { getInsightsForTarget, dismissInsight, addInsight } from '@/stores/aiInsightStore';
import { getInsightIcon, type AIInsight } from '@/ai/insights';
import { analyzeWorkflowForFailures } from '@/ai/failureFirstHeuristics';
import { WorkflowIntentSection } from './WorkflowIntentSection';
import { 
  generatePrototypingPrompt, 
  copyPrototypingPromptToClipboard,
  exportKiteframePRDJson,
  downloadKiteframePRDJson
} from '@/lib/export';
import { usePRDGenerationState } from '@/stores/prdGenerationBus';

interface WorkflowPRDSectionProps {
  projectId: string;
  workflowId: string;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  isReadOnly?: boolean;
}

type LinkPickerTab = 'nodes' | 'edges';

function LinkPickerModal({ 
  nodes,
  edges,
  onSelectNode,
  onSelectEdge, 
  onClose 
}: { 
  nodes: Node[];
  edges: Edge[];
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<LinkPickerTab>('nodes');

  const getEdgeLabel = (edge: Edge) => {
    if (edge.label) return edge.label;
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    const sourceName = sourceNode?.data?.label || edge.source;
    const targetName = targetNode?.data?.label || edge.target;
    return `${sourceName} → ${targetName}`;
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold">Link to Section</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" data-testid="close-link-picker">
            <X size={16} />
          </button>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('nodes')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'nodes' 
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500' 
                : 'text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            data-testid="link-picker-tab-nodes"
          >
            Nodes ({nodes.length})
          </button>
          <button
            onClick={() => setActiveTab('edges')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'edges' 
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-b-2 border-purple-500' 
                : 'text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            data-testid="link-picker-tab-edges"
          >
            Edges ({edges.length})
          </button>
        </div>
        <div className="overflow-y-auto max-h-72 p-2">
          {activeTab === 'nodes' ? (
            nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No nodes available</p>
            ) : (
              nodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                  data-testid={`pick-node-${node.id}`}
                >
                  <span className="text-xs text-blue-600 dark:text-blue-400">{node.type || 'node'}</span>
                  <span>{node.data?.label || node.id}</span>
                </button>
              ))
            )
          ) : (
            edges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No edges available</p>
            ) : (
              edges.map(edge => (
                <button
                  key={edge.id}
                  onClick={() => onSelectEdge(edge.id)}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2"
                  data-testid={`pick-edge-${edge.id}`}
                >
                  <span className="text-xs text-purple-600 dark:text-purple-400">edge</span>
                  <span className="truncate">{getEdgeLabel(edge)}</span>
                </button>
              ))
            )
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
  edges,
  isReadOnly = false
}: WorkflowPRDSectionProps) {
  const [prd, setPrd] = useState<WorkflowPRD | null>(null);
  const [history, setHistory] = useState<PRDVersion<WorkflowPRD>[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<PRDReviewResult | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [linkingSectionId, setLinkingSectionId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sectionInsights, setSectionInsights] = useState<Record<string, AIInsight[]>>({});
  const [staleSections, setStaleSections] = useState<Record<string, boolean>>({});
  const [isRegeneratingSectionId, setIsRegeneratingSectionId] = useState<string | null>(null);
  const [applyingSuggestionSectionId, setApplyingSuggestionSectionId] = useState<string | null>(null);
  const prevUpdateKeyRef = useRef(0);
  const { toast } = useToast();
  const prdLinks = usePRDNodeLinks(projectId);
  
  const { updateKey } = usePRDGenerationState(projectId);

  const suggestionsBySectionId = useMemo(() => {
    if (!reviewResult?.suggestions) return {};
    return reviewResult.suggestions.reduce((acc, suggestion) => {
      if (!acc[suggestion.sectionId]) {
        acc[suggestion.sectionId] = [];
      }
      acc[suggestion.sectionId].push(suggestion);
      return acc;
    }, {} as Record<string, PRDSuggestion[]>);
  }, [reviewResult]);
  
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

  const loadFromStorage = useCallback(() => {
    if (projectId && workflowId) {
      console.log('[PRD][LOAD_ATTEMPT]', { projectId, workflowId, key: `prd-workflow-${projectId}-${workflowId}` });
      const loaded = loadWorkflowPRD(projectId, workflowId);
      console.log('[PRD][LOAD_RESULT]', { found: !!loaded, length: loaded?.sections?.length ?? 0 });
      if (loaded) {
        setPrd(loaded);
        const stale = isWorkflowStale(projectId, workflowId, nodes, edges);
        setIsStale(stale);
        
        const storedHashes = loaded.sectionHashes || loadSectionHashes(projectId, workflowId) || undefined;
        const currentHashes = computeAllSectionHashes(nodes, edges);
        const staleInfo = detectStaleSections(storedHashes, currentHashes);
        const staleMap: Record<string, boolean> = {};
        staleInfo.forEach(info => {
          staleMap[info.sectionId] = info.isStale;
        });
        setStaleSections(staleMap);
      } else {
        setPrd(null);
        setIsStale(false);
        setStaleSections({});
      }
      const loadedHistory = loadWorkflowPRDHistory(projectId, workflowId);
      setHistory(loadedHistory);
    }
  }, [projectId, workflowId, nodes, edges]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);
  
  useEffect(() => {
    if (updateKey > 0 && updateKey !== prevUpdateKeyRef.current) {
      prevUpdateKeyRef.current = updateKey;
      loadFromStorage();
    }
  }, [updateKey, loadFromStorage]);

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
        saveWorkflowPRDVersion(projectId, workflowId, prd, 'ai-update');
        saveWorkflowPRDBackup(projectId, workflowId, prd);
        toast({ title: 'Backup saved', description: 'Previous spec saved as backup.' });
      }

      const model = extractSemanticWorkflowModel(
        workflowId,
        workflowName,
        nodes,
        edges
      );

      const router = getRouter();
      const newPrd = await generateWorkflowPRD(router, model, prd || undefined);
      
      const hash = computeWorkflowHash(nodes, edges);
      storeHash(projectId, workflowId, hash);
      
      const sectionHashes = computeAllSectionHashes(nodes, edges);
      saveWorkflowPRD(projectId, workflowId, { ...newPrd, hash, sectionHashes });
      saveSectionHashes(projectId, workflowId, sectionHashes);
      setPrd({ ...newPrd, hash, sectionHashes });
      setIsStale(false);
      setStaleSections({});
      
      saveWorkflowPRDVersion(projectId, workflowId, { ...newPrd, hash }, 'ai-generate');
      const updatedHistory = loadWorkflowPRDHistory(projectId, workflowId);
      setHistory(updatedHistory);

      const failureAnalysis = analyzeWorkflowForFailures(workflowId, nodes, edges);
      failureAnalysis.insights.forEach(insight => {
        addInsight(projectId, insight);
      });
      loadSectionInsights();

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
  }, [workflowId, projectId, workflowName, nodes, edges, prd, toast]);

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
    prdLinks.addLink(nodeId, 'node', workflowId, linkingSectionId);
    setLinkingSectionId(null);
    toast({ title: 'Node linked', description: 'Node connected to this section.' });
  }, [linkingSectionId, workflowId, prdLinks, toast]);

  const handleEdgeSelected = useCallback((edgeId: string) => {
    if (!linkingSectionId) return;
    prdLinks.addLink(edgeId, 'edge', workflowId, linkingSectionId);
    setLinkingSectionId(null);
    toast({ title: 'Edge linked', description: 'Edge connected to this section.' });
  }, [linkingSectionId, workflowId, prdLinks, toast]);

  const handleUnlinkNode = useCallback((nodeId: string, sectionId: string) => {
    prdLinks.removeLink(nodeId, 'node', workflowId, sectionId);
    toast({ title: 'Node unlinked', description: 'Link removed.' });
  }, [workflowId, prdLinks, toast]);

  const handleUnlinkItem = useCallback((targetId: string, targetType: 'node' | 'edge', sectionId: string) => {
    prdLinks.removeLink(targetId, targetType, workflowId, sectionId);
    toast({ title: targetType === 'edge' ? 'Edge unlinked' : 'Node unlinked', description: 'Link removed.' });
  }, [workflowId, prdLinks, toast]);

  const handleFocusNode = useCallback((nodeId: string) => {
    focusBus.focusNodes([nodeId], { select: true });
  }, []);

  const handleFocusEdge = useCallback((edgeId: string) => {
    focusBus.focusEdges([edgeId], { select: true });
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

      const router = getRouter();
      const result = await reviewPRD(router, model, prd);
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
  }, [workflowId, projectId, workflowName, nodes, edges, prd, toast]);

  const handleRestoreVersion = useCallback((version: number) => {
    if (!projectId || !workflowId) return;
    const restored = restoreWorkflowPRDVersion(projectId, workflowId, version);
    if (restored) {
      setPrd(restored);
      const updatedHistory = loadWorkflowPRDHistory(projectId, workflowId);
      setHistory(updatedHistory);
      toast({ title: 'Version restored', description: `Restored to version ${version}.` });
    } else {
      toast({ title: 'Restore failed', description: 'Could not restore version.', variant: 'destructive' });
    }
  }, [projectId, workflowId, toast]);

  const handleApplySuggestion = useCallback(async (suggestion: PRDSuggestion) => {
    if (!prd || !projectId || !workflowId) return;

    const section = prd.sections.find(s => s.id === suggestion.sectionId);
    if (!section) return;

    setApplyingSuggestionSectionId(suggestion.sectionId);

    try {
      let newContent = suggestion.suggestedContent || '';

      const router = getRouter();
      const response = await router.chat({
        taskType: 'prd_generation',
        messages: [
          {
            role: 'system',
            content: 'You are a technical writer improving PRD content. Return ONLY the improved text, no explanations or markdown code blocks.'
          },
          {
            role: 'user',
            content: `Improve this PRD section based on the suggestion below.\n\nOriginal section:\n${section.content}\n\nSuggestion type: ${suggestion.type}\nSuggestion: ${suggestion.description}\n\n${suggestion.suggestedContent ? `Suggested improvement:\n${suggestion.suggestedContent}\n\n` : ''}Rewrite the section incorporating this improvement. Keep a similar format and length.`
          }
        ],
        temperature: 0.4,
        maxTokens: 1000
      });

      if (response.text?.trim()) {
        newContent = response.text.trim();
      }

      if (!newContent) {
        toast({ title: 'Apply failed', description: 'Could not generate improved content.', variant: 'destructive' });
        return;
      }

      const updated = updatePRDSection(prd, suggestion.sectionId, newContent, true) as WorkflowPRD;
      setPrd(updated);
      saveWorkflowPRD(projectId, workflowId, updated);

      setReviewResult(prev => prev ? {
        ...prev,
        suggestions: prev.suggestions.filter(s => 
          !(s.sectionId === suggestion.sectionId && s.type === suggestion.type)
        )
      } : null);

      toast({ title: 'Applied', description: `Updated ${suggestion.sectionId} section with AI improvements.` });
    } catch (error) {
      if (suggestion.suggestedContent) {
        const updated = updatePRDSection(prd, suggestion.sectionId, suggestion.suggestedContent, true) as WorkflowPRD;
        setPrd(updated);
        saveWorkflowPRD(projectId, workflowId, updated);
        setReviewResult(prev => prev ? {
          ...prev,
          suggestions: prev.suggestions.filter(s => 
            !(s.sectionId === suggestion.sectionId && s.type === suggestion.type)
          )
        } : null);
        toast({ title: 'Applied', description: `Updated ${suggestion.sectionId} section (used suggestion directly).` });
      } else {
        toast({ title: 'Apply failed', description: 'Could not apply suggestion.', variant: 'destructive' });
      }
    } finally {
      setApplyingSuggestionSectionId(null);
    }
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

  const handleCopyPrototypingPrompt = useCallback(async () => {
    if (!prd) return;
    const prompt = generatePrototypingPrompt({
      workflowName,
      prd,
      role: 'developer',
      includeContext: true
    });
    const success = await copyPrototypingPromptToClipboard(prompt);
    if (success) {
      toast({ title: 'Copied', description: 'Prototyping prompt copied to clipboard.' });
    } else {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  }, [prd, workflowName, toast]);

  const handleDownloadKiteframePRD = useCallback(() => {
    if (!prd) return;
    const json = exportKiteframePRDJson({
      workflowId,
      workflowName,
      prd,
      nodes,
      edges,
      projectId,
      includeWorkflow: true
    });
    downloadKiteframePRDJson(json, workflowName);
    toast({ title: 'Downloaded', description: 'Kiteframe PRD exported as JSON.' });
  }, [prd, workflowId, workflowName, nodes, edges, projectId, toast]);

  const handlePrintPRD = useCallback(() => {
    window.print();
  }, []);

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

  const handleRegenerateSection = useCallback(async (sectionId: string) => {
    if (!prd || !projectId || !workflowId) return;
    
    if (prd.manualEditedAt[sectionId]) {
      const confirmed = window.confirm(
        'This section has manual edits. Regenerating will overwrite them. Continue?'
      );
      if (!confirmed) return;
    }
    
    setIsRegeneratingSectionId(sectionId);
    
    try {
      const model = extractSemanticWorkflowModel(workflowId, workflowName, nodes, edges);
      const router = getRouter();
      const newSection = await generateSingleSection(router, model, sectionId, prd);
      
      if (newSection) {
        const updatedSections = prd.sections.map(s => 
          s.id === sectionId ? newSection : s
        );
        
        const currentHashes = computeAllSectionHashes(nodes, edges);
        const updatedManualEdits = { ...prd.manualEditedAt };
        delete updatedManualEdits[sectionId];
        
        const updatedPrd: WorkflowPRD = {
          ...prd,
          sections: updatedSections,
          manualEditedAt: updatedManualEdits,
          sectionHashes: currentHashes
        };
        
        saveWorkflowPRD(projectId, workflowId, updatedPrd);
        saveSectionHashes(projectId, workflowId, currentHashes);
        setPrd(updatedPrd);
        setStaleSections(prev => ({ ...prev, [sectionId]: false }));
        
        toast({ title: 'Section regenerated', description: `Updated ${newSection.title}.` });
      }
    } catch (error) {
      toast({
        title: 'Regeneration failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRegeneratingSectionId(null);
    }
  }, [prd, projectId, workflowId, workflowName, nodes, edges, toast]);

  const handleElaborateSection = useCallback(async (sectionId: string): Promise<string | null> => {
    if (!prd) return null;
    const section = prd.sections.find(s => s.id === sectionId);
    if (!section?.content) return null;

    const model = extractSemanticWorkflowModel(workflowId, workflowName, nodes, edges);
    const router = getRouter();
    return elaborateSection(router, model, sectionId, section.content);
  }, [prd, workflowId, workflowName, nodes, edges]);

  return (
    <div data-testid="workflow-prd-section">
      {isStale && prd && !isReadOnly && (
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
            {isReadOnly ? 'No spec available for this workflow.' : 'No spec generated yet for this workflow.'}
          </p>
          {!isReadOnly && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid="generate-prd"
            >
              <Sparkles size={14} className="mr-2" />
              Generate Spec
            </Button>
          )}
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
          <WorkflowIntentSection
            projectId={projectId}
            workflowId={workflowId}
            workflowName={workflowName}
            nodes={nodes}
            edges={edges}
          />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{workflowName} Spec</h2>
              {prd.autoGenerated && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded" data-testid="ai-draft-label">
                  <Sparkles size={10} />
                  AI Draft
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isReadOnly && history.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid="workflow-history-dropdown">
                      <History size={12} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs">Version History</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {history.map((v) => (
                      <DropdownMenuItem key={v.version} onClick={() => handleRestoreVersion(v.version)} className="text-xs cursor-pointer" data-testid={`restore-workflow-version-${v.version}`}>
                        <RotateCw size={10} className="mr-2" />
                        <div className="flex-1">
                          <div className="font-medium">v{v.version}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(v.createdAt).toLocaleString()} · {v.reason}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {!isReadOnly && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={handleReview}
                    disabled={isReviewing || isGenerating}
                    data-testid="review-prd-btn"
                  >
                    {isReviewing ? (
                      <Loader2 size={10} className="mr-1 animate-spin" />
                    ) : (
                      <Sparkles size={10} className="mr-1" />
                    )}
                    Analyze
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
                </>
              )}
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
                  <DropdownMenuItem onClick={handleCopyPrototypingPrompt} data-testid="copy-prototyping-prompt">
                    <Code size={14} className="mr-2" />
                    Copy Prototyping Prompt
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDownloadMarkdown} data-testid="download-prd-markdown">
                    <Download size={14} className="mr-2" />
                    Download .md
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadKiteframePRD} data-testid="download-kiteframe-prd">
                    <FileJson size={14} className="mr-2" />
                    Download .kiteframe-prd.json
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrintPRD} data-testid="print-prd">
                    <Printer size={14} className="mr-2" />
                    Print to PDF
                  </DropdownMenuItem>
                  {!isReadOnly && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setIsImportModalOpen(true)} data-testid="import-prd">
                        <Upload size={14} className="mr-2" />
                        Import PRD
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {prd.sections.map((section) => {
            const insights = sectionInsights[section.id] || [];
            const contentLength = section.content?.length || 0;
            const confidence = contentLength > 200 ? 'high' : contentLength > 50 ? 'medium' : 'low';
            return (
              <div key={section.id}>
                <DocSection
                  title={section.title}
                  content={section.content}
                  sectionKey={section.id}
                  manuallyEdited={!!prd.manualEditedAt[section.id]}
                  isStale={staleSections[section.id] || false}
                  confidence={confidence as 'high' | 'medium' | 'low'}
                  insights={insights}
                  reviewSuggestions={suggestionsBySectionId[section.id] || []}
                  onApplyReviewSuggestion={handleApplySuggestion}
                  onDismissReviewSuggestion={handleDismissSuggestion}
                  isApplyingReviewSuggestion={applyingSuggestionSectionId === section.id}
                  onSave={handleSectionSave}
                  onResetToAI={handleResetSection}
                  onRegenerateSection={handleRegenerateSection}
                  onElaborate={handleElaborateSection}
                  onDismissInsight={handleDismissInsight}
                  linkedNodes={prdLinks.getLinksForSection(workflowId, section.id)}
                  onLinkNode={() => handleLinkNode(section.id)}
                  onUnlinkNode={(nodeId) => handleUnlinkNode(nodeId, section.id)}
                  onUnlinkItem={(targetId, targetType) => handleUnlinkItem(targetId, targetType, section.id)}
                  onFocusNode={handleFocusNode}
                  onFocusEdge={handleFocusEdge}
                  isReadOnly={isReadOnly}
                />
              </div>
            );
          })}
        </WorkflowDocument>
      )}

      {linkingSectionId && (
        <LinkPickerModal
          nodes={nodes}
          edges={edges}
          onSelectNode={handleNodeSelected}
          onSelectEdge={handleEdgeSelected}
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
