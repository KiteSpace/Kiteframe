import React, { useState } from "react";
import { Pen, Eraser, Undo2, Redo2, X } from "lucide-react";

export function SidePanel() {
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#8b5cf6");
  const [size, setSize] = useState(4);
  const [opacity, setOpacity] = useState(100);

  const colors = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#3b82f6",
    "#8b5cf6",
    "#ffffff",
  ];

  return (
    <div className="flex w-[1280px] h-[820px] bg-[#0f0f12] text-gray-100 font-sans overflow-hidden">
      {/* Left Panel */}
      <div className="w-[220px] h-full bg-[#16161e] border-r border-white/10 flex flex-col z-10 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-full text-xs font-medium text-white/90">
            <span>✏️</span> Sketch
          </div>
          <div className="flex items-center gap-0.5">
            <button className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors">
              <Undo2 size={16} />
            </button>
            <button className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors">
              <Redo2 size={16} />
            </button>
          </div>
        </div>

        {/* Tools */}
        <div className="p-4 space-y-8">
          {/* Pen / Eraser Toggle */}
          <div className="flex gap-1 p-1 bg-black/40 rounded-lg border border-white/5 shadow-inner">
            <button
              onClick={() => setTool("pen")}
              className={`flex-1 py-2.5 rounded flex justify-center items-center transition-all ${
                tool === "pen"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
              }`}
              style={tool === "pen" ? { backgroundColor: color, color: color === "#ffffff" ? "#000" : "#fff" } : {}}
            >
              <Pen size={20} />
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`flex-1 py-2.5 rounded flex justify-center items-center transition-all ${
                tool === "eraser"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Eraser size={20} />
            </button>
          </div>

          {/* Colors */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
              Color
            </label>
            <div className="flex flex-wrap gap-2.5">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    color === c
                      ? "scale-110 ring-2 ring-offset-2 ring-offset-[#16161e] ring-white"
                      : "scale-100 ring-1 ring-white/10 hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                Size
              </label>
              <span className="text-xs text-white/50 font-medium">{size}px</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="40"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="w-6 flex justify-center">
                <div
                  className="rounded-full bg-white transition-all duration-75"
                  style={{
                    width: `${Math.max(4, size / 1.5)}px`,
                    height: `${Math.max(4, size / 1.5)}px`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                Opacity
              </label>
              <span className="text-xs text-white/50 font-medium">{opacity}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto p-4 border-t border-white/5">
          <button className="w-full py-2 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/90 rounded-md text-sm font-medium transition-colors border border-white/10">
            <X size={16} />
            Done
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        className="flex-1 relative cursor-crosshair"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* Dimmed Nodes */}
        <div className="absolute top-[140px] left-[200px] w-[260px] h-[160px] bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-center backdrop-blur-[2px]">
          <div className="text-white/10 font-semibold text-sm tracking-wide">
            DATA SOURCE
          </div>
        </div>
        <div className="absolute top-[240px] left-[600px] w-[320px] h-[220px] bg-white/[0.02] border border-white/5 rounded-xl flex flex-col p-6 gap-4 backdrop-blur-[2px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.03]" />
            <div className="flex-1 h-3 rounded bg-white/[0.03]" />
          </div>
          <div className="w-full h-2 rounded bg-white/[0.03] mt-2" />
          <div className="w-3/4 h-2 rounded bg-white/[0.03]" />
          <div className="w-5/6 h-2 rounded bg-white/[0.03]" />
        </div>
        <div className="absolute top-[540px] left-[320px] w-[220px] h-[140px] bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-center backdrop-blur-[2px]">
          <div className="text-white/10 font-semibold text-sm tracking-wide">
            FILTER NODE
          </div>
        </div>

        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <path
            d="M 460 220 C 530 220, 530 350, 600 350"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="2"
          />
          <path
            d="M 330 300 C 330 420, 430 420, 430 540"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="2"
          />
        </svg>

        {/* Sketch Layer (Pen Strokes) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-lg">
          {/* Arrow pointing at data source */}
          <path
            d="M 480 120 Q 420 80, 360 110 T 300 130"
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="4"
            strokeLinecap="round"
            className="opacity-90"
          />
          <path
            d="M 320 115 L 300 130 L 325 145"
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-90"
          />

          {/* Circle around the middle node */}
          <path
            d="M 580 350 C 580 200, 940 200, 940 350 C 940 500, 580 500, 580 350"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="6"
            strokeLinecap="round"
            className="opacity-80"
          />

          {/* Squiggle near bottom */}
          <path
            d="M 680 550 Q 720 500, 760 560 T 840 540"
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-70"
          />
        </svg>

        {/* Tool cursor indicator */}
        <div
          className="absolute top-[540px] left-[840px] rounded-full border-2 border-white/40 shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all"
          style={{ width: "20px", height: "20px" }}
        >
          <div className="w-1 h-1 bg-[#8b5cf6] rounded-full" />
        </div>
      </div>
    </div>
  );
}
