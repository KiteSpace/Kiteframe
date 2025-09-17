import * as React from 'react';
import { Eye, EyeOff, Lock, Unlock, MinusSquare } from 'lucide-react';
import type { Tri } from './triStateUtils';

export function GroupRow({
  id, depth, label, childIds,
  triHidden, triLocked,
  onToggleHidden, onToggleLocked,
}:{
  id:string; depth:number; label:string; childIds:string[];
  triHidden:Tri; triLocked:Tri;
  onToggleHidden:()=>void; onToggleLocked:()=>void;
}) {
  const EyeGlyph = triHidden==='mixed' ? MinusSquare : (triHidden==='on' ? Eye : EyeOff);
  const LockGlyph = triLocked==='mixed' ? MinusSquare : (triLocked==='on' ? Lock : Unlock);
  return (
    <div role="treeitem" aria-level={depth+1} aria-expanded className="flex items-center gap-2 px-2 h-7">
      <span style={{paddingLeft: depth*12}} className="font-medium">{label}</span>
      <span className="ml-auto flex gap-2">
        <button onClick={onToggleHidden} title={`visibility: ${triHidden}`}><EyeGlyph size={16}/></button>
        <button onClick={onToggleLocked} title={`lock: ${triLocked}`}><LockGlyph size={16}/></button>
      </span>
    </div>
  );
}

export function LeafRow({
  id, depth, label, effHidden, effLocked
}:{
  id:string; depth:number; label:string; effHidden:boolean; effLocked:boolean;
}) {
  return (
    <div role="treeitem" aria-level={depth+1}
         className={`px-2 h-7 flex items-center ${effHidden?'opacity-50':''}`}>
      <span style={{paddingLeft: depth*12}}>{label}</span>
      {effLocked && <span className="ml-2 text-xs opacity-70">[locked]</span>}
    </div>
  );
}