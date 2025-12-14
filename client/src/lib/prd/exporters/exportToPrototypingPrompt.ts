import type { AssembledProjectPRD } from '../assembleProjectPRD';

export function exportToPrototypingPrompt(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# ${assembled.project.name}`);
  lines.push('');
  
  if (assembled.project.description) {
    lines.push(`## Project Description`);
    lines.push(assembled.project.description);
    lines.push('');
  }
  
  if (assembled.projectPRD && assembled.projectPRD.sections.length > 0) {
    lines.push('## Project Overview');
    lines.push('');
    for (const section of assembled.projectPRD.sections) {
      if (section.content) {
        lines.push(`### ${section.title}`);
        lines.push(section.content);
        lines.push('');
      }
    }
  }
  
  lines.push('---');
  lines.push('');
  lines.push('## Workflows');
  lines.push('');
  
  for (const workflow of assembled.workflows) {
    lines.push(`### ${workflow.workflowName}`);
    lines.push('');
    
    if (workflow.semanticSummary) {
      lines.push(`> ${workflow.semanticSummary}`);
      lines.push('');
    }
    
    for (const section of workflow.prdSections) {
      if (section.content) {
        lines.push(`#### ${section.title}`);
        lines.push(section.content);
        lines.push('');
      }
    }
    
    lines.push('---');
    lines.push('');
  }
  
  lines.push('## Implementation Guidelines');
  lines.push('');
  lines.push('Use this PRD to build a prototype that:');
  lines.push('1. Implements all workflows as described above');
  lines.push('2. Handles all specified inputs and outputs');
  lines.push('3. Accounts for failure scenarios and recovery paths');
  lines.push('4. Meets the acceptance criteria for each workflow');
  lines.push('');
  lines.push(`Generated: ${assembled.generatedAt}`);
  
  return lines.join('\n');
}

export function downloadPrototypingPrompt(assembled: AssembledProjectPRD): void {
  const content = exportToPrototypingPrompt(assembled);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-prototyping-prompt.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
