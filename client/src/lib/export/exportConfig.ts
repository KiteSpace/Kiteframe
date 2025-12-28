export type ExportArtifact =
  | 'prd_document'
  | 'prototype_prompt'
  | 'figma_make_prompt'
  | 'jira_csv'
  | 'kiteframe_project'
  | 'workflow_markdown_outline'
  | 'ai_build_instructions'
  | 'agent_system_prompt'
  | 'constraints_and_non_goals'
  | 'expected_outputs'
  | 'workflow_diagram';

export type ExportOption =
  | 'prd_document'
  | 'prototype_prompt'
  | 'figma_make_prompt'
  | 'jira_csv'
  | 'kiteframe_project'
  | 'bundle_builder'
  | 'bundle_design'
  | 'bundle_project'
  | 'bundle_ai_agent';

export type ExportSelection = ExportOption[];

export interface ExportOptionConfig {
  id: ExportOption;
  label: string;
  description: string;
  isBundle: boolean;
  artifacts: ExportArtifact[];
}

export const INDIVIDUAL_EXPORTS: ExportOptionConfig[] = [
  {
    id: 'prd_document',
    label: 'PRD Document',
    description: 'Product requirements document generated from selected workflows',
    isBundle: false,
    artifacts: ['prd_document'],
  },
  {
    id: 'prototype_prompt',
    label: 'Prototype Prompt',
    description: 'Structured prompt for generating prototypes with AI tools',
    isBundle: false,
    artifacts: ['prototype_prompt'],
  },
  {
    id: 'figma_make_prompt',
    label: 'Figma Make Prompt',
    description: 'Prompt optimized for Figma Make and design-focused AI tools',
    isBundle: false,
    artifacts: ['figma_make_prompt'],
  },
  {
    id: 'jira_csv',
    label: 'JIRA CSV',
    description: 'CSV file for importing epics, stories, or tasks into Jira',
    isBundle: false,
    artifacts: ['jira_csv'],
  },
  {
    id: 'kiteframe_project',
    label: 'Kiteframe Project',
    description: 'Complete project file for reimporting into Kiteframe',
    isBundle: false,
    artifacts: ['kiteframe_project'],
  },
];

export const BUNDLE_EXPORTS: ExportOptionConfig[] = [
  {
    id: 'bundle_design',
    label: 'Design',
    description: 'Prototype prompt and workflow outline for design exploration',
    isBundle: true,
    artifacts: ['prototype_prompt', 'workflow_markdown_outline'],
  },
  {
    id: 'bundle_builder',
    label: 'Builder',
    description: 'Prototype prompt, build instructions, and workflow outline',
    isBundle: true,
    artifacts: ['prototype_prompt', 'ai_build_instructions', 'workflow_markdown_outline'],
  },
  {
    id: 'bundle_project',
    label: 'Project',
    description: 'PRD, Jira CSV, workflow diagram, and Kiteframe project file',
    isBundle: true,
    artifacts: ['prd_document', 'jira_csv', 'workflow_diagram', 'kiteframe_project'],
  },
  {
    id: 'bundle_ai_agent',
    label: 'AI Agent',
    description: 'System prompt, workflow context, constraints, and expectations for an AI agent',
    isBundle: true,
    artifacts: ['agent_system_prompt', 'workflow_markdown_outline', 'constraints_and_non_goals', 'expected_outputs'],
  },
];

export const ALL_EXPORT_OPTIONS: ExportOptionConfig[] = [...INDIVIDUAL_EXPORTS, ...BUNDLE_EXPORTS];

export function getArtifactsForSelection(selection: ExportSelection): ExportArtifact[] {
  const artifactSet = new Set<ExportArtifact>();
  
  for (const optionId of selection) {
    const option = ALL_EXPORT_OPTIONS.find(o => o.id === optionId);
    if (option) {
      for (const artifact of option.artifacts) {
        artifactSet.add(artifact);
      }
    }
  }
  
  return Array.from(artifactSet);
}

export function getExportOptionById(id: ExportOption): ExportOptionConfig | undefined {
  return ALL_EXPORT_OPTIONS.find(o => o.id === id);
}

export const ARTIFACT_FILENAMES: Record<ExportArtifact, string> = {
  prd_document: 'prd.md',
  prototype_prompt: 'prototype-prompt.txt',
  figma_make_prompt: 'figma-make-prompt.txt',
  jira_csv: 'jira-import.csv',
  kiteframe_project: 'project.kiteframe.json',
  workflow_markdown_outline: 'workflow-outline.md',
  ai_build_instructions: 'build-instructions.md',
  agent_system_prompt: 'agent-system-prompt.txt',
  constraints_and_non_goals: 'constraints-and-non-goals.md',
  expected_outputs: 'expected-outputs.md',
  workflow_diagram: 'workflow-diagram.md',
};

export const ARTIFACT_LABELS: Record<ExportArtifact, string> = {
  prd_document: 'PRD Document',
  prototype_prompt: 'Prototype Prompt',
  figma_make_prompt: 'Figma Make Prompt',
  jira_csv: 'JIRA CSV',
  kiteframe_project: 'Kiteframe Project',
  workflow_markdown_outline: 'Workflow Outline',
  ai_build_instructions: 'Build Instructions',
  agent_system_prompt: 'Agent System Prompt',
  constraints_and_non_goals: 'Constraints & Non-Goals',
  expected_outputs: 'Expected Outputs',
  workflow_diagram: 'Workflow Diagram',
};
