import { buildLinkGroups } from './linkGroups';

export type LayerRole = 'root'|'workflow'|'frame'|'node'|'edge'|'linkRoot'|'linkGroup'|'stage'|'spatialGroup'|'standalone';
export interface LayerGroupBase { id:string; name:string; role:LayerRole; childIds:string[]; badges?:string[]; }
export interface LayerLeaf { 
  id:string; 
  role:'node'|'edge'; 
  label:string; 
  parentId:string;
  isDecision?: boolean;
  branchDepth?: number;
  outgoingEdgeCount?: number;
}
export type LayerTree = { groups:Record<string,LayerGroupBase>; leaves:Record<string,LayerLeaf>; roots:string[]; };

export function buildMultiViewTrees(
  nodes:any[], edges:any[], frames:any[],
  workerResult:{ nodeToWorkflow:Record<string,string>, level:Record<string,number>, cycles:string[], rows:[number,string[]][] }
): LayerTree {
  const groups: Record<string,LayerGroupBase> = {};
  const leaves: Record<string,LayerLeaf> = {};
  const roots = ['structureRoot','topologyRoot','spatialRoot','linksRoot'];

  // Create lookup maps for node and edge labels
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const getNodeLabel = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    return node?.data?.label || node?.data?.name || nodeId;
  };
  
  // Helper to count outgoing edges for a node
  const getOutgoingEdgeCount = (nodeId: string) => {
    return edges.filter(e => e.source === nodeId).length;
  };
  
  // Helper to check if a node is a decision node
  const isDecisionNode = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    return node?.type === 'condition' || getOutgoingEdgeCount(nodeId) > 1;
  };

  groups['structureRoot'] = { id:'structureRoot', name:'Structure', role:'root', childIds:[] };
  
  // Collect standalone nodes
  const standaloneNodeIds: string[] = [];
  
  const workflowsById: Record<string,string[]> = {};
  Object.entries(workerResult.nodeToWorkflow).forEach(([nodeId,wf])=>{
    (workflowsById[wf]??=[]).push(nodeId);
  });
  
  for (const [wf, nodeIds] of Object.entries(workflowsById)) {
    // Count internal edges for this component
    const internalEdges = edges.filter(e =>
      (nodeIds as string[]).includes(e.source) &&
      (nodeIds as string[]).includes(e.target)
    );
    
    // Only create workflow if >= 2 internal edges
    if (internalEdges.length < 2) {
      // Add all nodes to standalone bucket
      standaloneNodeIds.push(...(nodeIds as string[]));
      continue;
    }
    
    const wfId = `wf:${wf}`;
    groups['structureRoot'].childIds.push(wfId);
    groups[wfId] = { id:wfId, name: wf.startsWith('wf:')?wf.slice(3):wf, role:'workflow', childIds:[] };
    
    // Build edge map for branch depth calculation
    const nodeOutgoing = new Map<string, string[]>();
    const nodeIncoming = new Map<string, string[]>();
    internalEdges.forEach(e => {
      const outList = nodeOutgoing.get(e.source) || [];
      outList.push(e.target);
      nodeOutgoing.set(e.source, outList);
      
      const inList = nodeIncoming.get(e.target) || [];
      inList.push(e.source);
      nodeIncoming.set(e.target, inList);
    });
    
    // Find root nodes (no incoming edges within workflow)
    const rootNodes = (nodeIds as string[]).filter(nid => 
      !nodeIncoming.has(nid) || nodeIncoming.get(nid)!.length === 0
    );
    
    // Calculate branch depth using BFS from roots
    const branchDepths = new Map<string, number>();
    const visited = new Set<string>();
    const queue: { nodeId: string; depth: number; parentIsDecision: boolean }[] = [];
    
    // Start from root nodes
    rootNodes.forEach(rootId => {
      queue.push({ nodeId: rootId, depth: 0, parentIsDecision: false });
    });
    
    // If no roots found, start from first node
    if (queue.length === 0 && (nodeIds as string[]).length > 0) {
      queue.push({ nodeId: (nodeIds as string[])[0], depth: 0, parentIsDecision: false });
    }
    
    while (queue.length > 0) {
      const { nodeId, depth, parentIsDecision } = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      
      // Increase depth if parent was a decision node
      const currentDepth = parentIsDecision ? depth + 1 : depth;
      branchDepths.set(nodeId, currentDepth);
      
      const isCurrentDecision = isDecisionNode(nodeId);
      const children = nodeOutgoing.get(nodeId) || [];
      children.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ nodeId: childId, depth: currentDepth, parentIsDecision: isCurrentDecision });
        }
      });
    }
    
    // Add unvisited nodes with depth 0
    (nodeIds as string[]).forEach(nid => {
      if (!branchDepths.has(nid)) {
        branchDepths.set(nid, 0);
      }
    });
    
    // Sort nodes by topological level then by branch depth for better visualization
    const sortedNodeIds = [...(nodeIds as string[])].sort((a, b) => {
      const levelA = workerResult.level[a] ?? 0;
      const levelB = workerResult.level[b] ?? 0;
      if (levelA !== levelB) return levelA - levelB;
      return (branchDepths.get(a) ?? 0) - (branchDepths.get(b) ?? 0);
    });
    
    sortedNodeIds.forEach(nid => {
      const outCount = getOutgoingEdgeCount(nid);
      const isDecision = isDecisionNode(nid);
      const branchDepth = branchDepths.get(nid) ?? 0;
      
      leaves[nid] = { 
        id: nid, 
        role: 'node', 
        label: getNodeLabel(nid), 
        parentId: wfId,
        isDecision,
        branchDepth,
        outgoingEdgeCount: outCount
      };
      groups[wfId].childIds.push(nid);
    });
    
    // NOTE: Edges are NOT added to workflow groups (per spec)
  }
  
  // Create standalone nodes group if there are any
  if (standaloneNodeIds.length > 0) {
    const standaloneId = 'standalone';
    groups['structureRoot'].childIds.push(standaloneId);
    groups[standaloneId] = { 
      id: standaloneId, 
      name: 'Standalone Nodes', 
      role: 'standalone', 
      childIds: [] 
    };
    
    standaloneNodeIds.forEach(nid => {
      leaves[nid] = { 
        id: nid, 
        role: 'node', 
        label: getNodeLabel(nid), 
        parentId: standaloneId,
        isDecision: false,
        branchDepth: 0,
        outgoingEdgeCount: 0
      };
      groups[standaloneId].childIds.push(nid);
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
    ids.forEach((id:string)=>{ if(!leaves[id]) leaves[id]={ id, role:'node', label:getNodeLabel(id), parentId:gid }; });
  });

  groups['spatialRoot'] = { id:'spatialRoot', name:'Spatial', role:'root', childIds:[] };
  workerResult.rows.forEach(([rowIdx, ids])=>{
    const gid=`row:${rowIdx}`;
    groups['spatialRoot'].childIds.push(gid);
    groups[gid]={ id:gid, name:`Row Y=${rowIdx}`, role:'spatialGroup', childIds:[...ids] };
    ids.forEach((id:string)=>{ if(!leaves[id]) leaves[id]={ id, role:'node', label:getNodeLabel(id), parentId:gid }; });
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
