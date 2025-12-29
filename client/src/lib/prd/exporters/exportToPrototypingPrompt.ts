import type { AssembledProjectPRD } from '../assembleProjectPRD';

const PROTOTYPE_PROMPT_HEADER = `ROLE: You are an AI product designer and prototyper.
TASK: Produce a low-fidelity interactive prototype plan based on the workflow below.
OUTPUT: Provide screens or states, interactions, and navigation using structured bullet points.
CONSTRAINTS:
- Do not create high-fidelity visual design.
- Do not assume a backend unless explicitly stated.
- Call out ambiguities as "Open Questions" instead of inventing details.

---

INPUT: Workflow Outline (authoritative)

`;

const PROTOTYPE_RESPONSE_FORMAT = `
---

RESPONSE FORMAT:
1. Assumptions (max 5)
2. Primary screens or states
3. Key interactions per screen
4. Edge cases and empty states
5. Open Questions
`;

export function exportToPrototypingPrompt(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(PROTOTYPE_PROMPT_HEADER);
  
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
  
  lines.push(PROTOTYPE_RESPONSE_FORMAT);
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
