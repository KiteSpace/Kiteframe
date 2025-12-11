import type { WorkflowPRD, ProjectPRD } from '../../../ai/prdEngine';

const WORKFLOW_PRD_PREFIX = 'prd-workflow-';
const PROJECT_PRD_PREFIX = 'prd-project-';
const BACKUP_SUFFIX = '-backup';

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
