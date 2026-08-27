import type { CanvasObject, Edge, Node } from '../types';

/**
 * A canvas item that can participate in a persistent visual group.
 *
 * `groupId` is deliberately separate from `workflowGroupId`, which only
 * organizes items in the Layers panel.
 */
export interface GroupableItem {
  id: string;
  groupId?: string;
}

type GroupIdMap = ReadonlyMap<string, string>;

function collectSelectedGroupIds<T extends GroupableItem>(
  items: readonly T[],
  selectedItemIds: ReadonlySet<string>,
): Set<string> {
  const groupIds = new Set<string>();

  for (const item of items) {
    if (selectedItemIds.has(item.id) && item.groupId !== undefined) {
      groupIds.add(item.groupId);
    }
  }

  return groupIds;
}

/**
 * Includes every item in a selected item's visual group. Returned IDs retain
 * canvas order and only include IDs that exist in `items`.
 */
export function expandSelectedItemIds<T extends GroupableItem>(
  items: readonly T[],
  selectedItemIds: Iterable<string>,
): string[] {
  const selectedIds = new Set(selectedItemIds);
  const selectedGroupIds = collectSelectedGroupIds(items, selectedIds);

  return items
    .filter(item => selectedIds.has(item.id) || (
      item.groupId !== undefined && selectedGroupIds.has(item.groupId)
    ))
    .map(item => item.id);
}

/** Assigns one persistent group identity to the explicitly selected items. */
export function assignGroupId<T extends GroupableItem>(
  items: readonly T[],
  selectedItemIds: Iterable<string>,
  groupId: string,
): T[] {
  const selectedIds = new Set(selectedItemIds);

  return items.map(item => (
    selectedIds.has(item.id) ? { ...item, groupId } : item
  ));
}

/**
 * Removes every group represented in the selection. Selecting one member is
 * sufficient to ungroup all of that group's members.
 */
export function clearSelectedGroups<T extends GroupableItem>(
  items: readonly T[],
  selectedItemIds: Iterable<string>,
): T[] {
  const selectedGroupIds = collectSelectedGroupIds(items, new Set(selectedItemIds));

  return items.map(item => {
    if (item.groupId === undefined || !selectedGroupIds.has(item.groupId)) {
      return item;
    }

    return { ...item, groupId: undefined };
  });
}

/**
 * Builds a mapping that gives each group represented in a pasted selection a
 * fresh identity while preserving relationships between its pasted members.
 */
export function createGroupIdRemap<T extends GroupableItem>(
  items: readonly T[],
  createGroupId: (sourceGroupId: string) => string,
): Map<string, string> {
  const remap = new Map<string, string>();

  for (const item of items) {
    if (item.groupId !== undefined && !remap.has(item.groupId)) {
      remap.set(item.groupId, createGroupId(item.groupId));
    }
  }

  return remap;
}

/** Applies an existing group-ID remapping without mutating input items. */
export function remapGroupIds<T extends GroupableItem>(
  items: readonly T[],
  groupIdMap: GroupIdMap,
): T[] {
  return items.map(item => {
    if (item.groupId === undefined) {
      return item;
    }

    const remappedGroupId = groupIdMap.get(item.groupId);
    return remappedGroupId === undefined ? item : { ...item, groupId: remappedGroupId };
  });
}

/**
 * Convenience operation for paste/clone flows. It produces both the cloned
 * group identities and the mapping used to produce them.
 */
export function remapGroupIdsForPaste<T extends GroupableItem>(
  items: readonly T[],
  createGroupId: (sourceGroupId: string) => string,
): { items: T[]; groupIdMap: Map<string, string> } {
  const groupIdMap = createGroupIdRemap(items, createGroupId);
  return { items: remapGroupIds(items, groupIdMap), groupIdMap };
}

export interface DuplicateGroupIdFactories {
  nodeId: (sourceId: string) => string;
  canvasObjectId: (sourceId: string) => string;
  edgeId: (sourceId: string) => string;
  groupId: (sourceGroupId: string) => string;
}

/** Clones one complete persistent mixed group as an independent group. */
export function duplicatePersistentGroup(
  nodes: readonly Node[],
  canvasObjects: readonly CanvasObject[],
  edges: readonly Edge[],
  sourceGroupId: string,
  createId: DuplicateGroupIdFactories,
  offset = { x: 20, y: 20 },
): { nodes: Node[]; canvasObjects: CanvasObject[]; edges: Edge[]; groupId: string } {
  const sourceNodes = nodes.filter(node => node.groupId === sourceGroupId);
  const sourceObjects = canvasObjects.filter(object => object.groupId === sourceGroupId);
  const groupId = createId.groupId(sourceGroupId);
  const nodeIdMap = new Map<string, string>();

  const duplicatedNodes = sourceNodes.map(node => {
    const id = createId.nodeId(node.id);
    nodeIdMap.set(node.id, id);
    return {
      ...node,
      id,
      groupId,
      selected: false,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
    };
  });
  const duplicatedObjects = sourceObjects.map(object => ({
    ...object,
    id: createId.canvasObjectId(object.id),
    groupId,
    selected: false,
    position: {
      x: object.position.x + offset.x,
      y: object.position.y + offset.y,
    },
  }));
  const duplicatedEdges = edges
    .filter(edge => nodeIdMap.has(edge.source) && nodeIdMap.has(edge.target))
    .map(edge => ({
      ...edge,
      id: createId.edgeId(edge.id),
      source: nodeIdMap.get(edge.source)!,
      target: nodeIdMap.get(edge.target)!,
      selected: false,
    }));

  return {
    nodes: duplicatedNodes,
    canvasObjects: duplicatedObjects,
    edges: duplicatedEdges,
    groupId,
  };
}

/** Returns group IDs that must be treated atomically because any member is locked. */
export function getLockedPersistentGroupIds(
  nodes: readonly Node[],
  canvasObjects: readonly CanvasObject[],
  isLocked: (kind: 'node' | 'canvasObject', id: string) => boolean,
): Set<string> {
  const lockedGroupIds = new Set<string>();
  nodes.forEach(node => {
    if (node.groupId && isLocked('node', node.id)) lockedGroupIds.add(node.groupId);
  });
  canvasObjects.forEach(object => {
    if (object.groupId && isLocked('canvasObject', object.id)) {
      lockedGroupIds.add(object.groupId);
    }
  });
  return lockedGroupIds;
}