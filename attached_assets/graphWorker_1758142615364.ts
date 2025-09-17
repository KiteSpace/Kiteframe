import { UF, topoLevels, spatialRows } from './graphAlgorithms';

self.onmessage = (evt:any) => {
  const { nodes, edges, frames, pinnedWorkflows } = evt.data;
  const uf = new UF();
  nodes.forEach((n:any)=>uf.find(n.id));
  edges.forEach((e:any)=>uf.union(e.source,e.target));
  const comps = uf.groups();

  const nodeToWorkflow: Record<string,string> = {};
  Object.entries(comps).forEach(([root, ids])=>{
    (ids as string[]).forEach(id => nodeToWorkflow[id] = pinnedWorkflows?.[id] ?? root);
  });

  const { level, cycles } = topoLevels(nodes, edges);
  const rows = spatialRows(nodes);

  postMessage({
    nodeToWorkflow,
    level: Object.fromEntries(level as any),
    cycles: Array.from(cycles as any),
    rows: Array.from(rows.entries())
  });
};
