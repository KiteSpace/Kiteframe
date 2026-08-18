/**
 * Phase 6.7: Decision Repair Module
 * 
 * Exports repair utilities for incomplete decision nodes.
 */

export {
  detectIncompleteDecisions,
  ensureEdgeLabels,
  repairDecision,
  runDecisionRepair,
  isDecisionRepairNeeded,
  getRepairableIssues,
  type DecisionIssue,
  type DecisionIssueType,
  type DecisionRepairApplied,
  type DecisionRepairResult,
} from './decisionRepair';
