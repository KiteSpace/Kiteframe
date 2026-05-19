import { useRef, useState } from 'react';
import { Pen, Eraser, Undo2, Redo2, X, Trash2, Minus } from 'lucide-react';

const PRESET_COLORS = [
  '#ff6b6b', '#ff9f43', '#ffd32a', '#0be881', '#48dbfb',
  '#54a0ff', '#a29bfe', '#fd79a8', '#ffffff', '#636e72',
];

interface SketchFloatingBarProps {
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  opacity: number;
  lineStyle: 'solid' | 'dashed';
  dashLen: number;
  dashGap: number;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: 'pen' | 'eraser') => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onOpacityChange: (opacity: number) => void;
  onLineStyleChange: (style: 'solid' | 'dashed') => void;
  onDashLenChange: (len: number) => void;
  onDashGapChange: (gap: number) => void;
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
  lineStyle,
  dashLen,
  dashGap,
  canUndo,
  canRedo,
  onToolChange,
  onColorChange,
  onSizeChange,
  onOpacityChange,
  onLineStyleChange,
  onDashLenChange,
  onDashGapChange,
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
      <div className="pointer-events-auto flex items-center gap-1 px-3 py-2 rounded-full shadow-2xl border border-border bg-background/95 backdrop-blur-md text-foreground">

        {/* Tool toggle — Pen */}
        <button
          title="Pen"
          onClick={() => onToolChange('pen')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            tool === 'pen' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Pen size={15} />
        </button>

        {/* Tool toggle — Eraser */}
        <button
          title="Eraser"
          onClick={() => onToolChange('eraser')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            tool === 'eraser' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Eraser size={15} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Color swatch */}
        <div className="relative">
          <button
            title="Pick color"
            onClick={() => setShowColorPicker((v) => !v)}
            className="w-7 h-7 rounded-full border-2 border-border shadow-inner transition-transform hover:scale-110 active:scale-95"
            style={{ background: color }}
          />

          {showColorPicker && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-background border border-border rounded-xl p-3 shadow-2xl min-w-[160px]">
              {/* Preset swatches */}
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                    onClick={() => { onColorChange(c); setShowColorPicker(false); }}
                  />
                ))}
              </div>
              {/* Custom color */}
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 hover:bg-accent rounded-lg transition-colors"
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

        <div className="w-px h-5 bg-border mx-1" />

        {/* Line style toggle */}
        <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
          <button
            title="Solid line"
            onClick={() => onLineStyleChange('solid')}
            className={`h-6 px-2 rounded-full text-[10px] font-medium transition-colors flex items-center gap-1 ${
              lineStyle === 'solid'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Minus size={11} />
            <span>Solid</span>
          </button>
          <button
            title="Dashed line"
            onClick={() => onLineStyleChange('dashed')}
            className={`h-6 px-2 rounded-full text-[10px] font-medium transition-colors flex items-center gap-1 ${
              lineStyle === 'dashed'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="text-[10px] tracking-[3px] leading-none">---</span>
            <span>Dash</span>
          </button>
        </div>

        {/* Dash controls — only when dashed */}
        {lineStyle === 'dashed' && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Dash</span>
              <input
                type="number"
                min={2}
                max={80}
                value={dashLen}
                onChange={(e) => onDashLenChange(Math.max(2, Math.min(80, Number(e.target.value))))}
                className="w-10 h-5 text-[10px] text-center border border-border rounded bg-background text-foreground"
              />
              <span className="text-[10px] text-muted-foreground">Gap</span>
              <input
                type="number"
                min={1}
                max={80}
                value={dashGap}
                onChange={(e) => onDashGapChange(Math.max(1, Math.min(80, Number(e.target.value))))}
                className="w-10 h-5 text-[10px] text-center border border-border rounded bg-background text-foreground"
              />
            </div>
          </>
        )}

        <div className="w-px h-5 bg-border mx-1" />

        {/* Size */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground w-7 text-right">Size</span>
          <input
            type="range"
            min={1}
            max={40}
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="w-20 h-1 accent-orange-400 cursor-pointer"
          />
          <span className="text-[11px] text-muted-foreground w-5">{size}</span>
        </div>

        {/* Opacity */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground w-10 text-right">Opacity</span>
          <input
            type="range"
            min={10}
            max={100}
            value={opacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="w-20 h-1 accent-orange-400 cursor-pointer"
          />
          <span className="text-[11px] text-muted-foreground w-7">{opacity}%</span>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Undo */}
        <button
          title="Undo stroke (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            canUndo ? 'text-muted-foreground hover:text-foreground hover:bg-accent' : 'text-muted-foreground/40 cursor-not-allowed'
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
            canRedo ? 'text-muted-foreground hover:text-foreground hover:bg-accent' : 'text-muted-foreground/40 cursor-not-allowed'
          }`}
        >
          <Redo2 size={15} />
        </button>

        {/* Clear */}
        <button
          title="Clear all sketches"
          onClick={onClear}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-red-500 hover:bg-accent transition-colors"
        >
          <Trash2 size={15} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Exit */}
        <button
          title="Exit sketch mode"
          onClick={onExit}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
