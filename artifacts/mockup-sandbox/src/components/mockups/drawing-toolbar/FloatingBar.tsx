import React, { useState } from 'react';
import { Pen, Eraser, Undo2, Redo2, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';

export function FloatingBar() {
  const [tool, setTool] = useState('pen');
  const [size, setSize] = useState([4]);
  const [opacity, setOpacity] = useState([100]);
  const activeColor = '#ff7b72'; // Coral orange

  return (
    <div className="relative w-full h-[820px] max-w-[1280px] bg-[#0f0f12] overflow-hidden text-white font-sans selection:bg-white/20">
      {/* Background Dot Grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Dimmed Nodes / Inert Shapes */}
      <div className="absolute top-[20%] left-[15%] w-[240px] h-[120px] bg-[#1c1c21]/50 border border-white/5 rounded-xl pointer-events-none" />
      <div className="absolute top-[35%] left-[45%] w-[200px] h-[160px] bg-[#1c1c21]/50 border border-white/5 rounded-xl pointer-events-none" />
      <div className="absolute top-[60%] left-[25%] w-[280px] h-[100px] bg-[#1c1c21]/50 border border-white/5 rounded-xl pointer-events-none" />
      <div className="absolute top-[25%] right-[15%] w-[220px] h-[180px] bg-[#1c1c21]/50 border border-white/5 rounded-xl pointer-events-none" />

      {/* Freehand Strokes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1280 820">
        <path 
          d="M 200,400 Q 250,300 350,350 T 500,250" 
          fill="none" 
          stroke={activeColor} 
          strokeWidth="6" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="opacity-90"
        />
        <path 
          d="M 600,500 Q 650,600 750,550 T 900,450 Q 950,400 1000,500" 
          fill="none" 
          stroke={activeColor} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="opacity-70"
        />
        <path 
          d="M 300,600 Q 320,550 400,650" 
          fill="none" 
          stroke="#4d4d56" 
          strokeWidth="12" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="opacity-40"
        />
      </svg>

      {/* Sketch Layer Badge */}
      <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-[#1e1e26]/80 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
        <span className="text-sm">✏️</span>
        <span className="text-sm font-medium tracking-wide text-white/90">Sketch</span>
      </div>

      {/* Floating Toolbar Pill */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-3 bg-[#1e1e26]/80 backdrop-blur-md border border-white/10 rounded-full shadow-2xl">
        
        {/* Tool Toggle */}
        <ToggleGroup type="single" value={tool} onValueChange={(v) => v && setTool(v)} className="bg-black/20 p-1 rounded-full border border-white/5">
          <ToggleGroupItem 
            value="pen" 
            aria-label="Toggle pen"
            className="rounded-full w-10 h-10 data-[state=on]:bg-[#2a2a35] data-[state=on]:text-white text-white/50 hover:text-white/80 transition-colors"
          >
            <Pen className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="eraser" 
            aria-label="Toggle eraser"
            className="rounded-full w-10 h-10 data-[state=on]:bg-[#2a2a35] data-[state=on]:text-white text-white/50 hover:text-white/80 transition-colors"
          >
            <Eraser className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="w-px h-8 bg-white/10" />

        {/* Color Swatch */}
        <div className="flex items-center">
          <button 
            className="w-7 h-7 rounded-full outline-none ring-2 ring-offset-2 ring-offset-[#1e1e26] transition-all"
            style={{ 
              backgroundColor: activeColor,
              ringColor: activeColor 
            }}
          />
        </div>

        <div className="w-px h-8 bg-white/10" />

        {/* Sliders Container */}
        <div className="flex items-center gap-6">
          {/* Thickness Slider */}
          <div className="flex items-center gap-3 w-32">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider w-8">Size</span>
            <Slider 
              value={size} 
              onValueChange={setSize} 
              max={24} 
              step={1} 
              className="flex-1 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-white/30 [&_.bg-secondary]:bg-white/10" 
            />
            <div className="w-3 h-3 flex items-center justify-center">
              <div className="rounded-full bg-white" style={{ width: `${Math.max(2, size[0] / 2)}px`, height: `${Math.max(2, size[0] / 2)}px` }} />
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="flex items-center gap-3 w-32">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider w-[52px]">Opacity</span>
            <Slider 
              value={opacity} 
              onValueChange={setOpacity} 
              max={100} 
              step={1} 
              className="flex-1 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-white/30 [&_.bg-secondary]:bg-white/10" 
            />
          </div>
        </div>

        <div className="w-px h-8 bg-white/10" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-white/50 hover:text-white hover:bg-white/5">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-white/30 hover:text-white/50 hover:bg-white/5" disabled>
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="w-px h-8 bg-white/10" />

        {/* Exit */}
        <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-white/50 hover:text-white hover:bg-[#ff5555]/20 hover:text-[#ff5555]">
          <X className="w-5 h-5" />
        </Button>

      </div>
    </div>
  );
}
