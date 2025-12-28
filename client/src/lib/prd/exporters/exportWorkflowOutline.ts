import type { AssembledProjectPRD, WorkflowCanvasData } from '../assembleProjectPRD';

export function exportWorkflowOutline(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# Workflow Outline: ${assembled.project.name}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  lines.push('');
  
  if (assembled.project.description) {
    lines.push('## Project Overview');
    lines.push('');
    lines.push(assembled.project.description);
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  for (const workflow of assembled.workflows) {
    lines.push(`## ${workflow.workflowName}`);
    lines.push('');
    
    if (workflow.semanticSummary) {
      lines.push(`> ${workflow.semanticSummary}`);
      lines.push('');
    }
    
    if (workflow.canvas) {
      const canvasOutline = buildCanvasOutline(workflow.canvas);
      lines.push(canvasOutline);
    } else {
      lines.push('*No canvas data available*');
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }
  
  lines.push(`*Exported from Kiteframe v${assembled.version}*`);
  
  return lines.join('\n');
}

function buildCanvasOutline(canvas: WorkflowCanvasData): string {
  const lines: string[] = [];
  const { nodes, edges } = canvas;
  
  if (!nodes || nodes.length === 0) {
    return '*No nodes in workflow*\n';
  }
  
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();
  
  for (const edge of edges || []) {
    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, []);
    }
    outgoingEdges.get(edge.source)!.push(edge.target);
    
    if (!incomingEdges.has(edge.target)) {
      incomingEdges.set(edge.target, []);
    }
    incomingEdges.get(edge.target)!.push(edge.source);
  }
  
  const entryNodes = nodes.filter(n => !incomingEdges.has(n.id) || incomingEdges.get(n.id)!.length === 0);
  const exitNodes = nodes.filter(n => !outgoingEdges.has(n.id) || outgoingEdges.get(n.id)!.length === 0);
  
  lines.push('### Structure');
  lines.push('');
  lines.push(`- **Total Nodes:** ${nodes.length}`);
  lines.push(`- **Total Connections:** ${edges?.length || 0}`);
  lines.push(`- **Entry Points:** ${entryNodes.length}`);
  lines.push(`- **Exit Points:** ${exitNodes.length}`);
  lines.push('');
  
  if (entryNodes.length > 0) {
    lines.push('### Entry Points');
    lines.push('');
    for (const node of entryNodes) {
      const label = getNodeLabel(node);
      const type = node.type || 'default';
      lines.push(`- **${label}** (${type})`);
    }
    lines.push('');
  }
  
  lines.push('### Nodes');
  lines.push('');
  
  const nodesByType = groupNodesByType(nodes);
  for (const [type, typeNodes] of Object.entries(nodesByType)) {
    lines.push(`#### ${formatNodeType(type)} (${typeNodes.length})`);
    lines.push('');
    for (const node of typeNodes) {
      const label = getNodeLabel(node);
      const connections = outgoingEdges.get(node.id) || [];
      const connectionLabels = connections.map(id => {
        const target = nodeMap.get(id);
        return target ? getNodeLabel(target) : id;
      });
      
      if (connectionLabels.length > 0) {
        lines.push(`- **${label}** → ${connectionLabels.join(', ')}`);
      } else {
        lines.push(`- **${label}**`);
      }
    }
    lines.push('');
  }
  
  if (exitNodes.length > 0) {
    lines.push('### Exit Points');
    lines.push('');
    for (const node of exitNodes) {
      const label = getNodeLabel(node);
      const type = node.type || 'default';
      lines.push(`- **${label}** (${type})`);
    }
    lines.push('');
  }
  
  if (edges && edges.length > 0) {
    lines.push('### Connections');
    lines.push('');
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      const sourceLabel = source ? getNodeLabel(source) : edge.source;
      const targetLabel = target ? getNodeLabel(target) : edge.target;
      const edgeLabel = edge.label ? ` [${edge.label}]` : '';
      lines.push(`- ${sourceLabel} → ${targetLabel}${edgeLabel}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

function getNodeLabel(node: any): string {
  return node.data?.label || node.data?.text || node.id;
}

function groupNodesByType(nodes: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const node of nodes) {
    const type = node.type || 'default';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(node);
  }
  return groups;
}

function formatNodeType(type: string): string {
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

export function downloadWorkflowOutline(assembled: AssembledProjectPRD): void {
  const content = exportWorkflowOutline(assembled);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-workflow-outline.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
