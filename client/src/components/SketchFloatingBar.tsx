import { useRef, useState } from 'react';
import { Pen, Eraser, Undo2, Redo2, X, Trash2 } from 'lucide-react';

const PRESET_COLORS = [
  '#ff6b6b', '#ff9f43', '#ffd32a', '#0be881', '#48dbfb',
  '#54a0ff', '#a29bfe', '#fd79a8', '#ffffff', '#636e72',
];

interface SketchFloatingBarProps {
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  opacity: number;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: 'pen' | 'eraser') => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onOpacityChange: (opacity: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExit: () => void;
}

export function SketchFloatingBar({
  tool,
  color,
  size,
  opacity,
  canUndo,
  canRedo,
  onToolChange,
  onColorChange,
  onSizeChange,
  onOpacityChange,
  onUndo,
  onRedo,
  onClear,
  onExit,
}: SketchFloatingBarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none select-none">
      {/* Sketch mode badge */}
      <div className="absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/90 text-white text-xs font-semibold shadow pointer-events-none">
        <Pen size={10} />
        <span>Sketch</span>
      </div>

      {/* Main pill */}
      <div className="pointer-events-auto flex items-center gap-1 px-3 py-2 rounded-full shadow-2xl border border-white/10 bg-[#1e1e26]/90 backdrop-blur-md text-white">

        {/* Tool toggle — Pen */}
        <button
          title="Pen"
          onClick={() => onToolChange('pen')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            tool === 'pen' ? 'bg-orange-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
        >
          <Pen size={15} />
        </button>

        {/* Tool toggle — Eraser */}
        <button
          title="Eraser"
          onClick={() => onToolChange('eraser')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            tool === 'eraser' ? 'bg-orange-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
        >
          <Eraser size={15} />
        </button>

        <div className="w-px h-5 bg-white/15 mx-1" />

        {/* Color swatch */}
        <div className="relative">
          <button
            title="Pick color"
            onClick={() => setShowColorPicker((v) => !v)}
            className="w-7 h-7 rounded-full border-2 border-white/30 shadow-inner transition-transform hover:scale-110 active:scale-95"
            style={{ background: color }}
          />

          {showColorPicker && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#2a2a35] border border-white/10 rounded-xl p-3 shadow-2xl min-w-[160px]">
              {/* Preset swatches */}
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                    onClick={() => { onColorChange(c); setShowColorPicker(false); }}
                  />
                ))}
              </div>
              {/* Custom color */}
              <button
                className="w-full text-xs text-white/50 hover:text-white/80 text-center py-1 hover:bg-white/5 rounded-lg transition-colors"
                onClick={() => colorInputRef.current?.click()}
              >
                Custom…
              </button>
              <input
                ref={colorInputRef}
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
              />
            </div>
          )}
        </div>

        {showColorPicker && (
          <div
            className="fixed inset-0 z-[59]"
            onClick={() => setShowColorPicker(false)}
          />
        )}

        <div className="w-px h-5 bg-white/15 mx-1" />

        {/* Size */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/40 w-7 text-right">Size</span>
          <input
            type="range"
            min={1}
            max={40}
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="w-20 h-1 accent-orange-400 cursor-pointer"
          />
          <span className="text-[11px] text-white/60 w-5">{size}</span>
        </div>

        {/* Opacity */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/40 w-10 text-right">Opacity</span>
          <input
            type="range"
            min={10}
            max={100}
            value={opacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="w-20 h-1 accent-orange-400 cursor-pointer"
          />
          <span className="text-[11px] text-white/60 w-7">{opacity}%</span>
        </div>

        <div className="w-px h-5 bg-white/15 mx-1" />

        {/* Undo */}
        <button
          title="Undo stroke (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            canUndo ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed'
          }`}
        >
          <Undo2 size={15} />
        </button>

        {/* Redo */}
        <button
          title="Redo stroke (Ctrl+Shift+Z)"
          onClick={onRedo}
          disabled={!canRedo}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            canRedo ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed'
          }`}
        >
          <Redo2 size={15} />
        </button>

        {/* Clear */}
        <button
          title="Clear all sketches"
          onClick={onClear}
          className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
        >
          <Trash2 size={15} />
        </button>

        <div className="w-px h-5 bg-white/15 mx-1" />

        {/* Exit */}
        <button
          title="Exit sketch mode"
          onClick={onExit}
          className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
