import React from 'react';

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  disabled = false,
  'data-testid': testId
}) => {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="flex-1 disabled:opacity-50"
          data-testid={testId ? `${testId}-slider` : undefined}
        />
        <div className="flex items-center gap-1 min-w-0">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || min)}
            disabled={disabled}
            className="w-12 p-1 text-xs border border-border rounded bg-background text-center disabled:opacity-50"
            data-testid={testId ? `${testId}-input` : undefined}
          />
          {unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
};