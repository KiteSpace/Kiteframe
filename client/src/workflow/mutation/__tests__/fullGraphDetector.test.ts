/**
 * FullGraphDetector Unit Tests
 * 
 * Tests for the full graph detection heuristics used to identify
 * when AI generates a complete replacement workflow vs incremental edits.
 */

import { describe, it, expect } from 'vitest';
import { detectFullGraphPayload, requiresReplaceConfirmation, shouldBlockMerge } from '../fullGraphDetector';

describe('FullGraphDetector', () => {
  describe('detectFullGraphPayload', () => {
    it('should detect full graph when node count exceeds threshold (>=8)', () => {
      const incomingNodes = Array.from({ length: 10 }, (_, i) => ({
        id: `node-${i}`,
        type: 'process',
        position: { x: i * 100, y: 0 },
        data: { label: `Node ${i}` },
      }));
      const incomingEdges = incomingNodes.slice(0, -1).map((_, i) => ({
        id: `edge-${i}`,
        source: `node-${i}`,
        target: `node-${i + 1}`,
      }));
      const existingNodes = [
        { id: 'existing-1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Start' } },
      ];
      const existingEdges: any[] = [];

      const result = detectFullGraphPayload(existingNodes, existingEdges, incomingNodes, incomingEdges);

      expect(result.isFullGraph).toBe(true);
      expect(result.matchedHeuristics).toContain('H1_NODE_COUNT_THRESHOLD');
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it('should detect full graph when multiple heuristics match', () => {
      const existingNodes = Array.from({ length: 3 }, (_, i) => ({
        id: `existing-${i}`,
        type: 'process',
        position: { x: i * 100, y: 0 },
        data: { label: `Existing ${i}` },
      }));
      const existingEdges: any[] = [];
      const incomingNodes = Array.from({ length: 8 }, (_, i) => ({
        id: `new-${i}`,
        type: 'process',
        position: { x: i * 100, y: 100 },
        data: { label: `New ${i}` },
      }));
      const incomingEdges: any[] = [];

      const result = detectFullGraphPayload(existingNodes, existingEdges, incomingNodes, incomingEdges);

      expect(result.isFullGraph).toBe(true);
      expect(result.matchedHeuristics.length).toBeGreaterThanOrEqual(1);
    });

    it('should NOT detect full graph for small additions', () => {
      const existingNodes = Array.from({ length: 10 }, (_, i) => ({
        id: `existing-${i}`,
        type: 'process',
        position: { x: i * 100, y: 0 },
        data: { label: `Existing ${i}` },
      }));
      const existingEdges: any[] = [];
      const incomingNodes = [
        { id: 'new-1', type: 'process', position: { x: 0, y: 100 }, data: { label: 'New' } },
      ];
      const incomingEdges: any[] = [];

      const result = detectFullGraphPayload(existingNodes, existingEdges, incomingNodes, incomingEdges);

      expect(result.isFullGraph).toBe(false);
    });

    it('should detect duplicates when new nodes have same labels as existing', () => {
      const existingNodes = [
        { id: 'node-1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'node-2', type: 'process', position: { x: 100, y: 0 }, data: { label: 'Process Data' } },
        { id: 'node-3', type: 'output', position: { x: 200, y: 0 }, data: { label: 'End' } },
      ];
      const existingEdges: any[] = [];
      const incomingNodes = [
        { id: '0', type: 'input', position: { x: 0, y: 100 }, data: { label: 'Start' } },
        { id: '1', type: 'process', position: { x: 100, y: 100 }, data: { label: 'Process Data' } },
        { id: '2', type: 'output', position: { x: 200, y: 100 }, data: { label: 'End' } },
      ];
      const incomingEdges: any[] = [];

      const result = detectFullGraphPayload(existingNodes, existingEdges, incomingNodes, incomingEdges);

      expect(result.matchedHeuristics).toContain('H2_DUPLICATE_CANONICAL_LABELS');
    });

    it('should detect full graph on empty canvas when node count is significant', () => {
      const incomingNodes = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        type: 'process',
        position: { x: i * 100, y: 0 },
        data: { label: `Node ${i}` },
      }));
      const incomingEdges = incomingNodes.slice(0, -1).map((_, i) => ({
        id: `edge-${i}`,
        source: `${i}`,
        target: `${i + 1}`,
      }));

      const result = detectFullGraphPayload([], [], incomingNodes, incomingEdges);

      expect(result.isFullGraph).toBe(true);
    });
  });

  describe('requiresReplaceConfirmation', () => {
    it('should require confirmation when full graph detected with existing nodes', () => {
      const result = {
        isFullGraph: true,
        confidence: 0.7,
        matchedHeuristics: ['H1_NODE_COUNT_THRESHOLD'],
        suggestedIntent: 'REPLACE' as const,
        stats: { existingNodeCount: 5, incomingNodeCount: 10 },
      };

      expect(requiresReplaceConfirmation(result)).toBe(true);
    });

    it('should require confirmation even when canvas is empty if full graph', () => {
      const result = {
        isFullGraph: true,
        confidence: 0.7,
        matchedHeuristics: ['H1_NODE_COUNT_THRESHOLD'],
        suggestedIntent: 'PATCH' as const,
        stats: { existingNodeCount: 0, incomingNodeCount: 10 },
      };

      expect(requiresReplaceConfirmation(result)).toBe(true);
    });

    it('should NOT require confirmation when not a full graph', () => {
      const result = {
        isFullGraph: false,
        confidence: 0.2,
        matchedHeuristics: [],
        suggestedIntent: 'PATCH' as const,
        stats: { existingNodeCount: 5, incomingNodeCount: 2 },
      };

      expect(requiresReplaceConfirmation(result)).toBe(false);
    });
  });

  describe('shouldBlockMerge', () => {
    it('should block merge for high confidence full graph replacements', () => {
      const result = {
        isFullGraph: true,
        confidence: 0.8,
        matchedHeuristics: ['H1_NODE_COUNT_THRESHOLD', 'H2_DUPLICATE_CANONICAL_LABELS'],
        suggestedIntent: 'REPLACE' as const,
        stats: { existingNodeCount: 5, incomingNodeCount: 10 },
      };

      expect(shouldBlockMerge(result)).toBe(true);
    });

    it('should NOT block merge for incremental changes', () => {
      const result = {
        isFullGraph: false,
        confidence: 0.1,
        matchedHeuristics: [],
        suggestedIntent: 'PATCH' as const,
        stats: { existingNodeCount: 5, incomingNodeCount: 1 },
      };

      expect(shouldBlockMerge(result)).toBe(false);
    });
  });
});
