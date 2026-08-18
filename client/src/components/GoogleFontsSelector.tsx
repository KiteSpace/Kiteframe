import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { GOOGLE_FONTS, loadGoogleFont } from '@/lib/fontUtils';

interface GoogleFontsSelectorProps {
  value: string;
  onChange: (font: string) => void;
  label?: string;
  className?: string;
  'data-testid'?: string;
}

export const GoogleFontsSelector = ({ 
  value, 
  onChange, 
  label, 
  className = '',
  'data-testid': testId
}: GoogleFontsSelectorProps) => {

  const handleValueChange = (newValue: string) => {
    const selectedFont = GOOGLE_FONTS.find(font => font.value === newValue);
    if (selectedFont && selectedFont.weight) {
      loadGoogleFont(selectedFont.value, selectedFont.weight);
    }
    onChange(newValue);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="text-xs font-medium">{label}</Label>
      )}
      <Select 
        value={value} 
        onValueChange={handleValueChange}
      >
        <SelectTrigger 
          className="w-full h-9 text-sm"
          data-testid={testId}
        >
          <SelectValue 
            placeholder="Select font..."
            style={{ fontFamily: value }}
          />
        </SelectTrigger>
        <SelectContent className="max-h-60 z-[9999]">
          {GOOGLE_FONTS.map((font) => (
            <SelectItem 
              key={font.value} 
              value={font.value}
              className="text-sm py-2 px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              style={{ fontFamily: font.value }}
            >
              <span className="text-base">{font.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};