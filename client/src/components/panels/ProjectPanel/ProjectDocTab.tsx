import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { GitBranch, Circle, FileText, FolderOpen, List } from 'lucide-react';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { FlowDetection } from '@/lib/kiteframe/utils/FlowDetection';
import { 
  ProjectOverviewSection, 
  ProjectNotesSection, 
  ProjectSourcesSection,
  WorkflowPRDSection,
  ProjectPRDSection
} from './sections';
import { loadProjectPRD } from '@/lib/kiteframe/utils/prdStorage';
import type { PRDSection } from '@/ai/prdEngine';

type DocMode = 'overview' | 'project-prd' | 'workflow-prd';

interface WorkflowSummary {
  id: string;
  name: string;
  nodeIds: string[];
  edgeIds: string[];
  nodeCount: number;
  edgeCount: number;
  nodes: Node[];
  edges: Edge[];
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
}

const WORKFLOW_NAMES_KEY_PREFIX = 'kiteframe-workflow-names-';

function getWorkflowName(projectId: string | undefined, workflowId: string, index: number): string {
  if (!projectId) return `Workflow ${index + 1}`;
  
  try {
    const key = `${WORKFLOW_NAMES_KEY_PREFIX}${projectId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const names = JSON.parse(saved);
      if (names[workflowId]) return names[workflowId];
    }
  } catch {}
  
  return `Workflow ${index + 1}`;
}

interface DocumentOutlineProps {
  sections: PRDSection[];
  activeSection: string | null;
  onSectionClick: (sectionId: string) => void;
}

function DocumentOutline({ sections, activeSection, onSectionClick }: DocumentOutlineProps) {
  if (sections.length === 0) return null;

  return (
    <nav className="mb-4 pb-3 border-b border-border" data-testid="document-outline">
      <div className="text-[10px] uppercase text-muted-foreground mb-2 flex items-center gap-1">
        <List size={10} />
        Contents
      </div>
      <ul className="space-y-0.5">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              onClick={() => onSectionClick(section.id)}
              className={cn(
                "text-xs text-left w-full px-2 py-1 rounded hover:bg-accent/50 transition-colors",
                activeSection === section.id && "bg-accent text-accent-foreground font-medium"
              )}
              data-testid={`outline-${section.id}`}
            >
              {section.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ProjectDocTab({ 
  projectId, 
  projectName, 
  nodes, 
  edges, 
  canvasObjects = [],
  onProjectNameChange 
}: ProjectDocTabProps) {
  const [docMode, setDocMode] = useState<DocMode>('overview');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [prdUpdateKey, setPrdUpdateKey] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { workflowSummaries, standaloneNodes } = useMemo(() => {
    if (nodes.length === 0) {
      return { workflowSummaries: [], standaloneNodes: [] };
    }

    const flows = FlowDetection.detectFlows(nodes, edges);
    
    const workflows: WorkflowSummary[] = [];
    const standalone: StandaloneNodeSummary[] = [];

    flows.forEach((flow, index) => {
      const nodeCount = flow.nodes.length;
      const edgeCount = flow.edges.length;

      if (nodeCount >= 2 && edgeCount >= 2) {
        workflows.push({
          id: flow.id,
          name: getWorkflowName(projectId, flow.id, workflows.length),
          nodeIds: flow.nodes.map(n => n.id),
          edgeIds: flow.edges.map(e => e.id),
          nodeCount,
          edgeCount,
          nodes: flow.nodes,
          edges: flow.edges
        });
      } else {
        flow.nodes.forEach(node => {
          standalone.push({
            nodeId: node.id,
            label: node.data?.label || node.type || 'Node'
          });
        });
      }
    });

    return { workflowSummaries: workflows, standaloneNodes: standalone };
  }, [nodes, edges, projectId]);

  const selectedWorkflow = useMemo(() => {
    if (!selectedWorkflowId && workflowSummaries.length > 0) {
      return workflowSummaries[0];
    }
    return workflowSummaries.find(w => w.id === selectedWorkflowId) || null;
  }, [selectedWorkflowId, workflowSummaries]);

  const projectPRDSections = useMemo(() => {
    if (!projectId || docMode !== 'project-prd') return [];
    const prd = loadProjectPRD(projectId);
    return prd?.sections || [];
  }, [projectId, docMode, prdUpdateKey]);

  const handlePRDGenerated = useCallback(() => {
    setPrdUpdateKey(prev => prev + 1);
  }, []);

  const handleSectionClick = useCallback((sectionId: string) => {
    const element = document.getElementById(`prd-section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (docMode !== 'project-prd' || projectPRDSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id.replace('prd-section-', '');
            setActiveSection(sectionId);
          }
        });
      },
      { threshold: 0.3, rootMargin: '-20% 0px -60% 0px' }
    );

    projectPRDSections.forEach((section) => {
      const element = document.getElementById(`prd-section-${section.id}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [docMode, projectPRDSections]);

  return (
    <div className="flex flex-col h-full" data-testid="project-doc-tab">
      <div className="px-4 py-2 border-b border-border flex gap-1">
        <button
          onClick={() => setDocMode('overview')}
          className={cn(
            "px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5",
            docMode === 'overview' 
              ? "bg-accent text-accent-foreground font-medium" 
              : "text-muted-foreground hover:bg-accent/50"
          )}
          data-testid="mode-overview"
        >
          <FolderOpen size={12} />
          Overview
        </button>
        <button
          onClick={() => setDocMode('project-prd')}
          className={cn(
            "px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5",
            docMode === 'project-prd' 
              ? "bg-accent text-accent-foreground font-medium" 
              : "text-muted-foreground hover:bg-accent/50"
          )}
          data-testid="mode-project-prd"
        >
          <FileText size={12} />
          Project PRD
        </button>
        <button
          onClick={() => setDocMode('workflow-prd')}
          className={cn(
            "px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5",
            docMode === 'workflow-prd' 
              ? "bg-accent text-accent-foreground font-medium" 
              : "text-muted-foreground hover:bg-accent/50"
          )}
          data-testid="mode-workflow-prd"
        >
          <GitBranch size={12} />
          Workflow PRD
        </button>
      </div>

      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="px-4 py-4 space-y-6">
          {docMode === 'overview' && (
            <>
              <ProjectOverviewSection
                projectId={projectId}
                projectName={projectName}
                onProjectNameChange={onProjectNameChange}
                nodes={nodes}
                edges={edges}
              />

              {(workflowSummaries.length > 0 || standaloneNodes.length > 0) && (
                <section className="border-t border-border pt-4 mt-4">
                  <header className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <GitBranch size={12} />
                      Workflows
                    </h2>
                  </header>

                  {workflowSummaries.length > 0 && (
                    <div className="space-y-1">
                      {workflowSummaries.map((wf) => (
                        <div
                          key={wf.id}
                          className="px-2 py-1.5 text-sm flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Circle size={8} className="text-primary fill-primary" />
                            <span className="font-medium">{wf.name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {wf.nodeCount} nodes · {wf.edgeCount} edges
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {standaloneNodes.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">
                        Standalone nodes
                      </div>
                      <div className="space-y-1">
                        {standaloneNodes.map((sn) => (
                          <div 
                            key={sn.nodeId} 
                            className="px-2 py-1 text-xs text-muted-foreground flex items-center gap-2"
                          >
                            <Circle size={6} className="text-muted-foreground" />
                            {sn.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              <ProjectNotesSection projectId={projectId} />
              <ProjectSourcesSection projectId={projectId} />
            </>
          )}

          {docMode === 'project-prd' && projectId && (
            <>
              <DocumentOutline
                sections={projectPRDSections}
                activeSection={activeSection}
                onSectionClick={handleSectionClick}
              />
              <ProjectPRDSection
                projectId={projectId}
                projectName={projectName || 'Untitled'}
                nodes={nodes}
                edges={edges}
                onPRDGenerated={handlePRDGenerated}
              />
            </>
          )}

          {docMode === 'workflow-prd' && (
            <>
              {workflowSummaries.length > 0 && (
                <section className="mb-4">
                  <header className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <GitBranch size={12} />
                      Select Workflow
                    </h2>
                  </header>

                  <div className="space-y-1">
                    {workflowSummaries.map((wf) => (
                      <button
                        key={wf.id}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded hover:bg-accent/60 text-sm flex items-center justify-between transition-colors",
                          wf.id === selectedWorkflow?.id && "bg-accent"
                        )}
                        onClick={() => setSelectedWorkflowId(wf.id)}
                        data-testid={`workflow-${wf.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Circle size={8} className="text-primary fill-primary" />
                          <span className="font-medium">{wf.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {wf.nodeCount} nodes · {wf.edgeCount} edges
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {selectedWorkflow && projectId && (
                <section className="border-t border-border pt-4">
                  <header className="mb-3">
                    <h2 className="text-sm font-semibold">
                      {selectedWorkflow.name}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedWorkflow.nodeCount} nodes · {selectedWorkflow.edgeCount} edges
                    </p>
                  </header>

                  <WorkflowPRDSection
                    projectId={projectId}
                    workflowId={selectedWorkflow.id}
                    workflowName={selectedWorkflow.name}
                    nodes={selectedWorkflow.nodes}
                    edges={selectedWorkflow.edges}
                  />
                </section>
              )}

              {workflowSummaries.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <GitBranch size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No workflows detected.</p>
                  <p className="text-xs mt-1">Add at least 2 connected nodes to create a workflow.</p>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
