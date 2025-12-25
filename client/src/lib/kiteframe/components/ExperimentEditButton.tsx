import { useState, useCallback } from 'react';
import { FlaskConical, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ExperimentMeta, ExperimentMode } from '../types';

export interface ExperimentEditButtonProps {
  nodeId: string;
  experimentMeta: ExperimentMeta;
  position: { x: number; y: number };
  nodeWidth: number;
  scale: number;
  onRegenerateExperiment?: (nodeId: string, mode: ExperimentMode) => void;
}

const MODE_LABELS: Record<ExperimentMode, string> = {
  whatif: 'What-If Scenario',
  risk: 'Risk Analysis',
  enhancement: 'Enhancement',
  prompt: 'Custom Prompt',
};

const MODE_DESCRIPTIONS: Record<ExperimentMode, string> = {
  whatif: 'Explore alternative paths and scenarios',
  risk: 'Identify potential failure points',
  enhancement: 'Suggest improvements and optimizations',
  prompt: 'Generate based on your custom description',
};

export function ExperimentEditButton({
  nodeId,
  experimentMeta,
  position,
  nodeWidth,
  scale,
  onRegenerateExperiment,
}: ExperimentEditButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ExperimentMode>(experimentMeta.mode);

  const handleRegenerate = useCallback(() => {
    onRegenerateExperiment?.(nodeId, selectedMode);
    setIsOpen(false);
  }, [nodeId, selectedMode, onRegenerateExperiment]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid={`experiment-edit-button-${nodeId}`}
          className="absolute flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 border border-purple-300 hover:bg-purple-200 transition-colors cursor-pointer z-50"
          style={{
            left: position.x + nodeWidth - 8,
            top: position.y - 8,
            transform: `scale(${1 / scale})`,
            transformOrigin: 'center center',
          }}
          title="Edit experiment settings"
        >
          <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-4" 
        align="end"
        data-testid={`experiment-edit-popover-${nodeId}`}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-600" />
            <h4 className="font-medium text-sm">Experiment Settings</h4>
          </div>
          
          <div className="text-xs text-gray-500">
            This node was created from an experiment. You can regenerate it with different settings.
          </div>

          <div className="space-y-2">
            <Label htmlFor={`mode-select-${nodeId}`} className="text-xs font-medium">
              Experiment Mode
            </Label>
            <Select
              value={selectedMode}
              onValueChange={(value) => setSelectedMode(value as ExperimentMode)}
            >
              <SelectTrigger 
                id={`mode-select-${nodeId}`}
                className="h-9"
                data-testid={`experiment-mode-select-${nodeId}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABELS) as ExperimentMode[]).map((mode) => (
                  <SelectItem 
                    key={mode} 
                    value={mode}
                    data-testid={`experiment-mode-option-${mode}`}
                  >
                    <div className="flex flex-col">
                      <span>{MODE_LABELS[mode]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              {MODE_DESCRIPTIONS[selectedMode]}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              data-testid={`experiment-cancel-${nodeId}`}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRegenerate}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              data-testid={`experiment-regenerate-${nodeId}`}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Regenerate
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ExperimentEditButton;
