import { describe, it, expect } from 'vitest';
import { detectTerminalIntent, type TerminalIntentSignal } from '../detectTerminalIntent';
import type { Node, Edge } from '@/lib/kiteframe/types';

function createNode(id: string, type: string, label: string, description?: string): Node {
  return {
    id,
    type: type as any,
    position: { x: 0, y: 0 },
    data: { label, description },
  };
}

function createEdge(id: string, source: string, target: string, label?: string): Edge {
  return {
    id,
    source,
    target,
    data: label ? { label } : {},
  };
}

describe('detectTerminalIntent', () => {
  describe('HIGH confidence - completion keywords', () => {
    it('detects "Notify user of approval" as high confidence terminal', () => {
      const node = createNode('1', 'process', 'Notify user of approval');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.matchedRules).toContain('TERM_HIGH_KEYWORD');
      expect(result.reasons.some(r => r.includes('approval'))).toBe(true);
    });

    it('detects "Setup complete" as high confidence terminal', () => {
      const node = createNode('1', 'process', 'Setup complete');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.matchedRules).toContain('TERM_HIGH_KEYWORD');
    });

    it('detects "Dashboard created" as high confidence terminal', () => {
      const node = createNode('1', 'process', 'Dashboard created');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.matchedRules).toContain('TERM_HIGH_KEYWORD');
    });
  });

  describe('HIGH confidence - explicit end phrases', () => {
    it('detects "Flow ends here" in description as high confidence terminal', () => {
      const node = createNode('1', 'process', 'Final step', 'Flow ends here');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.matchedRules).toContain('TERM_HIGH_EXPLICIT_END');
    });

    it('detects "No further action" as high confidence terminal', () => {
      const node = createNode('1', 'process', 'No further action needed');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.matchedRules).toContain('TERM_HIGH_EXPLICIT_END');
    });
  });

  describe('HIGH confidence - decision outcome branch', () => {
    it('detects node from "Rejected" decision branch as high confidence terminal', () => {
      const conditionNode = createNode('cond', 'condition', 'Check approval');
      const processNode = createNode('1', 'process', 'Handle rejection');
      const nodesById = new Map([['cond', conditionNode], ['1', processNode]]);
      const incomingEdge = createEdge('e1', 'cond', '1', 'Rejected');
      
      const result = detectTerminalIntent({
        node: processNode,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.matchedRules).toContain('TERM_HIGH_DECISION_OUTCOME');
      expect(result.reasons.some(r => r.includes('rejected'))).toBe(true);
    });

    it('detects node from "Approved" decision branch as high confidence terminal', () => {
      const conditionNode = createNode('cond', 'condition', 'Check approval');
      const processNode = createNode('1', 'process', 'Complete order');
      const nodesById = new Map([['cond', conditionNode], ['1', processNode]]);
      const incomingEdge = createEdge('e1', 'cond', '1', 'Approved');
      
      const result = detectTerminalIntent({
        node: processNode,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.matchedRules).toContain('TERM_HIGH_DECISION_OUTCOME');
    });
  });

  describe('MEDIUM confidence - notification actions', () => {
    it('detects "Send email" as medium confidence terminal', () => {
      const node = createNode('1', 'process', 'Send email to user');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.matchedRules).toContain('TERM_MED_NOTIFY');
    });

    it('detects "Notify admin" as medium confidence terminal', () => {
      const node = createNode('1', 'process', 'Notify admin');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.matchedRules).toContain('TERM_MED_NOTIFY');
    });
  });

  describe('MEDIUM confidence - administrative actions', () => {
    it('detects "Archive request" as medium confidence terminal', () => {
      const node = createNode('1', 'process', 'Archive request');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.matchedRules).toContain('TERM_MED_ADMIN');
    });

    it('detects "Log activity" as medium confidence terminal', () => {
      const node = createNode('1', 'process', 'Log activity');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.matchedRules).toContain('TERM_MED_ADMIN');
    });
  });

  describe('LOW confidence - no terminal signals', () => {
    it('returns low confidence for ambiguous node like "Review request"', () => {
      const node = createNode('1', 'process', 'Review request');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.matchedRules).toHaveLength(0);
    });

    it('returns low confidence for generic process node', () => {
      const node = createNode('1', 'process', 'Process data');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(false);
      expect(result.confidence).toBe('low');
    });
  });

  describe('Non-candidate nodes', () => {
    it('returns low for non-leaf node (has outgoing edges)', () => {
      const node = createNode('1', 'process', 'Notify user of approval');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      const outgoingEdge = createEdge('e2', '1', '2');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [outgoingEdge],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(false);
      expect(result.confidence).toBe('low');
    });

    it('returns low for output node (handled elsewhere)', () => {
      const node = createNode('1', 'output', 'Final output');
      const nodesById = new Map([['1', node]]);
      const incomingEdge = createEdge('e1', '0', '1');
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [incomingEdge],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(false);
      expect(result.confidence).toBe('low');
    });

    it('returns low for node with no incoming edges', () => {
      const node = createNode('1', 'process', 'Setup complete');
      const nodesById = new Map([['1', node]]);
      
      const result = detectTerminalIntent({
        node,
        incomingEdges: [],
        outgoingEdges: [],
        nodesById,
      });
      
      expect(result.isLikelyTerminal).toBe(false);
      expect(result.confidence).toBe('low');
    });
  });
});
