import React from 'react';
import { ColorPickerControl } from './ColorPickerControl';
import { SliderControl } from './SliderControl';
import { DropdownControl } from './DropdownControl';
import { ToggleGroupControl } from './ToggleGroupControl';
import { colorPresets } from '../../utils/colorUtils';
import { ShapeNodeData } from '../../types';
import { Shapes, Circle, Square, Triangle } from 'lucide-react';

interface ShapeObjectStylingPanelProps {
  data: ShapeNodeData;
  onUpdate: (updates: Partial<ShapeNodeData>) => void;
}

export const ShapeObjectStylingPanel: React.FC<ShapeObjectStylingPanelProps> = ({
  data,
  onUpdate
}) => {
  const shapeTypeOptions = [
    { value: 'rectangle', label: 'Rectangle', icon: <Square size={14} /> },
    { value: 'circle', label: 'Circle', icon: <Circle size={14} /> },
    { value: 'triangle', label: 'Triangle', icon: <Triangle size={14} /> }
  ];

  const strokeStyleOptions = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' }
  ];

  return (
    <div className="space-y-4 p-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Shapes size={16} />
        Shape Styling
      </h4>

      {/* Shape Type */}
      <div className="space-y-3">
        <ToggleGroupControl
          label="Shape Type"
          value={data.shapeType || 'rectangle'}
          options={shapeTypeOptions}
          onChange={(value) => onUpdate({ shapeType: value as any })}
          data-testid="shape-type"
        />
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
          value={(data.fillOpacity || 1) * 100}
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
          presets={colorPresets.primary}
          data-testid="shape-stroke-color"
        />

        <SliderControl
          label="Stroke Width"
          value={data.strokeWidth || 2}
          onChange={(value) => onUpdate({ strokeWidth: value })}
          min={0}
          max={20}
          unit="px"
          data-testid="shape-stroke-width"
        />

        <DropdownControl
          label="Stroke Style"
          value={data.strokeStyle || 'solid'}
          options={strokeStyleOptions}
          onChange={(value) => onUpdate({ strokeStyle: value as any })}
          data-testid="shape-stroke-style"
        />

        <SliderControl
          label="Stroke Opacity"
          value={(data.strokeOpacity || 1) * 100}
          onChange={(value) => onUpdate({ strokeOpacity: value / 100 })}
          min={0}
          max={100}
          unit="%"
          data-testid="shape-stroke-opacity"
        />
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
          value={data.opacity * 100}
          onChange={(value) => onUpdate({ opacity: value / 100 })}
          min={0}
          max={100}
          unit="%"
          data-testid="shape-opacity"
        />
      </div>
    </div>
  );
};