export type DiagnosticSeverity = 'info' | 'warn' | 'risk' | 'critical';

export type DiagnosticStatus = 'new' | 'acknowledged' | 'resolved';

export type DiagnosticType = 
  | 'missing-end-state'
  | 'dead-end-node'
  | 'disconnected-subgraph'
  | 'orphan-decision'
  | 'loop-without-exit'
  | 'retry-without-counter';

export interface DiagnosticIssue {
  id: string;
  projectId: string;
  workflowId?: string;
  nodeId?: string;
  edgeId?: string;
  
  type: DiagnosticType;
  title: string;
  description: string;
  severity: DiagnosticSeverity;
  status: DiagnosticStatus;
  
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  
  recommendedAction?: {
    kind: 'create-experiment' | 'navigate' | 'noop';
    experimentMode?: 'whatif' | 'enhancement' | 'open_exploration';
  };
  
  fingerprint: string;
  
  autoRepaired?: boolean;
  autoRepairDetails?: string;
}

export interface RepairInfo {
  repairedNodeIds: string[];
  repairedIssueTypes: string[];
}

export const SEVERITY_CONFIG: Record<DiagnosticSeverity, { color: string; glyph: string; priority: number }> = {
  info: { color: 'grey', glyph: '•', priority: 0 },
  warn: { color: 'yellow', glyph: '!', priority: 1 },
  risk: { color: 'orange', glyph: '!!', priority: 2 },
  critical: { color: 'red', glyph: '⚠', priority: 3 },
};

export function getSeverityPriority(severity: DiagnosticSeverity): number {
  return SEVERITY_CONFIG[severity].priority;
}

export function getHighestSeverity(issues: DiagnosticIssue[]): DiagnosticSeverity | null {
  if (issues.length === 0) return null;
  return issues.reduce((highest, issue) => {
    return getSeverityPriority(issue.severity) > getSeverityPriority(highest.severity) ? issue : highest;
  }, issues[0]).severity;
}
