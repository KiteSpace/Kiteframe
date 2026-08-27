import { describe, expect, it } from 'vitest';
import { buildMultiViewTrees } from '../multiViewBuilder';
import type { CanvasObject } from '@/lib/kiteframe/types';

const nodes = [
  { id: 'start', type: 'input', data: { label: 'Start' } },
  { id: 'finish', type: 'output', data: { label: 'Finish' } },
];

const edges = [{ id: 'edge-1', source: 'start', target: 'finish' }];

const workerResult = {
  nodeToWorkflow: { start: 'start', finish: 'start' },
  level: { start: 0, finish: 1 },
  cycles: [],
  rows: [[0, ['start', 'finish']]] as [number, string[]][],
};

function object(
  id: string,
  type: CanvasObject['type'],
  data: CanvasObject['data'],
  workflowGroupId?: string,
): CanvasObject {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data,
    workflowGroupId,
  };
}

describe('buildMultiViewTrees canvas objects', () => {
  it('shows every supported object with useful labels and persisted grouping', () => {
    const canvasObjects = [
      object('text-1', 'text', { label: '', text: 'Project heading' } as any),
      object('shape-1', 'shape', { shapeType: 'circle', text: '' } as any, 'wf:start'),
      object('sticky-1', 'sticky', { text: 'Remember this' } as any, 'wf:start'),
      object('field-1', 'text-field', {
        blocks: [{ type: 'paragraph', runs: [{ text: 'Customer details' }] }],
      } as any),
    ];

    const tree = buildMultiViewTrees(nodes, edges, [], workerResult, [], canvasObjects);

    expect(tree.groups['wf:start'].childIds).toEqual([
      'start',
      'finish',
      'object:shape-1',
      'object:sticky-1',
    ]);
    expect(tree.groups.standalone.childIds).toEqual([
      'object:text-1',
      'object:field-1',
    ]);
    expect(tree.leaves['object:text-1']).toMatchObject({
      role: 'canvasObject',
      label: 'Project heading',
      canvasObjectId: 'text-1',
      canvasObjectType: 'text',
      parentId: 'standalone',
    });
    expect(tree.leaves['object:shape-1'].label).toBe('Circle');
    expect(tree.leaves['object:sticky-1'].label).toBe('Remember this');
    expect(tree.leaves['object:field-1'].label).toBe('Customer details');
  });

  it('defaults old or orphaned associations to standalone and keeps it as a drop target', () => {
    const canvasObjects = [
      object('legacy', 'text', { text: '' } as any),
      object('orphan', 'shape', { shapeType: 'rectangle' } as any, 'wf:missing'),
      object('grouped', 'sticky', { text: 'Grouped' } as any, 'wf:start'),
    ];

    const tree = buildMultiViewTrees(nodes, edges, [], workerResult, [], canvasObjects);

    expect(tree.groups.standalone).toBeDefined();
    expect(tree.groups.standalone.childIds).toEqual([
      'object:legacy',
      'object:orphan',
    ]);
    expect(tree.leaves['object:legacy'].label).toBe('Text');
    expect(tree.leaves['object:orphan'].parentId).toBe('standalone');
    expect(tree.leaves['object:grouped'].parentId).toBe('wf:start');
  });

  it('keeps an empty standalone group available when every object is grouped', () => {
    const tree = buildMultiViewTrees(
      nodes,
      edges,
      [],
      workerResult,
      [],
      [object('grouped', 'sticky', { text: 'Grouped' } as any, 'wf:start')],
    );

    expect(tree.groups.standalone.childIds).toEqual([]);
  });
});