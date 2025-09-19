import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { GoogleFontsSelector } from './GoogleFontsSelector';
import FigmaStyleColorPicker from './FigmaStyleColorPicker';
import { 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  AlignVerticalSpaceAround,
  AlignVerticalSpaceBetween,
  AlignVerticalDistributeStart,
  Underline,
  Type
} from 'lucide-react';

interface TypographyPanelProps {
  textContent: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textColor: string;
  textAlign?: string;
  textDecoration?: string;
  verticalAlign?: string;
  onTextContentChange: (value: string) => void;
  onFontSizeChange: (value: number) => void;
  onFontFamilyChange: (value: string) => void;
  onFontWeightChange: (value: string) => void;
  onTextColorChange: (value: string) => void;
  onTextAlignChange?: (value: string) => void;
  onTextDecorationChange?: (value: string) => void;
  onVerticalAlignChange?: (value: string) => void;
  className?: string;
}

const FONT_WEIGHTS = [
  { value: 'normal', label: 'Regular' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'bold', label: 'Bold' }
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

export const TypographyPanel = ({
  textContent,
  fontSize,
  fontFamily,
  fontWeight,
  textColor,
  textAlign = 'left',
  textDecoration = 'none',
  verticalAlign = 'top',
  onTextContentChange,
  onFontSizeChange,
  onFontFamilyChange,
  onFontWeightChange,
  onTextColorChange,
  onTextAlignChange,
  onTextDecorationChange,
  onVerticalAlignChange,
  className = ''
}: TypographyPanelProps) => {

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Typography Header */}
      <div className="flex items-center gap-2">
        <Type className="w-4 h-4" />
        <h3 className="text-sm font-semibold">Typography</h3>
      </div>

      {/* Text Content */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Content</Label>
        <Input
          value={textContent}
          onChange={(e) => onTextContentChange(e.target.value)}
          className="text-sm"
          placeholder="Click to add text"
          data-testid="text-content-input"
        />
      </div>

      <Separator />

      {/* Font Family with Google Fonts */}
      <GoogleFontsSelector
        value={fontFamily}
        onChange={onFontFamilyChange}
        label="Font Family"
        data-testid="font-family-selector"
      />

      {/* Font Weight and Size Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Weight</Label>
          <Select value={fontWeight} onValueChange={onFontWeightChange}>
            <SelectTrigger className="h-9 text-sm" data-testid="font-weight-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((weight) => (
                <SelectItem key={weight.value} value={weight.value}>
                  {weight.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Size</Label>
          <Select 
            value={fontSize.toString()} 
            onValueChange={(value) => onFontSizeChange(Number(value))}
          >
            <SelectTrigger className="h-9 text-sm" data-testid="font-size-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Text Formatting Controls */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Formatting</Label>
        
        {/* Text Decoration and Text Color Row */}
        <div className="flex items-center gap-2">
          {/* Underline Toggle */}
          <Button
            variant={textDecoration === 'underline' ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-12 p-0"
            onClick={() => onTextDecorationChange?.(
              textDecoration === 'underline' ? 'none' : 'underline'
            )}
            data-testid="underline-toggle"
          >
            <Underline className="w-4 h-4" />
          </Button>

          {/* Font Size Display */}
          <div className="flex items-center gap-1 px-3 py-1 bg-muted rounded text-sm font-medium">
            <Type className="w-3 h-3" />
            <span>{fontSize}</span>
          </div>

          {/* Color Indicator - shows current color */}
          <div
            className="h-8 w-12 border-2 border-border rounded"
            style={{ backgroundColor: textColor }}
            data-testid="text-color-display"
          />
        </div>

        {/* Color Picker - Always Visible */}
        <div className="p-3 border rounded-lg bg-background">
          <FigmaStyleColorPicker
            fillColor={textColor}
            onFillColorChange={onTextColorChange}
            showFill={true}
            showStroke={false}
            testIdScope="text-color"
          />
        </div>
      </div>

      <Separator />

      {/* Text Alignment */}
      {onTextAlignChange && (
        <div className="space-y-3">
          <Label className="text-xs font-medium">Horizontal Alignment</Label>
          <div className="flex gap-1">
            {[
              { value: 'left', icon: AlignLeft, label: 'Left' },
              { value: 'center', icon: AlignCenter, label: 'Center' },
              { value: 'right', icon: AlignRight, label: 'Right' }
            ].map((align) => {
              const IconComponent = align.icon;
              return (
                <Button
                  key={align.value}
                  variant={textAlign === align.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-12 p-0"
                  onClick={() => onTextAlignChange(align.value)}
                  data-testid={`align-${align.value}`}
                >
                  <IconComponent className="w-4 h-4" />
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Vertical Alignment */}
      {onVerticalAlignChange && (
        <div className="space-y-3">
          <Label className="text-xs font-medium">Vertical Alignment</Label>
          <div className="flex gap-1">
            {[
              { value: 'top', icon: AlignVerticalDistributeStart, label: 'Top' },
              { value: 'middle', icon: AlignVerticalSpaceAround, label: 'Middle' },
              { value: 'bottom', icon: AlignVerticalSpaceBetween, label: 'Bottom' }
            ].map((align) => {
              const IconComponent = align.icon;
              return (
                <Button
                  key={align.value}
                  variant={verticalAlign === align.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-12 p-0"
                  onClick={() => onVerticalAlignChange(align.value)}
                  data-testid={`vertical-align-${align.value}`}
                >
                  <IconComponent className="w-4 h-4" />
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};