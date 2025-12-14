import type { WorkflowPRD } from '@/ai/prdEngine';

export interface PrototypingPromptOptions {
  workflowName: string;
  prd: WorkflowPRD;
  role?: 'developer' | 'designer' | 'pm';
  includeContext?: boolean;
}

const roleHeaders: Record<string, string> = {
  developer: `You are a senior software engineer building a production-ready prototype.
Focus on clean architecture, type safety, and maintainable code.
Prioritize functionality over visual polish for the initial implementation.`,

  designer: `You are a product designer creating a high-fidelity interactive prototype.
Focus on user experience, visual consistency, and interaction patterns.
Use realistic content and consider edge cases in the UI.`,

  pm: `You are a product manager reviewing requirements for implementation.
Ensure all acceptance criteria are clear and testable.
Identify any gaps or ambiguities that need clarification.`
};

export function generatePrototypingPrompt(options: PrototypingPromptOptions): string {
  const { workflowName, prd, role = 'developer', includeContext = true } = options;
  
  const lines: string[] = [];
  
  lines.push(`# Role`);
  lines.push(roleHeaders[role] || roleHeaders.developer);
  lines.push('');
  
  lines.push(`# Task`);
  lines.push(`Build a working prototype for: **${workflowName}**`);
  lines.push('');
  
  if (includeContext && prd.sections.length > 0) {
    lines.push(`# Requirements`);
    lines.push('');
    
    prd.sections.forEach(section => {
      if (section.content?.trim()) {
        lines.push(`## ${section.title}`);
        lines.push(section.content.trim());
        lines.push('');
      }
    });
  }
  
  lines.push(`# Constraints`);
  lines.push(`- Build incrementally, starting with core functionality`);
  lines.push(`- Use modern best practices for the chosen stack`);
  lines.push(`- Include error handling and loading states`);
  lines.push(`- Keep the code modular and well-documented`);
  lines.push('');
  
  lines.push(`# Deliverable`);
  lines.push(`A functional prototype that demonstrates the key user flows described above.`);
  
  return lines.join('\n');
}

export function copyPrototypingPromptToClipboard(prompt: string): Promise<boolean> {
  return navigator.clipboard.writeText(prompt)
    .then(() => true)
    .catch(() => false);
}

export function downloadPrototypingPrompt(prompt: string, filename: string): void {
  const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
