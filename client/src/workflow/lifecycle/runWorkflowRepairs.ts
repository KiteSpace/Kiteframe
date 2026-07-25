/**
 * TASK 4: Workflow Repairs Lifecycle
 * 
 * Orchestrates repair operations in the correct order:
 * 1. AFTER chat mutation
 * 2. BEFORE Test Flight
 * 3. BEFORE Propose / Experiment logic
 * 
 * This ensures decision nodes are complete before any diagnostics run.
 */

import type { Node, Edge } from '@/lib/kiteframe/types';
import { runDecisionRepair, type DecisionRepairResult } from '@/ai/repair/decisionRepair';
import type { DecisionRepairApplied, MutationSafety } from '@/ai/explainability/types';
import type { RepairInfo } from '@/lib/kiteframe/utils/diagnostics/types';

export interface WorkflowRepairResult {
  nodes: Node[];
  edges: Edge[];
  repairsApplied: {
    decisionRepairs: DecisionRepairApplied[];
  };
  hasChanges: boolean;
  repairInfo: RepairInfo;
  mutationSafety: Partial<MutationSafety>;
}

export interface RepairOptions {
  decisionRepairEnabled?: boolean;
}

const DEFAULT_REPAIR_OPTIONS: RepairOptions = {
  decisionRepairEnabled: true,
};

export function runWorkflowRepairs(
  nodes: Node[],
  edges: Edge[],
  options: RepairOptions = {}
): WorkflowRepairResult {
  const opts = { ...DEFAULT_REPAIR_OPTIONS, ...options };
  let currentNodes = nodes;
  let currentEdges = edges;
  let hasChanges = false;
  
  const repairsApplied: WorkflowRepairResult['repairsApplied'] = {
    decisionRepairs: [],
  };
  
  const repairedNodeIds: string[] = [];
  const repairedIssueTypes: string[] = [];
  
  if (opts.decisionRepairEnabled) {
    const decisionResult = runDecisionRepair(currentNodes, currentEdges, { enabled: true });
    
    if (decisionResult.hasChanges) {
      currentNodes = decisionResult.nodes;
      currentEdges = decisionResult.edges;
      hasChanges = true;
      
      repairsApplied.decisionRepairs = decisionResult.repairsApplied.map(repair => ({
        decisionNodeId: repair.decisionNodeId,
        issuesResolved: repair.issuesResolved,
        edgesAdded: repair.edgesAdded,
        labelsAssigned: repair.labelsAssigned,
        nodesCreated: repair.nodesCreated,
      }));
      
      for (const repair of decisionResult.repairsApplied) {
        repairedNodeIds.push(repair.decisionNodeId);
        for (const issueType of repair.issuesResolved) {
          const issueKey = `decision:${issueType}`;
          if (!repairedIssueTypes.includes(issueKey)) {
            repairedIssueTypes.push(issueKey);
          }
        }
      }
      
    }
  }
  
  const repairInfo: RepairInfo = {
    repairedNodeIds,
    repairedIssueTypes,
  };
  
  const mutationSafety: Partial<MutationSafety> = {
    decisionRepairApplied: hasChanges,
  };
  
  return {
    nodes: currentNodes,
    edges: currentEdges,
    repairsApplied,
    hasChanges,
    repairInfo,
    mutationSafety,
  };
}

export function isRepairNeeded(nodes: Node[], edges: Edge[]): boolean {
  const testResult = runDecisionRepair(nodes, edges, { enabled: true });
  return testResult.hasChanges;
}

export function getRepairedIssueTypes(
  repairsApplied: WorkflowRepairResult['repairsApplied']
): Set<string> {
  const types = new Set<string>();
  
  for (const repair of repairsApplied.decisionRepairs) {
    for (const issue of repair.issuesResolved) {
      types.add(`decision:${issue}`);
    }
  }
  
  return types;
}
