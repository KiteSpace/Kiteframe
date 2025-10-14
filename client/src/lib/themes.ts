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

/**
 * Calculate if a color is light or dark for intelligent text color selection
 */
export function isLightColor(color: string): boolean {
  try {
    // Remove # if present
    const hex = color.replace('#', '');
    
    // Handle 3-char hex codes
    let r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }
    
    // Calculate luminance using standard formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  } catch {
    return true; // Default to light if parsing fails
  }
}

/**
 * Get appropriate text color based on background brightness
 */
export function getContrastTextColor(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#0f172a' : '#ffffff';
}

/**
 * Get border color that matches header color exactly
 */
export function getBorderColorFromHeader(headerColor: string): string {
  console.log('🎨 getBorderColorFromHeader called with:', headerColor);
  // Simply return the header color as-is
  const borderColor = headerColor || '#e2e8f0';
  console.log('🎨 Returning border color:', borderColor);
  return borderColor;
}

export function applyThemeToNode(nodeData: any, theme: WorkflowTheme): any {
  // Use theme's predefined text colors, but fall back to intelligent contrast if needed
  const headerTextColor = theme.nodeStyles.headerText || getContrastTextColor(theme.nodeStyles.headerBackground);
  const bodyTextColor = theme.nodeStyles.bodyText || getContrastTextColor(theme.nodeStyles.bodyBackground);
  
  // Calculate border color from header color (30% darker/lighter)
  const borderColor = getBorderColorFromHeader(theme.nodeStyles.headerBackground);
  
  return {
    ...nodeData,
    colors: {
      headerBackground: theme.nodeStyles.headerBackground,
      headerTextColor: headerTextColor,
      bodyBackground: theme.nodeStyles.bodyBackground, 
      bodyTextColor: bodyTextColor,
      borderColor: borderColor
    }
  };
}

export function applyThemeToEdge(edge: any, theme: WorkflowTheme): any {
  return {
    ...edge,
    style: {
      ...edge.style,
      strokeColor: theme.edgeStyles.stroke
    },
    data: {
      ...edge.data,
      strokeSelected: theme.edgeStyles.strokeSelected
    }
  };
}