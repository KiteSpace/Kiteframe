import { describe, expect, it } from 'vitest';
import { exportWorkflow, importWorkflow } from '../exportImport';
import type { CanvasObject } from '../../types';

describe('canvas object workflow organization export/import', () => {
  it('preserves persistent visual group identities independently of Layers associations', () => {
    const canvasObject: CanvasObject = {
      id: 'shape-1',
      type: 'shape',
      position: { x: 10, y: 20 },
      data: { shapeType: 'rectangle' } as CanvasObject['data'],
      groupId: 'visual-group:checkout',
      workflowGroupId: 'wf:start',
    };

    const exported = exportWorkflow({
      nodes: [{
        id: 'node-1',
        type: 'process',
        position: { x: 0, y: 0 },
        data: { label: 'Start' },
        groupId: 'visual-group:checkout',
      }],
      edges: [],
      canvasObjects: [canvasObject],
    });
    const imported = importWorkflow(JSON.stringify(exported));

    expect(exported.workflow.nodes[0]?.groupId).toBe('visual-group:checkout');
    expect(exported.workflow.canvasObjects?.[0]?.groupId).toBe('visual-group:checkout');
    expect(imported.success).toBe(true);
    expect(imported.data?.nodes[0]?.groupId).toBe('visual-group:checkout');
    expect(imported.data?.canvasObjects?.[0]?.groupId).toBe('visual-group:checkout');
    expect(imported.data?.canvasObjects?.[0]?.workflowGroupId).toBe('wf:start');
  });

  it('preserves the optional Layers workflow association', () => {
    const canvasObject: CanvasObject = {
      id: 'shape-1',
      type: 'shape',
      position: { x: 10, y: 20 },
      data: {
        shapeType: 'rectangle',
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 1,
        strokeStyle: 'solid',
      },
      workflowGroupId: 'wf:start',
    };

    const exported = exportWorkflow({
      nodes: [],
      edges: [],
      canvasObjects: [canvasObject],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    const imported = importWorkflow(exported);

    expect(exported.workflow.canvasObjects?.[0]?.workflowGroupId).toBe('wf:start');
    expect(imported.success).toBe(true);
    expect(imported.data?.canvasObjects?.[0]?.workflowGroupId).toBe('wf:start');
  });

  it('imports old canvas objects without an association as standalone-compatible', () => {
    const exported = exportWorkflow({
      nodes: [],
      edges: [],
      canvasObjects: [{
        id: 'legacy-text',
        type: 'text',
        position: { x: 0, y: 0 },
        data: { text: 'Legacy' },
      } as CanvasObject],
    });

    const imported = importWorkflow(exported);

    expect(imported.success).toBe(true);
    expect(imported.data?.canvasObjects?.[0]?.workflowGroupId).toBeUndefined();
  });
});