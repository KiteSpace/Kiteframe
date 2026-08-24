import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Circle, FileText, FolderOpen, GitBranch, History, Download, RotateCcw } from 'lucide-react';
import { focusBus } from '@/stores/focusBus';
import { usePRDGenerationState, prdGenerationBus } from '@/stores/prdGenerationBus';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { FlowDetection } from '@/lib/kiteframe/utils/FlowDetection';
import {
  ProjectOverviewSection,
  ProjectNotesSection,
  ProjectSourcesSection,
  ProjectInsightsSection,
} from './sections';
import {
  loadProjectPRD,
  loadProjectPRDHistory,
  loadWorkflowPRD,
  loadWorkflowPRDHistory,
  listWorkflowPRDHistoryIds,
  listWorkflowPRDs,
  restoreProjectPRDVersion,
  restoreWorkflowPRDVersion,
} from '@/lib/kiteframe/utils/prdStorage';
import { openInReader, useIsOpenInReader, type ReaderDocKind } from '@/stores/readerStore';
import { ExportProjectModal } from '@/components/ExportProjectModal';

type DocMode = 'overview' | 'spec' | 'history';

interface WorkflowSummary {
  id: string;
  name: string;
  nodeIds: string[];
  edgeIds: string[];
  nodeCount: number;
  edgeCount: number;
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
}

interface StandaloneNodeSummary {
  nodeId: string;
  label: string;
}

interface ProjectDocTabProps {
  projectId?: string;
  projectName?: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  onProjectNameChange?: (name: string) => void;
  isReadOnly?: boolean;
  shareUuid?: string;
  cloudProjectId?: number | null;
  onShareCreated?: (shareUuid: string) => void;
}

const WORKFLOW_NAMES_KEY_PREFIX = 'kiteframe-workflow-names-';

function getWorkflowName(projectId: string | undefined, workflowId: string, index: number): string {
  if (!projectId) return `Workflow ${index + 1}`;
  try {
    const saved = localStorage.getItem(`${WORKFLOW_NAMES_KEY_PREFIX}${projectId}`);
    const names = saved ? JSON.parse(saved) : null;
    if (names?.[workflowId]) return names[workflowId];
  } catch {}
  return `Workflow ${index + 1}`;
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return 'Not generated yet';
  return new Date(value).toLocaleDateString();
}

function summaryFor(prd: any, empty: string): string {
  const section = Array.isArray(prd?.sections) ? prd.sections.find((item: any) => typeof item?.content === 'string' && item.content.trim()) : null;
  if (!section) return empty;
  const plainText = section.content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plainText ? plainText.slice(0, 180) : empty;
}

function DocumentCard({
  title,
  type,
  date,
  summary,
  onOpen,
  testId,
  docKind,
  workflowId,
}: {
  title: string;
  type: string;
  date: string;
  summary: string;
  onOpen: () => void;
  testId: string;
  docKind: ReaderDocKind;
  workflowId?: string;
}) {
  const isOpen = useIsOpenInReader(docKind, workflowId);
  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border bg-card p-[10px] text-left transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isOpen ? 'border-[color:var(--brand)] bg-[color:var(--brand-wash)] shadow-[0_0_0_3px_rgba(155,107,255,.14)]' : 'border-border',
      )}
      onClick={onOpen}
      data-testid={testId}
      aria-label={`Open ${title} in the reader`}
    >
      <div className="flex items-start gap-2">
        <FileText size={15} className="mt-0.5 flex-none text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[12.5px] font-semibold leading-[1.3]">{title}</h3>
          <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">{type} · {date}</p>
          <p className="mt-[7px] line-clamp-2 text-[11.5px] leading-[1.5] text-muted-foreground">{summary}</p>
        </div>
      </div>
    </button>
  );
}

interface HistoryEntry {
  key: string;
  title: string;
  kind: 'project-prd' | 'workflow-prd';
  workflowId?: string;
  version: number;
  createdAt: string;
  reason: string;
}

function ProjectHistorySection({
  projectId,
  workflows,
  isReadOnly,
  refreshKey,
  onRestored,
}: {
  projectId: string;
  workflows: Array<Pick<WorkflowSummary, 'id' | 'name'>>;
  isReadOnly: boolean;
  refreshKey: number;
  onRestored: () => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback(() => {
    const projectHistory = loadProjectPRDHistory(projectId).map(version => ({
      key: `project-${version.version}`,
      title: 'Project Spec',
      kind: 'project-prd' as const,
      version: version.version,
      createdAt: version.createdAt,
      reason: version.reason,
    }));
    const workflowHistory = workflows.flatMap(workflow =>
      loadWorkflowPRDHistory(projectId, workflow.id).map(version => ({
        key: `workflow-${workflow.id}-${version.version}`,
        title: `${workflow.name} Spec`,
        kind: 'workflow-prd' as const,
        workflowId: workflow.id,
        version: version.version,
        createdAt: version.createdAt,
        reason: version.reason,
      })),
    );
    setEntries([...projectHistory, ...workflowHistory].sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    ));
  }, [projectId, workflows]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshKey]);

  const restore = (entry: HistoryEntry) => {
    const restored = entry.kind === 'project-prd'
      ? restoreProjectPRDVersion(projectId, entry.version)
      : entry.workflowId ? restoreWorkflowPRDVersion(projectId, entry.workflowId, entry.version) : null;
    if (!restored) return;
    prdGenerationBus.notifyPRDUpdated(projectId, entry.workflowId);
    loadHistory();
    onRestored();
  };

  if (entries.length === 0) {
    return <div className="rounded-lg border border-border px-3 py-6 text-center text-xs text-muted-foreground" data-testid="project-history-empty">No saved spec versions yet.</div>;
  }

  return (
    <section className="relative ml-[4px] space-y-0 border-l border-border pl-[18px]" data-testid="project-history-timeline">
      {entries.map((entry, index) => (
        <div key={entry.key} className="relative pb-[14px] last:pb-0">
          <span className={cn('absolute -left-[22px] top-1 h-[7px] w-[7px] rounded-full ring-[3px] ring-card', index === 0 ? 'bg-[color:var(--brand)]' : 'bg-border')} />
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold">{entry.title} · v{entry.version}</p>
                <p className="mt-[3px] text-[11.5px] leading-[1.55] text-muted-foreground">{entry.reason}</p>
                <p className="mt-1 text-[10px] font-mono text-muted-foreground">Kiteframe</p>
              </div>
              <p className="flex-none text-[10px] font-mono text-muted-foreground">{formatDate(entry.createdAt)}</p>
              {!isReadOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 flex-none px-2 text-[10px] text-foreground"
                  onClick={() => restore(entry)}
                  data-testid={`restore-history-${entry.key}`}
                >
                  <RotateCcw size={11} className="mr-1" />Restore
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

export function ProjectDocTab({
  projectId,
  projectName,
  nodes,
  edges,
  canvasObjects = [],
  onProjectNameChange,
  isReadOnly = false,
  shareUuid,
  cloudProjectId,
  onShareCreated,
}: ProjectDocTabProps) {
  const [docMode, setDocMode] = useState<DocMode>('overview');
  const [docsUpdateKey, setDocsUpdateKey] = useState(0);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const { isGenerating, updateKey: generationUpdateKey } = usePRDGenerationState(projectId);

  const { data: projectsData } = useQuery<{ projects: Array<Record<string, any>> }>({
    queryKey: ['/api/projects'],
    enabled: false,
  });

  const serverUpdatedAt = useMemo(() => {
    const projects = projectsData?.projects;
    if (!Array.isArray(projects)) return null;
    const byUuid = projectId ? projects.find(project => project.projectUuid === projectId) : undefined;
    const match = byUuid ?? (cloudProjectId != null ? projects.find(project => String(project.id) === String(cloudProjectId)) : undefined);
    return match?.updatedAt ?? null;
  }, [cloudProjectId, projectId, projectsData]);

  const projectDescription = useMemo(() => {
    if (!projectId) return undefined;
    try {
      return JSON.parse(localStorage.getItem(`kiteframe-details-${projectId}`) || '{}').description || undefined;
    } catch {
      return undefined;
    }
  }, [projectId, isExportModalOpen]);

  const { workflowSummaries, standaloneNodes } = useMemo(() => {
    if (nodes.length === 0) return { workflowSummaries: [], standaloneNodes: [] };
    const workflows: WorkflowSummary[] = [];
    const standalone: StandaloneNodeSummary[] = [];
    FlowDetection.detectFlows(nodes, edges).forEach((flow) => {
      if (flow.nodes.length >= 2 && flow.edges.length >= 1) {
        workflows.push({
          id: flow.id,
          name: getWorkflowName(projectId, flow.id, workflows.length),
          nodeIds: flow.nodes.map(node => node.id),
          edgeIds: flow.edges.map(edge => edge.id),
          nodeCount: flow.nodes.length,
          edgeCount: flow.edges.length,
          nodes: flow.nodes,
          edges: flow.edges,
        });
      } else {
        flow.nodes.forEach(node => standalone.push({ nodeId: node.id, label: node.data?.label || node.type || 'Node' }));
      }
    });
    return { workflowSummaries: workflows, standaloneNodes: standalone };
  }, [edges, nodes, projectId]);

  useEffect(() => {
    if (generationUpdateKey > 0) setDocsUpdateKey(previous => previous + 1);
  }, [generationUpdateKey]);

  const refreshDocs = useCallback(() => setDocsUpdateKey(previous => previous + 1), []);
  const projectPrd = useMemo(() => projectId ? loadProjectPRD(projectId) : null, [docsUpdateKey, generationUpdateKey, projectId]);
  const workflowPrds = useMemo(
    () => projectId ? workflowSummaries.map(workflow => ({ workflow, prd: loadWorkflowPRD(projectId, workflow.id) })) : [],
    [docsUpdateKey, generationUpdateKey, projectId, workflowSummaries],
  );
  const workflowHistorySources = useMemo(() => {
    if (!projectId) return [];
    const liveNames = new Map(workflowSummaries.map(workflow => [workflow.id, workflow.name]));
    const ids = new Set([
      ...workflowSummaries.map(workflow => workflow.id),
      ...listWorkflowPRDs(projectId),
      ...listWorkflowPRDHistoryIds(projectId),
    ]);
    return Array.from(ids).map(id => {
      const liveName = liveNames.get(id);
      const savedName = loadWorkflowPRD(projectId, id)?.workflowName;
      const historyName = loadWorkflowPRDHistory(projectId, id)[0]?.content?.workflowName;
      return { id, name: liveName || savedName || historyName || 'Workflow' };
    });
  }, [docsUpdateKey, projectId, workflowSummaries]);

  return (
    <div className="flex h-full flex-col" data-testid="project-doc-tab">
       <div className={cn('flex items-center gap-[3px] border-b border-border px-4 py-2', isGenerating && 'opacity-50 pointer-events-none')}>
        {([
          ['overview', FolderOpen, 'Overview'],
          ['spec', FileText, 'Spec'],
          ['history', History, 'History'],
        ] as const).map(([mode, Icon, label]) => (
          <button
            key={mode}
            onClick={() => setDocMode(mode)}
            disabled={isGenerating}
            className={cn(
               'flex items-center gap-1.5 rounded-[7px] px-[9px] py-1 text-[11.5px] font-medium transition-colors',
               docMode === mode ? 'bg-accent text-accent-foreground font-semibold' : 'text-muted-foreground hover:bg-border-soft',
            )}
            data-testid={`mode-${mode}`}
          >
            <Icon size={12} />{label}
          </button>
        ))}
        <div className="flex-1" />
        {!isReadOnly && (
          <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(true)} disabled={isGenerating} className="h-7 text-xs" data-testid="button-open-export-modal">
            <Download size={14} className="mr-1" />Export
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className={cn('space-y-6 px-4 py-4', isGenerating && 'pointer-events-none')}>
          {docMode === 'overview' && (
            <>
              <ProjectOverviewSection projectId={projectId} projectName={projectName} onProjectNameChange={onProjectNameChange} nodes={nodes} edges={edges} isReadOnly={isReadOnly} serverUpdatedAt={serverUpdatedAt} />
              {workflowSummaries.length > 0 && (
                <section className="mt-4 border-t border-border pt-4">
                  <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><GitBranch size={12} />Workflows</h2>
                  <div className="space-y-1">
                    {workflowSummaries.map(workflow => (
                      <button
                        key={workflow.id}
                        className="w-full rounded px-2 py-2 text-left transition-colors hover:bg-accent/50"
                        onClick={() => focusBus.focusWorkflow(workflow.nodeIds, { padding: 150 })}
                        data-testid={`workflow-${workflow.id}`}
                      >
                        <div className="flex items-center gap-2"><Circle size={8} className="fill-primary text-primary" /><span className="text-sm font-medium">{workflow.name}</span></div>
                        <p className="pl-4 text-[10px] text-muted-foreground">{workflow.nodeCount} steps · {workflow.edgeCount} connections</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {standaloneNodes.length > 0 && (
                <section className="border-t border-border pt-4">
                  <p className="text-[10px] uppercase text-muted-foreground">Standalone nodes</p>
                  {standaloneNodes.map(node => <p key={node.nodeId} className="mt-1 text-xs text-muted-foreground">{node.label}</p>)}
                </section>
              )}
              <ProjectInsightsSection projectId={projectId || 'default'} nodes={nodes} edges={edges} />
              <ProjectNotesSection projectId={projectId} isReadOnly={isReadOnly} />
              <ProjectSourcesSection projectId={projectId} />
            </>
          )}

          {docMode === 'spec' && projectId && (
            <section data-testid="project-spec-cards">
              <div className="mb-3"><h2 className="text-sm font-semibold">Specs</h2><p className="mt-1 text-xs text-muted-foreground">Open a spec in the reader to generate, read, or edit it.</p></div>
              <div className="space-y-2">
                <DocumentCard
                  title={`${projectName || 'Project'} Spec`}
                  type="Project spec"
                  date={formatDate(projectPrd?.updatedAt || projectPrd?.generatedAt)}
                  summary={summaryFor(projectPrd, 'No project spec yet. Open the reader to generate one.')}
                  onOpen={() => openInReader({ docKind: 'project-prd' })}
                  testId="document-card-project-prd"
                  docKind="project-prd"
                />
                {workflowPrds.map(({ workflow, prd }) => (
                  <DocumentCard
                    key={workflow.id}
                    title={`${workflow.name} Spec`}
                    type="Workflow spec"
                    date={formatDate(prd?.updatedAt || prd?.generatedAt)}
                    summary={summaryFor(prd, 'No workflow spec yet. Open the reader to generate one.')}
                    onOpen={() => openInReader({ docKind: 'workflow-prd', workflowId: workflow.id })}
                    testId={`document-card-workflow-${workflow.id}`}
                  docKind="workflow-prd"
                  workflowId={workflow.id}
                  />
                ))}
              </div>
            </section>
          )}

          {docMode === 'history' && projectId && (
            <section>
              <div className="mb-4"><h2 className="text-sm font-semibold">Version history</h2><p className="mt-1 text-xs text-muted-foreground">Saved project and workflow spec versions, newest first.</p></div>
              <ProjectHistorySection projectId={projectId} workflows={workflowHistorySources} isReadOnly={isReadOnly} refreshKey={docsUpdateKey} onRestored={refreshDocs} />
            </section>
          )}
        </div>
      </ScrollArea>

      <ExportProjectModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectId={projectId || 'default'}
        projectName={projectName || 'Untitled Project'}
        projectDescription={projectDescription}
        workflows={workflowSummaries.map(workflow => ({ id: workflow.id, name: workflow.name, nodes: workflow.nodes, edges: workflow.edges, canvasObjects }))}
        shareUuid={shareUuid}
        cloudProjectId={cloudProjectId}
        onShareCreated={onShareCreated}
      />
    </div>
  );
}