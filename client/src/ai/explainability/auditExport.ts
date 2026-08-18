/**
 * Phase 5: Audit Export
 * 
 * Provides exportable audit data for enterprise and regulated environments.
 * Export is read-only, no sensitive prompt data included.
 */

import type { AuditExport, DecisionSnapshot } from './types';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { getTimeline } from './timeline';

/**
 * In-memory decision snapshot storage
 * Persisted alongside workflow in production
 */
let decisionSnapshots: DecisionSnapshot[] = [];

/**
 * Store a decision snapshot
 */
export function storeDecisionSnapshot(snapshot: DecisionSnapshot): void {
  decisionSnapshots.push(snapshot);
}

/**
 * Get all decision snapshots (read-only)
 */
export function getDecisionSnapshots(): readonly DecisionSnapshot[] {
  return [...decisionSnapshots];
}

/**
 * Clear decision snapshots (for testing or session reset)
 */
export function clearDecisionSnapshots(): void {
  decisionSnapshots = [];
}

/**
 * Get decision snapshot by ID
 */
export function getDecisionSnapshotById(id: string): DecisionSnapshot | undefined {
  return decisionSnapshots.find(s => s.id === id);
}

/**
 * Get decision snapshots for a specific insight
 */
export function getDecisionSnapshotsForInsight(insightId: string): DecisionSnapshot[] {
  return decisionSnapshots.filter(s => s.insightId === insightId);
}

/**
 * Get decision snapshot that created a specific node
 */
export function getDecisionSnapshotForNode(nodeId: string): DecisionSnapshot | undefined {
  return decisionSnapshots.find(s => s.createdNodeIds.includes(nodeId));
}

/**
 * Generate audit export JSON
 * Contains workflow structure, provenance, snapshots, and timeline
 */
export function generateAuditExport(
  nodes: Node[],
  edges: Edge[]
): AuditExport {
  const nodeTypeCounts: Record<string, number> = {};
  
  for (const node of nodes) {
    const type = node.type || 'unknown';
    nodeTypeCounts[type] = (nodeTypeCounts[type] || 0) + 1;
  }
  
  const nodeProvenance = nodes.map(node => ({
    nodeId: node.id,
    nodeType: node.type || 'unknown',
    createdFromInsightId: node.meta?.createdFromInsightId,
    createdFromProposalId: node.meta?.createdFromProposalId,
    createdFromExperimentId: node.meta?.createdFromExperimentId,
    createdAt: node.meta?.createdAt,
  }));
  
  const edgeProvenance = edges.map(edge => ({
    edgeId: edge.id,
    createdFromInsightId: edge.meta?.createdFromInsightId,
    createdFromProposalId: edge.meta?.createdFromProposalId,
    createdFromExperimentId: edge.meta?.createdFromExperimentId,
    createdAt: edge.meta?.createdAt,
  }));
  
  return {
    exportedAt: Date.now(),
    exportVersion: '1.0',
    workflow: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: nodeTypeCounts,
    },
    nodeProvenance,
    edgeProvenance,
    decisionSnapshots: [...decisionSnapshots],
    timeline: [...getTimeline()],
  };
}

/**
 * Export audit data as downloadable JSON string
 */
export function exportAuditDataAsJson(
  nodes: Node[],
  edges: Edge[]
): string {
  const auditData = generateAuditExport(nodes, edges);
  return JSON.stringify(auditData, null, 2);
}
