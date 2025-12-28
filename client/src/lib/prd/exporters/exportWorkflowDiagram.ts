import type { AssembledProjectPRD } from '../assembleProjectPRD';

export function exportWorkflowDiagram(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# Workflow Diagrams: ${assembled.project.name}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  lines.push('');
  
  for (const workflow of assembled.workflows) {
    lines.push(`## ${workflow.workflowName}`);
    lines.push('');
    
    if (workflow.canvas && workflow.canvas.nodes && workflow.canvas.nodes.length > 0) {
      const mermaidDiagram = generateMermaidFlowchart(workflow);
      lines.push('```mermaid');
      lines.push(mermaidDiagram);
      lines.push('```');
      lines.push('');
      
      lines.push('### Node Details');
      lines.push('');
      lines.push('| ID | Type | Label |');
      lines.push('|---|---|---|');
      for (const node of workflow.canvas.nodes) {
        const label = node.data?.label || node.id;
        const type = node.type || 'default';
        const sanitizedLabel = label.replace(/\|/g, '\\|').replace(/\n/g, ' ');
        lines.push(`| ${node.id.slice(0, 8)} | ${type} | ${sanitizedLabel} |`);
      }
      lines.push('');
      
      if (workflow.canvas.edges && workflow.canvas.edges.length > 0) {
        lines.push('### Connections');
        lines.push('');
        lines.push('| From | To | Label |');
        lines.push('|---|---|---|');
        for (const edge of workflow.canvas.edges) {
          const label = edge.data?.label || edge.label || '';
          const sanitizedLabel = String(label).replace(/\|/g, '\\|').replace(/\n/g, ' ');
          lines.push(`| ${edge.source.slice(0, 8)} | ${edge.target.slice(0, 8)} | ${sanitizedLabel} |`);
        }
        lines.push('');
      }
    } else {
      lines.push('*No diagram data available for this workflow.*');
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }
  
  lines.push(`*Exported from Kiteframe v${assembled.version}*`);
  
  return lines.join('\n');
}

function generateMermaidFlowchart(workflow: any): string {
  const lines: string[] = [];
  lines.push('flowchart TD');
  
  if (!workflow.canvas?.nodes) return lines.join('\n');
  
  const nodeMap = new Map<string, any>();
  for (const node of workflow.canvas.nodes) {
    nodeMap.set(node.id, node);
  }
  
  for (const node of workflow.canvas.nodes) {
    const id = sanitizeMermaidId(node.id);
    const label = sanitizeMermaidLabel(node.data?.label || node.id);
    const type = node.type || 'default';
    
    let shape: string;
    switch (type) {
      case 'input':
      case 'inputNode':
        shape = `${id}([${label}])`;
        break;
      case 'output':
      case 'outputNode':
        shape = `${id}[[${label}]]`;
        break;
      case 'condition':
      case 'conditionNode':
        shape = `${id}{${label}}`;
        break;
      case 'process':
      case 'processNode':
        shape = `${id}[${label}]`;
        break;
      case 'ai':
      case 'aiNode':
        shape = `${id}((${label}))`;
        break;
      default:
        shape = `${id}[${label}]`;
    }
    
    lines.push(`    ${shape}`);
  }
  
  if (workflow.canvas?.edges) {
    for (const edge of workflow.canvas.edges) {
      const sourceId = sanitizeMermaidId(edge.source);
      const targetId = sanitizeMermaidId(edge.target);
      const label = edge.data?.label || edge.label;
      
      if (label) {
        const sanitizedLabel = sanitizeMermaidLabel(String(label));
        lines.push(`    ${sourceId} -->|${sanitizedLabel}| ${targetId}`);
      } else {
        lines.push(`    ${sourceId} --> ${targetId}`);
      }
    }
  }
  
  return lines.join('\n');
}

function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
}

function sanitizeMermaidLabel(label: string): string {
  return label
    .replace(/"/g, "'")
    .replace(/\n/g, ' ')
    .replace(/[[\]{}()]/g, '')
    .substring(0, 50);
}

export function downloadWorkflowDiagram(assembled: AssembledProjectPRD): void {
  const content = exportWorkflowDiagram(assembled);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-workflow-diagram.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
