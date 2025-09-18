import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Palette } from 'lucide-react';
import FigmaStyleColorPicker from '@/components/FigmaStyleColorPicker';

export interface ColorProperty {
  key: string;
  label: string;
  value: string;
  opacity?: number;
  hasOpacity: boolean;
  type: 'fill' | 'stroke';
}

export interface TabbedColorPickerProps {
  colorProperties: ColorProperty[];
  onColorChange: (propertyKey: string, color: string) => void;
  onOpacityChange: (propertyKey: string, opacity: number) => void;
  className?: string;
  testIdScope?: string;
}

export function TabbedColorPicker({
  colorProperties,
  onColorChange,
  onOpacityChange,
  className,
  testIdScope
}: TabbedColorPickerProps) {
  const [activeTab, setActiveTab] = useState<string>(colorProperties[0]?.key || '');

  // Reset active tab when colorProperties change (e.g., selecting different node types)
  useEffect(() => {
    const firstPropertyKey = colorProperties[0]?.key;
    if (firstPropertyKey && !colorProperties.find(prop => prop.key === activeTab)) {
      setActiveTab(firstPropertyKey);
    }
  }, [colorProperties, activeTab]);

  // Find the currently active color property
  const activeProperty = colorProperties.find(prop => prop.key === activeTab) || colorProperties[0];
  
  if (!activeProperty) {
    return null;
  }

  const handleColorChange = (color: string) => {
    onColorChange(activeProperty.key, color);
  };

  const handleOpacityChange = (opacity: number) => {
    if (activeProperty.hasOpacity) {
      onOpacityChange(activeProperty.key, opacity);
    }
  };

  return (
    <div className={`space-y-3 ${className || ''}`} data-testid={testIdScope ? `${testIdScope}-tabbed-picker` : undefined}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4" />
        <span className="text-xs font-semibold">Node Colors</span>
      </div>
      
      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {colorProperties.map((property) => (
          <Button
            key={property.key}
            variant={activeTab === property.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(property.key)}
            className="h-7 px-2 text-xs"
            data-testid={testIdScope ? `${testIdScope}-tab-${property.key}` : undefined}
          >
            <div 
              className="w-3 h-3 rounded-sm border border-white/30 mr-1.5" 
              style={{ backgroundColor: property.value }}
            />
            {property.label}
          </Button>
        ))}
      </div>

      <Separator />

      {/* Single Color Picker */}
      <FigmaStyleColorPicker
        label={activeProperty.label}
        showFill={activeProperty.type === 'fill'}
        showStroke={activeProperty.type === 'stroke'}
        fillColor={activeProperty.type === 'fill' ? activeProperty.value : undefined}
        fillOpacity={activeProperty.type === 'fill' ? (activeProperty.opacity || 100) : 100}
        onFillColorChange={activeProperty.type === 'fill' ? handleColorChange : undefined}
        onFillOpacityChange={activeProperty.type === 'fill' ? (activeProperty.hasOpacity ? handleOpacityChange : () => {}) : undefined}
        strokeColor={activeProperty.type === 'stroke' ? activeProperty.value : undefined}
        strokeOpacity={activeProperty.type === 'stroke' ? (activeProperty.opacity || 100) : 100}
        onStrokeColorChange={activeProperty.type === 'stroke' ? handleColorChange : undefined}
        onStrokeOpacityChange={activeProperty.type === 'stroke' ? (activeProperty.hasOpacity ? handleOpacityChange : () => {}) : undefined}
        testIdScope={testIdScope ? `${testIdScope}-${activeProperty.key}` : undefined}
      />
    </div>
  );
}