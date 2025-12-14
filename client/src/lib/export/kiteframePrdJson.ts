import type { WorkflowPRD } from '@/ai/prdEngine';
import type { Node, Edge } from '@/lib/kiteframe/types';

export interface KiteframePRDExport {
  version: '1.0';
  exportedAt: string;
  workflowId: string;
  workflowName: string;
  prd: WorkflowPRD;
  workflow?: {
    nodes: Node[];
    edges: Edge[];
  };
  metadata?: {
    projectId?: string;
    hash?: string;
  };
}

export interface ExportKiteframePRDOptions {
  workflowId: string;
  workflowName: string;
  prd: WorkflowPRD;
  nodes?: Node[];
  edges?: Edge[];
  projectId?: string;
  includeWorkflow?: boolean;
}

export function exportKiteframePRDJson(options: ExportKiteframePRDOptions): string {
  const { workflowId, workflowName, prd, nodes, edges, projectId, includeWorkflow = false } = options;
  
  const exportData: KiteframePRDExport = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    workflowId,
    workflowName,
    prd,
    metadata: {
      projectId,
      hash: prd.hash
    }
  };
  
  if (includeWorkflow && nodes && edges) {
    exportData.workflow = { nodes, edges };
  }
  
  return JSON.stringify(exportData, null, 2);
}

export function downloadKiteframePRDJson(json: string, workflowName: string): void {
  const safeName = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const filename = `${safeName}.kiteframe-prd.json`;
  
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseKiteframePRDJson(json: string): KiteframePRDExport | null {
  try {
    const data = JSON.parse(json);
    if (data.version === '1.0' && data.prd) {
      return data as KiteframePRDExport;
    }
    return null;
  } catch {
    return null;
  }
}
