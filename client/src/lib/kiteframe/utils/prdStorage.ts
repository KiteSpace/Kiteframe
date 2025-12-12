import type { WorkflowPRD, ProjectPRD } from '../../../ai/prdEngine';

const WORKFLOW_PRD_PREFIX = 'prd-workflow-';
const PROJECT_PRD_PREFIX = 'prd-project-';
const BACKUP_SUFFIX = '-backup';
const HISTORY_SUFFIX = '-history';
const MAX_HISTORY_VERSIONS = 10;

export type PRDVersionReason = 'ai-generate' | 'ai-update' | 'manual';

export interface PRDVersion<T = WorkflowPRD | ProjectPRD> {
  version: number;
  createdAt: string;
  content: T;
  reason: PRDVersionReason;
}

export interface PRDHistory<T = WorkflowPRD | ProjectPRD> {
  versions: PRDVersion<T>[];
}

export function getWorkflowPRDKey(projectId: string, workflowId: string): string {
  return `${WORKFLOW_PRD_PREFIX}${projectId}-${workflowId}`;
}

export function getProjectPRDKey(projectId: string): string {
  return `${PROJECT_PRD_PREFIX}${projectId}`;
}

export function saveWorkflowPRD(projectId: string, workflowId: string, prd: WorkflowPRD): void {
  const key = getWorkflowPRDKey(projectId, workflowId);
  try {
    localStorage.setItem(key, JSON.stringify(prd));
  } catch (e) {
    console.error('Failed to save workflow PRD:', e);
  }
}

export function loadWorkflowPRD(projectId: string, workflowId: string): WorkflowPRD | null {
  const key = getWorkflowPRDKey(projectId, workflowId);
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveWorkflowPRDBackup(projectId: string, workflowId: string, prd: WorkflowPRD): void {
  const key = getWorkflowPRDKey(projectId, workflowId) + BACKUP_SUFFIX;
  try {
    localStorage.setItem(key, JSON.stringify({
      ...prd,
      backedUpAt: Date.now()
    }));
  } catch (e) {
    console.error('Failed to save workflow PRD backup:', e);
  }
}

export function loadWorkflowPRDBackup(projectId: string, workflowId: string): WorkflowPRD | null {
  const key = getWorkflowPRDKey(projectId, workflowId) + BACKUP_SUFFIX;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveProjectPRD(projectId: string, prd: ProjectPRD): void {
  const key = getProjectPRDKey(projectId);
  try {
    localStorage.setItem(key, JSON.stringify(prd));
  } catch (e) {
    console.error('Failed to save project PRD:', e);
  }
}

export function loadProjectPRD(projectId: string): ProjectPRD | null {
  const key = getProjectPRDKey(projectId);
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveProjectPRDBackup(projectId: string, prd: ProjectPRD): void {
  const key = getProjectPRDKey(projectId) + BACKUP_SUFFIX;
  try {
    localStorage.setItem(key, JSON.stringify({
      ...prd,
      backedUpAt: Date.now()
    }));
  } catch (e) {
    console.error('Failed to save project PRD backup:', e);
  }
}

export function deleteWorkflowPRD(projectId: string, workflowId: string): void {
  const key = getWorkflowPRDKey(projectId, workflowId);
  localStorage.removeItem(key);
  localStorage.removeItem(key + BACKUP_SUFFIX);
}

export function deleteProjectPRD(projectId: string): void {
  const key = getProjectPRDKey(projectId);
  localStorage.removeItem(key);
  localStorage.removeItem(key + BACKUP_SUFFIX);
}

export function listWorkflowPRDs(projectId: string): string[] {
  const prefix = `${WORKFLOW_PRD_PREFIX}${projectId}-`;
  const keys: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix) && !key.endsWith(BACKUP_SUFFIX)) {
      const workflowId = key.replace(prefix, '');
      keys.push(workflowId);
    }
  }
  
  return keys;
}

export function updatePRDSection(
  prd: WorkflowPRD | ProjectPRD,
  sectionId: string,
  content: string,
  markAsManualEdit: boolean = true
): WorkflowPRD | ProjectPRD {
  const updatedSections = prd.sections.map(s => 
    s.id === sectionId ? { ...s, content } : s
  );
  
  const updatedManualEditedAt = markAsManualEdit
    ? { ...prd.manualEditedAt, [sectionId]: Date.now() }
    : prd.manualEditedAt;
  
  return {
    ...prd,
    sections: updatedSections,
    manualEditedAt: updatedManualEditedAt
  };
}

export function clearManualEdit(
  prd: WorkflowPRD | ProjectPRD,
  sectionId: string
): WorkflowPRD | ProjectPRD {
  const { [sectionId]: _, ...remainingEdits } = prd.manualEditedAt;
  return {
    ...prd,
    manualEditedAt: remainingEdits
  };
}

function getWorkflowHistoryKey(projectId: string, workflowId: string): string {
  return `${WORKFLOW_PRD_PREFIX}${projectId}-${workflowId}${HISTORY_SUFFIX}`;
}

function getProjectHistoryKey(projectId: string): string {
  return `${PROJECT_PRD_PREFIX}${projectId}${HISTORY_SUFFIX}`;
}

export function saveWorkflowPRDVersion(
  projectId: string,
  workflowId: string,
  prd: WorkflowPRD,
  reason: PRDVersionReason
): void {
  const historyKey = getWorkflowHistoryKey(projectId, workflowId);
  
  try {
    const stored = localStorage.getItem(historyKey);
    const history: PRDHistory<WorkflowPRD> = stored ? JSON.parse(stored) : { versions: [] };
    
    const nextVersion = history.versions.length > 0 
      ? Math.max(...history.versions.map(v => v.version)) + 1 
      : 1;
    
    const newVersion: PRDVersion<WorkflowPRD> = {
      version: nextVersion,
      createdAt: new Date().toISOString(),
      content: prd,
      reason
    };
    
    history.versions.push(newVersion);
    
    if (history.versions.length > MAX_HISTORY_VERSIONS) {
      history.versions = history.versions.slice(-MAX_HISTORY_VERSIONS);
    }
    
    localStorage.setItem(historyKey, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save workflow PRD version:', e);
  }
}

export function loadWorkflowPRDHistory(
  projectId: string,
  workflowId: string
): PRDVersion<WorkflowPRD>[] {
  const historyKey = getWorkflowHistoryKey(projectId, workflowId);
  
  try {
    const stored = localStorage.getItem(historyKey);
    if (!stored) return [];
    
    const history: PRDHistory<WorkflowPRD> = JSON.parse(stored);
    return history.versions.sort((a, b) => b.version - a.version);
  } catch {
    return [];
  }
}

export function restoreWorkflowPRDVersion(
  projectId: string,
  workflowId: string,
  version: number
): WorkflowPRD | null {
  const history = loadWorkflowPRDHistory(projectId, workflowId);
  const versionToRestore = history.find(v => v.version === version);
  
  if (!versionToRestore) return null;
  
  const currentPrd = loadWorkflowPRD(projectId, workflowId);
  if (currentPrd) {
    saveWorkflowPRDVersion(projectId, workflowId, currentPrd, 'manual');
  }
  
  saveWorkflowPRD(projectId, workflowId, versionToRestore.content);
  return versionToRestore.content;
}

export function saveProjectPRDVersion(
  projectId: string,
  prd: ProjectPRD,
  reason: PRDVersionReason
): void {
  const historyKey = getProjectHistoryKey(projectId);
  
  try {
    const stored = localStorage.getItem(historyKey);
    const history: PRDHistory<ProjectPRD> = stored ? JSON.parse(stored) : { versions: [] };
    
    const nextVersion = history.versions.length > 0 
      ? Math.max(...history.versions.map(v => v.version)) + 1 
      : 1;
    
    const newVersion: PRDVersion<ProjectPRD> = {
      version: nextVersion,
      createdAt: new Date().toISOString(),
      content: prd,
      reason
    };
    
    history.versions.push(newVersion);
    
    if (history.versions.length > MAX_HISTORY_VERSIONS) {
      history.versions = history.versions.slice(-MAX_HISTORY_VERSIONS);
    }
    
    localStorage.setItem(historyKey, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save project PRD version:', e);
  }
}

export function loadProjectPRDHistory(projectId: string): PRDVersion<ProjectPRD>[] {
  const historyKey = getProjectHistoryKey(projectId);
  
  try {
    const stored = localStorage.getItem(historyKey);
    if (!stored) return [];
    
    const history: PRDHistory<ProjectPRD> = JSON.parse(stored);
    return history.versions.sort((a, b) => b.version - a.version);
  } catch {
    return [];
  }
}

export function restoreProjectPRDVersion(
  projectId: string,
  version: number
): ProjectPRD | null {
  const history = loadProjectPRDHistory(projectId);
  const versionToRestore = history.find(v => v.version === version);
  
  if (!versionToRestore) return null;
  
  const currentPrd = loadProjectPRD(projectId);
  if (currentPrd) {
    saveProjectPRDVersion(projectId, currentPrd, 'manual');
  }
  
  saveProjectPRD(projectId, versionToRestore.content);
  return versionToRestore.content;
}
