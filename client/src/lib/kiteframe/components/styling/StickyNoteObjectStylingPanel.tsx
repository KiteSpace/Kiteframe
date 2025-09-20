import React from 'react';
import { ColorPickerControl } from './ColorPickerControl';
import { SliderControl } from './SliderControl';
import { FigJamFontSizeSelector } from '../../../../components/FigJamFontSizeSelector';
import { DropdownControl } from './DropdownControl';
import { ToggleGroupControl } from './ToggleGroupControl';
import { colorPresets, getOptimalTextColor } from '../../utils/colorUtils';
import { StickyNoteData } from '../../types';
import { partialResetHelpers } from '../../constants/defaults';
import { Button } from '../../../../components/ui/button';
import { StickyNote, AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, RotateCcw } from 'lucide-react';
import { getAvailableWeightOptions, findFallbackWeight, GOOGLE_FONTS, loadGoogleFont } from '../../../../lib/fontUtils';

interface StickyNoteObjectStylingPanelProps {
  data: StickyNoteData;
  onUpdate: (updates: Partial<StickyNoteData>) => void;
  onResetToDefaults?: () => void;
}

export const StickyNoteObjectStylingPanel: React.FC<StickyNoteObjectStylingPanelProps> = ({
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
    const updates: Partial<StickyNoteData> = { fontFamily: newFontFamily as any };
    
    // Update weight if it changed due to fallback
    if (fallbackWeight !== (data.fontWeight || 'normal')) {
      updates.fontWeight = fallbackWeight as any;
    }
    
    // Load Google Font if it's not a system font
    loadGoogleFont(newFontFamily);
    
    onUpdate(updates);
  };

  const fontStyleOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'italic', label: 'Italic' }
  ];

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

  const verticalAlignOptions = [
    { value: 'top', label: 'Top', icon: <AlignVerticalJustifyStart size={14} /> },
    { value: 'middle', label: 'Middle', icon: <AlignVerticalJustifyCenter size={14} /> },
    { value: 'bottom', label: 'Bottom', icon: <AlignVerticalJustifyEnd size={14} /> }
  ];

  const borderStyleOptions = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
    { value: 'none', label: 'None' }
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

  // Handle reset to defaults with content preservation
  const handleResetToDefaults = () => {
    if (onResetToDefaults) {
      onResetToDefaults();
    } else {
      // Use partial reset to preserve text content while resetting styling
      const stylingReset = partialResetHelpers.sticky(data);
      onUpdate(stylingReset);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <StickyNote size={16} />
          Sticky Note Styling
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetToDefaults}
          className="h-8 px-2 text-xs"
          data-testid="sticky-reset-button"
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
          data-testid="sticky-font-family"
        />

        <FigJamFontSizeSelector
          label="Font Size"
          value={data.fontSize || 14}
          onChange={(value) => onUpdate({ fontSize: value })}
          data-testid="sticky-font-size"
        />

        <DropdownControl
          label="Font Weight"
          value={data.fontWeight || 'normal'}
          options={availableWeights}
          onChange={(value) => onUpdate({ fontWeight: value as any })}
          data-testid="sticky-font-weight"
        />

        <DropdownControl
          label="Font Style"
          value={data.fontStyle || 'normal'}
          options={fontStyleOptions}
          onChange={(value) => onUpdate({ fontStyle: value as any })}
          data-testid="sticky-font-style"
        />

        <ToggleGroupControl
          label="Text Align"
          value={data.textAlign || 'left'}
          options={textAlignOptions}
          onChange={(value) => onUpdate({ textAlign: value as any })}
          data-testid="sticky-text-align"
        />

        <DropdownControl
          label="Text Decoration"
          value={data.textDecoration || 'none'}
          options={textDecorationOptions}
          onChange={(value) => onUpdate({ textDecoration: value as any })}
          data-testid="sticky-text-decoration"
        />

        <ToggleGroupControl
          label="Vertical Align"
          value={data.verticalAlign || 'top'}
          options={verticalAlignOptions}
          onChange={(value) => onUpdate({ verticalAlign: value as any })}
          data-testid="sticky-vertical-align"
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

        <SliderControl
          label="Letter Spacing"
          value={data.letterSpacing || 0}
          onChange={(value) => onUpdate({ letterSpacing: value })}
          min={-2}
          max={5}
          step={0.1}
          unit="px"
          data-testid="sticky-letter-spacing"
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

        {/* Shadow Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Shadow</label>
            <input
              type="checkbox"
              checked={data.shadow?.enabled || false}
              onChange={(e) => onUpdate({ 
                shadow: { 
                  ...data.shadow,
                  enabled: e.target.checked,
                  color: data.shadow?.color || '#00000040',
                  blur: data.shadow?.blur || 4,
                  offsetX: data.shadow?.offsetX || 0,
                  offsetY: data.shadow?.offsetY || 2
                }
              })}
              className="rounded"
              data-testid="sticky-shadow-enabled"
            />
          </div>
          
          {data.shadow?.enabled && (
            <div className="space-y-2 pl-2 border-l-2 border-muted">
              <ColorPickerControl
                label="Shadow Color"
                value={data.shadow?.color || '#00000040'}
                onChange={(color) => onUpdate({ 
                  shadow: { ...data.shadow!, color }
                })}
                presets={['#00000020', '#00000040', '#00000060', '#00000080']}
                data-testid="sticky-shadow-color"
              />
              
              <SliderControl
                label="Blur"
                value={data.shadow?.blur || 4}
                onChange={(value) => onUpdate({ 
                  shadow: { ...data.shadow!, blur: value }
                })}
                min={0}
                max={20}
                unit="px"
                data-testid="sticky-shadow-blur"
              />
              
              <SliderControl
                label="Offset X"
                value={data.shadow?.offsetX || 0}
                onChange={(value) => onUpdate({ 
                  shadow: { ...data.shadow!, offsetX: value }
                })}
                min={-10}
                max={10}
                unit="px"
                data-testid="sticky-shadow-offset-x"
              />
              
              <SliderControl
                label="Offset Y"
                value={data.shadow?.offsetY || 2}
                onChange={(value) => onUpdate({ 
                  shadow: { ...data.shadow!, offsetY: value }
                })}
                min={-10}
                max={10}
                unit="px"
                data-testid="sticky-shadow-offset-y"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};