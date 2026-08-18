import React from 'react';
import { cn } from '@/lib/utils';

interface ToggleOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface ToggleGroupControlProps {
  label: string;
  value: string;
  options: ToggleOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  'data-testid'?: string;
}

export const ToggleGroupControl: React.FC<ToggleGroupControlProps> = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  'data-testid': testId
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium">{label}</label>
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              "p-2 text-xs border rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              value === option.value 
                ? 'border-primary bg-primary/10' 
                : 'border-border'
            )}
            data-testid={testId ? `${testId}-${option.value}` : undefined}
          >
            <div className="flex flex-col items-center gap-1">
              {option.icon}
              <span>{option.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};