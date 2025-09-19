import React from "react";
import { Slider } from "@/components/ui/slider";

// Updated color swatches as requested: Red Orange Yellow Green Teal Blue Purple Violet White Grey Black
const vividSwatches = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#A855F7", "#FFFFFF", "#64748B", "#000000"
];
const pastelSwatches = [
  "#FCA5A5", "#FDBA74", "#FDE047", "#86EFAC", "#67E8F9", "#93C5FD", "#C4B5FD", "#D8B4FE", "#F8FAFC", "#CBD5E1", "#374151"
];

export interface FillStrokeColorPickerProps {
  fillColor?: string;
  fillOpacity?: number;
  onFillColorChange?: (hex: string) => void;
  onFillOpacityChange?: (value: number) => void;
  strokeColor?: string;
  strokeOpacity?: number;
  onStrokeColorChange?: (hex: string) => void;
  onStrokeOpacityChange?: (value: number) => void;
  className?: string;
  testIdScope?: string;
}

export default function FillStrokeColorPicker({
  fillColor = "#3b82f6",
  fillOpacity = 100,
  onFillColorChange,
  onFillOpacityChange,
  strokeColor = "#1e40af",
  strokeOpacity = 100,
  onStrokeColorChange,
  onStrokeOpacityChange,
  className,
  testIdScope
}: FillStrokeColorPickerProps) {

  const ColorSwatchRow = ({ 
    label, 
    color, 
    opacity, 
    onColorChange, 
    onOpacityChange,
    testId 
  }: {
    label: string;
    color: string;
    opacity: number;
    onColorChange?: (color: string) => void;
    onOpacityChange?: (opacity: number) => void;
    testId?: string;
  }) => (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {/* Vivid colors row */}
      <div className="grid grid-cols-11 gap-1.5">
        {vividSwatches.map((sw) => (
          <button 
            key={`${label}-vivid-${sw}`}
            className={`w-6 h-6 rounded-full border border-border ${color === sw ? 'ring-2 ring-blue-500' : ''}`}
            style={{ backgroundColor: sw }} 
            onClick={() => onColorChange?.(sw)} 
            aria-label={`${label} swatch ${sw}`} 
            data-testid={testId ? `${testId}-vivid-${sw}` : undefined}
          />
        ))}
      </div>
      {/* Pastel colors row */}
      <div className="grid grid-cols-11 gap-1.5">
        {pastelSwatches.map((sw) => (
          <button 
            key={`${label}-pastel-${sw}`}
            className={`w-6 h-6 rounded-full border border-border ${color === sw ? 'ring-2 ring-blue-500' : ''}`}
            style={{ backgroundColor: sw }} 
            onClick={() => onColorChange?.(sw)} 
            aria-label={`${label} swatch ${sw}`} 
            data-testid={testId ? `${testId}-pastel-${sw}` : undefined}
          />
        ))}
      </div>
      {/* Opacity slider */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span>Opacity</span>
          <span>{opacity}%</span>
        </div>
        <Slider 
          value={[opacity]} 
          onValueChange={(val) => onOpacityChange?.(val[0])} 
          max={100} 
          step={1} 
          data-testid={testId ? `${testId}-opacity` : undefined}
        />
      </div>
    </div>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <ColorSwatchRow
        label="Fill"
        color={fillColor}
        opacity={fillOpacity}
        onColorChange={onFillColorChange}
        onOpacityChange={onFillOpacityChange}
        testId={testIdScope ? `${testIdScope}-fill` : 'fill'}
      />
      
      <ColorSwatchRow
        label="Stroke"
        color={strokeColor}
        opacity={strokeOpacity}
        onColorChange={onStrokeColorChange}
        onOpacityChange={onStrokeOpacityChange}
        testId={testIdScope ? `${testIdScope}-stroke` : 'stroke'}
      />
    </div>
  );
}