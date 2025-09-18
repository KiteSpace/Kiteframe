import React, { useEffect, useMemo, useState } from 'react';
import { LayerModeTabs, type LayerMode } from './LayerModeTabs';
import { VirtualTree } from './VirtualTree';
import { VLStore } from './visibilityLockStore';
import { computeTri, cascade, isEffectivelyOn, Tri } from './triStateUtils';
import { GroupRow, LeafRow } from './TreeRow';
import { buildMultiViewTrees } from './multiViewBuilder';
import { AncestorsStore } from './ancestorsStore';
import { useWorkflowNames, generateDefaultWorkflowNames } from '@/stores/workflowNameStore';
import { focusBus } from '@/stores/focusBus';

export function LayersPanel({ nodes, edges, frames }:{
  nodes:any[]; edges:any[]; frames?:any[];
}) {
  const [mode, setMode] = useState<LayerMode>('structure');
  const [tree, setTree] = useState<any>(null);

  useEffect(()=>{
    const w = new Worker(new URL('./graphWorker.ts', import.meta.url), { type:'module' });
    w.onmessage = (e:any)=> setTree(buildMultiViewTrees(nodes, edges, frames ?? [], e.data));
    w.postMessage({ nodes, edges, frames, pinnedWorkflows:{} });
    return ()=> w.terminate();
  }, [nodes, edges, frames]);

  const rootId = mode==='structure' ? 'structureRoot' : mode==='topology' ? 'topologyRoot' : mode==='spatial' ? 'spatialRoot' : 'linksRoot';
  const getChildren = (id:string):string[] => tree?.groups[id]?.childIds ?? [];

  const workflowNames = useWorkflowNames();

  const { rows, ancestorsIndex, defaultNames } = useMemo(()=>{
    if(!tree) return { rows:[], ancestorsIndex:{} as Record<string,string[]>, defaultNames:{} as Record<string,string> };
    
    // Generate default workflow names based on position
    const workflowsById: Record<string, string[]> = {};
    Object.entries(tree.groups).forEach(([groupId, group]) => {
      if ((group as any).role === 'workflow' && groupId.startsWith('wf:')) {
        const wfKey = groupId.slice(3);
        workflowsById[wfKey] = (group as any).childIds.filter((id: string) => !id.startsWith('e:'));
      }
    });
    const generatedDefaults = generateDefaultWorkflowNames(workflowsById, nodes);
    
    const idx: Record<string,string[]> = {};
    const out:any[]=[];
    const walk=(id:string, depth:number, ancestors:string[])=>{
      const g = tree.groups[id]; if(!g) return;
      g.childIds.forEach((cid: string)=>{ idx[cid] = ancestors.concat(id); });
      
      // Resolve display name for workflow groups
      let displayName = g.name;
      if (g.role === 'workflow' && id.startsWith('wf:')) {
        displayName = workflowNames.get(id) || generatedDefaults[id] || g.name;
      } else if (g.role === 'linkGroup' && id.startsWith('links:')) {
        // Resolve workflow names in link group labels
        const match = id.match(/links:(.+)\|(.+)/);
        if (match) {
          const [, wfA, wfB] = match;
          const nameA = workflowNames.get(`wf:${wfA}`) || generatedDefaults[`wf:${wfA}`] || wfA;
          const nameB = workflowNames.get(`wf:${wfB}`) || generatedDefaults[`wf:${wfB}`] || wfB;
          displayName = `Between ${nameA} ↔ ${nameB}`;
        }
      }
      
      out.push({ type:'group', id, label:displayName, depth, childIds:g.childIds, role:g.role });
      for (const cid of g.childIds) {
        if (tree.groups[cid]) walk(cid, depth+1, ancestors.concat(id));
        else {
          const leaf = tree.leaves[cid];
          out.push({ type:'leaf', id:cid, label:leaf?.label ?? cid, depth:depth+1, role:leaf?.role });
        }
      }
    };
    walk(rootId, 0, []);
    return { rows: out, ancestorsIndex: idx, defaultNames: generatedDefaults };
  }, [tree, rootId, workflowNames, nodes]);

  useEffect(()=>{ AncestorsStore.set(ancestorsIndex); }, [ancestorsIndex]);

  const [, force] = React.useReducer(x=>x+1, 0);
  useEffect(()=>{ const unsubscribe = VLStore.subscribe(force); return unsubscribe; },[]);
  const flags = VLStore.get();

  return (
    <div className="flex flex-col h-full bg-white" role="tree" aria-label="Layers">
      <LayerModeTabs mode={mode} setMode={setMode} />
      <div className="flex-1 overflow-hidden">
        <VirtualTree
          rows={rows}
          Row={({type,id,label,depth,childIds,role}:{type:'group'|'leaf';id:string;label:string;depth:number;childIds?:string[];role?:string})=>{
            if (type==='group') {
              const triHidden:Tri = computeTri(childIds ?? [], flags.hidden);
              const triLocked:Tri = computeTri(childIds ?? [], flags.locked);
              const onToggleHidden = () => {
                const next = { hidden: { ...flags.hidden }, locked: { ...flags.locked } };
                cascade(id, !(triHidden==='on'), getChildren, next.hidden);
                VLStore.set(next);
              };
              const onToggleLocked = () => {
                const next = { hidden: { ...flags.hidden }, locked: { ...flags.locked } };
                cascade(id, !(triLocked==='on'), getChildren, next.locked);
                VLStore.set(next);
              };
              const handleClick = () => {
                if (role === 'workflow' && childIds) {
                  const nodeIds = childIds.filter(cid => !cid.startsWith('e:'));
                  focusBus.focusWorkflow(nodeIds);
                }
              };
              
              const handleNameChange = role === 'workflow' ? (newName: string) => {
                // Let errors propagate to GroupRow for proper toast feedback
                workflowNames.set(id, newName);
              } : undefined;
              
              return <GroupRow 
                id={id} depth={depth} label={label} childIds={childIds ?? []}
                triHidden={triHidden} triLocked={triLocked}
                onToggleHidden={onToggleHidden} onToggleLocked={onToggleLocked}
                onClick={handleClick}
                onNameChange={handleNameChange}
                role={role}
              />;
            } else {
              const ancestors = ancestorsIndex[id] ?? [];
              const effHidden = isEffectivelyOn(id, ancestors, flags.hidden);
              const effLocked = isEffectivelyOn(id, ancestors, flags.locked);
              
              const handleClick = () => {
                if (role === 'node') {
                  focusBus.focusNodes([id], { select: true });
                } else if (role === 'edge' && id.startsWith('e:')) {
                  const edgeId = id.slice(2);
                  const edge = edges.find(e => e.id === edgeId);
                  if (edge) {
                    focusBus.focusNodes([edge.source, edge.target]);
                  }
                }
              };
              
              return <LeafRow 
                id={id} depth={depth} label={label} 
                effHidden={effHidden} effLocked={effLocked}
                onClick={handleClick}
              />;
            }
          }}
        />
      </div>
    </div>
  );
}

export default LayersPanel;