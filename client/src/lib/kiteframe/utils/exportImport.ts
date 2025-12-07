/**
 * Export/Import utilities with versioning and validation
 * Provides reliable workflow serialization for enterprise use
 */

import { z } from 'zod';
import { Node, Edge, CanvasObject } from '../types';
import { validateColor, sanitizeText } from './validation';

// Export format version
export const CURRENT_VERSION = '2.0.0';

// Version compatibility map
const VERSION_COMPATIBILITY: Record<string, string[]> = {
  '2.0.0': ['2.0.0', '1.9.0', '1.8.0'],
  '1.9.0': ['1.9.0', '1.8.0', '1.7.0'],
  '1.8.0': ['1.8.0', '1.7.0']
};

// Schema for node data
const NodeDataSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  iconColor: z.string().optional(),
  displayText: z.string().optional(),
  src: z.string().optional(),
  filename: z.string().optional(),
  sourceType: z.enum(['upload', 'url', 'ai']).optional(),
  isImageBroken: z.boolean().optional(),
  // Webview node fields
  url: z.string().optional(),
  title: z.string().optional(),
  favicon: z.string().optional(),
  serviceName: z.string().optional(),
  serviceIcon: z.string().optional(),
  isLoading: z.boolean().optional(),
  loadError: z.string().optional(),
  showControls: z.boolean().optional(),
  colors: z.object({
    headerBackground: z.string().optional(),
    bodyBackground: z.string().optional(),
    borderColor: z.string().optional(),
    headerTextColor: z.string().optional(),
    bodyTextColor: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

// Schema for node
const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: NodeDataSchema,
  width: z.number().optional(),
  height: z.number().optional(),
  selected: z.boolean().optional(),
  draggable: z.boolean().optional(),
  selectable: z.boolean().optional(),
  resizable: z.boolean().optional(),
  zIndex: z.number().optional(),
  style: z.record(z.any()).optional(),
  hidden: z.boolean().optional()
});

// Schema for edge
const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  data: z.record(z.any()).optional(),
  style: z.record(z.any()).optional(),
  animated: z.boolean().optional(),
  selected: z.boolean().optional(),
  hidden: z.boolean().optional()
});

// Schema for canvas object
const CanvasObjectSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'shape', 'sticky', 'group']),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: z.record(z.any()),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  style: z.record(z.any()).optional(),
  selected: z.boolean().optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional()
});

// Schema for viewport
const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number()
});

// Schema for workflow metadata
const WorkflowMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
  permissions: z.object({
    canEdit: z.boolean().optional(),
    canShare: z.boolean().optional(),
    canExport: z.boolean().optional()
  }).optional()
});

// Main export schema
const ExportSchema = z.object({
  version: z.string(),
  format: z.literal('kiteframe-workflow'),
  exportedAt: z.string(),
  metadata: WorkflowMetadataSchema,
  workflow: z.object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
    canvasObjects: z.array(CanvasObjectSchema).optional(),
    viewport: ViewportSchema.optional()
  }),
  plugins: z.array(z.object({
    id: z.string(),
    version: z.string(),
    config: z.record(z.any()).optional()
  })).optional(),
  checksum: z.string().optional()
});

// Export type
export type WorkflowExport = z.infer<typeof ExportSchema>;

/**
 * Calculate checksum for data integrity
 */
function calculateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Sanitize and validate workflow data before export
 */
function sanitizeWorkflowData(data: {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  viewport?: { x: number; y: number; zoom: number };
}): typeof data {
  // Sanitize nodes
  const sanitizedNodes = data.nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      label: sanitizeText(node.data.label || ''),
      description: sanitizeText(node.data.description || ''),
      displayText: sanitizeText(node.data.displayText || ''),
      colors: node.data.colors ? {
        ...node.data.colors,
        headerBackground: validateColor(node.data.colors.headerBackground || '') 
          ? node.data.colors.headerBackground : undefined,
        bodyBackground: validateColor(node.data.colors.bodyBackground || '') 
          ? node.data.colors.bodyBackground : undefined,
        borderColor: validateColor(node.data.colors.borderColor || '') 
          ? node.data.colors.borderColor : undefined,
        headerTextColor: validateColor(node.data.colors.headerTextColor || '') 
          ? node.data.colors.headerTextColor : undefined,
        bodyTextColor: validateColor(node.data.colors.bodyTextColor || '') 
          ? node.data.colors.bodyTextColor : undefined
      } : undefined
    }
  }));

  // Sanitize edges
  const sanitizedEdges = data.edges.map(edge => ({
    ...edge,
    label: edge.label ? sanitizeText(edge.label) : undefined
  }));

  // Sanitize canvas objects
  const sanitizedCanvasObjects = data.canvasObjects?.map(obj => ({
    ...obj,
    data: {
      ...obj.data,
      text: obj.data.text ? sanitizeText(obj.data.text) : undefined
    }
  }));

  return {
    nodes: sanitizedNodes,
    edges: sanitizedEdges,
    canvasObjects: sanitizedCanvasObjects,
    viewport: data.viewport
  };
}

/**
 * Export workflow to JSON format
 */
export function exportWorkflow(
  data: {
    nodes: Node[];
    edges: Edge[];
    canvasObjects?: CanvasObject[];
    viewport?: { x: number; y: number; zoom: number };
  },
  metadata: Partial<z.infer<typeof WorkflowMetadataSchema>> = {}
): WorkflowExport {
  // Sanitize data
  const sanitizedData = sanitizeWorkflowData(data);

  // Create export object
  const exportData: WorkflowExport = {
    version: CURRENT_VERSION,
    format: 'kiteframe-workflow',
    exportedAt: new Date().toISOString(),
    metadata: {
      name: metadata.name || 'Untitled Workflow',
      description: metadata.description,
      author: metadata.author,
      createdAt: metadata.createdAt || new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      tags: metadata.tags,
      thumbnail: metadata.thumbnail,
      permissions: metadata.permissions
    },
    workflow: {
      nodes: sanitizedData.nodes as any[], // Type assertion needed due to complex nested types
      edges: sanitizedData.edges as any[],
      canvasObjects: sanitizedData.canvasObjects as any[],
      viewport: sanitizedData.viewport
    },
    plugins: [],
    checksum: ''
  };

  // Calculate checksum
  exportData.checksum = calculateChecksum(exportData.workflow);

  // Validate export data
  const validation = ExportSchema.safeParse(exportData);
  if (!validation.success) {
    console.error('Export validation failed:', validation.error);
    throw new Error('Failed to validate export data');
  }

  return exportData;
}

/**
 * Export workflow as downloadable file
 */
export function downloadWorkflow(
  exportData: WorkflowExport,
  filename?: string
): void {
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `workflow-${Date.now()}.kiteframe`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}

/**
 * Import workflow from JSON
 */
export function importWorkflow(
  jsonData: string | WorkflowExport
): {
  success: boolean;
  data?: {
    nodes: Node[];
    edges: Edge[];
    canvasObjects?: CanvasObject[];
    viewport?: { x: number; y: number; zoom: number };
    metadata: z.infer<typeof WorkflowMetadataSchema>;
  };
  error?: string;
  warnings?: string[];
} {
  try {
    // Parse JSON if string
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    // Validate schema
    const validation = ExportSchema.safeParse(data);
    if (!validation.success) {
      return {
        success: false,
        error: 'Invalid workflow format',
        warnings: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }

    const validData = validation.data;
    
    // Check version compatibility
    const isCompatible = isVersionCompatible(validData.version, CURRENT_VERSION);
    const warnings: string[] = [];
    
    if (!isCompatible) {
      warnings.push(`Workflow version ${validData.version} may not be fully compatible with current version ${CURRENT_VERSION}`);
    }

    // Verify checksum
    if (validData.checksum) {
      const calculatedChecksum = calculateChecksum(validData.workflow);
      if (calculatedChecksum !== validData.checksum) {
        warnings.push('Workflow data integrity check failed - data may have been modified');
      }
    }

    // Migrate data if needed
    const migratedData = migrateWorkflowData(validData, CURRENT_VERSION);
    
    // Sanitize imported data
    const sanitizedData = sanitizeWorkflowData(migratedData.workflow);

    return {
      success: true,
      data: {
        ...sanitizedData,
        metadata: migratedData.metadata
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import workflow'
    };
  }
}

/**
 * Check version compatibility
 */
function isVersionCompatible(sourceVersion: string, targetVersion: string): boolean {
  const compatibleVersions = VERSION_COMPATIBILITY[targetVersion] || [targetVersion];
  return compatibleVersions.includes(sourceVersion);
}

/**
 * Migrate workflow data to current version
 */
function migrateWorkflowData(
  data: WorkflowExport,
  targetVersion: string
): WorkflowExport {
  // Version-specific migrations
  let migrated = { ...data };
  
  // Example migration from 1.x to 2.x
  if (data.version.startsWith('1.') && targetVersion.startsWith('2.')) {
    // Add any missing fields required in v2
    migrated.workflow.nodes = migrated.workflow.nodes.map(node => ({
      ...node,
      resizable: node.resizable ?? true,
      draggable: node.draggable ?? true,
      selectable: node.selectable ?? true
    }));
  }
  
  // Update version
  migrated.version = targetVersion;
  
  return migrated;
}

/**
 * Import workflow from file
 */
export async function importWorkflowFromFile(file: File): Promise<ReturnType<typeof importWorkflow>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = importWorkflow(content);
        resolve(result);
      } catch (error) {
        resolve({
          success: false,
          error: 'Failed to read file'
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Failed to read file'
      });
    };
    
    reader.readAsText(file);
  });
}

/**
 * Validate workflow file
 */
export function validateWorkflowFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file type
  if (!file.name.endsWith('.kiteframe') && !file.name.endsWith('.json')) {
    return {
      valid: false,
      error: 'Invalid file type. Please select a .kiteframe or .json file'
    };
  }
  
  // Check file size (10MB max)
  if (file.size > 10485760) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 10MB'
    };
  }
  
  return { valid: true };
}