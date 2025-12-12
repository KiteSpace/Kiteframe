import type { WorkflowPRD, ProjectPRD } from '../../../ai/prdEngine';

export function exportWorkflowPRDToMarkdown(prd: WorkflowPRD): string {
  const lines: string[] = [];
  
  lines.push(`# ${prd.workflowName}`);
  lines.push('');
  
  for (const section of prd.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(section.content.trim());
    lines.push('');
  }
  
  return lines.join('\n').trim();
}

export function exportProjectPRDToMarkdown(prd: ProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# ${prd.projectName}`);
  lines.push('');
  
  for (const section of prd.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(section.content.trim());
    lines.push('');
  }
  
  return lines.join('\n').trim();
}

export function downloadMarkdownFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function generatePRDFilename(projectName: string, workflowName?: string): string {
  const sanitizedProject = sanitizeFilename(projectName);
  if (workflowName) {
    const sanitizedWorkflow = sanitizeFilename(workflowName);
    return `kiteframe-${sanitizedProject}-${sanitizedWorkflow}.md`;
  }
  return `kiteframe-${sanitizedProject}.md`;
}
