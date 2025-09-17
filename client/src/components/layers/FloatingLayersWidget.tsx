import * as React from 'react';
import { ListTree } from 'lucide-react';
import LayersPanel from './LayersPanel';

type Props = {
  nodes:any[]; edges:any[]; frames?:any[];
};

export function FloatingLayersWidget({ nodes, edges, frames }: Props){
  const [open, setOpen] = React.useState(false);
  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={()=>setOpen(o=>!o)}
        className="flex items-center gap-2 rounded-full px-3 py-2 bg-white/90 shadow border hover:shadow-md transition"
        title="Layers"
      >
        <ListTree size={16}/>
        <span className="text-sm font-medium">Layers</span>
      </button>
      {open && (
        <div className="mt-2 w-[380px] h-[560px] rounded-xl shadow-2xl border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold"><ListTree size={16}/> Layers</div>
            <button className="text-xs opacity-70 hover:opacity-100" onClick={()=>setOpen(false)}>Close</button>
          </div>
          <div className="h-[calc(100%-40px)]">
            <LayersPanel nodes={nodes} edges={edges} frames={frames}/>
          </div>
        </div>
      )}
    </div>
  );
}

export default FloatingLayersWidget;