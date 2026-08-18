import type { WorkflowPRD, ProjectPRD, PRDSection } from '../../ai/prdEngine';
import { loadWorkflowPRD, loadProjectPRD, listWorkflowPRDs } from '../kiteframe/utils/prdStorage';
import type { SemanticWorkflowModel } from '../kiteframe/utils/extractSemanticWorkflowModel';
import type { Node, Edge, CanvasObject } from '../kiteframe/types';
import { workflowIntentStore, type WorkflowIntent, type WorkflowMaturity } from '../../stores/workflowIntentStore';

export interface WorkflowCanvasData {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface WorkflowIntentData {
  primaryGoal: string;
  userType: string;
  successSignal: string;
  failureModes: string[];
  maturity: WorkflowMaturity;
  confirmed: boolean;
}

export interface WorkflowPRDEntry {
  workflowId: string;
  workflowName: string;
  prdSections: PRDSection[];
  semanticSummary?: string;
  canvas?: WorkflowCanvasData;
  intent?: WorkflowIntentData;
  shareUrl?: string;
}

export interface AssembledProjectPRD {
  project: {
    id: string;
    name: string;
    description?: string;
    categories?: string[];
    createdAt?: string;
    updatedAt?: string;
  };
  projectPRD?: {
    sections: PRDSection[];
    version: number;
    generatedAt: number;
  };
  workflows: WorkflowPRDEntry[];
  generatedAt: string;
  version: string;
}

export interface AssembleOptions {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  selectedWorkflowIds: string[];
  workflowNames?: Record<string, string>;
  semanticModels?: Record<string, SemanticWorkflowModel>;
  workflowCanvasData?: Record<string, WorkflowCanvasData>;
  workflowShareUrls?: Record<string, string>;
}

export function assembleProjectPRD(options: AssembleOptions): AssembledProjectPRD {
  const {
    projectId,
    projectName,
    projectDescription,
    selectedWorkflowIds,
    workflowNames = {},
    semanticModels = {},
    workflowCanvasData = {},
    workflowShareUrls = {}
  } = options;

  console.log('[assembleProjectPRD] Starting assembly');
  console.log('[assembleProjectPRD] selectedWorkflowIds:', selectedWorkflowIds);
  console.log('[assembleProjectPRD] workflowCanvasData keys:', Object.keys(workflowCanvasData));

  const projectPRD = loadProjectPRD(projectId);

  let overviewCategories: string[] | undefined;
  let overviewCreatedAt: string | undefined;
  let overviewUpdatedAt: string | undefined;
  let overviewName: string | undefined;
  let overviewDescription: string | undefined;
  try {
    const overviewRaw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(`kiteframe-details-${projectId}`)
      : null;
    if (overviewRaw) {
      const parsed = JSON.parse(overviewRaw);
      if (Array.isArray(parsed.categories)) {
        overviewCategories = parsed.categories.filter((c: unknown) => typeof c === 'string');
      }
      if (typeof parsed.createdAt === 'number') {
        overviewCreatedAt = new Date(parsed.createdAt).toISOString();
      }
      if (typeof parsed.updatedAt === 'number') {
        overviewUpdatedAt = new Date(parsed.updatedAt).toISOString();
      }
      if (typeof parsed.name === 'string') overviewName = parsed.name;
      if (typeof parsed.description === 'string') overviewDescription = parsed.description;
    }
  } catch (e) {
    console.warn('[assembleProjectPRD] Failed to read project overview:', e);
  }

  const workflows: WorkflowPRDEntry[] = [];
  
  for (const workflowId of selectedWorkflowIds) {
    const workflowPRD = loadWorkflowPRD(projectId, workflowId);
    
    const semanticModel = semanticModels[workflowId];
    let semanticSummary: string | undefined;
    
    if (semanticModel) {
      semanticSummary = buildSemanticSummary(semanticModel);
    }
    
    const canvasData = workflowCanvasData[workflowId];
    console.log(`[assembleProjectPRD] Workflow ${workflowId}: canvasData exists=${!!canvasData}, nodes=${canvasData?.nodes?.length || 0}`);
    
    const rawIntent = workflowIntentStore.get(projectId, workflowId);
    const intentData: WorkflowIntentData | undefined = rawIntent ? {
      primaryGoal: rawIntent.primaryGoal,
      userType: rawIntent.userType,
      successSignal: rawIntent.successSignal,
      failureModes: rawIntent.failureModes,
      maturity: rawIntent.maturity,
      confirmed: rawIntent.confirmed,
    } : undefined;
    
    workflows.push({
      workflowId,
      workflowName: workflowPRD?.workflowName || workflowNames[workflowId] || workflowId,
      prdSections: workflowPRD?.sections || [],
      semanticSummary,
      canvas: canvasData,
      intent: intentData,
      shareUrl: workflowShareUrls[workflowId]
    });
  }

  return {
    project: {
      id: projectId,
      name: overviewName || projectName,
      description: projectDescription || overviewDescription,
      categories: overviewCategories,
      createdAt: overviewCreatedAt || new Date().toISOString(),
      updatedAt: overviewUpdatedAt || new Date().toISOString()
    },
    projectPRD: projectPRD ? {
      sections: projectPRD.sections,
      version: projectPRD.version,
      generatedAt: projectPRD.generatedAt
    } : undefined,
    workflows,
    generatedAt: new Date().toISOString(),
    version: '1.0.0'
  };
}

function buildSemanticSummary(model: SemanticWorkflowModel): string {
  const parts: string[] = [];
  
  if (model.nodeCount > 0) {
    parts.push(`${model.nodeCount} nodes`);
  }
  
  if (model.edges.length > 0) {
    parts.push(`${model.edges.length} connections`);
  }
  
  if (model.entryPoints.length > 0) {
    parts.push(`Entry: ${model.entryPoints.join(', ')}`);
  }
  
  if (model.exitPoints.length > 0) {
    parts.push(`Exit: ${model.exitPoints.join(', ')}`);
  }
  
  if (model.primaryActions.length > 0) {
    parts.push(`Actions: ${model.primaryActions.join(', ')}`);
  }
  
  return parts.join(' | ');
}

export function getAvailableWorkflowsForExport(projectId: string): string[] {
  return listWorkflowPRDs(projectId);
}
