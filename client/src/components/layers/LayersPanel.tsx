import React, { useEffect, useMemo, useState } from 'react';
import { LayerModeTabs, type LayerMode } from './LayerModeTabs';
import { VirtualTree } from './VirtualTree';
import { VLStore } from './visibilityLockStore';
import { computeTri, cascade, isEffectivelyOn, Tri } from './triStateUtils';
import { GroupRow, LeafRow } from './TreeRow';
import { buildMultiViewTrees } from './multiViewBuilder';
import { AncestorsStore } from './ancestorsStore';

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

  const { rows, ancestorsIndex } = useMemo(()=>{
    if(!tree) return { rows:[], ancestorsIndex:{} as Record<string,string[]> };
    const idx: Record<string,string[]> = {};
    const out:any[]=[];
    const walk=(id:string, depth:number, ancestors:string[])=>{
      const g = tree.groups[id]; if(!g) return;
      g.childIds.forEach(cid=>{ idx[cid] = ancestors.concat(id); });
      out.push({ type:'group', id, label:g.name, depth, childIds:g.childIds });
      for (const cid of g.childIds) {
        if (tree.groups[cid]) walk(cid, depth+1, ancestors.concat(id));
        else {
          const leaf = tree.leaves[cid];
          out.push({ type:'leaf', id:cid, label:leaf?.label ?? cid, depth:depth+1 });
        }
      }
    };
    walk(rootId, 0, []);
    return { rows: out, ancestorsIndex: idx };
  }, [tree, rootId]);

  useEffect(()=>{ AncestorsStore.set(ancestorsIndex); }, [ancestorsIndex]);

  const [, force] = React.useReducer(x=>x+1, 0);
  useEffect(()=>VLStore.subscribe(force),[]);
  const flags = VLStore.get();

  return (
    <div className="flex flex-col h-full bg-white" role="tree" aria-label="Layers">
      <LayerModeTabs mode={mode} setMode={setMode} />
      <div className="flex-1 overflow-hidden">
        <VirtualTree
          rows={rows}
          Row={({type,id,label,depth,childIds}:{type:'group'|'leaf';id:string;label:string;depth:number;childIds?:string[]})=>{
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
              return <GroupRow id={id} depth={depth} label={label} childIds={childIds ?? []}
                triHidden={triHidden} triLocked={triLocked}
                onToggleHidden={onToggleHidden} onToggleLocked={onToggleLocked} />;
            } else {
              const ancestors = ancestorsIndex[id] ?? [];
              const effHidden = isEffectivelyOn(id, ancestors, flags.hidden);
              const effLocked = isEffectivelyOn(id, ancestors, flags.locked);
              return <LeafRow id={id} depth={depth} label={label} effHidden={effHidden} effLocked={effLocked} />;
            }
          }}
        />
      </div>
    </div>
  );
}

export default LayersPanel;