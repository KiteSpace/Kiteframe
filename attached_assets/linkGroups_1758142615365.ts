export function buildLinkGroups(edges:any[], nodeToWorkflow:Record<string,string>){
  const buckets = new Map<string, string[]>();
  for(const e of edges){
    const wa = nodeToWorkflow[e.source];
    const wb = nodeToWorkflow[e.target];
    if (!wa || !wb || wa===wb) continue;
    const key = [wa,wb].sort().join('|');
    const arr = buckets.get(key) ?? [];
    arr.push(e.id);
    buckets.set(key,arr);
  }
  return Array.from(buckets.entries()).map(([key, edgeIds])=>{
    const [A,B]=key.split('|');
    return { id:`links:${A}|${B}`, label:`Between ${A} ↔ ${B}`, edgeIds, A, B };
  });
}
