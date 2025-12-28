import type { AssembledProjectPRD } from '../assembleProjectPRD';

export function exportAgentSystemPrompt(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push('# AI Agent System Prompt');
  lines.push('');
  lines.push(`You are an AI agent configured to work on the "${assembled.project.name}" project.`);
  lines.push('');
  
  lines.push('## Project Context');
  lines.push('');
  if (assembled.project.description) {
    lines.push(assembled.project.description);
    lines.push('');
  }
  
  if (assembled.projectPRD && assembled.projectPRD.sections.length > 0) {
    for (const section of assembled.projectPRD.sections) {
      if (section.content) {
        lines.push(`### ${section.title}`);
        lines.push('');
        lines.push(section.content);
        lines.push('');
      }
    }
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Workflows');
  lines.push('');
  lines.push('You must understand and be able to assist with the following workflows:');
  lines.push('');
  
  for (const workflow of assembled.workflows) {
    lines.push(`### ${workflow.workflowName}`);
    lines.push('');
    
    if (workflow.semanticSummary) {
      lines.push(`> ${workflow.semanticSummary}`);
      lines.push('');
    }
    
    if (workflow.prdSections && workflow.prdSections.length > 0) {
      for (const section of workflow.prdSections) {
        if (section.content) {
          lines.push(`#### ${section.title}`);
          lines.push('');
          lines.push(section.content);
          lines.push('');
        }
      }
    }
    
    if (workflow.canvas && workflow.canvas.nodes && workflow.canvas.nodes.length > 0) {
      lines.push('#### Workflow Steps');
      lines.push('');
      for (const node of workflow.canvas.nodes) {
        const label = node.data?.label || node.id;
        const type = node.type || 'step';
        lines.push(`- **${label}** (${type})`);
      }
      lines.push('');
    }
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Your Responsibilities');
  lines.push('');
  lines.push('1. Assist users in understanding and navigating the project workflows');
  lines.push('2. Help implement features according to the PRD specifications');
  lines.push('3. Maintain consistency with the defined project structure');
  lines.push('4. Flag any deviations from the specified requirements');
  lines.push('5. Suggest improvements that align with the project goals');
  lines.push('');
  
  lines.push('## Guidelines');
  lines.push('');
  lines.push('- Always refer back to the workflow definitions when making decisions');
  lines.push('- Consider edge cases and error handling as specified');
  lines.push('- Maintain the terminology used in this document');
  lines.push('- When uncertain, ask for clarification rather than making assumptions');
  lines.push('');
  
  lines.push(`*Generated from Kiteframe v${assembled.version} on ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  
  return lines.join('\n');
}

export function exportConstraintsAndNonGoals(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# Constraints and Non-Goals: ${assembled.project.name}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  lines.push('');
  
  lines.push('## Constraints');
  lines.push('');
  lines.push('The following constraints apply to this project:');
  lines.push('');
  
  const constraints = extractConstraints(assembled);
  for (const constraint of constraints) {
    lines.push(`- ${constraint}`);
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Non-Goals');
  lines.push('');
  lines.push('The following are explicitly out of scope for this project:');
  lines.push('');
  
  const nonGoals = extractNonGoals(assembled);
  for (const nonGoal of nonGoals) {
    lines.push(`- ${nonGoal}`);
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Boundaries');
  lines.push('');
  lines.push('### What This Project IS');
  lines.push('');
  
  const isStatements = generateIsStatements(assembled);
  for (const statement of isStatements) {
    lines.push(`- ${statement}`);
  }
  lines.push('');
  
  lines.push('### What This Project IS NOT');
  lines.push('');
  
  const isNotStatements = generateIsNotStatements(assembled);
  for (const statement of isNotStatements) {
    lines.push(`- ${statement}`);
  }
  lines.push('');
  
  lines.push(`*Exported from Kiteframe v${assembled.version}*`);
  
  return lines.join('\n');
}

function extractConstraints(assembled: AssembledProjectPRD): string[] {
  const constraints: string[] = [];
  
  constraints.push('Must implement all defined workflows as specified');
  constraints.push('Must handle error cases gracefully');
  constraints.push('Must maintain data consistency across workflows');
  
  for (const workflow of assembled.workflows) {
    if (workflow.prdSections) {
      for (const section of workflow.prdSections) {
        if (section.title.toLowerCase().includes('constraint') && section.content) {
          const items = section.content.split('\n').filter(l => l.trim().startsWith('-'));
          constraints.push(...items.map(i => i.replace(/^-\s*/, '')));
        }
      }
    }
  }
  
  if (assembled.workflows.length > 0) {
    constraints.push(`Must support ${assembled.workflows.length} core workflow(s)`);
  }
  
  return Array.from(new Set(constraints));
}

function extractNonGoals(assembled: AssembledProjectPRD): string[] {
  const nonGoals: string[] = [];
  
  nonGoals.push('Features not explicitly defined in the workflows');
  nonGoals.push('Optimizations beyond functional requirements');
  nonGoals.push('Third-party integrations not specified in the PRD');
  
  for (const workflow of assembled.workflows) {
    if (workflow.prdSections) {
      for (const section of workflow.prdSections) {
        if (section.title.toLowerCase().includes('non-goal') && section.content) {
          const items = section.content.split('\n').filter(l => l.trim().startsWith('-'));
          nonGoals.push(...items.map(i => i.replace(/^-\s*/, '')));
        }
      }
    }
  }
  
  return Array.from(new Set(nonGoals));
}

function generateIsStatements(assembled: AssembledProjectPRD): string[] {
  const statements: string[] = [];
  
  if (assembled.project.description) {
    statements.push(assembled.project.description.split('.')[0]);
  }
  
  for (const workflow of assembled.workflows) {
    statements.push(`A system that supports ${workflow.workflowName}`);
  }
  
  return statements;
}

function generateIsNotStatements(assembled: AssembledProjectPRD): string[] {
  return [
    'A complete replacement for existing enterprise systems',
    'A one-size-fits-all solution for all use cases',
    'A system that handles edge cases beyond the defined scope',
    'A platform for features not specified in the PRD'
  ];
}

export function exportExpectedOutputs(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# Expected Outputs: ${assembled.project.name}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  lines.push('');
  
  lines.push('## Deliverables');
  lines.push('');
  lines.push('The following outputs are expected from this project:');
  lines.push('');
  
  lines.push('### Core Features');
  lines.push('');
  
  for (const workflow of assembled.workflows) {
    lines.push(`#### ${workflow.workflowName}`);
    lines.push('');
    
    if (workflow.canvas && workflow.canvas.nodes) {
      const outputs = extractWorkflowOutputs(workflow);
      for (const output of outputs) {
        lines.push(`- ${output}`);
      }
    } else {
      lines.push('- Functional workflow implementation');
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Acceptance Criteria');
  lines.push('');
  
  for (const workflow of assembled.workflows) {
    lines.push(`### ${workflow.workflowName}`);
    lines.push('');
    
    const criteria = extractAcceptanceCriteria(workflow);
    for (const criterion of criteria) {
      lines.push(`- [ ] ${criterion}`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Success Metrics');
  lines.push('');
  lines.push('The project will be considered successful when:');
  lines.push('');
  lines.push('- All workflows are implemented and functional');
  lines.push('- Acceptance criteria for each workflow are met');
  lines.push('- Error handling covers defined edge cases');
  lines.push('- User can complete end-to-end flows without blocking issues');
  lines.push('');
  
  lines.push(`*Exported from Kiteframe v${assembled.version}*`);
  
  return lines.join('\n');
}

function extractWorkflowOutputs(workflow: any): string[] {
  const outputs: string[] = [];
  
  if (!workflow.canvas?.nodes) return outputs;
  
  for (const node of workflow.canvas.nodes) {
    const label = node.data?.label || node.id;
    const type = node.type || 'default';
    
    if (type === 'form' || type === 'formNode') {
      outputs.push(`Form component: ${label}`);
    } else if (type === 'table' || type === 'tableNode') {
      outputs.push(`Data display: ${label}`);
    } else if (type === 'condition' || type === 'conditionNode') {
      outputs.push(`Decision logic: ${label}`);
    } else {
      outputs.push(`Feature: ${label}`);
    }
  }
  
  return outputs;
}

function extractAcceptanceCriteria(workflow: any): string[] {
  const criteria: string[] = [];
  
  criteria.push(`User can initiate ${workflow.workflowName}`);
  
  if (workflow.canvas?.nodes) {
    const hasForm = workflow.canvas.nodes.some((n: any) => n.type === 'form' || n.type === 'formNode');
    if (hasForm) {
      criteria.push('Form submissions are validated and processed correctly');
    }
    
    const hasCondition = workflow.canvas.nodes.some((n: any) => n.type === 'condition' || n.type === 'conditionNode');
    if (hasCondition) {
      criteria.push('Conditional paths execute correctly based on criteria');
    }
  }
  
  criteria.push('Error states are handled gracefully');
  criteria.push(`User can complete ${workflow.workflowName} end-to-end`);
  
  if (workflow.prdSections) {
    for (const section of workflow.prdSections) {
      if (section.title.toLowerCase().includes('acceptance') && section.content) {
        const items = section.content.split('\n').filter((l: string) => l.trim().startsWith('-'));
        criteria.push(...items.map((i: string) => i.replace(/^-\s*/, '')));
      }
    }
  }
  
  return Array.from(new Set(criteria));
}

export function downloadAgentSystemPrompt(assembled: AssembledProjectPRD): void {
  const content = exportAgentSystemPrompt(assembled);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-agent-system-prompt.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadConstraintsAndNonGoals(assembled: AssembledProjectPRD): void {
  const content = exportConstraintsAndNonGoals(assembled);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-constraints.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExpectedOutputs(assembled: AssembledProjectPRD): void {
  const content = exportExpectedOutputs(assembled);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-expected-outputs.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
