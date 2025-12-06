import React from 'react';
import { ColorPickerControl } from './ColorPickerControl';
import { SliderControl } from './SliderControl';
import { DropdownControl } from './DropdownControl';
import { ToggleGroupControl } from './ToggleGroupControl';
import { colorPresets } from '../../utils/colorUtils';
import { ShapeNodeData } from '../../types';
import { partialResetHelpers } from '../../constants/defaults';
import { Button } from '../../../../components/ui/button';
import { Shapes, Circle, Square, Triangle, RotateCcw } from 'lucide-react';

interface ShapeObjectStylingPanelProps {
  data: ShapeNodeData;
  onUpdate: (updates: Partial<ShapeNodeData>) => void;
  onResetToDefaults?: () => void;
}

export const ShapeObjectStylingPanel: React.FC<ShapeObjectStylingPanelProps> = ({
  data,
  onUpdate,
  onResetToDefaults
}) => {
  const shapeTypeOptions = [
    { value: 'rectangle', label: 'Rectangle', icon: <Square size={14} /> },
    { value: 'circle', label: 'Circle', icon: <Circle size={14} /> },
    { value: 'triangle', label: 'Triangle', icon: <Triangle size={14} /> }
  ];

  const strokeStyleOptions = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
    { value: 'none', label: 'None' }
  ];

  // Handle reset to defaults with shape identity preservation
  const handleResetToDefaults = () => {
    if (onResetToDefaults) {
      onResetToDefaults();
    } else {
      // Use partial reset to preserve shapeType, lineCap, arrowSize while resetting styling
      const stylingReset = partialResetHelpers.shape(data);
      onUpdate(stylingReset);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Shapes size={16} />
          Shape Styling
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetToDefaults}
          className="h-8 px-2 text-xs"
          data-testid="shape-reset-button"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Shape Type */}
      <div className="space-y-3">
        <ToggleGroupControl
          label="Shape Type"
          value={data.shapeType || 'rectangle'}
          options={shapeTypeOptions}
          onChange={(value) => {
            onUpdate({ shapeType: value as any });
          }}
          data-testid="shape-type"
        />
      </div>

      {/* Text Content Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Text Content</h5>
        
        <div className="space-y-2">
          <label className="text-xs font-medium">Text</label>
          <input
            type="text"
            value={data.text || ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Add text to shape..."
            className="w-full px-2 py-1 text-xs border border-border rounded"
            data-testid="shape-text-content"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Font Size</label>
            <input
              type="number"
              value={data.fontSize || 14}
              onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 14 })}
              min={8}
              max={72}
              className="w-full px-2 py-1 text-xs border border-border rounded"
              data-testid="shape-font-size"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Font Weight</label>
            <select
              value={data.fontWeight || 400}
              onChange={(e) => onUpdate({ fontWeight: e.target.value === 'normal' || e.target.value === 'bold' ? e.target.value : parseInt(e.target.value) })}
              className="w-full px-2 py-1 text-xs border border-border rounded"
              data-testid="shape-font-weight"
            >
              <option value={400}>Normal</option>
              <option value={500}>Medium</option>
              <option value={600}>Semibold</option>
              <option value={700}>Bold</option>
            </select>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-medium">Text Color</label>
          <input
            type="color"
            value={data.textColor || '#374151'}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
            className="w-full h-8 border border-border rounded"
            data-testid="shape-text-color"
          />
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-medium">Text Align</label>
          <select
            value={data.textAlign || 'center'}
            onChange={(e) => onUpdate({ textAlign: e.target.value as any })}
            className="w-full px-2 py-1 text-xs border border-border rounded"
            data-testid="shape-text-align"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      {/* Fill Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Fill</h5>
        
        <ColorPickerControl
          label="Fill Color"
          value={data.fillColor || '#3b82f6'}
          onChange={(color) => onUpdate({ fillColor: color })}
          presets={colorPresets.primary}
          data-testid="shape-fill-color"
        />

        <SliderControl
          label="Fill Opacity"
          value={data.fillOpacity !== undefined ? data.fillOpacity * 100 : 70}
          onChange={(value) => onUpdate({ fillOpacity: value / 100 })}
          min={0}
          max={100}
          unit="%"
          data-testid="shape-fill-opacity"
        />
      </div>

      {/* Stroke Section */}
      <div className="space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground">Stroke</h5>
        
        <ColorPickerControl
          label="Stroke Color"
          value={data.strokeColor || '#1d4ed8'}
          onChange={(color) => onUpdate({ strokeColor: color })}
          disabled={(data.strokeWidth || 0) === 0}
          presets={colorPresets.primary}
          data-testid="shape-stroke-color"
        />

        <SliderControl
          label="Stroke Width"
          value={data.strokeWidth || 2}
          onChange={(value) => onUpdate({ strokeWidth: value })}
          disabled={(data.strokeWidth || 0) === 0}
          min={1}
          max={20}
          unit="px"
          data-testid="shape-stroke-width"
        />

        <DropdownControl
          label="Stroke Style"
          value={data.strokeStyle || 'solid'}
          options={strokeStyleOptions}
          disabled={(data.strokeWidth || 0) === 0}
          onChange={(value) => onUpdate({ strokeStyle: value as any })}
          data-testid="shape-stroke-style"
        />

        <SliderControl
          label="Stroke Opacity"
          value={data.strokeOpacity !== undefined ? data.strokeOpacity * 100 : 100}
          onChange={(value) => onUpdate({ strokeOpacity: value / 100 })}
          disabled={(data.strokeWidth || 0) === 0}
          min={0}
          max={100}
          unit="%"
          data-testid="shape-stroke-opacity"
        />

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Enable Stroke</label>
          <input
            type="checkbox"
            checked={(data.strokeWidth || 0) > 0}
            onChange={(e) => onUpdate({ strokeWidth: e.target.checked ? 2 : 0 })}
            className="rounded"
            data-testid="shape-enable-stroke"
          />
        </div>
      </div>

      {/* Shape-specific Properties */}
      {data.shapeType === 'rectangle' && (
        <div className="space-y-3">
          <h5 className="text-xs font-medium text-muted-foreground">Rectangle</h5>
          
          <SliderControl
            label="Border Radius"
            value={data.borderRadius || 0}
            onChange={(value) => onUpdate({ borderRadius: value })}
            min={0}
            max={50}
            unit="px"
            data-testid="shape-border-radius"
          />
        </div>
      )}

      {data.shapeType === 'arrow' && (
        <div className="space-y-3">
          <h5 className="text-xs font-medium text-muted-foreground">Arrow</h5>
          
          <SliderControl
            label="Arrow Size"
            value={data.arrowSize || 1}
            onChange={(value) => onUpdate({ arrowSize: value })}
            min={0.5}
            max={3}
            step={0.1}
            data-testid="shape-arrow-size"
          />
        </div>
      )}

      {(data.shapeType === 'line' || data.shapeType === 'arrow') && (
        <div className="space-y-3">
          <h5 className="text-xs font-medium text-muted-foreground">Line Caps</h5>
          
          <DropdownControl
            label="Line Cap"
            value={data.lineCap || 'round'}
            options={[
              { value: 'butt', label: 'Square' },
              { value: 'round', label: 'Round' },
              { value: 'square', label: 'Extended' }
            ]}
            onChange={(value) => onUpdate({ lineCap: value as any })}
            data-testid="shape-line-cap"
          />
        </div>
      )}

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
          data-testid="shape-opacity"
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
                  blur: data.shadow?.blur || 8,
                  offsetX: data.shadow?.offsetX || 0,
                  offsetY: data.shadow?.offsetY || 4
                }
              })}
              className="rounded"
              data-testid="shape-shadow-enabled"
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
                data-testid="shape-shadow-color"
              />
              
              <SliderControl
                label="Blur"
                value={data.shadow?.blur || 8}
                onChange={(value) => onUpdate({ 
                  shadow: { ...data.shadow!, blur: value }
                })}
                min={0}
                max={20}
                unit="px"
                data-testid="shape-shadow-blur"
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
                data-testid="shape-shadow-offset-x"
              />
              
              <SliderControl
                label="Offset Y"
                value={data.shadow?.offsetY || 4}
                onChange={(value) => onUpdate({ 
                  shadow: { ...data.shadow!, offsetY: value }
                })}
                min={-10}
                max={10}
                unit="px"
                data-testid="shape-shadow-offset-y"
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
};