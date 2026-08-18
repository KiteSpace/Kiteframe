import React, { useState } from 'react';
import { Pen, Eraser, Undo2, Redo2, Check } from 'lucide-react';

export function TopBar() {
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen');
  const [size, setSize] = useState(15);
  const [opacity, setOpacity] = useState(80);

  return (
    <div className="w-full h-[820px] bg-[#0f0f12] relative overflow-hidden flex flex-col font-sans text-white">
      {/* Dot Grid Background */}
      <div className="absolute inset-0 pointer-events-none" style={{
         backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.05) 1px, transparent 1px)',
         backgroundSize: '24px 24px'
      }} />

      {/* Top Bar Overlay */}
      <div className="h-14 bg-[#1a1a24] border-b border-white/10 flex items-center px-4 shrink-0 relative z-10 shadow-sm">
        {/* Sketch Badge */}
        <div className="flex items-center gap-2 mr-6">
          <span className="bg-[#4f46e5]/15 text-[#818cf8] px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 border border-[#4f46e5]/30">
            ✏️ Sketch
          </span>
        </div>

        {/* Tools */}
        <div className="flex items-center bg-black/30 rounded-lg p-1 border border-white/5 mr-6 shadow-inner">
          <button
            className={`p-1.5 rounded-md flex items-center justify-center transition-all ${activeTool === 'pen' ? 'bg-[#4f46e5] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
            onClick={() => setActiveTool('pen')}
          >
            <Pen className="w-4 h-4" />
          </button>
          <button
            className={`p-1.5 rounded-md flex items-center justify-center transition-all ${activeTool === 'eraser' ? 'bg-[#4f46e5] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
            onClick={() => setActiveTool('eraser')}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Color Swatch */}
        <div className="flex items-center gap-2 mr-6">
          <button className="w-7 h-7 rounded-full bg-[#8b5cf6] ring-2 ring-[#8b5cf6]/40 ring-offset-2 ring-offset-[#1a1a24] transition-all hover:scale-105" />
        </div>

        <div className="w-[1px] h-6 bg-white/10 mr-6" />

        {/* Size Slider */}
        <div className="flex items-center gap-3 mr-8 w-48 group">
          <span className="text-xs text-zinc-400 font-medium">Size</span>
          <div className="flex-1 relative flex items-center h-4 cursor-pointer">
            <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="absolute h-full bg-[#8b5cf6]" style={{ width: `${size}%` }} />
            </div>
            <div className="absolute w-3 h-3 bg-white rounded-full shadow-sm" style={{ left: `calc(${size}% - 6px)` }} />
            <input type="range" min="1" max="100" value={size} onChange={(e) => setSize(Number(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer" />
          </div>
          <div className="w-5 h-5 flex items-center justify-center bg-black/20 rounded-full border border-white/5">
            <div className="rounded-full bg-[#8b5cf6]" style={{ width: `${Math.max(2, size / 5)}px`, height: `${Math.max(2, size / 5)}px` }} />
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="flex items-center gap-3 w-44 mr-4 group">
          <span className="text-xs text-zinc-400 font-medium">Opacity</span>
          <div className="flex-1 relative flex items-center h-4 cursor-pointer">
            <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="absolute h-full bg-[#8b5cf6]" style={{ width: `${opacity}%` }} />
            </div>
            <div className="absolute w-3 h-3 bg-white rounded-full shadow-sm" style={{ left: `calc(${opacity}% - 6px)` }} />
            <input type="range" min="0" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer" />
          </div>
          <span className="text-xs text-zinc-400 w-8 text-right font-mono">{opacity}%</span>
        </div>

        <div className="w-[1px] h-6 bg-white/10 mx-4" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 mx-2">
          <button className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors">
            <Undo2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md transition-colors opacity-50 cursor-not-allowed">
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1" />

        {/* Done Button */}
        <button className="bg-white hover:bg-zinc-200 text-black text-sm font-medium px-4 h-8 rounded-md transition-colors shadow-sm">
          Done
        </button>
      </div>
      
      {/* Rest of the scene below */}
      <div className="flex-1 relative w-full h-full">
         {/* Dummy Nodes */}
         <div className="absolute top-24 left-32 w-48 h-32 bg-zinc-800/30 border border-zinc-700/40 rounded-xl pointer-events-none flex flex-col p-3 gap-2">
            <div className="w-20 h-3 bg-zinc-700/50 rounded-full" />
            <div className="w-full h-2 bg-zinc-700/30 rounded-full mt-2" />
            <div className="w-4/5 h-2 bg-zinc-700/30 rounded-full" />
         </div>
         <div className="absolute top-52 left-96 w-56 h-40 bg-zinc-800/30 border border-zinc-700/40 rounded-xl pointer-events-none flex flex-col p-3 gap-2">
            <div className="w-24 h-3 bg-zinc-700/50 rounded-full" />
            <div className="w-full h-16 bg-zinc-700/20 rounded-md mt-2" />
         </div>
         <div className="absolute top-32 right-64 w-40 h-24 bg-zinc-800/30 border border-zinc-700/40 rounded-xl pointer-events-none flex flex-col p-3 gap-2">
            <div className="w-16 h-3 bg-zinc-700/50 rounded-full" />
         </div>

         {/* SVG Strokes */}
         <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1280 766" preserveAspectRatio="none">
           <path d="M 220 180 Q 350 150 480 280 T 650 200" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
           <path d="M 450 380 C 500 480, 650 300, 750 350" fill="none" stroke="#8b5cf6" strokeWidth="8" strokeLinecap="round" opacity="0.8" />
           <path d="M 800 250 C 850 200, 900 300, 950 250" fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
         </svg>
      </div>
    </div>
  );
}
