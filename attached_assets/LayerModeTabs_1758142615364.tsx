export type LayerMode = 'structure'|'topology'|'spatial'|'links';
export function LayerModeTabs({mode,setMode}:{mode:LayerMode,setMode:(m:LayerMode)=>void}){
  const tabs:LayerMode[]=['structure','topology','spatial','links'];
  return <div className="flex gap-1 p-2 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
    {tabs.map(t=>
      <button key={t}
        className={`px-2 py-1 rounded ${mode===t?'bg-slate-200 dark:bg-slate-700':''}`}
        onClick={()=>setMode(t)}>{t[0].toUpperCase()+t.slice(1)}</button>
    )}
  </div>;
}
