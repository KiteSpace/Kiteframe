/**
 * REPLACE Workflow Mode Tests
 * 
 * Tests for the REPLACE mode functionality that atomically replaces
 * the entire workflow without merge/repair logic.
 */

import { describe, it, expect } from 'vitest';
import { applyChatMutation } from '../../../hooks/useChatMutation';

const createNode = (id: string, type: string = 'process', label: string = `Node ${id}`) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label },
});

const createEdge = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
});

describe('REPLACE Workflow Mode', () => {
  describe('executeReplaceWorkflow', () => {
    it('should completely replace existing workflow with new nodes', () => {
      const existingNodes = [
        createNode('old-1', 'input', 'Old Start'),
        createNode('old-2', 'process', 'Old Process'),
        createNode('old-3', 'output', 'Old End'),
      ];
      const existingEdges = [
        createEdge('old-edge-1', 'old-1', 'old-2'),
        createEdge('old-edge-2', 'old-2', 'old-3'),
      ];
      const newNodes = [
        createNode('new-1', 'input', 'New Start'),
        createNode('new-2', 'process', 'New Process'),
        createNode('new-3', 'condition', 'New Decision'),
        createNode('new-4', 'output', 'New End'),
      ];
      const newEdges = [
        createEdge('new-edge-1', 'new-1', 'new-2'),
        createEdge('new-edge-2', 'new-2', 'new-3'),
        createEdge('new-edge-3', 'new-3', 'new-4'),
      ];

      const result = applyChatMutation({
        existingNodes,
        existingEdges,
        newNodes,
        newEdges,
        userMessage: 'Replace workflow',
        mode: 'REPLACE',
      });

      expect(result.success).toBe(true);
      expect(result.mutatedNodes.length).toBe(4);
      expect(result.mutatedEdges.length).toBe(3);
      expect(result.mutatedNodes.every((n: any) => n.id.startsWith('new-'))).toBe(true);
    });

    it('should bypass merge logic in REPLACE mode', () => {
      const existingNodes = [
        createNode('decision-1', 'condition', 'Decision'),
        createNode('branch-a', 'process', 'Branch A'),
        createNode('branch-b', 'process', 'Branch B'),
      ];
      const existingEdges = [
        createEdge('edge-1', 'decision-1', 'branch-a'),
        createEdge('edge-2', 'decision-1', 'branch-b'),
      ];
      const newNodes = [
        createNode('simple-1', 'input', 'Simple Start'),
        createNode('simple-2', 'output', 'Simple End'),
      ];
      const newEdges = [
        createEdge('simple-edge', 'simple-1', 'simple-2'),
      ];

      const result = applyChatMutation({
        existingNodes,
        existingEdges,
        newNodes,
        newEdges,
        userMessage: 'Simplify workflow',
        mode: 'REPLACE',
      });

      expect(result.success).toBe(true);
      expect(result.mutatedNodes.length).toBe(2);
      expect(result.safetyReport.mergeEnforced).toBe(false);
    });

    it('should bypass decision repair in REPLACE mode', () => {
      const existingNodes = [createNode('existing', 'process', 'Existing')];
      const existingEdges: any[] = [];
      const newNodes = [
        createNode('decision', 'condition', 'Decision without branches'),
      ];
      const newEdges: any[] = [];

      const result = applyChatMutation({
        existingNodes,
        existingEdges,
        newNodes,
        newEdges,
        userMessage: 'Create decision node',
        mode: 'REPLACE',
      });

      expect(result.success).toBe(true);
      expect(result.repairInfo.repairedNodeIds.length).toBe(0);
    });

    it('should return empty arrays when replacing with empty workflow', () => {
      const existingNodes = [
        createNode('old-1', 'input', 'Old'),
      ];
      const existingEdges: any[] = [];
      const newNodes: any[] = [];
      const newEdges: any[] = [];

      const result = applyChatMutation({
        existingNodes,
        existingEdges,
        newNodes,
        newEdges,
        userMessage: 'Clear workflow',
        mode: 'REPLACE',
      });

      expect(result.success).toBe(true);
      expect(result.mutatedNodes.length).toBe(0);
      expect(result.mutatedEdges.length).toBe(0);
    });
  });

  describe('REPLACE mode safety', () => {
    it('should not trigger orphan prevention in REPLACE mode', () => {
      const existingNodes = [createNode('existing', 'process', 'Existing')];
      const existingEdges: any[] = [];
      const newNodes = [
        createNode('orphan-1', 'process', 'Orphan 1'),
        createNode('orphan-2', 'process', 'Orphan 2'),
      ];
      const newEdges: any[] = [];

      const result = applyChatMutation({
        existingNodes,
        existingEdges,
        newNodes,
        newEdges,
        userMessage: 'Add orphan nodes',
        mode: 'REPLACE',
      });

      expect(result.success).toBe(true);
      expect(result.safetyReport.orphanPreventionTriggered).toBe(false);
    });
  });
});
