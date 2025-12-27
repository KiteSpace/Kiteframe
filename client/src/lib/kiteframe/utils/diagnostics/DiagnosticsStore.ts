import type { DiagnosticIssue, DiagnosticStatus } from './types';

const STORAGE_KEY_PREFIX = 'diagnostics-';

interface StoredDiagnostics {
  version: number;
  issues: DiagnosticIssue[];
  lastUpdated: number;
}

export class DiagnosticsStore {
  private getStorageKey(projectId: string): string {
    return `${STORAGE_KEY_PREFIX}${projectId}`;
  }
  
  load(projectId: string): DiagnosticIssue[] {
    try {
      const key = this.getStorageKey(projectId);
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      
      const data: StoredDiagnostics = JSON.parse(stored);
      return data.issues || [];
    } catch (e) {
      console.warn('[DiagnosticsStore] Failed to load diagnostics:', e);
      return [];
    }
  }
  
  save(projectId: string, issues: DiagnosticIssue[]): void {
    try {
      const key = this.getStorageKey(projectId);
      const data: StoredDiagnostics = {
        version: 1,
        issues,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[DiagnosticsStore] Failed to save diagnostics:', e);
    }
  }
  
  merge(
    storedIssues: DiagnosticIssue[],
    freshIssues: DiagnosticIssue[]
  ): DiagnosticIssue[] {
    const now = Date.now();
    const storedByFingerprint = new Map<string, DiagnosticIssue>();
    
    for (const issue of storedIssues) {
      storedByFingerprint.set(issue.fingerprint, issue);
    }
    
    const freshFingerprints = new Set(freshIssues.map(i => i.fingerprint));
    const mergedIssues: DiagnosticIssue[] = [];
    
    for (const freshIssue of freshIssues) {
      const stored = storedByFingerprint.get(freshIssue.fingerprint);
      
      if (stored) {
        if (stored.status === 'resolved') {
          mergedIssues.push({
            ...freshIssue,
            status: 'new',
            createdAt: now,
            updatedAt: now,
            acknowledgedAt: undefined,
            resolvedAt: undefined,
          });
        } else {
          mergedIssues.push({
            ...stored,
            title: freshIssue.title,
            description: freshIssue.description,
            severity: freshIssue.severity,
            nodeId: freshIssue.nodeId,
            edgeId: freshIssue.edgeId,
            recommendedAction: freshIssue.recommendedAction,
            updatedAt: now,
          });
        }
      } else {
        mergedIssues.push({
          ...freshIssue,
          status: 'new',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    
    for (const stored of storedIssues) {
      if (!freshFingerprints.has(stored.fingerprint)) {
        if (stored.status !== 'resolved') {
          mergedIssues.push({
            ...stored,
            status: 'resolved',
            updatedAt: now,
            resolvedAt: now,
          });
        } else {
          mergedIssues.push(stored);
        }
      }
    }
    
    return mergedIssues;
  }
  
  acknowledge(projectId: string, fingerprint: string): void {
    const issues = this.load(projectId);
    const now = Date.now();
    
    const updated = issues.map(issue => {
      if (issue.fingerprint === fingerprint && issue.status === 'new') {
        return {
          ...issue,
          status: 'acknowledged' as DiagnosticStatus,
          acknowledgedAt: now,
          updatedAt: now,
        };
      }
      return issue;
    });
    
    this.save(projectId, updated);
  }
  
  unacknowledge(projectId: string, fingerprint: string): void {
    const issues = this.load(projectId);
    const now = Date.now();
    
    const updated = issues.map(issue => {
      if (issue.fingerprint === fingerprint && issue.status === 'acknowledged') {
        return {
          ...issue,
          status: 'new' as DiagnosticStatus,
          acknowledgedAt: undefined,
          updatedAt: now,
        };
      }
      return issue;
    });
    
    this.save(projectId, updated);
  }
  
  acknowledgeAll(projectId: string): void {
    const issues = this.load(projectId);
    const now = Date.now();
    
    const updated = issues.map(issue => {
      if (issue.status === 'new') {
        return {
          ...issue,
          status: 'acknowledged' as DiagnosticStatus,
          acknowledgedAt: now,
          updatedAt: now,
        };
      }
      return issue;
    });
    
    this.save(projectId, updated);
  }
  
  getActiveIssues(projectId: string): DiagnosticIssue[] {
    return this.load(projectId).filter(i => i.status !== 'resolved');
  }
  
  getNewIssues(projectId: string): DiagnosticIssue[] {
    return this.load(projectId).filter(i => i.status === 'new');
  }
  
  getResolvedIssues(projectId: string): DiagnosticIssue[] {
    return this.load(projectId).filter(i => i.status === 'resolved');
  }
  
  clear(projectId: string): void {
    try {
      const key = this.getStorageKey(projectId);
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[DiagnosticsStore] Failed to clear diagnostics:', e);
    }
  }
}

export const diagnosticsStore = new DiagnosticsStore();
