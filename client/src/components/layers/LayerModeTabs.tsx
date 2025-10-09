export type LayerMode = 'structure'|'topology'|'spatial'|'links';
export function LayerModeTabs({mode,setMode}:{mode:LayerMode,setMode:(m:LayerMode)=>void}){
  const tabs:LayerMode[]=['structure','topology','spatial','links'];
  return <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60">
    {tabs.map(t=>
      <button key={t}
        className={`px-2 py-1 rounded text-sm ${mode===t?'bg-slate-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100':'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        onClick={()=>setMode(t)}>{t[0].toUpperCase()+t.slice(1)}</button>
    )}
  </div>;
}