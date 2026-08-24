import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2, History, RotateCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { extractSemanticWorkflowModel } from '@/lib/kiteframe/utils/extractSemanticWorkflowModel';
import { FlowDetection } from '@/lib/kiteframe/utils/FlowDetection';
import { 
  loadProjectPRD, saveProjectPRD, saveProjectPRDBackup, 
  updatePRDSection, clearManualEdit,
  saveProjectPRDVersion, loadProjectPRDHistory, restoreProjectPRDVersion,
  type PRDVersion
} from '@/lib/kiteframe/utils/prdStorage';
import { type ProjectPRD, type PRDGenerationStatus, generateProjectPRD } from '@/ai/prdEngine';
import { useAi } from '@/ai/AiProvider';
import { useToast } from '@/hooks/use-toast';
import { DocSection, WorkflowDocument, overallConfidence, type DocDensity, type ReaderDocMeta } from '@/components/docs';
import { usePRDGenerationState, prdGenerationBus } from '@/stores/prdGenerationBus';
import { useServerDocument } from '@/lib/documents/useServerDocument';
import { formatDate } from '@/lib/utils/formatDate';
import { announceDocumentArtifact } from '@/lib/chatArtifacts';

interface ProjectPRDSectionProps {
  projectId: string;
  projectName: string;
  nodes: Node[];
  edges: Edge[];
  onPRDGenerated?: () => void;
  isReadOnly?: boolean;
  /** `reader` steps up to reading typography and hands the title to the pane. */
  density?: DocDensity;
  /** Reports the loaded document upward so a container can render its chrome. */
  onDocMeta?: (meta: ReaderDocMeta | null) => void;
}

export function ProjectPRDSection({ 
  projectId, 
  projectName,
  nodes,
  edges,
  onPRDGenerated,
  isReadOnly = false,
  density = 'rail',
  onDocMeta
}: ProjectPRDSectionProps) {
  const [prd, setPrd] = useState<ProjectPRD | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaitingForCapacity, setIsWaitingForCapacity] = useState(false);
  const [history, setHistory] = useState<PRDVersion<ProjectPRD>[]>([]);
  const prevUpdateKeyRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentProjectIdRef = useRef(projectId);
  const ai = useAi();
  const { toast } = useToast();
  
  const { updateKey } = usePRDGenerationState(projectId);

  useEffect(() => {
    currentProjectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [projectId]);

  const loadFromStorage = useCallback(() => {
    if (projectId) {
      const loaded = loadProjectPRD(projectId);
      if (loaded) {
        setPrd(loaded);
      } else {
        setPrd(null);
      }
      const loadedHistory = loadProjectPRDHistory(projectId);
      setHistory(loadedHistory);
    }
  }, [projectId]);

  // Server is the system of record; localStorage above is the offline cache.
  // Disabled in read-only shared viewers — their projectId is a shareUuid.
  const { updatedAt, persist } = useServerDocument<ProjectPRD>({
    projectId,
    docKind: 'project-prd',
    enabled: !isReadOnly,
    readLocal: () => loadProjectPRD(projectId),
    writeLocal: (content) => saveProjectPRD(projectId, content),
    onAdoptRemote: () => loadFromStorage(),
  });

  /**
   * Single write path for the document: cache first, then the server. Every
   * mutation goes through here so no edit can reach localStorage without also
   * being scheduled for the server.
   */
  const persistPrd = useCallback(
    (next: ProjectPRD, opts?: { immediate?: boolean }) => {
      if (!projectId) return;
      saveProjectPRD(projectId, next);
      persist(next, opts);
      // The rail and the reader can be showing this document at the same time.
      // Without this, the one that did not make the edit keeps its stale copy
      // and the next edit there silently reverts this one.
      prdGenerationBus.notifyPRDUpdated(projectId);
    },
    [projectId, persist],
  );

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
    if (!projectId || !projectName) return;

    const requestProjectId = projectId;
    const signal = abortControllerRef.current?.signal;

    setIsGenerating(true);
    setIsWaitingForCapacity(false);

    try {
      const isFirstGeneration = !prd;
      
      if (prd) {
        saveProjectPRDVersion(projectId, prd, 'ai-update');
        saveProjectPRDBackup(projectId, prd);
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

      const newPrd = await generateProjectPRD(
        ai,
        projectId,
        projectName,
        workflowModels,
        prd || undefined,
        signal,
        (status: PRDGenerationStatus) => setIsWaitingForCapacity(status === 'waiting-for-capacity')
      );

      if (signal?.aborted || requestProjectId !== currentProjectIdRef.current) {
        console.log('[ProjectPRDSection] Project changed during generation — discarding result');
        return;
      }
      
      if (isFirstGeneration) {
        saveProjectPRDVersion(projectId, newPrd, 'ai-generate');
      }
      
      persistPrd(newPrd, { immediate: true });
      setPrd(newPrd);
      onPRDGenerated?.();

      // Record it in the conversation as a card, not as its full text.
      announceDocumentArtifact(projectId, {
        docKind: 'project-prd',
        title: `${projectName} Spec`,
        kindLabel: 'Project spec',
        sections: newPrd.sections,
      });

      const updatedHistory = loadProjectPRDHistory(projectId);
      setHistory(updatedHistory);

      toast({ title: 'Spec generated', description: 'Project spec has been created.' });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[ProjectPRDSection] Generation aborted');
        return;
      }
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsWaitingForCapacity(false);
      setIsGenerating(false);
    }
  }, [projectId, projectName, nodes, edges, prd, ai, toast, onPRDGenerated]);

  const handleRestoreVersion = useCallback((version: number) => {
    if (!projectId) return;

    const restored = restoreProjectPRDVersion(projectId, version);
    if (restored) {
      setPrd(restored);
      // Deliberate act the user may navigate away from — skip the edit debounce.
      persistPrd(restored, { immediate: true });
      onPRDGenerated?.();
      const updatedHistory = loadProjectPRDHistory(projectId);
      setHistory(updatedHistory);
      toast({ title: 'Version restored', description: `Restored to version ${version}.` });
    } else {
      toast({ title: 'Restore failed', description: 'Could not restore version.', variant: 'destructive' });
    }
  }, [projectId, toast, onPRDGenerated]);

  const handleSectionSave = useCallback((sectionKey: string, content: string) => {
    if (!prd || !projectId) return;

    const updated = updatePRDSection(prd, sectionKey, content, true) as ProjectPRD;
    setPrd(updated);
    persistPrd(updated);
  }, [prd, projectId, persistPrd]);

  const handleResetSection = useCallback((sectionKey: string) => {
    if (!prd || !projectId) return;

    const updated = clearManualEdit(prd, sectionKey) as ProjectPRD;
    setPrd(updated);
    persistPrd(updated);
  }, [prd, projectId, persistPrd]);

  const isReader = density === 'reader';

  useEffect(() => {
    if (!onDocMeta) return;
    if (!prd) {
      onDocMeta(null);
      return;
    }
    onDocMeta({
      title: `${projectName} Spec`,
      updatedAt: updatedAt ?? null,
      version: prd.version,
      autoGenerated: prd.autoGenerated,
      confidence: overallConfidence(prd.sections),
      sections: prd.sections.map(s => ({ id: s.id, title: s.title })),
    });
  }, [onDocMeta, prd, projectName, updatedAt]);

  return (
    <div data-testid="project-prd-section">
      {!prd && !isGenerating && (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">
            {isReadOnly ? 'No project spec available.' : 'No project spec generated yet.'}
          </p>
          {!isReadOnly && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid="generate-project-prd"
            >
              <Sparkles size={14} className="mr-2" />
              Generate Project Spec
            </Button>
          )}
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            {isWaitingForCapacity
              ? 'AI is busy. Waiting to continue automatically...'
              : 'Generating project spec...'}
          </span>
        </div>
      )}

      {prd && !isGenerating && (
        <WorkflowDocument density={density}>
          <div className="flex items-center justify-between mb-4">
            {/* In the reader the pane's own header carries the title, timestamp
                and draft badge, so repeating them here would be two headers for
                one document. The actions stay: they belong to the document. */}
            <div className="flex items-center gap-2">
              {!isReader && (
                <>
                  <h2 className="text-base font-semibold">{projectName} Spec</h2>
                  {updatedAt && (
                    <span className="text-[11px] text-muted-foreground" data-testid="project-prd-updated-at">
                      Updated {formatDate(updatedAt, { includeTime: true })}
                    </span>
                  )}
                  {prd.autoGenerated && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded" data-testid="ai-draft-label">
                      <Sparkles size={10} />
                      AI Draft
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isReadOnly && history.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      data-testid="project-history-dropdown"
                    >
                      <History size={12} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs">Version History</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {history.map((v) => (
                      <DropdownMenuItem
                        key={v.version}
                        onClick={() => handleRestoreVersion(v.version)}
                        className="text-xs cursor-pointer"
                        data-testid={`restore-project-version-${v.version}`}
                      >
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
              )}
            </div>
          </div>

          {prd.sections.map((section) => (
            <DocSection
              key={section.id}
              title={section.title}
              content={section.content}
              sectionKey={section.id}
              density={density}
              manuallyEdited={!!prd.manualEditedAt[section.id]}
              onSave={handleSectionSave}
              onResetToAI={handleResetSection}
              isReadOnly={isReadOnly}
            />
          ))}
        </WorkflowDocument>
      )}
    </div>
  );
}
