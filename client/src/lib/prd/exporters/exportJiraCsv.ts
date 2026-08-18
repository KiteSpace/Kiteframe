import type { AssembledProjectPRD, WorkflowCanvasData } from '../assembleProjectPRD';

export function exportJiraCsv(assembled: AssembledProjectPRD): string {
  const rows: string[][] = [];
  
  rows.push(['Summary', 'Description', 'Issue Type', 'Labels']);
  
  for (const workflow of assembled.workflows) {
    if (workflow.canvas) {
      const stories = extractStories(workflow.canvas, workflow.workflowName);
      for (const story of stories) {
        rows.push(story);
      }
    }
  }
  
  return rows.map(row => row.map(escapeCSVField).join(',')).join('\n');
}

function extractStories(canvas: WorkflowCanvasData, workflowName: string): string[][] {
  const stories: string[][] = [];
  
  if (!canvas.nodes || canvas.nodes.length === 0) {
    return stories;
  }
  
  const nodeMap = new Map(canvas.nodes.map(n => [n.id, n]));
  const edges = canvas.edges || [];
  
  for (const node of canvas.nodes) {
    const nodeType = node.type || 'default';
    const label = node.data?.label || node.id;
    
    if (nodeType === 'condition' || nodeType === 'conditionNode') {
      const branches = edges.filter(e => e.source === node.id);
      
      if (branches.length > 0) {
        for (const branch of branches) {
          const branchLabel = branch.label || 'Branch';
          const targetNode = nodeMap.get(branch.target);
          const targetLabel = targetNode?.data?.label || branch.target;
          
          stories.push([
            `${label}: ${branchLabel} → ${targetLabel}`,
            buildConditionBranchDescription(node, branch, targetNode),
            'Story',
            formatLabels(['kiteframe-export', 'condition-branch'])
          ]);
        }
      } else {
        stories.push([
          `Condition: ${label}`,
          buildNodeDescription(node),
          'Story',
          formatLabels(['kiteframe-export', 'condition'])
        ]);
      }
    } else {
      stories.push([
        label,
        buildNodeDescription(node),
        'Story',
        formatLabels(['kiteframe-export', mapNodeTypeToLabel(nodeType)])
      ]);
    }
  }
  
  return stories;
}

function formatLabels(labels: string[]): string {
  return labels.join(' ');
}

function buildNodeDescription(node: any): string {
  const parts: string[] = [];
  
  const nodeType = node.type || 'default';
  parts.push(`**Type:** ${formatNodeType(nodeType)}`);
  
  if (node.data?.description) {
    parts.push(`\n\n${node.data.description}`);
  }
  
  if (node.data?.text) {
    parts.push(`\n\nContent: ${node.data.text}`);
  }
  
  parts.push('\n\n---');
  parts.push('*Generated from Kiteframe workflow*');
  
  return parts.join('');
}

function buildConditionBranchDescription(
  conditionNode: any,
  branch: any,
  targetNode: any
): string {
  const parts: string[] = [];
  
  parts.push(`**Condition:** ${conditionNode.data?.label || 'Decision point'}`);
  parts.push(`\n**Branch:** ${branch.label || 'Unnamed branch'}`);
  
  if (targetNode) {
    parts.push(`\n**Leads to:** ${targetNode.data?.label || targetNode.id}`);
  }
  
  if (conditionNode.data?.description) {
    parts.push(`\n\n${conditionNode.data.description}`);
  }
  
  parts.push('\n\n---');
  parts.push('*Generated from Kiteframe workflow condition branch*');
  
  return parts.join('');
}

function mapNodeTypeToLabel(nodeType: string): string {
  const typeMap: Record<string, string> = {
    'default': 'workflow-step',
    'form': 'user-input',
    'formNode': 'user-input',
    'condition': 'decision',
    'conditionNode': 'decision',
    'api': 'integration',
    'table': 'data-display',
    'tableNode': 'data-display',
    'text': 'content',
    'textNode': 'content',
    'image': 'media',
    'imageNode': 'media',
    'code': 'technical',
    'codeNode': 'technical',
  };
  
  return typeMap[nodeType] || 'workflow-step';
}

function formatNodeType(type: string): string {
  return type
    .replace(/Node$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, s => s.toUpperCase());
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function downloadJiraCsv(assembled: AssembledProjectPRD): void {
  const content = exportJiraCsv(assembled);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-jira-import.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
