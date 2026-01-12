/**
 * Branch Guard Unit Tests
 * 
 * Tests for the branch guard that prevents overwriting existing branching nodes
 * during merge operations, while still allowing legitimate branch expansions.
 */

import { describe, it, expect } from 'vitest';
import { applyChatWorkflowMutation } from '../applyChatWorkflowMutation';
import type { ExistingGraph, ChatMutationIntent } from '../types';

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

describe('Branch Guard', () => {
  describe('detectBranchingNodeOverwrite', () => {
    it('should ALLOW adding new edges from a branching node (legitimate expansion)', () => {
      const existingGraph: ExistingGraph = {
        nodes: [
          createNode('decision-1', 'condition', 'Decision'),
          createNode('branch-a', 'process', 'Branch A'),
          createNode('branch-b', 'process', 'Branch B'),
        ],
        edges: [
          createEdge('edge-1', 'decision-1', 'branch-a'),
          createEdge('edge-2', 'decision-1', 'branch-b'),
        ],
      };

      const intent: ChatMutationIntent = {
        newNodes: [createNode('branch-c', 'process', 'Branch C')],
        newEdges: [createEdge('edge-3', 'decision-1', 'branch-c')],
        isFollowUp: true,
      };

      const result = applyChatWorkflowMutation(existingGraph, intent, { intent: 'merge' });

      expect(result.success).toBe(true);
      expect(result.mutatedNodes.length).toBe(4);
      expect(result.mutatedEdges.length).toBe(3);
    });

    it('should BLOCK node ID collision with existing branching node', () => {
      const existingGraph: ExistingGraph = {
        nodes: [
          createNode('decision-1', 'condition', 'Original Decision'),
          createNode('branch-a', 'process', 'Branch A'),
          createNode('branch-b', 'process', 'Branch B'),
        ],
        edges: [
          createEdge('edge-1', 'decision-1', 'branch-a'),
          createEdge('edge-2', 'decision-1', 'branch-b'),
        ],
      };

      const intent: ChatMutationIntent = {
        newNodes: [createNode('decision-1', 'condition', 'Replacement Decision')],
        newEdges: [],
        isFollowUp: true,
      };

      const result = applyChatWorkflowMutation(existingGraph, intent, { intent: 'merge' });

      expect(result.success).toBe(false);
      expect(result.safetyReport.validationErrors).toContainEqual(
        expect.objectContaining({ code: 'BRANCHING_NODE_OVERWRITE' })
      );
    });

    it('should ALLOW mutations on non-branching nodes', () => {
      const existingGraph: ExistingGraph = {
        nodes: [
          createNode('input-1', 'input', 'Start'),
          createNode('process-1', 'process', 'Single Path'),
        ],
        edges: [
          createEdge('edge-1', 'input-1', 'process-1'),
        ],
      };

      const intent: ChatMutationIntent = {
        newNodes: [createNode('output-1', 'output', 'End')],
        newEdges: [createEdge('edge-2', 'process-1', 'output-1')],
        isFollowUp: true,
      };

      const result = applyChatWorkflowMutation(existingGraph, intent, { intent: 'merge' });

      expect(result.success).toBe(true);
    });

    it('should NOT trigger on empty canvas (no existing branching nodes)', () => {
      const existingGraph: ExistingGraph = {
        nodes: [],
        edges: [],
      };

      const intent: ChatMutationIntent = {
        newNodes: [
          createNode('decision-1', 'condition', 'Decision'),
          createNode('branch-a', 'process', 'Branch A'),
          createNode('branch-b', 'process', 'Branch B'),
        ],
        newEdges: [
          createEdge('edge-1', 'decision-1', 'branch-a'),
          createEdge('edge-2', 'decision-1', 'branch-b'),
        ],
        isFollowUp: false,
      };

      const result = applyChatWorkflowMutation(existingGraph, intent);

      expect(result.success).toBe(true);
    });

    it('should ALLOW extending linear workflows without triggering guard', () => {
      const existingGraph: ExistingGraph = {
        nodes: [
          createNode('node-1', 'input', 'Start'),
          createNode('node-2', 'process', 'Step 1'),
          createNode('node-3', 'process', 'Step 2'),
        ],
        edges: [
          createEdge('edge-1', 'node-1', 'node-2'),
          createEdge('edge-2', 'node-2', 'node-3'),
        ],
      };

      const intent: ChatMutationIntent = {
        newNodes: [createNode('node-4', 'output', 'End')],
        newEdges: [createEdge('edge-3', 'node-3', 'node-4')],
        isFollowUp: true,
      };

      const result = applyChatWorkflowMutation(existingGraph, intent, { intent: 'merge' });

      expect(result.success).toBe(true);
      expect(result.mutatedNodes.length).toBe(4);
    });
  });
});
