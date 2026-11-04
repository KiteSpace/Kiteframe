import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useAi } from '../ai/AiProvider';
import { Bot, Loader2 } from 'lucide-react';

interface AiSettings {
  provider: string;
  model: string;
  apiKey: string;
  temperature: number;
}

interface AiSettingsModalProps {
  onClose: () => void;
  onSave: (settings: AiSettings) => void;
}

export function AiSettingsModal({ onClose, onSave }: AiSettingsModalProps) {
  const [settings, setSettings] = useState<AiSettings>({
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: '',
    temperature: 0.7
  });

  const modelOptions = {
    anthropic: [
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
      { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Recommended)' },
      { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5 (Most Capable)' },
    ]
  };

  const [isTestingApi, setIsTestingApi] = useState(false);
  const { toast } = useToast();
  const aiClient = useAi();

  useEffect(() => {
    const migrationKey = 'ai_settings_claude_migration_v3';
    if (!localStorage.getItem(migrationKey)) {
      localStorage.removeItem('ai_settings');
      localStorage.setItem(migrationKey, 'true');
    }

    const saved = localStorage.getItem('ai_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const fixedSettings = { ...parsed };

        // Migrate any GPT/OpenAI settings to Claude
        if (fixedSettings.provider !== 'anthropic') {
          fixedSettings.provider = 'anthropic';
          fixedSettings.model = 'claude-sonnet-4-5-20250929';
          fixedSettings.apiKey = '';
        }
        delete fixedSettings.customEndpoint;
        delete fixedSettings.customModel;

        // Fix invalid model names
        if (fixedSettings.provider === 'anthropic' && (
          !fixedSettings.model ||
          fixedSettings.model.includes('gpt') ||
          fixedSettings.model.includes('gpt-5') ||
          !['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'].includes(fixedSettings.model)
        )) {
          fixedSettings.model = 'claude-sonnet-4-5-20250929';
        }

        setSettings(prev => ({ ...prev, ...fixedSettings }));
      } catch (e) {
        console.warn('Failed to parse saved AI settings');
      }
    }
  }, []);

  const handleModelChange = (model: string) => {
    setSettings(prev => ({ ...prev, model }));
  };

  const handleSave = () => {
    onSave(settings);
  };

  const handleQuickTest = async () => {
    setIsTestingApi(true);
    try {
      const modelToTest = settings.model;

      const response = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'anthropic',
          model: modelToTest || undefined,
          apiKey: settings.apiKey
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Connection Successful",
          description: `Claude is working correctly with ${modelToTest}!`,
          variant: "default"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Failed to connect to AI service.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to test AI connection.",
        variant: "destructive"
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="modal-ai-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="text-primary" size={20} />
            AI Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {settings.provider === 'anthropic' && (
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={settings.model}
                onValueChange={handleModelChange}
              >
                <SelectTrigger data-testid="select-ai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.anthropic.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="p-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md text-xs text-gray-600 dark:text-gray-400">
                <strong>Note:</strong> Workflow generation uses a system-recommended model for reliability.
                Your model selection applies to general chat only.
              </div>
            </div>
          )}

          {settings.provider === 'anthropic' && (
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  ☁️ Anthropic Claude
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Industry-leading safety and reliability
                </p>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1">
                  <div>• Data processed by Anthropic</div>
                  <div>• Check their privacy policy for data handling details</div>
                  <div>• No API key needed — automatically configured</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Temperature: {settings.temperature}</Label>
            <Slider
              value={[settings.temperature]}
              onValueChange={(value) => setSettings(prev => ({ ...prev, temperature: value[0] }))}
              max={1}
              min={0}
              step={0.1}
              className="w-full"
              data-testid="slider-temperature"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 (Focused)</span>
              <span>1 (Creative)</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleQuickTest}
              disabled={isTestingApi}
              className="flex-1"
              data-testid="button-quick-test"
            >
              {isTestingApi ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Testing...
                </>
              ) : (
                'Quick Test'
              )}
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              data-testid="button-save-ai-settings"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
