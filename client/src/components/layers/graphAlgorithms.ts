export class UF {
  private p: Record<string,string> = {};
  find(x:string){ if(!this.p[x]) this.p[x]=x; return this.p[x]===x?x:this.p[x]=this.find(this.p[x]); }
  union(a:string,b:string){ this.p[this.find(a)] = this.find(b); }
  groups(){ const m:Record<string,string[]>={}; for(const k of Object.keys(this.p)){ const r=this.find(k); (m[r]??=[]).push(k);} return m; }
}

export function topoLevels(nodes:any[], edges:any[]){
  const inDeg = new Map<string,number>();
  const out = new Map<string,string[]>();
  nodes.forEach(n => { inDeg.set(n.id,0); out.set(n.id,[]); });
  edges.forEach(e => { inDeg.set(e.target,(inDeg.get(e.target)??0)+1); (out.get(e.source) ?? out.set(e.source, []).get(e.source)) });
  // ensure out map entries
  edges.forEach(e => {
    const arr = out.get(e.source) || [];
    if (!out.has(e.source)) out.set(e.source, arr);
    arr.push(e.target);
  });

  const q = nodes.filter(n => (inDeg.get(n.id)??0)===0).map(n=>n.id);
  const level = new Map<string,number>(); q.forEach(id=>level.set(id,0));
  const order:string[] = [];
  while(q.length){
    const u=q.shift()!;
    order.push(u);
    for(const v of out.get(u) || []){
      const deg=(inDeg.get(v)??0)-1; inDeg.set(v,deg);
      if(deg===0){ q.push(v); level.set(v, (level.get(u)??0)+1); }
    }
  }
  const cycles = new Set<string>(nodes.map(n=>n.id).filter(id => !order.includes(id)));
  for(const id of Array.from(cycles)){
    const preds = edges.filter(e=>e.target===id).map(e=>level.get(e.source)??0);
    level.set(id, (preds.length?Math.max(...preds):0)+1);
  }
  return { level, cycles };
}

export function spatialRows(nodes:any[], rowHeight=120){
  const rows = new Map<number, string[]>();
  nodes.forEach(n=>{
    const y = n.position?.y ?? 0;
    const r = Math.floor(y/rowHeight);
    const arr = rows.get(r) ?? [];
    arr.push(n.id);
    rows.set(r,arr);
  });
  return rows;
}