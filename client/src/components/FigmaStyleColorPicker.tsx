import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { colorPresets } from '@/lib/kiteframe/utils/colorUtils';

interface FigmaStyleColorPickerProps {
  fillColor?: string;
  strokeColor?: string;
  onFillColorChange?: (color: string) => void;
  onStrokeColorChange?: (color: string) => void;
  showFill?: boolean;
  showStroke?: boolean;
  label?: string;
  testIdScope?: string;
  className?: string;
}

// Shared recent colors across all instances
let globalRecentColors: string[] = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'
];

const validateHexColor = (color: string): string => {
  // Remove # if present and convert to lowercase
  let hex = color.replace('#', '').toLowerCase();
  
  // Handle 3-character hex codes
  if (hex.length === 3 && /^[0-9a-f]{3}$/.test(hex)) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // Validate 6-character hex codes
  if (hex.length === 6 && /^[0-9a-f]{6}$/.test(hex)) {
    return '#' + hex;
  }
  
  // Return unchanged if invalid (let browser handle)
  return color;
};

export const FigmaStyleColorPicker: React.FC<FigmaStyleColorPickerProps> = ({
  fillColor = '#3b82f6',
  strokeColor = '#1e40af',
  onFillColorChange,
  onStrokeColorChange,
  showFill = true,
  showStroke = true,
  label,
  testIdScope = 'color-picker',
  className = ''
}) => {
  const [recentColors, setRecentColors] = useState<string[]>(globalRecentColors);

  const addToRecentColors = (color: string) => {
    const validColor = validateHexColor(color);
    const filtered = globalRecentColors.filter(c => c !== validColor);
    globalRecentColors = [validColor, ...filtered].slice(0, 6);
    setRecentColors([...globalRecentColors]);
  };

  const handleFillColorChange = (color: string) => {
    const validColor = validateHexColor(color);
    onFillColorChange?.(validColor);
    addToRecentColors(validColor);
  };

  const handleStrokeColorChange = (color: string) => {
    const validColor = validateHexColor(color);
    onStrokeColorChange?.(validColor);
    addToRecentColors(validColor);
  };

  const ColorSection = ({ 
    sectionLabel, 
    value, 
    onChange,
    testIdPrefix 
  }: { 
    sectionLabel: string; 
    value: string; 
    onChange: (color: string) => void;
    testIdPrefix: string;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{sectionLabel}</Label>
        <div className="flex items-center gap-2">
          {/* Color preview and picker */}
          <div className="relative">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-6 h-6 rounded border border-border cursor-pointer opacity-0 absolute inset-0"
              data-testid={`${testIdScope}-${testIdPrefix}-color-picker`}
            />
            <div 
              className="w-6 h-6 rounded border border-border cursor-pointer"
              style={{ backgroundColor: value }}
              title={`Click to change ${sectionLabel.toLowerCase()}`}
            />
          </div>
          
          {/* Hex input */}
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(validateHexColor(e.target.value))}
            className="w-20 h-6 px-2 text-xs"
            placeholder="#000000"
            data-testid={`${testIdScope}-${testIdPrefix}-hex-input`}
          />
        </div>
      </div>

      {/* Preset Colors */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Presets</Label>
        <div className="grid grid-cols-6 gap-1">
          {colorPresets.primary.concat(
            colorPresets.success, 
            colorPresets.warning, 
            colorPresets.danger
          ).slice(0, 12).map((color, index) => (
            <button
              key={color}
              onClick={() => onChange(color)}
              className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={color}
              data-testid={`${testIdScope}-${testIdPrefix}-preset-${index}`}
            />
          ))}
        </div>
      </div>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Recent</Label>
          <div className="flex gap-1">
            {recentColors.map((color, index) => (
              <button
                key={`${color}-${index}`}
                onClick={() => onChange(color)}
                className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
                data-testid={`${testIdScope}-${testIdPrefix}-recent-${index}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // If only one type is shown, render directly without tabs
  if ((showFill && !showStroke) || (!showFill && showStroke)) {
    const singleType = showFill ? {
      sectionLabel: label || 'Fill',
      value: fillColor,
      onChange: handleFillColorChange,
      testIdPrefix: 'fill'
    } : {
      sectionLabel: label || 'Stroke',
      value: strokeColor,
      onChange: handleStrokeColorChange,
      testIdPrefix: 'stroke'
    };

    return (
      <div className={`space-y-3 ${className}`} data-testid={`${testIdScope}-figma-color-picker`}>
        <ColorSection {...singleType} />
      </div>
    );
  }

  // Render with Fill/Stroke tabs when both are shown
  return (
    <div className={`space-y-3 ${className}`} data-testid={`${testIdScope}-figma-color-picker`}>
      {label && (
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      )}
      <Tabs defaultValue="fill" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="fill" className="text-xs" data-testid={`${testIdScope}-fill-tab`}>
            Fill
          </TabsTrigger>
          <TabsTrigger value="stroke" className="text-xs" data-testid={`${testIdScope}-stroke-tab`}>
            Stroke
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="fill" className="mt-3">
          <ColorSection
            sectionLabel="Fill Color"
            value={fillColor}
            onChange={handleFillColorChange}
            testIdPrefix="fill"
          />
        </TabsContent>
        
        <TabsContent value="stroke" className="mt-3">
          <ColorSection
            sectionLabel="Stroke Color"
            value={strokeColor}
            onChange={handleStrokeColorChange}
            testIdPrefix="stroke"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};