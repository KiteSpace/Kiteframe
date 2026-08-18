import React from 'react';

interface DropdownOption {
  value: string;
  label: string;
  preview?: React.ReactNode;
}

interface DropdownControlProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  'data-testid'?: string;
}

export const DropdownControl: React.FC<DropdownControlProps> = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  'data-testid': testId
}) => {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full p-2 text-xs border border-border rounded bg-background disabled:opacity-50"
        data-testid={testId}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};