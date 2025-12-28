import type { AssembledProjectPRD, WorkflowCanvasData } from '../assembleProjectPRD';

export function exportAiBuildInstructions(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(`# Build Instructions: ${assembled.project.name}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  lines.push('');
  
  lines.push('## Project Context');
  lines.push('');
  if (assembled.project.description) {
    lines.push(assembled.project.description);
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Technical Stack Recommendations');
  lines.push('');
  const techStack = inferTechStack(assembled);
  for (const item of techStack) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Data Models');
  lines.push('');
  const dataModels = extractDataModels(assembled);
  if (dataModels.length > 0) {
    for (const model of dataModels) {
      lines.push(`### ${model.name}`);
      lines.push('');
      lines.push('```typescript');
      lines.push(`interface ${model.name} {`);
      for (const field of model.fields) {
        lines.push(`  ${field.name}: ${field.type};`);
      }
      lines.push('}');
      lines.push('```');
      lines.push('');
    }
  } else {
    lines.push('*Data models will be derived from workflow implementation*');
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Key Components to Build');
  lines.push('');
  const components = extractKeyComponents(assembled);
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    lines.push(`### ${i + 1}. ${comp.name}`);
    lines.push('');
    lines.push(`**Type:** ${comp.type}`);
    lines.push('');
    if (comp.description) {
      lines.push(comp.description);
      lines.push('');
    }
    if (comp.responsibilities.length > 0) {
      lines.push('**Responsibilities:**');
      for (const resp of comp.responsibilities) {
        lines.push(`- ${resp}`);
      }
      lines.push('');
    }
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Implementation Order');
  lines.push('');
  const implementationOrder = generateImplementationOrder(assembled);
  for (let i = 0; i < implementationOrder.length; i++) {
    const step = implementationOrder[i];
    lines.push(`### Step ${i + 1}: ${step.title}`);
    lines.push('');
    lines.push(step.description);
    lines.push('');
    if (step.tasks.length > 0) {
      lines.push('**Tasks:**');
      for (const task of step.tasks) {
        lines.push(`- [ ] ${task}`);
      }
      lines.push('');
    }
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Workflow Implementation Details');
  lines.push('');
  
  for (const workflow of assembled.workflows) {
    lines.push(`### ${workflow.workflowName}`);
    lines.push('');
    
    if (workflow.semanticSummary) {
      lines.push(`> ${workflow.semanticSummary}`);
      lines.push('');
    }
    
    if (workflow.canvas) {
      const implDetails = generateWorkflowImplementation(workflow.workflowName, workflow.canvas);
      lines.push(implDetails);
    }
    
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push(`*Exported from Kiteframe v${assembled.version}*`);
  
  return lines.join('\n');
}

function inferTechStack(assembled: AssembledProjectPRD): string[] {
  const stack: string[] = [];
  
  stack.push('**Frontend:** React with TypeScript');
  stack.push('**State Management:** React Query or Zustand');
  stack.push('**Styling:** Tailwind CSS');
  stack.push('**Backend:** Node.js with Express');
  stack.push('**Database:** PostgreSQL with Drizzle ORM');
  stack.push('**Authentication:** Session-based or JWT');
  
  const hasFormNodes = assembled.workflows.some(w => 
    w.canvas?.nodes?.some(n => n.type === 'form' || n.type === 'formNode')
  );
  if (hasFormNodes) {
    stack.push('**Forms:** React Hook Form with Zod validation');
  }
  
  const hasApiNodes = assembled.workflows.some(w => 
    w.canvas?.nodes?.some(n => 
      n.type === 'api' || 
      n.data?.label?.toLowerCase().includes('api') ||
      n.data?.label?.toLowerCase().includes('fetch')
    )
  );
  if (hasApiNodes) {
    stack.push('**API Client:** Axios or Fetch with type safety');
  }
  
  return stack;
}

interface DataModel {
  name: string;
  fields: { name: string; type: string }[];
}

function extractDataModels(assembled: AssembledProjectPRD): DataModel[] {
  const models: DataModel[] = [];
  const seenNames = new Set<string>();
  
  for (const workflow of assembled.workflows) {
    if (!workflow.canvas?.nodes) continue;
    
    for (const node of workflow.canvas.nodes) {
      const label = node.data?.label || '';
      
      if (node.type === 'table' || node.type === 'tableNode') {
        const modelName = toPascalCase(label) || 'DataEntity';
        if (!seenNames.has(modelName)) {
          seenNames.add(modelName);
          models.push({
            name: modelName,
            fields: [
              { name: 'id', type: 'string' },
              { name: 'createdAt', type: 'Date' },
              { name: 'updatedAt', type: 'Date' },
            ]
          });
        }
      }
      
      if (node.type === 'form' || node.type === 'formNode') {
        const modelName = toPascalCase(label.replace(/form/i, '')) + 'FormData' || 'FormData';
        if (!seenNames.has(modelName)) {
          seenNames.add(modelName);
          models.push({
            name: modelName,
            fields: [
              { name: 'data', type: 'Record<string, unknown>' },
              { name: 'isValid', type: 'boolean' },
            ]
          });
        }
      }
    }
  }
  
  return models;
}

interface Component {
  name: string;
  type: string;
  description?: string;
  responsibilities: string[];
}

function extractKeyComponents(assembled: AssembledProjectPRD): Component[] {
  const components: Component[] = [];
  const seenNames = new Set<string>();
  
  for (const workflow of assembled.workflows) {
    const compName = toPascalCase(workflow.workflowName) + 'Component';
    if (!seenNames.has(compName)) {
      seenNames.add(compName);
      components.push({
        name: compName,
        type: 'Page/Feature Component',
        description: workflow.semanticSummary,
        responsibilities: extractResponsibilities(workflow.canvas)
      });
    }
  }
  
  return components;
}

function extractResponsibilities(canvas?: WorkflowCanvasData): string[] {
  const responsibilities: string[] = [];
  
  if (!canvas?.nodes) return responsibilities;
  
  const nodeTypes = new Set(canvas.nodes.map(n => n.type));
  
  if (nodeTypes.has('form') || nodeTypes.has('formNode')) {
    responsibilities.push('Handle user input and form validation');
  }
  if (nodeTypes.has('condition') || nodeTypes.has('conditionNode')) {
    responsibilities.push('Manage conditional logic and branching');
  }
  if (canvas.nodes.some(n => n.data?.label?.toLowerCase().includes('api'))) {
    responsibilities.push('Integrate with backend API');
  }
  if (canvas.nodes.some(n => n.data?.label?.toLowerCase().includes('display') || n.data?.label?.toLowerCase().includes('show'))) {
    responsibilities.push('Display data to users');
  }
  
  return responsibilities;
}

interface ImplementationStep {
  title: string;
  description: string;
  tasks: string[];
}

function generateImplementationOrder(assembled: AssembledProjectPRD): ImplementationStep[] {
  const steps: ImplementationStep[] = [];
  
  steps.push({
    title: 'Project Setup',
    description: 'Initialize the project structure and install dependencies.',
    tasks: [
      'Create project with recommended stack',
      'Configure TypeScript and linting',
      'Set up folder structure',
      'Configure environment variables'
    ]
  });
  
  steps.push({
    title: 'Data Layer',
    description: 'Define data models and set up database connections.',
    tasks: [
      'Define database schema',
      'Create TypeScript interfaces',
      'Set up ORM migrations',
      'Implement data access layer'
    ]
  });
  
  steps.push({
    title: 'Core Components',
    description: 'Build reusable UI components and utilities.',
    tasks: [
      'Create shared UI components',
      'Implement form components',
      'Set up routing',
      'Create layout components'
    ]
  });
  
  for (const workflow of assembled.workflows) {
    steps.push({
      title: `Implement: ${workflow.workflowName}`,
      description: `Build the ${workflow.workflowName} workflow as defined in the specification.`,
      tasks: generateWorkflowTasks(workflow.canvas)
    });
  }
  
  steps.push({
    title: 'Integration & Testing',
    description: 'Connect all components and verify functionality.',
    tasks: [
      'Write unit tests for core logic',
      'Add integration tests for workflows',
      'Test error handling and edge cases',
      'Perform end-to-end testing'
    ]
  });
  
  return steps;
}

function generateWorkflowTasks(canvas?: WorkflowCanvasData): string[] {
  const tasks: string[] = [];
  
  if (!canvas?.nodes) {
    return ['Implement workflow based on specification'];
  }
  
  const nodeLabels = canvas.nodes.map(n => n.data?.label).filter(Boolean);
  
  tasks.push('Create main component structure');
  
  for (const label of nodeLabels.slice(0, 5)) {
    tasks.push(`Implement "${label}" functionality`);
  }
  
  if (canvas.edges && canvas.edges.length > 0) {
    tasks.push('Wire up navigation and state transitions');
  }
  
  return tasks;
}

function generateWorkflowImplementation(name: string, canvas: WorkflowCanvasData): string {
  const lines: string[] = [];
  
  if (!canvas.nodes || canvas.nodes.length === 0) {
    return '*No nodes defined*';
  }
  
  lines.push('**Flow:**');
  lines.push('');
  lines.push('```');
  
  const nodeMap = new Map(canvas.nodes.map(n => [n.id, n]));
  const visited = new Set<string>();
  
  const entryNodes = canvas.nodes.filter(n => {
    const hasIncoming = canvas.edges?.some(e => e.target === n.id);
    return !hasIncoming;
  });
  
  for (const entry of entryNodes) {
    buildFlowTree(entry, canvas.edges || [], nodeMap, visited, lines, 0);
  }
  
  lines.push('```');
  lines.push('');
  
  return lines.join('\n');
}

function buildFlowTree(
  node: any,
  edges: any[],
  nodeMap: Map<string, any>,
  visited: Set<string>,
  lines: string[],
  depth: number
): void {
  if (visited.has(node.id) || depth > 10) return;
  visited.add(node.id);
  
  const indent = '  '.repeat(depth);
  const label = node.data?.label || node.id;
  const type = node.type || 'step';
  
  lines.push(`${indent}[${type}] ${label}`);
  
  const outgoing = edges.filter(e => e.source === node.id);
  for (const edge of outgoing) {
    const target = nodeMap.get(edge.target);
    if (target) {
      const edgeLabel = edge.label ? ` (${edge.label})` : '';
      lines.push(`${indent}  ↓${edgeLabel}`);
      buildFlowTree(target, edges, nodeMap, visited, lines, depth + 1);
    }
  }
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^./, s => s.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

export function downloadAiBuildInstructions(assembled: AssembledProjectPRD): void {
  const content = exportAiBuildInstructions(assembled);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-build-instructions.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
