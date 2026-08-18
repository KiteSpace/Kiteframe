/**
 * EdgeCaseSelector Component
 * 
 * Checkbox UI for selecting which edge cases to include in workflow expansion.
 */

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { EDGE_CASE_CHECKBOX_HELPER } from '@/constants/aiWorkflowExpansionPrompts';

export interface EdgeCase {
  id: string;
  label: string;
}

export interface EdgeCaseSelectorProps {
  edgeCases: EdgeCase[];
  initialSelectedIds?: string[];
  onSubmit: (selectedIds: string[]) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function EdgeCaseSelector({
  edgeCases,
  initialSelectedIds,
  onSubmit,
  onCancel,
  disabled = false,
}: EdgeCaseSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds ?? [])
  );

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === edgeCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(edgeCases.map(ec => ec.id)));
    }
  };

  const handleSubmit = () => {
    onSubmit(Array.from(selectedIds));
  };

  const allSelected = selectedIds.size === edgeCases.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <p className="text-xs text-muted-foreground">
        {EDGE_CASE_CHECKBOX_HELPER}
      </p>
      
      <div className="flex items-center gap-2 pb-2 border-b">
        <Checkbox
          id="select-all"
          checked={allSelected}
          onCheckedChange={handleSelectAll}
          disabled={disabled}
          data-testid="checkbox-select-all-edge-cases"
        />
        <Label 
          htmlFor="select-all" 
          className="text-sm font-medium cursor-pointer"
        >
          Select All
        </Label>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {edgeCases.map(edgeCase => (
          <div key={edgeCase.id} className="flex items-start gap-2">
            <Checkbox
              id={edgeCase.id}
              checked={selectedIds.has(edgeCase.id)}
              onCheckedChange={() => handleToggle(edgeCase.id)}
              disabled={disabled}
              className="mt-0.5"
              data-testid={`checkbox-edge-case-${edgeCase.id}`}
            />
            <Label 
              htmlFor={edgeCase.id} 
              className="text-sm cursor-pointer leading-tight"
            >
              {edgeCase.label}
            </Label>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={disabled}
          className="flex-1"
          data-testid="button-cancel-edge-case-selection"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || !someSelected}
          className="flex-1"
          data-testid="button-apply-edge-case-selection"
        >
          Include Selected ({selectedIds.size})
        </Button>
      </div>
    </div>
  );
}
