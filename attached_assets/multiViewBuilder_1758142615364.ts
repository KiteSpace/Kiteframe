import { buildLinkGroups } from './linkGroups';

export type LayerRole = 'root'|'workflow'|'frame'|'node'|'edge'|'linkRoot'|'linkGroup'|'stage'|'spatialGroup';
export interface LayerGroupBase { id:string; name:string; role:LayerRole; childIds:string[]; badges?:string[]; }
export interface LayerLeaf { id:string; role:'node'|'edge'; label:string; parentId:string; }
export type LayerTree = { groups:Record<string,LayerGroupBase>; leaves:Record<string,LayerLeaf>; roots:string[]; };

export function buildMultiViewTrees(
  nodes:any[], edges:any[], frames:any[],
  workerResult:{ nodeToWorkflow:Record<string,string>, level:Record<string,number>, cycles:string[], rows:[number,string[]][] }
): LayerTree {
  const groups: Record<string,LayerGroupBase> = {};
  const leaves: Record<string,LayerLeaf> = {};
  const roots = ['structureRoot','topologyRoot','spatialRoot','linksRoot'];

  groups['structureRoot'] = { id:'structureRoot', name:'Structure', role:'root', childIds:[] };
  const workflowsById: Record<string,string[]> = {};
  Object.entries(workerResult.nodeToWorkflow).forEach(([nodeId,wf])=>{
    (workflowsById[wf]??=[]).push(nodeId);
  });
  for (const [wf, nodeIds] of Object.entries(workflowsById)) {
    const wfId = `wf:${wf}`;
    groups['structureRoot'].childIds.push(wfId);
    groups[wfId] = { id:wfId, name: wf.startsWith('wf:')?wf.slice(3):wf, role:'workflow', childIds:[] };
    (nodeIds as string[]).forEach(nid=>{
      leaves[nid] = { id:nid, role:'node', label:nid, parentId:wfId };
      groups[wfId].childIds.push(nid);
    });
    edges.filter(e=>(nodeIds as string[]).includes(e.source) && (nodeIds as string[]).includes(e.target)).forEach(e=>{
      const id=`e:${e.id}`; leaves[id]={ id, role:'edge', label:`${e.source} → ${e.target}`, parentId:wfId };
      groups[wfId].childIds.push(id);
    });
  }

  groups['topologyRoot'] = { id:'topologyRoot', name:'Topology', role:'root', childIds:[] };
  const byLevel = new Map<number,string[]>();
  Object.entries(workerResult.level).forEach(([nodeId,l])=>{
    const arr=byLevel.get(l as number)??[]; arr.push(nodeId); byLevel.set(l as number,arr);
  });
  Array.from(byLevel.entries()).sort((a,b)=>a[0]-b[0]).forEach(([lvl, ids])=>{
    const gid=`stage:${lvl}`; groups['topologyRoot'].childIds.push(gid);
    groups[gid]={ id:gid, name:`Stage ${lvl}`, role:'stage', childIds:[...ids] };
    ids.forEach((id:string)=>{ if(!leaves[id]) leaves[id]={ id, role:'node', label:id, parentId:gid }; });
  });

  groups['spatialRoot'] = { id:'spatialRoot', name:'Spatial', role:'root', childIds:[] };
  workerResult.rows.forEach(([rowIdx, ids])=>{
    const gid=`row:${rowIdx}`;
    groups['spatialRoot'].childIds.push(gid);
    groups[gid]={ id:gid, name:`Row Y=${rowIdx}`, role:'spatialGroup', childIds:[...ids] };
    ids.forEach((id:string)=>{ if(!leaves[id]) leaves[id]={ id, role:'node', label:id, parentId:gid }; });
  });

  groups['linksRoot'] = { id:'linksRoot', name:'Links', role:'root', childIds:[] };
  const linkGroups = buildLinkGroups(edges, workerResult.nodeToWorkflow);
  linkGroups.forEach(g=>{
    const gid=`links:${g.A}|${g.B}`;
    groups['linksRoot'].childIds.push(gid);
    groups[gid]={ id:gid, name:`Between ${g.A} ↔ ${g.B}`, role:'linkGroup', childIds:[] };
    g.edgeIds.forEach((eid:string)=>{
      const id=`e:${eid}`;
      leaves[id] ??= { id, role:'edge', label:`${eid}`, parentId:gid };
      groups[gid].childIds.push(id);
    });
  });

  return { groups, leaves, roots };
}
