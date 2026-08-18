import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { MAX_GENERATED_SCREENS } from '@/lib/buildInterfacePrompt';

export interface ScreenCluster {
  name: string;
  nodes: Array<{ id: string; data?: { label?: string; [key: string]: unknown } }>;
}

interface InterfaceScreenPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusters: ScreenCluster[];
  onConfirm: (selected: ScreenCluster[]) => void;
}

const MAX_SCREENS = MAX_GENERATED_SCREENS;

export function InterfaceScreenPickerModal({
  open,
  onOpenChange,
  clusters,
  onConfirm,
}: InterfaceScreenPickerModalProps) {
  // checked[i] tracks whether cluster i is selected
  const [checked, setChecked] = useState<boolean[]>([]);

  // Reset selection whenever the cluster list changes (new modal open)
  useEffect(() => {
    setChecked(clusters.map((_, i) => i < MAX_SCREENS));
  }, [clusters]);

  const selectedCount = checked.filter(Boolean).length;

  function toggle(i: number) {
    setChecked((prev) => {
      const next = [...prev];
      if (next[i]) {
        next[i] = false;
      } else if (selectedCount < MAX_SCREENS) {
        next[i] = true;
      }
      return next;
    });
  }

  function handleConfirm() {
    const selected = clusters.filter((_, i) => checked[i]);
    onConfirm(selected);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose screens to generate</DialogTitle>
          <DialogDescription>
            This workflow maps to {clusters.length} screens. Pick a maximum of {MAX_SCREENS} to generate.
            {clusters.length > MAX_SCREENS
              ? ' KiteAI has pre-selected the recommended screens.'
              : ` The first ${MAX_SCREENS} are pre-selected.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto py-1 pr-1">
          {clusters.map((cluster, i) => {
            const nodeLabels = cluster.nodes
              .map((n) => n.data?.label || n.id)
              .join(', ');
            const isChecked = checked[i] ?? false;
            const isDisabled = !isChecked && selectedCount >= MAX_SCREENS;

            return (
              <label
                key={i}
                onClick={() => !isDisabled && toggle(i)}
                className={[
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer select-none transition-colors',
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed border-border'
                    : isChecked
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40',
                ].join(' ')}
              >
                <Checkbox
                  checked={isChecked}
                  disabled={isDisabled}
                  onCheckedChange={() => !isDisabled && toggle(i)}
                  className="mt-0.5 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    Screen {i + 1}: {cluster.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {nodeLabels}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {selectedCount} / {MAX_SCREENS} selected
          </span>
          <Button disabled={selectedCount === 0} onClick={handleConfirm}>
            Generate {selectedCount} screen{selectedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
