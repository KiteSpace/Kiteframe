import type { AssembledProjectPRD, WorkflowCanvasData } from '../assembleProjectPRD';

const FIGMA_MAKE_HEADER = `ROLE: You are generating a low-fidelity UI concept suitable for Figma Make.
OUTPUT: Describe frames, components, and interactions.
CONSTRAINTS:
- Avoid branding and styling
- Use generic components (Button, Input, Panel)
- Do not include engineering or backend instructions
- Call out ambiguities as "Open Questions" instead of inventing details

---

`;

export function exportFigmaMakePrompt(assembled: AssembledProjectPRD): string {
  const lines: string[] = [];
  
  lines.push(FIGMA_MAKE_HEADER);
  lines.push('# Figma Make Design Prompt');
  lines.push('');
  lines.push(`## Project: ${assembled.project.name}`);
  lines.push('');
  
  if (assembled.project.description) {
    lines.push('### Overview');
    lines.push('');
    lines.push(assembled.project.description);
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Design Requirements');
  lines.push('');
  
  const designReqs = generateDesignRequirements(assembled);
  for (const req of designReqs) {
    lines.push(`- ${req}`);
  }
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Screens to Design');
  lines.push('');
  
  const screens = extractScreens(assembled);
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    lines.push(`### ${i + 1}. ${screen.name}`);
    lines.push('');
    lines.push(`**Purpose:** ${screen.purpose}`);
    lines.push('');
    
    if (screen.elements.length > 0) {
      lines.push('**UI Elements:**');
      for (const element of screen.elements) {
        lines.push(`- ${element}`);
      }
      lines.push('');
    }
    
    if (screen.userActions.length > 0) {
      lines.push('**User Actions:**');
      for (const action of screen.userActions) {
        lines.push(`- ${action}`);
      }
      lines.push('');
    }
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Navigation Flows');
  lines.push('');
  
  const flows = extractNavigationFlows(assembled);
  for (const flow of flows) {
    lines.push(`### ${flow.name}`);
    lines.push('');
    lines.push('```');
    for (const step of flow.steps) {
      lines.push(step);
    }
    lines.push('```');
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## UI Components Needed');
  lines.push('');
  
  const components = extractUIComponents(assembled);
  for (const category of Object.keys(components)) {
    lines.push(`### ${category}`);
    lines.push('');
    for (const comp of components[category]) {
      lines.push(`- ${comp}`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Design Guidelines');
  lines.push('');
  lines.push('- Use a clean, modern design language');
  lines.push('- Ensure accessibility (WCAG 2.1 AA compliance)');
  lines.push('- Design for both desktop and mobile viewports');
  lines.push('- Include loading states for async operations');
  lines.push('- Design error states and empty states');
  lines.push('- Use consistent spacing and typography');
  lines.push('');
  
  lines.push('---');
  lines.push('');
  
  lines.push('## Figma Make Instructions');
  lines.push('');
  lines.push('When using this prompt with Figma Make:');
  lines.push('');
  lines.push('1. Start with the main screens listed above');
  lines.push('2. Create a component library for reusable elements');
  lines.push('3. Set up an auto-layout structure for responsiveness');
  lines.push('4. Use Figma variables for colors and spacing');
  lines.push('5. Create prototyping connections matching the navigation flows');
  lines.push('');
  
  lines.push(`*Generated from Kiteframe v${assembled.version} on ${new Date(assembled.generatedAt).toLocaleDateString()}*`);
  
  return lines.join('\n');
}

function generateDesignRequirements(assembled: AssembledProjectPRD): string[] {
  const requirements: string[] = [];
  
  requirements.push('Modern, clean interface with intuitive navigation');
  requirements.push('Responsive design supporting desktop, tablet, and mobile');
  requirements.push('Consistent visual hierarchy and typography');
  
  let hasForm = false;
  let hasTable = false;
  let hasCondition = false;
  
  for (const workflow of assembled.workflows) {
    if (!workflow.canvas?.nodes) continue;
    
    for (const node of workflow.canvas.nodes) {
      if (node.type === 'form' || node.type === 'formNode') hasForm = true;
      if (node.type === 'table' || node.type === 'tableNode') hasTable = true;
      if (node.type === 'condition' || node.type === 'conditionNode') hasCondition = true;
    }
  }
  
  if (hasForm) {
    requirements.push('Well-designed form components with validation states');
  }
  if (hasTable) {
    requirements.push('Data tables with sorting, filtering, and pagination');
  }
  if (hasCondition) {
    requirements.push('Clear visual feedback for conditional states and branches');
  }
  
  requirements.push('Accessible color contrast and focus states');
  requirements.push('Loading, error, and empty state designs');
  
  return requirements;
}

interface Screen {
  name: string;
  purpose: string;
  elements: string[];
  userActions: string[];
}

function extractScreens(assembled: AssembledProjectPRD): Screen[] {
  const screens: Screen[] = [];
  const seenNames = new Set<string>();
  
  for (const workflow of assembled.workflows) {
    const screenName = formatScreenName(workflow.workflowName);
    
    if (!seenNames.has(screenName)) {
      seenNames.add(screenName);
      
      screens.push({
        name: screenName,
        purpose: workflow.semanticSummary || `Main screen for ${workflow.workflowName}`,
        elements: extractUIElements(workflow.canvas),
        userActions: extractUserActions(workflow.canvas)
      });
    }
    
    if (workflow.canvas?.nodes) {
      for (const node of workflow.canvas.nodes) {
        const nodeType = node.type || 'default';
        
        if (shouldBeScreen(nodeType)) {
          const nodeScreenName = formatScreenName(node.data?.label || node.id);
          
          if (!seenNames.has(nodeScreenName)) {
            seenNames.add(nodeScreenName);
            
            screens.push({
              name: nodeScreenName,
              purpose: getScreenPurpose(nodeType, node.data?.label),
              elements: getNodeElements(node),
              userActions: getNodeActions(node)
            });
          }
        }
      }
    }
  }
  
  return screens;
}

function shouldBeScreen(nodeType: string): boolean {
  const screenTypes = ['form', 'formNode', 'table', 'tableNode', 'webview', 'webviewNode'];
  return screenTypes.includes(nodeType);
}

function formatScreenName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getScreenPurpose(nodeType: string, label?: string): string {
  const purposes: Record<string, string> = {
    'form': `Form screen for ${label || 'data entry'}`,
    'formNode': `Form screen for ${label || 'data entry'}`,
    'table': `Data display screen showing ${label || 'records'}`,
    'tableNode': `Data display screen showing ${label || 'records'}`,
    'webview': `Embedded content view for ${label || 'external content'}`,
    'webviewNode': `Embedded content view for ${label || 'external content'}`,
  };
  
  return purposes[nodeType] || `Screen for ${label || 'workflow step'}`;
}

function extractUIElements(canvas?: WorkflowCanvasData): string[] {
  const elements: string[] = [];
  
  if (!canvas?.nodes) return elements;
  
  for (const node of canvas.nodes) {
    const type = node.type || 'default';
    const label = node.data?.label || '';
    
    switch (type) {
      case 'form':
      case 'formNode':
        elements.push(`Form: ${label} with input fields and submit button`);
        break;
      case 'table':
      case 'tableNode':
        elements.push(`Data table: ${label} with sortable columns`);
        break;
      case 'text':
      case 'textNode':
        elements.push(`Text content: ${label}`);
        break;
      case 'image':
      case 'imageNode':
        elements.push(`Image/Media: ${label}`);
        break;
      case 'condition':
      case 'conditionNode':
        elements.push(`Decision point UI: ${label}`);
        break;
      default:
        if (label) {
          elements.push(`Component: ${label}`);
        }
    }
  }
  
  return elements;
}

function extractUserActions(canvas?: WorkflowCanvasData): string[] {
  const actions: string[] = [];
  
  if (!canvas?.nodes) return actions;
  
  for (const node of canvas.nodes) {
    const type = node.type || 'default';
    const label = node.data?.label || 'action';
    
    if (type === 'form' || type === 'formNode') {
      actions.push(`Fill out and submit ${label}`);
    }
    if (type === 'condition' || type === 'conditionNode') {
      actions.push(`Make decision at ${label}`);
    }
  }
  
  if (canvas.edges && canvas.edges.length > 0) {
    actions.push('Navigate between workflow steps');
  }
  
  return actions;
}

function getNodeElements(node: any): string[] {
  const elements: string[] = [];
  const type = node.type || 'default';
  const label = node.data?.label || '';
  
  switch (type) {
    case 'form':
    case 'formNode':
      elements.push('Text input fields');
      elements.push('Submit button');
      elements.push('Validation messages');
      elements.push('Form labels');
      break;
    case 'table':
    case 'tableNode':
      elements.push('Table header row');
      elements.push('Data rows');
      elements.push('Pagination controls');
      elements.push('Search/filter input');
      break;
    default:
      elements.push(`${label} content area`);
  }
  
  return elements;
}

function getNodeActions(node: any): string[] {
  const actions: string[] = [];
  const type = node.type || 'default';
  
  switch (type) {
    case 'form':
    case 'formNode':
      actions.push('Enter data in form fields');
      actions.push('Submit form');
      actions.push('Clear/reset form');
      break;
    case 'table':
    case 'tableNode':
      actions.push('Sort by column');
      actions.push('Filter data');
      actions.push('Navigate pages');
      actions.push('Select row');
      break;
    default:
      actions.push('Interact with content');
  }
  
  return actions;
}

interface NavigationFlow {
  name: string;
  steps: string[];
}

function extractNavigationFlows(assembled: AssembledProjectPRD): NavigationFlow[] {
  const flows: NavigationFlow[] = [];
  
  for (const workflow of assembled.workflows) {
    if (!workflow.canvas?.nodes || !workflow.canvas?.edges) continue;
    
    const steps: string[] = [];
    const nodeMap = new Map(workflow.canvas.nodes.map(n => [n.id, n]));
    
    const entryNodes = workflow.canvas.nodes.filter(n => {
      const hasIncoming = workflow.canvas?.edges?.some(e => e.target === n.id);
      return !hasIncoming;
    });
    
    for (const entry of entryNodes) {
      buildFlowSteps(entry, workflow.canvas.edges, nodeMap, steps, new Set(), 0);
    }
    
    if (steps.length > 0) {
      flows.push({
        name: workflow.workflowName,
        steps
      });
    }
  }
  
  return flows;
}

function buildFlowSteps(
  node: any,
  edges: any[],
  nodeMap: Map<string, any>,
  steps: string[],
  visited: Set<string>,
  depth: number
): void {
  if (visited.has(node.id) || depth > 10) return;
  visited.add(node.id);
  
  const indent = '  '.repeat(depth);
  const label = node.data?.label || node.id;
  steps.push(`${indent}[${label}]`);
  
  const outgoing = edges.filter(e => e.source === node.id);
  for (const edge of outgoing) {
    const target = nodeMap.get(edge.target);
    if (target) {
      const edgeLabel = edge.label ? ` (${edge.label})` : '';
      steps.push(`${indent}  ↓${edgeLabel}`);
      buildFlowSteps(target, edges, nodeMap, steps, visited, depth);
    }
  }
}

function extractUIComponents(assembled: AssembledProjectPRD): Record<string, string[]> {
  const components: Record<string, string[]> = {
    'Navigation': [],
    'Forms': [],
    'Data Display': [],
    'Feedback': [],
    'Layout': []
  };
  
  let hasNavigation = false;
  let hasForms = false;
  let hasTables = false;
  
  for (const workflow of assembled.workflows) {
    hasNavigation = true;
    
    if (!workflow.canvas?.nodes) continue;
    
    for (const node of workflow.canvas.nodes) {
      const type = node.type || 'default';
      
      if (type === 'form' || type === 'formNode') hasForms = true;
      if (type === 'table' || type === 'tableNode') hasTables = true;
    }
  }
  
  if (hasNavigation) {
    components['Navigation'] = [
      'Navigation bar/header',
      'Breadcrumbs',
      'Back button',
      'Tab navigation'
    ];
  }
  
  if (hasForms) {
    components['Forms'] = [
      'Text input',
      'Select/dropdown',
      'Checkbox/radio',
      'Date picker',
      'File upload',
      'Submit button'
    ];
  }
  
  if (hasTables) {
    components['Data Display'] = [
      'Data table',
      'Card list',
      'Detail view',
      'Empty state'
    ];
  }
  
  components['Feedback'] = [
    'Loading spinner',
    'Success toast',
    'Error message',
    'Confirmation dialog'
  ];
  
  components['Layout'] = [
    'Page container',
    'Section wrapper',
    'Grid/flex layouts',
    'Responsive breakpoints'
  ];
  
  return components;
}

export function downloadFigmaMakePrompt(assembled: AssembledProjectPRD): void {
  const content = exportFigmaMakePrompt(assembled);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-figma-make-prompt.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
