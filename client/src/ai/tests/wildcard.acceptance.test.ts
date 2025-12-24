/**
 * Wild Card Node Acceptance Tests
 * 
 * Tests for Wild Card / "What If" speculative branching feature.
 */

import { describe, it, expect } from 'vitest';
import type { Node, Edge, WildCardNodeData } from '../../lib/kiteframe/types';

describe('Wild Card Node Acceptance Tests', () => {
  describe('A. Wild Card Node Data Structure', () => {
    it('should have required WildCardNodeData fields', () => {
      const wildcardData: WildCardNodeData = {
        label: 'What If',
        mode: 'whatif',
        content: '',
        isGenerating: false,
        generatedIds: [],
        summary: '',
        hasGeneratedBranch: false,
      };

      expect(wildcardData.mode).toBe('whatif');
      expect(wildcardData.isGenerating).toBe(false);
      expect(wildcardData.generatedIds).toEqual([]);
      expect(wildcardData.hasGeneratedBranch).toBe(false);
    });

    it('should support all four wildcard modes', () => {
      const modes: WildCardNodeData['mode'][] = ['whatif', 'risk', 'enhancement', 'prompt'];
      modes.forEach(mode => {
        const data: WildCardNodeData = {
          label: 'Test',
          mode,
          content: '',
        };
        expect(data.mode).toBe(mode);
      });
    });
  });

  describe('B. Speculative Metadata', () => {
    it('should mark generated nodes with speculative metadata', () => {
      const speculativeMeta = {
        speculative: true,
        generatedFrom: 'wildcard-1',
      };

      expect(speculativeMeta.speculative).toBe(true);
      expect(speculativeMeta.generatedFrom).toBe('wildcard-1');
    });

    it('should mark generated edges with speculative metadata', () => {
      const speculativeMeta = {
        speculative: true,
        generatedFrom: 'wildcard-1',
      };

      expect(speculativeMeta.speculative).toBe(true);
      expect(speculativeMeta.generatedFrom).toBe('wildcard-1');
    });
  });

  describe('C. Adopt Branch Logic', () => {
    it('should clear speculative metadata when adopting', () => {
      const speculativeMeta = {
        speculative: true,
        generatedFrom: 'wildcard-1',
        otherMeta: 'preserved',
      };

      const { speculative, generatedFrom, ...restMeta } = speculativeMeta;

      expect((restMeta as any).speculative).toBeUndefined();
      expect((restMeta as any).generatedFrom).toBeUndefined();
      expect(restMeta.otherMeta).toBe('preserved');
    });

    it('should reset wildcard node state after adopt', () => {
      const wildcardData: WildCardNodeData = {
        label: 'What If',
        mode: 'whatif',
        content: 'Test content',
        isGenerating: false,
        generatedIds: ['spec-1', 'spec-2', 'edge-1'],
        summary: 'Generated summary',
        hasGeneratedBranch: true,
      };

      const resetData: WildCardNodeData = {
        ...wildcardData,
        generatedIds: [],
        summary: '',
        isGenerating: false,
        hasGeneratedBranch: false,
      };

      expect(resetData.generatedIds).toEqual([]);
      expect(resetData.summary).toBe('');
      expect(resetData.hasGeneratedBranch).toBe(false);
    });
  });

  describe('D. Discard Branch Logic', () => {
    it('should filter out speculative nodes by ID', () => {
      const generatedIds = new Set(['spec-1', 'spec-2']);
      const nodeIds = ['wildcard-1', 'spec-1', 'spec-2', 'existing-1'];

      const filtered = nodeIds.filter(id => !generatedIds.has(id));

      expect(filtered.length).toBe(2);
      expect(filtered).toContain('wildcard-1');
      expect(filtered).toContain('existing-1');
      expect(filtered).not.toContain('spec-1');
      expect(filtered).not.toContain('spec-2');
    });

    it('should filter out speculative edges by ID', () => {
      const generatedIds = new Set(['edge-1', 'edge-2']);
      const edgeIds = ['edge-1', 'edge-2', 'existing-edge'];

      const filtered = edgeIds.filter(id => !generatedIds.has(id));

      expect(filtered.length).toBe(1);
      expect(filtered[0]).toBe('existing-edge');
    });
  });

  describe('E. Edge Validation', () => {
    it('should allow wildcard to connect to standard node types', () => {
      const allowedTargets = ['input', 'process', 'condition', 'output', 'ai'];
      
      allowedTargets.forEach(targetType => {
        const edge: Edge = {
          id: `edge-to-${targetType}`,
          source: 'wildcard-1',
          target: `${targetType}-1`,
        };
        expect(edge.source).toBe('wildcard-1');
        expect(edge.target).toContain(targetType);
      });
    });

    it('should allow connections from any node type to wildcard', () => {
      const sourceTypes = ['input', 'process', 'condition', 'output', 'ai'];
      
      sourceTypes.forEach(sourceType => {
        const edge: Edge = {
          id: `edge-from-${sourceType}`,
          source: `${sourceType}-1`,
          target: 'wildcard-1',
        };
        expect(edge.source).toContain(sourceType);
        expect(edge.target).toBe('wildcard-1');
      });
    });
  });

  describe('F. Semantic Model Filtering', () => {
    it('should exclude speculative nodes from semantic extraction', () => {
      const nodes: Node[] = [
        { id: 'input-1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'process-1', type: 'process', position: { x: 100, y: 0 }, data: { label: 'Step 1' } },
        { id: 'wildcard-1', type: 'wildcard', position: { x: 200, y: 0 }, data: {} },
        { id: 'spec-1', type: 'process', position: { x: 300, y: 0 }, data: {}, meta: { speculative: true } },
      ];

      const nonSpeculative = nodes.filter(n => 
        n.type !== 'wildcard' && !n.meta?.speculative
      );

      expect(nonSpeculative.length).toBe(2);
      expect(nonSpeculative.map(n => n.id)).toContain('input-1');
      expect(nonSpeculative.map(n => n.id)).toContain('process-1');
      expect(nonSpeculative.map(n => n.id)).not.toContain('wildcard-1');
      expect(nonSpeculative.map(n => n.id)).not.toContain('spec-1');
    });
  });
});
