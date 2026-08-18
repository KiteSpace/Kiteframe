/**
 * DecisionRepair Unit Tests
 * 
 * Tests for the decision repair system that auto-repairs incomplete
 * decision nodes (missing branches, unlabeled edges, dangling outcomes).
 */

import { describe, it, expect } from 'vitest';
import {
  runDecisionRepair,
  detectIncompleteDecisions,
  NEEDS_LABEL_SENTINEL,
  isDecisionRepairNeeded,
  getRepairableIssues,
} from '../decisionRepair';

describe('DecisionRepair', () => {
  describe('runDecisionRepair', () => {
    it('should return unchanged graph when no repairs needed', () => {
      const nodes = [
        { id: 'start', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'condition', type: 'condition', position: { x: 100, y: 0 }, data: { label: 'Check Status' } },
        { id: 'yes', type: 'process', position: { x: 200, y: -50 }, data: { label: 'Process Yes' } },
        { id: 'no', type: 'process', position: { x: 200, y: 50 }, data: { label: 'Process No' } },
      ];
      const edges = [
        { id: 'e1', source: 'start', target: 'condition' },
        { id: 'e2', source: 'condition', target: 'yes', data: { label: 'Yes' } },
        { id: 'e3', source: 'condition', target: 'no', data: { label: 'No' } },
      ];

      const result = runDecisionRepair(nodes, edges);

      expect(result.hasChanges).toBe(false);
      expect(result.repairsApplied).toHaveLength(0);
    });

    it('should add missing "No" branch to binary decision nodes', () => {
      const nodes = [
        { id: 'start', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'condition', type: 'condition', position: { x: 100, y: 0 }, data: { label: 'Check Status' } },
        { id: 'yes', type: 'process', position: { x: 200, y: 0 }, data: { label: 'Process Yes' } },
      ];
      const edges = [
        { id: 'e1', source: 'start', target: 'condition' },
        { id: 'e2', source: 'condition', target: 'yes', data: { label: 'Yes' } },
      ];

      const result = runDecisionRepair(nodes, edges);

      expect(result.hasChanges).toBe(true);
      expect(result.repairsApplied.length).toBeGreaterThan(0);
      
      const conditionRepair = result.repairsApplied.find(r => r.decisionNodeId === 'condition');
      expect(conditionRepair).toBeDefined();
    });

    it('should be idempotent - running twice produces same result', () => {
      const nodes = [
        { id: 'condition', type: 'condition', position: { x: 100, y: 0 }, data: { label: 'Check' } },
        { id: 'yes', type: 'process', position: { x: 200, y: 0 }, data: { label: 'Yes' } },
      ];
      const edges = [
        { id: 'e1', source: 'condition', target: 'yes' },
      ];

      const result1 = runDecisionRepair(nodes, edges);
      const result2 = runDecisionRepair(result1.nodes, result1.edges);

      expect(result2.nodes.length).toBe(result1.nodes.length);
      expect(result2.edges.length).toBe(result1.edges.length);
    });
  });

  describe('detectIncompleteDecisions', () => {
    it('should detect decision node with single outgoing edge', () => {
      const nodes = [
        { id: 'condition', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'Check' } },
        { id: 'yes', type: 'process', position: { x: 100, y: 0 }, data: { label: 'Yes' } },
      ];
      const edges = [
        { id: 'e1', source: 'condition', target: 'yes' },
      ];

      const issues = detectIncompleteDecisions(nodes, edges);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.decisionNodeId === 'condition')).toBe(true);
    });

    it('should not flag decision node with 2+ branches', () => {
      const nodes = [
        { id: 'condition', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'Check' } },
        { id: 'yes', type: 'process', position: { x: 100, y: -50 }, data: { label: 'Yes' } },
        { id: 'no', type: 'process', position: { x: 100, y: 50 }, data: { label: 'No' } },
      ];
      const edges = [
        { id: 'e1', source: 'condition', target: 'yes', data: { label: 'Yes' } },
        { id: 'e2', source: 'condition', target: 'no', data: { label: 'No' } },
      ];

      const issues = detectIncompleteDecisions(nodes, edges);
      const missingOutcomeIssues = issues.filter(i => i.issueType === 'MISSING_OUTCOME');

      expect(missingOutcomeIssues).toHaveLength(0);
    });
  });

  describe('isDecisionRepairNeeded', () => {
    it('should return true when decision has missing branches', () => {
      const nodes = [
        { id: 'condition', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'Check' } },
        { id: 'yes', type: 'process', position: { x: 100, y: 0 }, data: { label: 'Yes' } },
      ];
      const edges = [
        { id: 'e1', source: 'condition', target: 'yes' },
      ];

      expect(isDecisionRepairNeeded(nodes, edges)).toBe(true);
    });

    it('should return false when no repairs needed', () => {
      const nodes = [
        { id: 'condition', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'Check' } },
        { id: 'yes', type: 'process', position: { x: 100, y: -50 }, data: { label: 'Yes' } },
        { id: 'no', type: 'process', position: { x: 100, y: 50 }, data: { label: 'No' } },
      ];
      const edges = [
        { id: 'e1', source: 'condition', target: 'yes', data: { label: 'Yes' } },
        { id: 'e2', source: 'condition', target: 'no', data: { label: 'No' } },
      ];

      expect(isDecisionRepairNeeded(nodes, edges)).toBe(false);
    });
  });

  describe('getRepairableIssues', () => {
    it('should return list of repairable issues', () => {
      const nodes = [
        { id: 'condition', type: 'condition', position: { x: 0, y: 0 }, data: { label: 'Check' } },
        { id: 'yes', type: 'process', position: { x: 100, y: 0 }, data: { label: 'Yes' } },
      ];
      const edges = [
        { id: 'e1', source: 'condition', target: 'yes' },
      ];

      const issues = getRepairableIssues(nodes, edges);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].decisionNodeId).toBe('condition');
    });
  });

  describe('NEEDS_LABEL_SENTINEL', () => {
    it('should be a non-empty string that is unlikely to appear in user labels', () => {
      expect(NEEDS_LABEL_SENTINEL).toBeDefined();
      expect(typeof NEEDS_LABEL_SENTINEL).toBe('string');
      expect(NEEDS_LABEL_SENTINEL.length).toBeGreaterThan(0);
      expect(NEEDS_LABEL_SENTINEL).toContain('{');
    });
  });
});
