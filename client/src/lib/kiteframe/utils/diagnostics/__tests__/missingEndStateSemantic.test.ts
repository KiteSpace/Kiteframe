import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { diagnosticsEngine } from '../DiagnosticsEngine';
import type { Node, Edge } from '../../../types';

function createNode(id: string, type: string, label: string): Node {
  return {
    id,
    type: type as any,
    position: { x: 0, y: 0 },
    data: { label },
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

describe('detectMissingEndState with Semantic Terminal Inference', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  describe('Feature flag OFF', () => {
    beforeEach(() => {
      process.env.VITE_ENABLE_SEMANTIC_TERMINAL_INFERENCE = 'false';
    });
    
    it('emits missing-end-state for workflow with only HIGH confidence semantic terminal', async () => {
      const { diagnosticsEngine } = await import('../DiagnosticsEngine');
      
      const nodes: Node[] = [
        createNode('1', 'input', 'Start'),
        createNode('2', 'process', 'Notify user of approval'),
      ];
      const edges: Edge[] = [
        createEdge('e1', '1', '2'),
      ];
      
      const issues = diagnosticsEngine.analyze({
        projectId: 'test-project',
        workflowId: 'test-workflow',
        nodes,
        edges,
      });
      
      const missingEndIssue = issues.find(i => i.type === 'missing-end-state');
      expect(missingEndIssue).toBeDefined();
      expect(missingEndIssue?.title).toBe('Missing end state');
    });
  });
  
  describe('Feature flag ON', () => {
    beforeEach(() => {
      process.env.VITE_ENABLE_SEMANTIC_TERMINAL_INFERENCE = 'true';
    });
    
    it('does NOT emit missing-end-state for workflow with HIGH confidence semantic terminal', async () => {
      const { diagnosticsEngine } = await import('../DiagnosticsEngine');
      
      const nodes: Node[] = [
        createNode('1', 'input', 'Start'),
        createNode('2', 'process', 'Notify user of approval'),
      ];
      const edges: Edge[] = [
        createEdge('e1', '1', '2'),
      ];
      
      const issues = diagnosticsEngine.analyze({
        projectId: 'test-project',
        workflowId: 'test-workflow',
        nodes,
        edges,
      });
      
      const missingEndIssue = issues.find(i => i.type === 'missing-end-state');
      expect(missingEndIssue).toBeUndefined();
      
      const semanticEndStateIssue = issues.find(i => i.type === 'semantic-end-state');
      expect(semanticEndStateIssue).toBeDefined();
      expect(semanticEndStateIssue?.severity).toBe('info');
      expect(semanticEndStateIssue?.description).toContain('approval');
    });
    
    it('emits missing-end-state for workflow with only MEDIUM confidence semantic terminal', async () => {
      const { diagnosticsEngine } = await import('../DiagnosticsEngine');
      
      const nodes: Node[] = [
        createNode('1', 'input', 'Start'),
        createNode('2', 'process', 'Send email to user'),
      ];
      const edges: Edge[] = [
        createEdge('e1', '1', '2'),
      ];
      
      const issues = diagnosticsEngine.analyze({
        projectId: 'test-project',
        workflowId: 'test-workflow',
        nodes,
        edges,
      });
      
      const missingEndIssue = issues.find(i => i.type === 'missing-end-state');
      expect(missingEndIssue).toBeDefined();
      expect(missingEndIssue?.title).toBe('Missing end state');
      
      const semanticEndStateIssue = issues.find(i => i.type === 'semantic-end-state');
      expect(semanticEndStateIssue).toBeUndefined();
    });
    
    it('does NOT emit missing-end-state for workflow with explicit output node', async () => {
      const { diagnosticsEngine } = await import('../DiagnosticsEngine');
      
      const nodes: Node[] = [
        createNode('1', 'input', 'Start'),
        createNode('2', 'process', 'Process data'),
        createNode('3', 'output', 'Complete'),
      ];
      const edges: Edge[] = [
        createEdge('e1', '1', '2'),
        createEdge('e2', '2', '3'),
      ];
      
      const issues = diagnosticsEngine.analyze({
        projectId: 'test-project',
        workflowId: 'test-workflow',
        nodes,
        edges,
      });
      
      const missingEndIssue = issues.find(i => i.type === 'missing-end-state');
      expect(missingEndIssue).toBeUndefined();
      
      const semanticEndStateIssue = issues.find(i => i.type === 'semantic-end-state');
      expect(semanticEndStateIssue).toBeUndefined();
    });
    
    it('handles workflow with multiple HIGH confidence semantic terminals', async () => {
      const { diagnosticsEngine } = await import('../DiagnosticsEngine');
      
      const nodes: Node[] = [
        createNode('1', 'input', 'Start'),
        createNode('2', 'condition', 'Check approval'),
        createNode('3', 'process', 'Notify user of approval'),
        createNode('4', 'process', 'Handle rejection'),
      ];
      const edges: Edge[] = [
        createEdge('e1', '1', '2'),
        createEdge('e2', '2', '3', 'Approved'),
        createEdge('e3', '2', '4', 'Rejected'),
      ];
      
      const issues = diagnosticsEngine.analyze({
        projectId: 'test-project',
        workflowId: 'test-workflow',
        nodes,
        edges,
      });
      
      const missingEndIssue = issues.find(i => i.type === 'missing-end-state');
      expect(missingEndIssue).toBeUndefined();
      
      const semanticEndStateIssue = issues.find(i => i.type === 'semantic-end-state');
      expect(semanticEndStateIssue).toBeDefined();
      expect(semanticEndStateIssue?.severity).toBe('info');
    });
    
    it('handles ambiguous workflow (no HIGH confidence terminals)', async () => {
      const { diagnosticsEngine } = await import('../DiagnosticsEngine');
      
      const nodes: Node[] = [
        createNode('1', 'input', 'Start'),
        createNode('2', 'process', 'Process data'),
        createNode('3', 'process', 'Review request'),
      ];
      const edges: Edge[] = [
        createEdge('e1', '1', '2'),
        createEdge('e2', '2', '3'),
      ];
      
      const issues = diagnosticsEngine.analyze({
        projectId: 'test-project',
        workflowId: 'test-workflow',
        nodes,
        edges,
      });
      
      const missingEndIssue = issues.find(i => i.type === 'missing-end-state');
      expect(missingEndIssue).toBeDefined();
      expect(missingEndIssue?.title).toBe('Missing end state');
    });
  });
});
