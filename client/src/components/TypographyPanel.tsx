import { useState, useCallback, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GoogleFontsSelector } from "./GoogleFontsSelector";
import FigmaStyleColorPicker from "./FigmaStyleColorPicker";
import { getAvailableWeightOptions, findFallbackWeight } from "@/lib/fontUtils";
import { DEFAULT_TEXT_NODE_DATA } from "@/lib/kiteframe/constants/defaults";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Underline,
  Type,
  RotateCcw,
} from "lucide-react";

interface TypographyPanelProps {
  textContent: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textColor: string;
  textAlign?: string;
  textDecoration?: string;
  verticalAlign?: string;
  lineHeight?: number;
  letterSpacing?: number;
  onTextContentChange: (value: string) => void;
  onFontSizeChange: (value: number) => void;
  onFontFamilyChange: (value: string) => void;
  onFontWeightChange: (value: string) => void;
  onTextColorChange: (value: string) => void;
  onTextAlignChange?: (value: string) => void;
  onTextDecorationChange?: (value: string) => void;
  onVerticalAlignChange?: (value: string) => void;
  onLineHeightChange?: (value: number) => void;
  onLetterSpacingChange?: (value: number) => void;
  onResetToDefaults?: () => void;
  className?: string;
}

// Dynamic font weights will be calculated based on selected font

const FONT_SIZES = [
  { label: "Extra small", value: 10 },
  { label: "Small", value: 14 },
  { label: "Normal", value: 18 },
  { label: "Large", value: 24 },
  { label: "Extra Large", value: 40 },
  { label: "Custom", value: "custom" },
];

export const TypographyPanel = ({
  textContent,
  fontSize,
  fontFamily,
  fontWeight,
  textColor,
  textAlign = "left",
  textDecoration = "none",
  verticalAlign = "top",
  lineHeight = 1.4,
  letterSpacing = 0,
  onTextContentChange,
  onFontSizeChange,
  onFontFamilyChange,
  onFontWeightChange,
  onTextColorChange,
  onTextAlignChange,
  onTextDecorationChange,
  onVerticalAlignChange,
  onLineHeightChange,
  onLetterSpacingChange,
  onResetToDefaults,
  className = "",
}: TypographyPanelProps) => {
  const [showCustomSize, setShowCustomSize] = useState(false);
  const [customSize, setCustomSize] = useState(fontSize);

  // Local state for text content input with debouncing
  const [localTextContent, setLocalTextContent] = useState(textContent);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state with prop changes (when canvas text is edited directly)
  useEffect(() => {
    setLocalTextContent(textContent);
  }, [textContent]);

  // Debounced text content change handler
  const debouncedTextContentChange = useCallback(
    (value: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        onTextContentChange(value);
      }, 150); // 150ms debounce delay for responsive feel
    },
    [onTextContentChange],
  );

  // Handle text input changes with immediate local update and debounced prop update
  const handleTextContentChange = useCallback(
    (value: string) => {
      setLocalTextContent(value); // Immediate local update for responsiveness
      debouncedTextContentChange(value); // Debounced prop update
    },
    [debouncedTextContentChange],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Check if current fontSize matches one of the preset sizes
  const currentPresetSize = FONT_SIZES.find((size) => size.value === fontSize);
  const isCustomSize = !currentPresetSize;

  // Get available font weights for the current font family
  const availableWeights = getAvailableWeightOptions(fontFamily);

  // Handle font family change with weight fallback
  const handleFontFamilyChange = useCallback(
    (newFontFamily: string) => {
      const fallbackWeight = findFallbackWeight(fontWeight, newFontFamily);
      onFontFamilyChange(newFontFamily);

      // Update weight if it changed due to fallback
      if (fallbackWeight !== fontWeight) {
        onFontWeightChange(fallbackWeight);
      }
    },
    [fontWeight, onFontFamilyChange, onFontWeightChange],
  );

  // Handle reset to defaults - now includes all typography properties
  const handleResetToDefaults = useCallback(() => {
    if (onResetToDefaults) {
      onResetToDefaults();
    } else {
      // Fallback to individual property resets if no unified reset handler
      const defaults = DEFAULT_TEXT_NODE_DATA;
      onTextContentChange(defaults.text);
      onFontSizeChange(defaults.fontSize);
      onFontFamilyChange(defaults.fontFamily);
      onFontWeightChange(defaults.fontWeight);
      onTextColorChange(defaults.textColor);
      onTextAlignChange?.(defaults.textAlign);
      onTextDecorationChange?.(defaults.textDecoration);
      onVerticalAlignChange?.(defaults.verticalAlign || "top");
      onLineHeightChange?.(defaults.lineHeight);
      onLetterSpacingChange?.(defaults.letterSpacing);
    }
  }, [
    onResetToDefaults,
    onTextContentChange,
    onFontSizeChange,
    onFontFamilyChange,
    onFontWeightChange,
    onTextColorChange,
    onTextAlignChange,
    onTextDecorationChange,
    onVerticalAlignChange,
    onLineHeightChange,
    onLetterSpacingChange,
  ]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Typography Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4" />
          <h3 className="text-sm font-semibold">Typography</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetToDefaults}
          className="h-8 px-2 text-xs"
          data-testid="typography-reset-button"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Text Content */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Content</Label>
        <Input
          value={localTextContent}
          onChange={(e) => handleTextContentChange(e.target.value)}
          className="text-sm"
          placeholder="Click to add text"
          data-testid="text-content-input"
        />
      </div>

      <Separator />

      {/* Font Family with Google Fonts */}
      <GoogleFontsSelector
        value={fontFamily}
        onChange={handleFontFamilyChange}
        label="Font Family"
        data-testid="font-family-selector"
      />

      {/* Font Weight and Size Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Weight</Label>
          <Select value={fontWeight} onValueChange={onFontWeightChange}>
            <SelectTrigger
              className="h-9 text-sm"
              data-testid="font-weight-selector"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {availableWeights.map((weight) => (
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
            value={isCustomSize ? "custom" : fontSize.toString()}
            onValueChange={(value) => {
              if (value === "custom") {
                setShowCustomSize(true);
                setCustomSize(fontSize);
              } else {
                setShowCustomSize(false);
                onFontSizeChange(Number(value));
              }
            }}
          >
            <SelectTrigger
              className="h-9 text-sm"
              data-testid="font-size-selector"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {FONT_SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value.toString()}>
                  {size.label} {size.value !== "custom" && `(${size.value}px)`}
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
                  onFontSizeChange(customSize);
                  setShowCustomSize(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onFontSizeChange(customSize);
                    setShowCustomSize(false);
                  }
                }}
                className="text-sm"
                placeholder="Custom size"
                data-testid="custom-font-size-input"
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
          )}
        </div>
      </div>

      {/* Text Alignment */}
      {onTextAlignChange && (
        <div className="space-y-3">
          <Label className="text-xs font-medium">Horizontal Alignment</Label>
          <div className="flex gap-1">
            {[
              { value: "left", icon: AlignLeft, label: "Left" },
              { value: "center", icon: AlignCenter, label: "Center" },
              { value: "right", icon: AlignRight, label: "Right" },
            ].map((align) => {
              const IconComponent = align.icon;
              return (
                <Button
                  key={align.value}
                  variant={textAlign === align.value ? "default" : "outline"}
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

      {/* Vertical Alignment
      {onVerticalAlignChange && (
        <div className="space-y-3">
          <Label className="text-xs font-medium">Vertical Alignment</Label>
          <div className="flex gap-1">
            {[
              { value: 'top', icon: AlignVerticalJustifyStart, label: 'Top' },
              { value: 'middle', icon: AlignVerticalJustifyCenter, label: 'Middle' },
              { value: 'bottom', icon: AlignVerticalJustifyEnd, label: 'Bottom' }
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
       */}

      <Separator />

      {/* Text Formatting Controls */}
      <div className="space-y-3">
        {/* Color Picker - Always Visible */}
        <div className="p-3 border rounded-lg bg-background">
          <FigmaStyleColorPicker
            fillColor={textColor}
            onFillColorChange={onTextColorChange}
            showFill={false}
            showStroke={false}
            testIdScope="text-color"
          />
        </div>
      </div>

      <Separator />
    </div>
  );
};
