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
  apiKey: string;
  temperature: number;
}

interface AiSettingsModalProps {
  onClose: () => void;
  onSave: (settings: AiSettings) => void;
}

export function AiSettingsModal({ onClose, onSave }: AiSettingsModalProps) {
  const [settings, setSettings] = useState<AiSettings>({
    provider: 'openai',
    model: 'gpt-5', // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    apiKey: '',
    temperature: 0.7
  });
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

  const handleSave = () => {
    if (!settings.apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your API key to use AI features.",
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

    setIsTestingApi(true);
    try {
      const response = await aiClient.chat({
        model: settings.model,
        messages: [{ role: 'user', content: 'Reply with just "Hello!" to test the connection.' }],
        temperature: 0.1,
        maxTokens: 10
      });
      
      if (response.text.toLowerCase().includes('hello')) {
        toast({
          title: "Connection Successful",
          description: "AI API is working correctly!",
          variant: "default"
        });
      } else {
        toast({
          title: "Unexpected Response",
          description: "Connection works but got unexpected response.",
          variant: "default"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to AI service.",
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
              onValueChange={(value) => setSettings(prev => ({ ...prev, provider: value }))}
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
              onValueChange={(value) => setSettings(prev => ({ ...prev, model: value }))}
            >
              <SelectTrigger data-testid="select-ai-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-5">GPT-5</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
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
