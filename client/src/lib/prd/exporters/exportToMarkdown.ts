import type { AssembledProjectPRD, WorkflowCanvasData, WorkflowIntentData } from '../assembleProjectPRD';
import type { Node, Edge } from '../../kiteframe/types';

function getNodeTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    'input': 'Input',
    'process': 'Process',
    'condition': 'Decision',
    'output': 'Output',
    'ai': 'AI',
    'experiment': 'Experiment',
    'image': 'Image',
    'form': 'Form',
    'table': 'Table',
    'code': 'Code',
    'webview': 'Webview',
    'compound': 'Compound',
    'shape': 'Shape',
    'text': 'Text'
  };
  return typeLabels[type] || type;
}

function buildFlowPath(nodes: Node[], edges: Edge[]): string[] {
  if (nodes.length === 0) return [];
  
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const outgoingEdges = new Map<string, Edge[]>();
  const incomingCount = new Map<string, number>();
  
  nodes.forEach(n => {
    outgoingEdges.set(n.id, []);
    incomingCount.set(n.id, 0);
  });
  
  edges.forEach(e => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      outgoingEdges.get(e.source)?.push(e);
      incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
    }
  });
  
  const entryNodes = nodes.filter(n => (incomingCount.get(n.id) || 0) === 0);
  if (entryNodes.length === 0 && nodes.length > 0) {
    entryNodes.push(nodes[0]);
  }
  
  const paths: string[] = [];
  const MAX_PATHS = 10;
  const MAX_DEPTH = 50;
  
  function traverse(nodeId: string, path: string[], visited: Set<string>, depth: number): void {
    if (paths.length >= MAX_PATHS) return;
    if (depth > MAX_DEPTH) return;
    if (visited.has(nodeId)) {
      if (path.length > 0) {
        paths.push(path.join(' → ') + ' → (cycle)');
      }
      return;
    }
    
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    const localVisited = new Set(visited);
    localVisited.add(nodeId);
    
    const label = node.data?.label || getNodeTypeLabel(node.type || 'process');
    const newPath = [...path, label];
    
    const outEdges = outgoingEdges.get(nodeId) || [];
    if (outEdges.length === 0) {
      paths.push(newPath.join(' → '));
    } else {
      outEdges.forEach(edge => {
        const edgeLabel = edge.label ? ` [${edge.label}]` : '';
        const pathWithLabel = [...newPath];
        if (edgeLabel) {
          pathWithLabel[pathWithLabel.length - 1] += edgeLabel;
        }
        traverse(edge.target, pathWithLabel, localVisited, depth + 1);
      });
    }
  }
  
  entryNodes.forEach(entry => traverse(entry.id, [], new Set(), 0));
  
  return paths;
}

function buildNodeTable(nodes: Node[]): string[] {
  const lines: string[] = [];
  lines.push('| Step | Type | Description | Status |');
  lines.push('|------|------|-------------|--------|');
  
  nodes.forEach(node => {
    const label = (node.data?.label || 'Untitled').replace(/\|/g, '\\|');
    const type = getNodeTypeLabel(node.type || 'process');
    const description = (node.data?.description || '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const status = node.data?.status;
    const statusText = status === 'done' ? 'Done' : status === 'inprogress' ? 'In Progress' : 'To-do';
    
    lines.push(`| ${label} | ${type} | ${description} | ${statusText} |`);
  });
  
  return lines;
}

function buildEdgeTable(edges: Edge[], nodes: Node[]): string[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const lines: string[] = [];
  
  lines.push('| From | To | Label |');
  lines.push('|------|-----|-------|');
  
  edges.forEach(edge => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const sourceLabel = (sourceNode?.data?.label || 'Node').replace(/\|/g, '\\|');
    const targetLabel = (targetNode?.data?.label || 'Node').replace(/\|/g, '\\|');
    const edgeLabel = edge.label ? edge.label.replace(/\|/g, '\\|') : '—';
    
    lines.push(`| ${sourceLabel} | ${targetLabel} | ${edgeLabel} |`);
  });
  
  return lines;
}

function buildIntentSection(intent: WorkflowIntentData): string[] {
  const lines: string[] = [];
  
  const maturityLabels: Record<string, string> = {
    'draft': 'Draft',
    'reviewed': 'Reviewed',
    'stable': 'Stable'
  };
  
  lines.push('| Aspect | Details |');
  lines.push('|--------|---------|');
  
  if (intent.primaryGoal) {
    lines.push(`| Primary Goal | ${intent.primaryGoal.replace(/\|/g, '\\|')} |`);
  }
  if (intent.userType) {
    lines.push(`| Target User | ${intent.userType.replace(/\|/g, '\\|')} |`);
  }
  if (intent.successSignal) {
    lines.push(`| Success Signal | ${intent.successSignal.replace(/\|/g, '\\|')} |`);
  }
  if (intent.failureModes && intent.failureModes.length > 0) {
    const failureModesList = intent.failureModes.map(f => f.replace(/\|/g, '\\|')).join('; ');
    lines.push(`| Failure Modes | ${failureModesList} |`);
  }
  lines.push(`| Maturity | ${maturityLabels[intent.maturity] || intent.maturity} |`);
  lines.push(`| Confirmed | ${intent.confirmed ? 'Yes' : 'No'} |`);
  
  return lines;
}

function buildWorkflowStructureSummary(canvas: WorkflowCanvasData): string[] {
  const { nodes, edges } = canvas;
  const lines: string[] = [];
  
  const stepCount = nodes.length;
  const connectionCount = edges.length;
  const decisionCount = nodes.filter(n => n.type === 'condition').length;
  const aiNodeCount = nodes.filter(n => n.type === 'ai').length;
  
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  nodes.forEach(n => {
    incomingCount.set(n.id, 0);
    outgoingCount.set(n.id, 0);
  });
  edges.forEach(e => {
    if (incomingCount.has(e.target)) {
      incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
    }
    if (outgoingCount.has(e.source)) {
      outgoingCount.set(e.source, (outgoingCount.get(e.source) || 0) + 1);
    }
  });
  
  const entryPoints = nodes.filter(n => (incomingCount.get(n.id) || 0) === 0);
  const exitPoints = nodes.filter(n => (outgoingCount.get(n.id) || 0) === 0);
  
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Steps | ${stepCount} |`);
  lines.push(`| Connections | ${connectionCount} |`);
  if (decisionCount > 0) {
    lines.push(`| Decision Points | ${decisionCount} |`);
  }
  if (aiNodeCount > 0) {
    lines.push(`| AI Steps | ${aiNodeCount} |`);
  }
  if (entryPoints.length > 0) {
    const entryLabels = entryPoints.map(n => n.data?.label || 'Start').join(', ');
    lines.push(`| Entry Points | ${entryLabels} |`);
  }
  if (exitPoints.length > 0) {
    const exitLabels = exitPoints.map(n => n.data?.label || 'End').join(', ');
    lines.push(`| Exit Points | ${exitLabels} |`);
  }
  
  const statusBreakdown = {
    todo: nodes.filter(n => !n.data?.status || n.data?.status === 'todo').length,
    inprogress: nodes.filter(n => n.data?.status === 'inprogress').length,
    done: nodes.filter(n => n.data?.status === 'done').length
  };
  
  if (statusBreakdown.inprogress > 0 || statusBreakdown.done > 0) {
    lines.push('');
    lines.push('**Status Breakdown:**');
    lines.push(`- To-do: ${statusBreakdown.todo}`);
    lines.push(`- In Progress: ${statusBreakdown.inprogress}`);
    lines.push(`- Done: ${statusBreakdown.done}`);
  }
  
  return lines;
}

export function exportToMarkdown(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# ${assembled.project.name}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  lines.push('');
  
  if (assembled.project.description) {
    lines.push('## Project Description');
    lines.push('');
    lines.push(assembled.project.description);
    lines.push('');
  }
  
  if (assembled.projectPRD && assembled.projectPRD.sections.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('# Project Documentation');
    lines.push('');
    
    for (const section of assembled.projectPRD.sections) {
      if (section.content) {
        lines.push(`## ${section.title}`);
        lines.push('');
        lines.push(section.content);
        lines.push('');
      }
    }
  }
  
  if (assembled.workflows.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('# Workflows');
    lines.push('');
    lines.push(`*${assembled.workflows.length} workflow(s) included in this export*`);
    lines.push('');
    
    for (const workflow of assembled.workflows) {
      lines.push(`## ${workflow.workflowName}`);
      lines.push('');
      
      if (workflow.semanticSummary) {
        lines.push(`> ${workflow.semanticSummary}`);
        lines.push('');
      }
      
      if (workflow.intent && (workflow.intent.primaryGoal || workflow.intent.userType || workflow.intent.successSignal)) {
        lines.push('### Workflow Intent');
        lines.push('');
        lines.push(...buildIntentSection(workflow.intent));
        lines.push('');
      }
      
      if (workflow.canvas && workflow.canvas.nodes.length > 0) {
        lines.push('### Workflow Structure');
        lines.push('');
        lines.push(...buildWorkflowStructureSummary(workflow.canvas));
        lines.push('');
        
        const flowPaths = buildFlowPath(workflow.canvas.nodes, workflow.canvas.edges);
        if (flowPaths.length > 0) {
          lines.push('### Flow Path');
          lines.push('');
          flowPaths.forEach((path, index) => {
            if (flowPaths.length > 1) {
              lines.push(`**Path ${index + 1}:** ${path}`);
            } else {
              lines.push(path);
            }
          });
          lines.push('');
        }
        
        lines.push('### Steps');
        lines.push('');
        lines.push(...buildNodeTable(workflow.canvas.nodes));
        lines.push('');
        
        if (workflow.canvas.edges.length > 0) {
          lines.push('### Connections');
          lines.push('');
          lines.push(...buildEdgeTable(workflow.canvas.edges, workflow.canvas.nodes));
          lines.push('');
        }
      }
      
      if (workflow.prdSections.length > 0) {
        const sectionsWithContent = workflow.prdSections.filter(s => s.content);
        if (sectionsWithContent.length > 0) {
          lines.push('### PRD Details');
          lines.push('');
          
          for (const section of sectionsWithContent) {
            lines.push(`#### ${section.title}`);
            lines.push('');
            lines.push(section.content);
            lines.push('');
          }
        }
      }
      
      lines.push('---');
      lines.push('');
    }
  }
  
  lines.push('## Success Metrics');
  lines.push('');
  lines.push('- **Adoption:** TBD (e.g. % of projects using the feature)');
  lines.push('- **Efficiency:** TBD (e.g. reduced clarification time)');
  lines.push('- **Quality:** TBD (e.g. fewer unresolved questions)');
  lines.push('- **Satisfaction:** TBD (qualitative feedback)');
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push('## Definition of Done');
  lines.push('');
  lines.push('- Feature works end-to-end for at least one workflow');
  lines.push('- Collaboration scenarios validated');
  lines.push('- Empty states and basic accessibility covered');
  lines.push('- Exported artifacts reflect final behavior');
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push(`*Exported from Kiteframe v${assembled.version}*`);
  
  return lines.join('\n');
}

export function downloadMarkdown(assembled: AssembledProjectPRD): void {
  const content = exportToMarkdown(assembled);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-prd.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
