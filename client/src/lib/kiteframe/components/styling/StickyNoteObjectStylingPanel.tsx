import React from 'react';
import { ColorPickerControl } from './ColorPickerControl';
import { SliderControl } from './SliderControl';
import { DropdownControl } from './DropdownControl';
import { ToggleGroupControl } from './ToggleGroupControl';
import { colorPresets, getOptimalTextColor } from '../../utils/colorUtils';
import { StickyNoteData } from '../../types';
import { StickyNote, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface StickyNoteObjectStylingPanelProps {
  data: StickyNoteData;
  onUpdate: (updates: Partial<StickyNoteData>) => void;
}

export const StickyNoteObjectStylingPanel: React.FC<StickyNoteObjectStylingPanelProps> = ({
  data,
  onUpdate
}) => {
  const fontFamilyOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Helvetica', label: 'Helvetica' }
  ];

  const fontWeightOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'medium', label: 'Medium' },
    { value: 'semibold', label: 'Semibold' },
    { value: 'bold', label: 'Bold' }
  ];

  const textAlignOptions = [
    { value: 'left', label: 'Left', icon: <AlignLeft size={14} /> },
    { value: 'center', label: 'Center', icon: <AlignCenter size={14} /> },
    { value: 'right', label: 'Right', icon: <AlignRight size={14} /> }
  ];

  const borderStyleOptions = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' }
  ];

  // Handle background color change with automatic text color calculation
  const handleBackgroundColorChange = (backgroundColor: string) => {
    const updates: Partial<StickyNoteData> = { backgroundColor };
    
    // Auto-calculate text color based on luminance if enabled
    if (data.autoTextColor !== false) {
      updates.textColor = getOptimalTextColor(backgroundColor);
    }
    
    onUpdate(updates);
  };

  // Handle text color change and disable auto color calculation
  const handleTextColorChange = (textColor: string) => {
    onUpdate({ 
      textColor, 
      autoTextColor: false // Disable auto-calculation when manually set
    });
  };

  // Toggle auto text color calculation
  const toggleAutoTextColor = () => {
    const autoTextColor = !data.autoTextColor;
    const updates: Partial<StickyNoteData> = { autoTextColor };
    
    if (autoTextColor) {
      updates.textColor = getOptimalTextColor(data.backgroundColor);
    }
    
    onUpdate(updates);
  };

  return (
    <div className="space-y-4 p-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <StickyNote size={16} />
        Sticky Note Styling
      </h4>

      {/* Typography Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Typography</h5>
        
        <DropdownControl
          label="Font Family"
          value={data.fontFamily || 'Inter'}
          options={fontFamilyOptions}
          onChange={(value) => onUpdate({ fontFamily: value as any })}
          data-testid="sticky-font-family"
        />

        <SliderControl
          label="Font Size"
          value={data.fontSize || 14}
          onChange={(value) => onUpdate({ fontSize: value })}
          min={8}
          max={24}
          unit="px"
          data-testid="sticky-font-size"
        />

        <DropdownControl
          label="Font Weight"
          value={data.fontWeight || 'normal'}
          options={fontWeightOptions}
          onChange={(value) => onUpdate({ fontWeight: value as any })}
          data-testid="sticky-font-weight"
        />

        <ToggleGroupControl
          label="Text Align"
          value={data.textAlign || 'left'}
          options={textAlignOptions}
          onChange={(value) => onUpdate({ textAlign: value as any })}
          data-testid="sticky-text-align"
        />

        <SliderControl
          label="Line Height"
          value={data.lineHeight || 1.4}
          onChange={(value) => onUpdate({ lineHeight: value })}
          min={1}
          max={2}
          step={0.1}
          data-testid="sticky-line-height"
        />
      </div>

      {/* Colors Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Colors</h5>
        
        <ColorPickerControl
          label="Background Color"
          value={data.backgroundColor || '#fef3c7'}
          onChange={handleBackgroundColorChange}
          presets={[...colorPresets.warning, ...colorPresets.primary, ...colorPresets.success, ...colorPresets.purple]}
          data-testid="sticky-background-color"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Text Color</label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={data.autoTextColor !== false}
                onChange={toggleAutoTextColor}
                className="rounded"
                data-testid="sticky-auto-text-color"
              />
              Auto
            </label>
          </div>
          
          <ColorPickerControl
            label=""
            value={data.textColor || '#000000'}
            onChange={handleTextColorChange}
            disabled={data.autoTextColor !== false}
            presets={colorPresets.neutral}
            showPresets={data.autoTextColor === false}
            data-testid="sticky-text-color"
          />
          
          {data.autoTextColor !== false && (
            <p className="text-xs text-muted-foreground">
              Text color automatically optimized for readability
            </p>
          )}
        </div>
      </div>

      {/* Border Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Border</h5>
        
        <ColorPickerControl
          label="Border Color"
          value={data.borderColor || data.backgroundColor || '#fef3c7'}
          onChange={(color) => onUpdate({ borderColor: color })}
          presets={colorPresets.neutral}
          data-testid="sticky-border-color"
        />

        <SliderControl
          label="Border Width"
          value={data.borderWidth || 2}
          onChange={(value) => onUpdate({ borderWidth: value })}
          min={0}
          max={5}
          unit="px"
          data-testid="sticky-border-width"
        />

        <DropdownControl
          label="Border Style"
          value={data.borderStyle || 'solid'}
          options={borderStyleOptions}
          onChange={(value) => onUpdate({ borderStyle: value as any })}
          data-testid="sticky-border-style"
        />

        <SliderControl
          label="Border Radius"
          value={data.borderRadius || 8}
          onChange={(value) => onUpdate({ borderRadius: value })}
          min={0}
          max={25}
          unit="px"
          data-testid="sticky-border-radius"
        />
      </div>

      {/* Effects Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Effects</h5>
        
        <SliderControl
          label="Opacity"
          value={(data.opacity || 1) * 100}
          onChange={(value) => onUpdate({ opacity: value / 100 })}
          min={0}
          max={100}
          unit="%"
          data-testid="sticky-opacity"
        />
      </div>
    </div>
  );
};