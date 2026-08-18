import React, { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Palette, Droplet, Square } from "lucide-react";

// Updated color swatches as requested: Red Orange Yellow Green Teal Blue Purple Violet White Grey Black
const vividSwatches = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#A855F7",
  "#FFFFFF",
  "#64748B",
  "#000000",
];
const pastelSwatches = [
  "#FCA5A5",
  "#FDBA74",
  "#FDE047",
  "#86EFAC",
  "#67E8F9",
  "#93C5FD",
  "#C4B5FD",
  "#D8B4FE",
  "#F8FAFC",
  "#CBD5E1",
  "#374151",
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export interface FigmaStyleColorPickerProps {
  label?: string;
  showFill?: boolean;
  showStroke?: boolean;
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

export default function FigmaStyleColorPicker({
  label = "Colors",
  showFill = true,
  showStroke = false,
  fillColor = "#0D9488",
  fillOpacity = 100,
  onFillColorChange,
  onFillOpacityChange,
  strokeColor = "#111827",
  strokeOpacity = 100,
  onStrokeColorChange,
  onStrokeOpacityChange,
  className,
  testIdScope,
}: FigmaStyleColorPickerProps) {
  // Controlled-only dev warnings
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      if (showFill) {
        if (typeof fillColor !== "string")
          console.warn(
            "[FigmaStyleColorPicker] fillColor must be a string HEX",
          );
        if (typeof fillOpacity !== "number")
          console.warn(
            "[FigmaStyleColorPicker] fillOpacity must be a number 0–100",
          );
        if (!onFillColorChange)
          console.warn(
            "[FigmaStyleColorPicker] onFillColorChange is required when showFill=true",
          );
        if (!onFillOpacityChange)
          console.warn(
            "[FigmaStyleColorPicker] onFillOpacityChange is required when showFill=true",
          );
      }
      if (showStroke) {
        if (typeof strokeColor !== "string")
          console.warn(
            "[FigmaStyleColorPicker] strokeColor must be a string HEX",
          );
        if (typeof strokeOpacity !== "number")
          console.warn(
            "[FigmaStyleColorPicker] strokeOpacity must be a number 0–100",
          );
        if (!onStrokeColorChange)
          console.warn(
            "[FigmaStyleColorPicker] onStrokeColorChange is required when showStroke=true",
          );
        if (!onStrokeOpacityChange)
          console.warn(
            "[FigmaStyleColorPicker] onStrokeOpacityChange is required when showStroke=true",
          );
      }
    }
  }, [
    showFill,
    fillColor,
    fillOpacity,
    onFillColorChange,
    onFillOpacityChange,
    showStroke,
    strokeColor,
    strokeOpacity,
    onStrokeColorChange,
    onStrokeOpacityChange,
  ]);

  const [target, setTarget] = useState<"fill" | "stroke">(
    showFill ? "fill" : "stroke",
  );

  const normalizeHex = (hex: string) => {
    if (!hex) return "#000000";
    const v = String(hex).trim();
    const prefixed = v.startsWith("#") ? v : `#${v}`;
    const body = prefixed.slice(1);
    if (![3, 6].includes(body.length) || /[^0-9a-fA-F]/.test(body))
      return "#000000";
    return prefixed.toUpperCase();
  };

  const currentHex = normalizeHex(
    target === "fill" ? (fillColor ?? "#000000") : (strokeColor ?? "#000000"),
  );
  const setCurrentHex = (hex: string) => {
    const safe = normalizeHex(hex);
    if (target === "fill" && onFillColorChange) onFillColorChange(safe);
    if (target === "stroke" && onStrokeColorChange) onStrokeColorChange(safe);
  };

  const currentOpacity =
    target === "fill" ? (fillOpacity ?? 100) : (strokeOpacity ?? 100);
  const setCurrentOpacity = (val: number) => {
    const v = clamp(Number.isFinite(val) ? (val as number) : 100, 0, 100);
    if (target === "fill" && onFillOpacityChange) onFillOpacityChange(v);
    if (target === "stroke" && onStrokeOpacityChange) onStrokeOpacityChange(v);
  };

  return (
    <Card
      className={`shadow-sm rounded-xl ${className || ""}`}
      data-testid={testIdScope ? `${testIdScope}-picker` : undefined}
    >
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <span className="text-xs font-medium">{label}</span>
          </div>
          {/*<div className="flex gap-2">
            {showFill && (
              <Button
                size="sm"
                variant={target === "fill" ? "default" : "outline"}
                onClick={() => setTarget("fill")}
                className="h-7 px-2 gap-1"
              >
                <Droplet className="w-3 h-3" /> Fill
              </Button>
            )}
            {showStroke && (
              <Button
                size="sm"
                variant={target === "stroke" ? "default" : "outline"}
                onClick={() => setTarget("stroke")}
                className="h-7 px-2 gap-1"
              >
                <Square className="w-3 h-3" /> Stroke
              </Button>
            )}
          </div>*/}
        </div>

        {/* Color picker hidden as requested */}
        {/* <HexColorPicker color={currentHex} onChange={setCurrentHex} /> */}

        {/* Swatches - made circular as requested */}
        <div className="space-y-2">
          <div className="grid grid-cols-11 gap-1.5">
            {vividSwatches.map((sw) => (
              <button
                key={sw}
                className="w-6 h-6 rounded-full border border-border"
                style={{ backgroundColor: sw }}
                onClick={() => setCurrentHex(sw)}
                aria-label={`swatch ${sw}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-11 gap-1.5">
            {pastelSwatches.map((sw) => (
              <button
                key={sw}
                className="w-6 h-6 rounded-full border border-border"
                style={{ backgroundColor: sw }}
                onClick={() => setCurrentHex(sw)}
                aria-label={`swatch ${sw}`}
              />
            ))}
          </div>
        </div>

        {/*<div className="space-y-3">*/}
        {/* Hide hex input as requested */}
        {/* <div className="flex items-center gap-2">
            <Input value={currentHex} onChange={(e) => setCurrentHex(e.target.value)} className="font-mono h-8" />
            <span className="text-[10px] text-muted-foreground">HEX</span>
          </div> */}
        {/*<div>
            <div className="flex justify-between text-xs mb-1"><span>Opacity ({target})</span><span>{currentOpacity}%</span></div>
            <Slider value={[currentOpacity]} onValueChange={(val) => setCurrentOpacity(val[0])} max={100} step={1} />
          </div>
        </div>*/}
      </CardContent>
    </Card>
  );
}
