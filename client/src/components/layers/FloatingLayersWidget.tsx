import * as React from 'react';
import { ListTree } from 'lucide-react';
import LayersPanel from './LayersPanel';

type Props = {
  nodes:any[]; edges:any[]; frames?:any[];
};

export function FloatingLayersWidget({ nodes, edges, frames }: Props){
  const [open, setOpen] = React.useState(false);
  return (
    <div className="absolute top-4 right-4 z-50">
      {!open && (
        <button
          onClick={()=>setOpen(o=>!o)}
          className="flex items-center gap-2 bg-card border border-border rounded-full shadow-lg px-2 py-2 hover:shadow-xl transition-shadow select-none"
          title="Layers"
          data-testid="button-layers"
        >
          <ListTree size={16}/>
          <span className="text-sm font-medium">Layers</span>
        </button>
      )}
      {open && (
        <div className="mt-2 w-[380px] h-[560px] rounded-xl shadow-2xl border border-border bg-white dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><ListTree size={16}/> Layers</div>
            <button 
              className="text-xs opacity-70 hover:opacity-100 text-gray-700 dark:text-gray-300" 
              onClick={()=>setOpen(false)}
              data-testid="button-close-layers"
            >
              Close
            </button>
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