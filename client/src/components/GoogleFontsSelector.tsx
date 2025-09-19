import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface GoogleFontsSelectorProps {
  value: string;
  onChange: (font: string) => void;
  label?: string;
  className?: string;
  'data-testid'?: string;
}

const GOOGLE_FONTS = [
  { value: 'Inter', label: 'Inter', weight: '300;400;500;600;700' },
  { value: 'Roboto', label: 'Roboto', weight: '300;400;500;700' },
  { value: 'Open Sans', label: 'Open Sans', weight: '300;400;600;700' },
  { value: 'Lato', label: 'Lato', weight: '300;400;700' },
  { value: 'Montserrat', label: 'Montserrat', weight: '300;400;500;600;700' },
  { value: 'Poppins', label: 'Poppins', weight: '300;400;500;600;700' },
  { value: 'Playfair Display', label: 'Playfair Display', weight: '400;500;600;700' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro', weight: '300;400;600;700' },
  { value: 'Arial', label: 'Arial', weight: '' },
  { value: 'Georgia', label: 'Georgia', weight: '' },
  { value: 'Times New Roman', label: 'Times New Roman', weight: '' },
  { value: 'Courier New', label: 'Courier New', weight: '' },
  { value: 'Verdana', label: 'Verdana', weight: '' },
  { value: 'Helvetica', label: 'Helvetica', weight: '' }
];

// Load Google Fonts dynamically
const loadGoogleFont = (fontFamily: string, weights: string) => {
  if (!weights || document.querySelector(`link[href*="${fontFamily.replace(/\s+/g, '+')}"]`)) {
    return; // Already loaded or no weights specified
  }
  
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@${weights}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
};

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
        <SelectContent className="max-h-60">
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