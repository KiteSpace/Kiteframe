import type { AssembledProjectPRD } from '../assembleProjectPRD';

export function exportToMarkdown(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# ${assembled.project.name}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  lines.push('');
  
  if (assembled.project.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(assembled.project.description);
    lines.push('');
  }
  
  if (assembled.projectPRD && assembled.projectPRD.sections.length > 0) {
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
    
    for (const workflow of assembled.workflows) {
      lines.push(`## ${workflow.workflowName}`);
      lines.push('');
      
      if (workflow.semanticSummary) {
        lines.push(`> ${workflow.semanticSummary}`);
        lines.push('');
      }
      
      for (const section of workflow.prdSections) {
        if (section.content) {
          lines.push(`### ${section.title}`);
          lines.push('');
          lines.push(section.content);
          lines.push('');
        }
      }
    }
  }
  
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
