import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FigJamFontSizeSelectorProps {
  value: number;
  onChange: (size: number) => void;
  label?: string;
  className?: string;
  'data-testid'?: string;
}

const FIGMA_FONT_SIZES = [
  { label: 'Extra small', value: 10 },
  { label: 'Small', value: 14 },
  { label: 'Normal', value: 18 },
  { label: 'Large', value: 24 },
  { label: 'Extra Large', value: 40 },
  { label: 'Custom', value: 'custom' }
];

export const FigJamFontSizeSelector = ({
  value,
  onChange,
  label = 'Font Size',
  className = '',
  'data-testid': testId
}: FigJamFontSizeSelectorProps) => {
  const [showCustomSize, setShowCustomSize] = useState(false);
  const [customSize, setCustomSize] = useState(value);

  // Check if current fontSize matches one of the preset sizes
  const currentPresetSize = FIGMA_FONT_SIZES.find(size => size.value === value);
  const isCustomSize = !currentPresetSize;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="text-xs font-medium">{label}</Label>
      )}
      <Select 
        value={isCustomSize ? 'custom' : value.toString()} 
        onValueChange={(selectedValue) => {
          if (selectedValue === 'custom') {
            setShowCustomSize(true);
            setCustomSize(value);
          } else {
            setShowCustomSize(false);
            onChange(Number(selectedValue));
          }
        }}
      >
        <SelectTrigger className="h-9 text-sm" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[9999]">
          {FIGMA_FONT_SIZES.map((size) => (
            <SelectItem key={size.value} value={size.value.toString()}>
              {size.label} {size.value !== 'custom' && `(${size.value}px)`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Custom Size Input */}
      {(showCustomSize || isCustomSize) && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="8"
            max="200"
            value={customSize}
            onChange={(e) => setCustomSize(Number(e.target.value))}
            onBlur={() => {
              onChange(customSize);
              setShowCustomSize(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onChange(customSize);
                setShowCustomSize(false);
              }
            }}
            className="text-sm"
            placeholder="Custom size"
            data-testid={testId ? `${testId}-custom-input` : undefined}
          />
          <span className="text-xs text-muted-foreground">px</span>
        </div>
      )}
    </div>
  );
};