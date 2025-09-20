import React from 'react';
import { ColorPickerControl } from './ColorPickerControl';
import { SliderControl } from './SliderControl';
import { FigJamFontSizeSelector } from '../../../../components/FigJamFontSizeSelector';
import { DropdownControl } from './DropdownControl';
import { ToggleGroupControl } from './ToggleGroupControl';
import { colorPresets } from '../../utils/colorUtils';
import { TextNodeData } from '../../types';
import { partialResetHelpers } from '../../constants/defaults';
import { Button } from '../../../../components/ui/button';
import { Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, RotateCcw } from 'lucide-react';
import { getAvailableWeightOptions, findFallbackWeight, GOOGLE_FONTS, loadGoogleFont } from '../../../../lib/fontUtils';

interface TextObjectStylingPanelProps {
  data: TextNodeData;
  onUpdate: (updates: Partial<TextNodeData>) => void;
  onResetToDefaults?: () => void;
}

export const TextObjectStylingPanel: React.FC<TextObjectStylingPanelProps> = ({
  data,
  onUpdate,
  onResetToDefaults
}) => {
  const fontFamilyOptions = GOOGLE_FONTS.map(font => ({
    value: font.value,
    label: font.label
  }));

  // Get available font weights for the current font family
  const availableWeights = getAvailableWeightOptions(data.fontFamily || 'Inter');

  // Handle font family change with weight fallback
  const handleFontFamilyChange = (newFontFamily: string) => {
    const fallbackWeight = findFallbackWeight(data.fontWeight || 'normal', newFontFamily);
    const updates: Partial<TextNodeData> = { fontFamily: newFontFamily as any };
    
    // Update weight if it changed due to fallback
    if (fallbackWeight !== (data.fontWeight || 'normal')) {
      updates.fontWeight = fallbackWeight as any;
    }
    
    // Load Google Font if it's not a system font
    loadGoogleFont(newFontFamily);
    
    onUpdate(updates);
  };

  // Handle reset to defaults with content preservation
  const handleResetToDefaults = () => {
    if (onResetToDefaults) {
      onResetToDefaults();
    } else {
      // Use partial reset to preserve label and text content while resetting styling
      const stylingReset = partialResetHelpers.text(data);
      onUpdate(stylingReset);
    }
  };

  const textAlignOptions = [
    { value: 'left', label: 'Left', icon: <AlignLeft size={14} /> },
    { value: 'center', label: 'Center', icon: <AlignCenter size={14} /> },
    { value: 'right', label: 'Right', icon: <AlignRight size={14} /> }
  ];

  const textDecorationOptions = [
    { value: 'none', label: 'None' },
    { value: 'underline', label: 'Underline' },
    { value: 'line-through', label: 'Strikethrough' }
  ];

  const borderStyleOptions = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
    { value: 'none', label: 'None' }
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Type size={16} />
          Text Styling
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetToDefaults}
          className="h-8 px-2 text-xs"
          data-testid="text-reset-button"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Typography Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Typography</h5>
        
        <DropdownControl
          label="Font Family"
          value={data.fontFamily || 'Inter'}
          options={fontFamilyOptions}
          onChange={handleFontFamilyChange}
          data-testid="text-font-family"
        />

        <FigJamFontSizeSelector
          label="Font Size"
          value={data.fontSize || 16}
          onChange={(value) => onUpdate({ fontSize: value })}
          data-testid="text-font-size"
        />

        <DropdownControl
          label="Font Weight"
          value={data.fontWeight || 'normal'}
          options={availableWeights}
          onChange={(value) => onUpdate({ fontWeight: value as any })}
          data-testid="text-font-weight"
        />

        <ToggleGroupControl
          label="Text Align"
          value={data.textAlign || 'left'}
          options={textAlignOptions}
          onChange={(value) => onUpdate({ textAlign: value as any })}
          data-testid="text-align"
        />

        <DropdownControl
          label="Text Decoration"
          value={data.textDecoration || 'none'}
          options={textDecorationOptions}
          onChange={(value) => onUpdate({ textDecoration: value as any })}
          data-testid="text-decoration"
        />

        <SliderControl
          label="Line Height"
          value={data.lineHeight || 1.4}
          onChange={(value) => onUpdate({ lineHeight: value })}
          min={1}
          max={3}
          step={0.1}
          data-testid="text-line-height"
        />

        <SliderControl
          label="Letter Spacing"
          value={data.letterSpacing || 0}
          onChange={(value) => onUpdate({ letterSpacing: value })}
          min={-2}
          max={5}
          step={0.1}
          unit="px"
          data-testid="text-letter-spacing"
        />
      </div>

      {/* Colors Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Colors</h5>
        
        <ColorPickerControl
          label="Text Color"
          value={data.textColor || '#000000'}
          onChange={(color) => onUpdate({ textColor: color })}
          presets={colorPresets.neutral}
          data-testid="text-color"
        />

        <ColorPickerControl
          label="Background Color"
          value={data.backgroundColor || 'transparent'}
          onChange={(color) => onUpdate({ backgroundColor: color })}
          presets={colorPresets.primary}
          data-testid="text-background-color"
        />
      </div>

      {/* Border Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Border</h5>
        
        <ColorPickerControl
          label="Border Color"
          value={data.borderColor || '#e2e8f0'}
          onChange={(color) => onUpdate({ borderColor: color })}
          presets={colorPresets.neutral}
          data-testid="text-border-color"
        />

        <SliderControl
          label="Border Width"
          value={data.borderWidth || 0}
          onChange={(value) => onUpdate({ borderWidth: value })}
          min={0}
          max={10}
          unit="px"
          data-testid="text-border-width"
        />

        <DropdownControl
          label="Border Style"
          value={data.borderStyle || 'solid'}
          options={borderStyleOptions}
          onChange={(value) => onUpdate({ borderStyle: value as any })}
          data-testid="text-border-style"
        />

        <SliderControl
          label="Border Radius"
          value={data.borderRadius || 0}
          onChange={(value) => onUpdate({ borderRadius: value })}
          min={0}
          max={50}
          unit="px"
          data-testid="text-border-radius"
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
          data-testid="text-opacity"
        />
      </div>
    </div>
  );
};