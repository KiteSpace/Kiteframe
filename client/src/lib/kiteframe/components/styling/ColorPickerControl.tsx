import React from 'react';
import { colorPresets } from '../../utils/colorUtils';

interface ColorPickerControlProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  showPresets?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

export const ColorPickerControl: React.FC<ColorPickerControlProps> = ({
  label,
  value,
  onChange,
  presets = colorPresets.primary,
  showPresets = true,
  disabled = false,
  'data-testid': testId
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium">{label}</label>
      
      {/* Color picker and text input */}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-8 h-8 border border-border rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          data-testid={testId ? `${testId}-color-picker` : undefined}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 p-1 text-xs border border-border rounded bg-background disabled:opacity-50"
          placeholder="#000000"
          data-testid={testId ? `${testId}-text-input` : undefined}
        />
      </div>

      {/* Preset colors */}
      {showPresets && (
        <div className="flex flex-wrap gap-1">
          {presets.map((color, index) => (
            <button
              key={color}
              onClick={() => onChange(color)}
              disabled={disabled}
              className="w-6 h-6 border border-border rounded cursor-pointer hover:scale-110 transition-transform disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              style={{ backgroundColor: color }}
              title={color}
              data-testid={testId ? `${testId}-preset-${index}` : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};