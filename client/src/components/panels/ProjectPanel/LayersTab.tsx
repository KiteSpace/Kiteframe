import { useEffect, useMemo, useState, useReducer, useRef } from 'react';
import { VirtualTree } from '@/components/layers/VirtualTree';
import { computeTri, cascade, isEffectivelyOn, Tri } from '@/components/layers/triStateUtils';
import { GroupRow, LeafRow } from '@/components/layers/TreeRow';
import { buildMultiViewTrees } from '@/components/layers/multiViewBuilder';
import { AncestorsStore } from '@/components/layers/ancestorsStore';
import { focusBus } from '@/stores/focusBus';
import { nodeToWorkflowStore } from '@/stores/nodeToWorkflowStore';
import { 
  VLStore, 
  collapseStore, 
  useProjectWorkflowNames, 
  generateDefaultWorkflowNames 
} from '@/stores/layersStateManager';
import { useWorkflowMetadata, type WorkflowStatus } from '@/stores/workflowMetadataStore';
import { Search } from 'lucide-react';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import type { SketchStroke } from '@/components/SketchCanvas';

interface LayersTabProps {
  nodes: Node[];
  edges: Edge[];
  frames?: any[];
  canvasObjects?: CanvasObject[];
  sketchStrokes?: SketchStroke[];
  projectId?: string;
  isReadOnly?: boolean;
  onStrokeSelect?: (index: number) => void;
  /** Required to persist ungrouping when a persistent group contains nodes. */
  onNodesChange?: (nodes: Node[]) => void;
  onCanvasObjectsChange?: (objects: CanvasObject[]) => void;
  /**
   * Lets the canvas host select the mixed members of a persistent group.
   * Focusing its combined world bounds is performed by LayersTab directly.
   */
  onPersistentGroupFocus?: (members: {
    groupId: string;
    nodeIds: string[];
    canvasObjectIds: string[];
  }) => void;
  onPersistentGroupUngroup?: (groupId: string) => void;
}

export function LayersTab({
  nodes,
  edges,
  frames,
  canvasObjects = [],
  sketchStrokes,
  projectId,
  isReadOnly = false,
  onStrokeSelect,
  onNodesChange,
  onCanvasObjectsChange,
  onPersistentGroupFocus,
  onPersistentGroupUngroup,
}: LayersTabProps) {
  const [tree, setTree] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  const draggedCanvasObjectIdRef = useRef<string | null>(null);
  const dropTargetGroupIdRef = useRef<string | null>(null);
  const [collapseVersion, forceCollapseUpdate] = useReducer((x: number) => x + 1, 0);
  const workflowMeta = useWorkflowMetadata(projectId);

  useEffect(() => {
    const w = new Worker(new URL('@/components/layers/graphWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: any) => setTree(buildMultiViewTrees(
      nodes,
      edges,
      frames ?? [],
      e.data,
      sketchStrokes ?? [],
      canvasObjects,
    ));
    w.postMessage({ nodes, edges, frames, pinnedWorkflows: {} });
    return () => w.terminate();
  }, [nodes, edges, frames, sketchStrokes, canvasObjects]);

  const rootId = 'structureRoot';
  const getChildren = (id: string): string[] => tree?.groups[id]?.childIds ?? [];

  const workflowNames = useProjectWorkflowNames();

  const defaultWorkflowNames = useMemo(() => {
    if (!tree) return {} as Record<string, string>;
    const workflowsById: Record<string, string[]> = {};
    Object.entries(tree.groups).forEach(([groupId, group]) => {
      if ((group as any).role === 'workflow' && groupId.startsWith('wf:')) {
        const wfKey = groupId.slice(3);
        workflowsById[wfKey] = (group as any).childIds.filter(
          (id: string) => tree.leaves[id]?.role === 'node',
        );
      }
    });
    return generateDefaultWorkflowNames(workflowsById, nodes);
  }, [tree, nodes]);

  useEffect(() => {
    if (!tree) return;
    const mappings: { nodeId: string; workflowGroupId: string; workflowName: string }[] = [];
    Object.entries(tree.groups).forEach(([groupId, group]) => {
      if ((group as any).role === 'workflow' && groupId.startsWith('wf:')) {
        const wfName = workflowNames.get(groupId) || defaultWorkflowNames[groupId] || (group as any).name;
        (group as any).childIds.forEach((childId: string) => {
          if (tree.leaves[childId]?.role === 'node') {
            mappings.push({ 
              nodeId: childId, 
              workflowGroupId: groupId, 
              workflowName: wfName 
            });
          }
        });
      }
    });
    nodeToWorkflowStore.setMultiple(mappings);
  }, [tree, workflowNames, defaultWorkflowNames]);

  const { rows, ancestorsIndex, defaultNames } = useMemo(() => {
    if (!tree) return { rows: [], ancestorsIndex: {} as Record<string, string[]>, defaultNames: {} as Record<string, string> };
    
    const generatedDefaults = defaultWorkflowNames;
    const idx: Record<string, string[]> = {};
    const out: any[] = [];
    
    const lowerQuery = searchQuery.toLowerCase().trim();
    const matchesSearch = (label: string) => {
      if (!lowerQuery) return true;
      return label.toLowerCase().includes(lowerQuery);
    };
    
    const hasMatchingDescendant = (groupId: string): boolean => {
      const group = tree.groups[groupId];
      if (!group) return false;
      
      for (const cid of group.childIds) {
        if (tree.groups[cid]) {
          const childGroup = tree.groups[cid];
          let childDisplayName = childGroup.name;
          if (childGroup.role === 'workflow' && cid.startsWith('wf:')) {
            childDisplayName = workflowNames.get(cid) || generatedDefaults[cid] || childGroup.name;
          }
          
          if (matchesSearch(childDisplayName) || hasMatchingDescendant(cid)) {
            return true;
          }
        } else {
          const leaf = tree.leaves[cid];
          if (leaf && matchesSearch(leaf.label || cid)) {
            return true;
          }
        }
      }
      return false;
    };
    
    const walk = (id: string, depth: number, ancestors: string[]) => {
      const g = tree.groups[id]; if (!g) return;
      g.childIds.forEach((cid: string) => { idx[cid] = ancestors.concat(id); });
      
      const shouldRenderGroup = id !== 'structureRoot';
      
      if (shouldRenderGroup) {
        let displayName = g.name;
        if (g.role === 'workflow' && id.startsWith('wf:')) {
          displayName = workflowNames.get(id) || generatedDefaults[id] || g.name;
        } else if (g.role === 'linkGroup' && id.startsWith('links:')) {
          const match = id.match(/links:(.+)\|(.+)/);
          if (match) {
            const [, wfA, wfB] = match;
            const nameA = workflowNames.get(`wf:${wfA}`) || generatedDefaults[`wf:${wfA}`] || wfA;
            const nameB = workflowNames.get(`wf:${wfB}`) || generatedDefaults[`wf:${wfB}`] || wfB;
            displayName = `Between ${nameA} ↔ ${nameB}`;
          }
        }
        
        const groupMatches = matchesSearch(displayName);
        const hasMatchingChildren = hasMatchingDescendant(id);
        
        if (!lowerQuery || groupMatches || hasMatchingChildren) {
          out.push({ type: 'group', id, label: displayName, depth, childIds: g.childIds, role: g.role, collapsed: collapseStore.get(id) });
        }
      }
      
      const isCollapsed = shouldRenderGroup ? collapseStore.get(id) : false;
      if (!isCollapsed || lowerQuery) {
        for (const cid of g.childIds) {
          if (tree.groups[cid]) {
            const childDepth = shouldRenderGroup ? depth + 1 : depth;
            walk(cid, childDepth, ancestors.concat(id));
          } else {
            const leaf = tree.leaves[cid];
            // Skip edges - they should not be rendered in Layers UI
            if (leaf && leaf.role === 'edge') continue;
            
            if (leaf && (!lowerQuery || matchesSearch(leaf.label || cid))) {
              const leafDepth = shouldRenderGroup ? depth + 1 : depth + 1;
              out.push({ 
                type: 'leaf', 
                id: cid, 
                label: leaf.label ?? cid, 
                depth: leafDepth, 
                role: leaf.role,
                nodeType: leaf.role === 'node' ? nodes.find(n => n.id === cid)?.type : undefined,
                 canvasObjectId: leaf.canvasObjectId,
                 canvasObjectType: leaf.canvasObjectType,
                isDecision: leaf.isDecision,
                branchDepth: leaf.branchDepth ?? 0
              });
            }
          }
        }
      }
    };
    walk(rootId, 0, []);
    
    return { rows: out, ancestorsIndex: idx, defaultNames: generatedDefaults };
  }, [tree, workflowNames, nodes, searchQuery, collapseVersion, defaultWorkflowNames]);

  useEffect(() => { AncestorsStore.set(ancestorsIndex); }, [ancestorsIndex]);

  const [, force] = useReducer(x => x + 1, 0);
  useEffect(() => { 
    const unsubscribe = VLStore.subscribe(force); 
    return () => { unsubscribe(); };
  }, []);
  
  useEffect(() => {
    const unsubscribe = collapseStore.subscribe(forceCollapseUpdate);
    return unsubscribe;
  }, []);
  
  const flags = VLStore.get();

  const moveCanvasObjectToGroup = (objectId: string, groupId: string) => {
    if (isReadOnly || !onCanvasObjectsChange) return;
    if (groupId !== 'standalone' && tree?.groups[groupId]?.role !== 'workflow') return;

    const nextWorkflowGroupId = groupId === 'standalone' ? undefined : groupId;
    let changed = false;
    const nextObjects = canvasObjects.map((object) => {
      if (object.id !== objectId || object.workflowGroupId === nextWorkflowGroupId) return object;
      changed = true;
      const nextObject = { ...object, workflowGroupId: nextWorkflowGroupId };
      if (!nextWorkflowGroupId) delete nextObject.workflowGroupId;
      return nextObject;
    });
    if (changed) onCanvasObjectsChange(nextObjects);
    draggedCanvasObjectIdRef.current = null;
    dropTargetGroupIdRef.current = null;
    setDropTargetGroupId(null);
  };

  const getPersistentGroupMembers = (groupId: string) => {
    const childIds = tree?.groups[groupId]?.childIds ?? [];
    return {
      nodeIds: childIds.filter((id: string) => tree?.leaves[id]?.role === 'node'),
      canvasObjectIds: childIds
        .filter((id: string) => tree?.leaves[id]?.role === 'canvasObject')
        .map((id: string) => tree.leaves[id].canvasObjectId as string),
    };
  };

  const focusPersistentGroup = (layerGroupId: string) => {
    const group = tree?.groups[layerGroupId];
    if (!group?.persistentGroupId) return;
    const members = getPersistentGroupMembers(layerGroupId);
    onPersistentGroupFocus?.({
      groupId: group.persistentGroupId,
      ...members,
    });

    const bounds: { x: number; y: number; width: number; height: number }[] = [];
    members.nodeIds.forEach((id: string) => {
      const node = nodes.find(candidate => candidate.id === id);
      if (!node) return;
      bounds.push({
        x: node.position.x,
        y: node.position.y,
        width: node.style?.width ?? node.width ?? node.measuredWidth ?? 200,
        height: node.style?.height ?? node.height ?? node.measuredHeight ?? 100,
      });
    });
    members.canvasObjectIds.forEach((id: string) => {
      const object = canvasObjects.find(candidate => candidate.id === id);
      if (!object) return;
      bounds.push({
        x: object.position.x,
        y: object.position.y,
        width: object.style?.width ?? object.width ?? 160,
        height: object.style?.height ?? object.height ?? 100,
      });
    });
    if (bounds.length === 0) return;
    const minX = Math.min(...bounds.map(bound => bound.x));
    const minY = Math.min(...bounds.map(bound => bound.y));
    const maxX = Math.max(...bounds.map(bound => bound.x + bound.width));
    const maxY = Math.max(...bounds.map(bound => bound.y + bound.height));
    focusBus.focusWorldRect({
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
    }, { padding: 150 });
  };

  const ungroupPersistentGroup = (layerGroupId: string) => {
    if (isReadOnly) return;
    const persistentGroupId = tree?.groups[layerGroupId]?.persistentGroupId;
    if (!persistentGroupId) return;
    if (onPersistentGroupUngroup) {
      onPersistentGroupUngroup(persistentGroupId);
      return;
    }
    const { nodeIds, canvasObjectIds } = getPersistentGroupMembers(layerGroupId);
    if (nodeIds.length > 0 && !onNodesChange) return;
    if (canvasObjectIds.length > 0 && !onCanvasObjectsChange) return;
    if (nodeIds.length > 0) {
      onNodesChange?.(nodes.map(node => {
        if (node.groupId !== persistentGroupId) return node;
        const nextNode = { ...node };
        delete nextNode.groupId;
        return nextNode;
      }));
    }
    if (canvasObjectIds.length > 0) {
      onCanvasObjectsChange?.(canvasObjects.map(object => {
        if (object.groupId !== persistentGroupId) return object;
        const nextObject = { ...object };
        delete nextObject.groupId;
        return nextObject;
      }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900" role="tree" aria-label="Layers" data-testid="layers-tab">
      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search layers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-colors"
            data-testid="input-layers-search"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden bg-gray-50/30 dark:bg-gray-800/30">
        <VirtualTree
          rows={rows}
          Row={({ type, id, label, depth, childIds, role, collapsed, nodeType, isDecision, branchDepth, canvasObjectId, canvasObjectType }: { type: 'group' | 'leaf'; id: string; label: string; depth: number; childIds?: string[]; role?: string; collapsed?: boolean; nodeType?: string; isDecision?: boolean; branchDepth?: number; canvasObjectId?: string; canvasObjectType?: string }) => {
            if (type === 'group') {
              const triHidden: Tri = computeTri(childIds ?? [], flags.hidden);
              const triLocked: Tri = computeTri(childIds ?? [], flags.locked);
              const onToggleHidden = () => {
                const next = { hidden: { ...flags.hidden }, locked: { ...flags.locked } };
                cascade(id, !(triHidden === 'on'), getChildren, next.hidden);
                VLStore.set(next);
              };
              const onToggleLocked = () => {
                const next = { hidden: { ...flags.hidden }, locked: { ...flags.locked } };
                cascade(id, !(triLocked === 'on'), getChildren, next.locked);
                VLStore.set(next);
              };
              const handleClick = () => {
                if (role === 'workflow' && childIds) {
                  const nodeIds = childIds.filter(cid => tree.leaves[cid]?.role === 'node');
                  focusBus.focusWorkflow(nodeIds, { padding: 150 });
                } else if (role === 'persistentGroup') {
                  focusPersistentGroup(id);
                }
              };
              
              const handleNameChange = role === 'workflow' ? (newName: string) => {
                workflowNames.set(id, newName);
              } : undefined;
              
              const handleToggleCollapse = () => {
                collapseStore.toggle(id);
              };
              
              const wfKey = id.startsWith('wf:') ? id.slice(3) : id;
              const wfStatus = role === 'workflow' ? workflowMeta.get(wfKey).status : undefined;
              const handleStatusChange = role === 'workflow' ? (newStatus: WorkflowStatus) => {
                workflowMeta.setStatus(wfKey, newStatus);
              } : undefined;
                const members = role === 'persistentGroup' ? getPersistentGroupMembers(id) : undefined;
                const canUngroup = !isReadOnly && !!members && (
                  !!onPersistentGroupUngroup ||
                  (
                    (members.nodeIds.length === 0 || !!onNodesChange) &&
                    (members.canvasObjectIds.length === 0 || !!onCanvasObjectsChange)
                  )
                );
              
              return <GroupRow 
                id={id} depth={depth} label={label} childIds={childIds ?? []}
                triHidden={triHidden} triLocked={triLocked}
                onToggleHidden={onToggleHidden} onToggleLocked={onToggleLocked}
                onClick={handleClick}
                onNameChange={handleNameChange}
                role={role}
                collapsed={collapsed}
                onToggleCollapse={handleToggleCollapse}
                status={wfStatus}
                onStatusChange={handleStatusChange}
                canDropCanvasObject={!isReadOnly && (role === 'workflow' || role === 'standalone')}
                isDropTarget={dropTargetGroupId === id}
                onCanvasObjectDragOver={(isOver) => {
                  if (!draggedCanvasObjectIdRef.current) return;
                  const nextTarget = isOver ? id : null;
                  dropTargetGroupIdRef.current = nextTarget;
                  setDropTargetGroupId(nextTarget);
                }}
                onDropCanvasObject={(objectId) => moveCanvasObjectToGroup(objectId, id)}
                onUngroup={canUngroup ? () => ungroupPersistentGroup(id) : undefined}
              />;
            } else {
              const ancestors = ancestorsIndex[id] ?? [];
              const effHidden = isEffectivelyOn(id, ancestors, flags.hidden);
              const effLocked = isEffectivelyOn(id, ancestors, flags.locked);
              
              const handleClick = () => {
                const persistentAncestorId = [...ancestors].reverse().find(
                  ancestorId => tree?.groups[ancestorId]?.role === 'persistentGroup',
                );
                if (persistentAncestorId) {
                  focusPersistentGroup(persistentAncestorId);
                  return;
                }
                if (role === 'node') {
                  focusBus.focusNodes([id], { select: true, padding: 150 });
                } else if (role === 'edge' && id.startsWith('e:')) {
                  const edgeId = id.slice(2);
                  const edge = edges.find(e => e.id === edgeId);
                  if (edge) {
                    focusBus.focusNodes([edge.source, edge.target], { padding: 150 });
                  }
                } else if (role === 'stroke' && id.startsWith('stroke:')) {
                  const idx = parseInt(id.slice(7), 10);
                  const stroke = (sketchStrokes ?? [])[idx];
                  if (!stroke || !stroke.points || stroke.points.length === 0) return;
                  // Pan the canvas to the stroke's bounding box
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                  for (const p of stroke.points) {
                    if (p.x < minX) minX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y > maxY) maxY = p.y;
                  }
                  focusBus.focusWorldRect({
                    x: minX, y: minY,
                    width: Math.max(maxX - minX, 1),
                    height: Math.max(maxY - minY, 1),
                  }, { padding: 150 });
                  // Enter sketch mode and select this stroke
                  onStrokeSelect?.(idx);
                } else if (role === 'canvasObject' && canvasObjectId) {
                  focusBus.focusCanvasObject(canvasObjectId, { select: true, padding: 150 });
                }
              };

              const isStroke = role === 'stroke';
              const onToggleStrokeHidden = isStroke ? () => {
                VLStore.set({ hidden: { ...flags.hidden, [id]: !flags.hidden[id] } });
              } : undefined;
              const onToggleStrokeLocked = isStroke ? () => {
                VLStore.set({ locked: { ...flags.locked, [id]: !flags.locked[id] } });
              } : undefined;
              
              return <LeafRow 
                id={id} depth={depth} label={label} 
                effHidden={effHidden} effLocked={effLocked}
                onClick={handleClick}
                role={role}
                nodeType={role === 'node' ? nodes.find(n => n.id === id)?.type : undefined}
                canvasObjectType={canvasObjectType}
                selected={role === 'canvasObject' && !!canvasObjects.find(object => object.id === canvasObjectId)?.selected}
                isDecision={isDecision}
                branchDepth={branchDepth}
                onToggleHidden={onToggleStrokeHidden}
                onToggleLocked={onToggleStrokeLocked}
                draggable={role === 'canvasObject' && !isReadOnly && !!onCanvasObjectsChange}
                onCanvasObjectDragStart={(objectId) => {
                  draggedCanvasObjectIdRef.current = objectId;
                }}
                onCanvasObjectDragEnd={() => {
                  const objectId = draggedCanvasObjectIdRef.current;
                  const groupId = dropTargetGroupIdRef.current;
                  if (objectId && groupId) {
                    moveCanvasObjectToGroup(objectId, groupId);
                    return;
                  }
                  draggedCanvasObjectIdRef.current = null;
                  dropTargetGroupIdRef.current = null;
                  setDropTargetGroupId(null);
                }}
              />;
            }
          }}
        />
      </div>
    </div>
  );
}

export default LayersTab;
