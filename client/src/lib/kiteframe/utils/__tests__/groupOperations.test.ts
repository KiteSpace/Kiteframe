import { describe, expect, it } from 'vitest';
import type { CanvasObject, Node } from '../../types';
import {
  assignGroupId,
  clearSelectedGroups,
  createGroupIdRemap,
  duplicatePersistentGroup,
  expandSelectedItemIds,
  getLockedPersistentGroupIds,
  remapGroupIds,
  remapGroupIdsForPaste,
} from '../groupOperations';

const node = (id: string, groupId?: string): Node => ({
  id,
  type: 'process',
  position: { x: 0, y: 0 },
  data: { label: id },
  groupId,
});

const canvasObject = (id: string, groupId?: string): CanvasObject => ({
  id,
  type: 'shape',
  position: { x: 0, y: 0 },
  data: { shapeType: 'rectangle' } as CanvasObject['data'],
  groupId,
});

describe('persistent visual group operations', () => {
  const items = [
    node('node-a', 'group-1'),
    canvasObject('shape-a', 'group-1'),
    node('node-b', 'group-2'),
    canvasObject('shape-b'),
  ];

  it('expands a mixed selection to full group membership in canvas order', () => {
    expect(expandSelectedItemIds(items, ['shape-a', 'shape-b'])).toEqual([
      'node-a',
      'shape-a',
      'shape-b',
    ]);
  });

  it('assigns one group identity to a mixed explicit selection without mutating inputs', () => {
    const result = assignGroupId(items, ['node-a', 'shape-b'], 'group-new');

    expect(result.map(item => item.groupId)).toEqual([
      'group-new',
      'group-1',
      'group-2',
      'group-new',
    ]);
    expect(items[0]?.groupId).toBe('group-1');
    expect(result[1]).toBe(items[1]);
  });

  it('clears every group represented by the selection', () => {
    const result = clearSelectedGroups(items, ['shape-a']);

    expect(result.map(item => item.groupId)).toEqual([
      undefined,
      undefined,
      'group-2',
      undefined,
    ]);
    expect(items[0]?.groupId).toBe('group-1');
  });

  it('remaps every copied group once while retaining copied group membership', () => {
    const remap = createGroupIdRemap(items, sourceGroupId => `copy:${sourceGroupId}`);
    const remapped = remapGroupIds(items, remap);
    const pasted = remapGroupIdsForPaste(items, sourceGroupId => `paste:${sourceGroupId}`);

    expect(Object.fromEntries(remap)).toEqual({
      'group-1': 'copy:group-1',
      'group-2': 'copy:group-2',
    });
    expect(remapped.map(item => item.groupId)).toEqual([
      'copy:group-1',
      'copy:group-1',
      'copy:group-2',
      undefined,
    ]);
    expect(pasted.items.map(item => item.groupId)).toEqual([
      'paste:group-1',
      'paste:group-1',
      'paste:group-2',
      undefined,
    ]);
  });

  it('duplicates a complete mixed group with independent IDs and internal edges', () => {
    const duplicated = duplicatePersistentGroup(
      [
        { ...node('a', 'g1'), position: { x: 10, y: 20 } },
        { ...node('b', 'g1'), position: { x: 50, y: 60 } },
        node('outside'),
      ],
      [
        {
          ...canvasObject('note', 'g1'),
          position: { x: 90, y: 100 },
        },
      ],
      [
        { id: 'inside-edge', source: 'a', target: 'b' },
        { id: 'outside-edge', source: 'a', target: 'outside' },
      ],
      'g1',
      {
        nodeId: id => `${id}-copy`,
        canvasObjectId: id => `${id}-copy`,
        edgeId: id => `${id}-copy`,
        groupId: () => 'g2',
      },
    );

    expect(duplicated.groupId).toBe('g2');
    expect(duplicated.nodes.map(item => [item.id, item.groupId, item.position])).toEqual([
      ['a-copy', 'g2', { x: 30, y: 40 }],
      ['b-copy', 'g2', { x: 70, y: 80 }],
    ]);
    expect(duplicated.canvasObjects[0]).toMatchObject({
      id: 'note-copy',
      groupId: 'g2',
      position: { x: 110, y: 120 },
    });
    expect(duplicated.edges).toEqual([
      expect.objectContaining({
        id: 'inside-edge-copy',
        source: 'a-copy',
        target: 'b-copy',
      }),
    ]);
  });

  it.each([
    ['node', 'node-a'],
    ['canvasObject', 'shape-a'],
  ] as const)('blocks a complete mixed group when its %s member is locked', (lockedKind, lockedId) => {
    const lockedGroups = getLockedPersistentGroupIds(
      [node('node-a', 'group-1')],
      [canvasObject('shape-a', 'group-1')],
      (kind, id) => kind === lockedKind && id === lockedId,
    );

    expect([...lockedGroups]).toEqual(['group-1']);
  });
});