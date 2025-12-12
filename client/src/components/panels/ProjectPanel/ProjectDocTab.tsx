import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { GitBranch, Circle } from 'lucide-react';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { FlowDetection } from '@/lib/kiteframe/utils/FlowDetection';
import { 
  ProjectOverviewSection, 
  ProjectNotesSection, 
  ProjectSourcesSection,
  WorkflowPRDSection 
} from './sections';

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

export function ProjectDocTab({ 
  projectId, 
  projectName, 
  nodes, 
  edges, 
  canvasObjects = [],
  onProjectNameChange 
}: ProjectDocTabProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full" data-testid="project-doc-tab">
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-6">
          <ProjectOverviewSection
            projectId={projectId}
            projectName={projectName}
            onProjectNameChange={onProjectNameChange}
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

          {selectedWorkflow && projectId && (
            <section className="border-t border-border pt-4 mt-4">
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

          <ProjectNotesSection projectId={projectId} />

          <ProjectSourcesSection projectId={projectId} />
        </div>
      </ScrollArea>
    </div>
  );
}
