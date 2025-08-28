import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { useAi } from '../ai/AiProvider';

interface AiSettings {
  provider: string;
  model: string;
  customModel?: string;
  apiKey: string;
  temperature: number;
  customEndpoint?: string;
}

interface AiSettingsModalProps {
  onClose: () => void;
  onSave: (settings: AiSettings) => void;
}

export function AiSettingsModal({ onClose, onSave }: AiSettingsModalProps) {
  const [settings, setSettings] = useState<AiSettings>({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    temperature: 0.7
  });

  // Provider-specific model options
  const modelOptions = {
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'custom', label: 'Custom Model' }
    ],
    anthropic: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
      { value: 'custom', label: 'Custom Model' }
    ],
    custom: [
      { value: 'custom', label: 'Custom Model' }
    ]
  };
  const [isTestingApi, setIsTestingApi] = useState(false);
  const { toast } = useToast();
  const aiClient = useAi();

  useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem('ai_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.warn('Failed to parse saved AI settings');
      }
    }
    
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setSettings(prev => ({ ...prev, apiKey: savedApiKey }));
    }
  }, []);

  const handleProviderChange = (provider: string) => {
    const currentModels = modelOptions[provider as keyof typeof modelOptions] || modelOptions.custom;
    const defaultModel = currentModels[0]?.value || 'custom';
    
    setSettings(prev => ({ 
      ...prev, 
      provider,
      model: defaultModel,
      customModel: provider === 'custom' ? prev.customModel : '',
      customEndpoint: provider === 'custom' ? prev.customEndpoint || 'https://api.openai.com' : ''
    }));
  };

  const handleModelChange = (model: string) => {
    setSettings(prev => ({ 
      ...prev, 
      model,
      customModel: model === 'custom' ? prev.customModel || '' : ''
    }));
  };

  const handleSave = () => {
    if (!settings.apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your API key to use AI features.",
        variant: "destructive"
      });
      return;
    }

    if (settings.model === 'custom' && !settings.customModel?.trim()) {
      toast({
        title: "Custom Model Required",
        description: "Please specify a custom model name when using custom model option.",
        variant: "destructive"
      });
      return;
    }

    if (settings.provider === 'custom' && !settings.customEndpoint?.trim()) {
      toast({
        title: "Custom Endpoint Required",
        description: "Please specify a custom API endpoint when using custom provider.",
        variant: "destructive"
      });
      return;
    }

    onSave(settings);
  };

  const handleQuickTest = async () => {
    if (!settings.apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your API key to test the connection.",
        variant: "destructive"
      });
      return;
    }

    if (settings.model === 'custom' && !settings.customModel?.trim()) {
      toast({
        title: "Custom Model Required",
        description: "Please specify a custom model name first.",
        variant: "destructive"
      });
      return;
    }

    setIsTestingApi(true);
    try {
      // Determine actual model to test
      const modelToTest = settings.model === 'custom' ? settings.customModel : settings.model;
      
      const response = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          model: modelToTest,
          apiKey: settings.apiKey,
          customEndpoint: settings.customEndpoint
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        toast({
          title: "Connection Successful",
          description: `${settings.provider.toUpperCase()} API is working correctly with ${modelToTest}!`,
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
      <DialogContent className="max-w-md" data-testid="modal-ai-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-robot text-primary" />
            AI Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">API Provider</Label>
            <Select
              value={settings.provider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger data-testid="select-ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="custom">Custom Endpoint</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={settings.model}
              onValueChange={handleModelChange}
            >
              <SelectTrigger data-testid="select-ai-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(modelOptions[settings.provider as keyof typeof modelOptions] || []).map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settings.model === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customModel">Custom Model Name</Label>
              <Input
                id="customModel"
                placeholder="e.g., gpt-4-turbo, claude-3-opus"
                value={settings.customModel || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, customModel: e.target.value }))}
                data-testid="input-custom-model"
              />
            </div>
          )}

          {settings.provider === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customEndpoint">Custom Endpoint</Label>
              <Input
                id="customEndpoint"
                placeholder="https://api.example.com"
                value={settings.customEndpoint || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, customEndpoint: e.target.value }))}
                data-testid="input-custom-endpoint"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="apiKey">
              API Key 
              {settings.provider === 'openai' && ' (OpenAI)'}
              {settings.provider === 'anthropic' && ' (Anthropic)'}
              {settings.provider === 'custom' && ' (Custom Provider)'}
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your API key"
              value={settings.apiKey}
              onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
              data-testid="input-api-key"
            />
            <p className="text-xs text-muted-foreground">
              Keys are stored temporarily for demo purposes only
            </p>
          </div>
          
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
                  <i className="fas fa-spinner fa-spin mr-2" />
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
