export type Tri = 'on'|'off'|'mixed';

export function computeTri(
  ids: string[],
  flagMap: Record<string, boolean>
): Tri {
  if (!ids.length) return 'off';
  let on=false, off=false;
  for (const id of ids) { (flagMap[id] ? on=true : off=true); if (on && off) return 'mixed'; }
  return on ? 'on' : 'off';
}

export function cascade(
  rootId: string,
  nextOn: boolean,
  getChildren: (id:string)=>string[],
  flagMap: Record<string, boolean>
) {
  const stack=[rootId];
  while (stack.length) {
    const id=stack.pop()!;
    flagMap[id]=nextOn;
    const kids=getChildren(id);
    for (const k of kids) stack.push(k);
  }
}

export function isEffectivelyOn(
  id: string,
  ancestors: string[],
  flagMap: Record<string, boolean>
) {
  if (flagMap[id]) return true;
  for (const a of ancestors) if (flagMap[a]) return true;
  return false;
}