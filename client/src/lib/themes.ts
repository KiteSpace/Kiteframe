export interface WorkflowTheme {
  id: string;
  name: string;
  description: string;
  nodeStyles: {
    headerBackground: string;
    headerText: string;
    bodyBackground: string;
    bodyText: string;
    border: string;
  };
  edgeStyles: {
    stroke: string;
    strokeSelected: string;
  };
}

export const workflowThemes: WorkflowTheme[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Clean light theme with blue accents',
    nodeStyles: {
      headerBackground: '#f8fafc',
      headerText: '#1e293b',
      bodyBackground: '#ffffff',
      bodyText: '#475569',
      border: '#e2e8f0'
    },
    edgeStyles: {
      stroke: '#94a3b8',
      strokeSelected: '#3b82f6'
    }
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Modern dark theme with purple highlights',
    nodeStyles: {
      headerBackground: '#1e293b',
      headerText: '#f1f5f9',
      bodyBackground: '#334155',
      bodyText: '#cbd5e1',
      border: '#475569'
    },
    edgeStyles: {
      stroke: '#64748b',
      strokeSelected: '#8b5cf6'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calming blue and teal color palette',
    nodeStyles: {
      headerBackground: '#0f766e',
      headerText: '#f0fdfa',
      bodyBackground: '#ccfbf1',
      bodyText: '#134e4a',
      border: '#5eead4'
    },
    edgeStyles: {
      stroke: '#2dd4bf',
      strokeSelected: '#0d9488'
    }
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Natural green theme inspired by nature',
    nodeStyles: {
      headerBackground: '#166534',
      headerText: '#f0fdf4',
      bodyBackground: '#dcfce7',
      bodyText: '#14532d',
      border: '#86efac'
    },
    edgeStyles: {
      stroke: '#4ade80',
      strokeSelected: '#22c55e'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm orange and red gradient theme',
    nodeStyles: {
      headerBackground: '#c2410c',
      headerText: '#fff7ed',
      bodyBackground: '#fed7aa',
      bodyText: '#9a3412',
      border: '#fb923c'
    },
    edgeStyles: {
      stroke: '#f97316',
      strokeSelected: '#ea580c'
    }
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Soft purple theme with gentle contrasts',
    nodeStyles: {
      headerBackground: '#7c3aed',
      headerText: '#faf5ff',
      bodyBackground: '#ede9fe',
      bodyText: '#581c87',
      border: '#c4b5fd'
    },
    edgeStyles: {
      stroke: '#a78bfa',
      strokeSelected: '#8b5cf6'
    }
  },
  {
    id: 'coral',
    name: 'Coral',
    description: 'Vibrant coral and pink theme',
    nodeStyles: {
      headerBackground: '#e11d48',
      headerText: '#fef2f2',
      bodyBackground: '#fecdd3',
      bodyText: '#881337',
      border: '#fb7185'
    },
    edgeStyles: {
      stroke: '#f43f5e',
      strokeSelected: '#e11d48'
    }
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Clean monochrome design with subtle grays',
    nodeStyles: {
      headerBackground: '#374151',
      headerText: '#f9fafb',
      bodyBackground: '#f3f4f6',
      bodyText: '#1f2937',
      border: '#d1d5db'
    },
    edgeStyles: {
      stroke: '#9ca3af',
      strokeSelected: '#4b5563'
    }
  }
];

export function getThemeById(themeId: string): WorkflowTheme | undefined {
  return workflowThemes.find(theme => theme.id === themeId);
}

export function applyThemeToNode(nodeData: any, theme: WorkflowTheme): any {
  return {
    ...nodeData,
    colors: {
      headerBackground: theme.nodeStyles.headerBackground,
      headerText: theme.nodeStyles.headerText,
      bodyBackground: theme.nodeStyles.bodyBackground,
      bodyText: theme.nodeStyles.bodyText,
      border: theme.nodeStyles.border
    }
  };
}

export function applyThemeToEdge(edgeData: any, theme: WorkflowTheme): any {
  return {
    ...edgeData,
    stroke: theme.edgeStyles.stroke,
    strokeSelected: theme.edgeStyles.strokeSelected
  };
}