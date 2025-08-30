import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      { value: 'gpt-5', label: 'GPT-5' },
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
    ollama: [
      { value: 'llama3.1:8b', label: 'Llama 3.1 8B' },
      { value: 'llama3.1:70b', label: 'Llama 3.1 70B' },
      { value: 'llama3.2:3b', label: 'Llama 3.2 3B' },
      { value: 'mistral:7b', label: 'Mistral 7B' },
      { value: 'codellama:7b', label: 'CodeLlama 7B' },
      { value: 'phi3:mini', label: 'Phi-3 Mini' },
      { value: 'custom', label: 'Custom Model' }
    ],
    kiteframe: [
      { value: 'llama3.2:3b', label: 'Llama 3.2 3B (Available)' },
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
        // Fix legacy settings with wrong models
        const fixedSettings = { ...parsed };
        if (fixedSettings.provider === 'openai' && fixedSettings.model === 'gpt-5') {
          fixedSettings.model = 'gpt-4o';
        }
        if (fixedSettings.provider === 'kiteframe' && fixedSettings.model === 'tinyllama:1.1b') {
          fixedSettings.model = 'llama3.2:3b';
        }
        setSettings(prev => ({ ...prev, ...fixedSettings }));
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
      customEndpoint: provider === 'ollama' ? 'http://localhost:11434' : 
                      provider === 'kiteframe' ? 'https://kiteline-ai.replit.app' :
                      provider === 'custom' ? prev.customEndpoint || 'https://api.openai.com' : ''
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
    // Ollama and Kiteframe don't require user API keys
    if (settings.provider !== 'ollama' && settings.provider !== 'kiteframe' && !settings.apiKey.trim()) {
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
    // Ollama and Kiteframe don't require user API keys
    if (settings.provider !== 'ollama' && settings.provider !== 'kiteframe' && !settings.apiKey.trim()) {
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
          model: modelToTest || undefined, // Let server set defaults if empty
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="modal-ai-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="text-primary" size={20} />
            AI Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-base font-medium">Privacy Level</Label>
            <div className="grid grid-cols-1 gap-3">
              {/* Maximum Privacy */}
              <div className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                settings.provider === 'ollama' || settings.provider === 'custom' || settings.provider === 'kiteframe'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
              }`}
              onClick={() => setSettings({ ...settings, provider: 'kiteframe' })}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                  <div className="flex-1">
                    <h3 className="font-medium text-green-800 dark:text-green-200">Maximum Privacy</h3>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Data stays on your machine or private server. Zero external data sharing.
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Kiteframe Managed • Local Ollama • Remote Ollama • Custom Endpoint
                    </p>
                  </div>
                </div>
              </div>

              {/* Standard Privacy */}
              <div className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                settings.provider === 'openai' || settings.provider === 'anthropic'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
              onClick={() => setSettings({ ...settings, provider: 'openai' })}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-800 dark:text-blue-200">Standard Privacy</h3>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Convenient cloud AI with established privacy policies.
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      OpenAI • Anthropic • Major cloud providers
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Select Provider</Label>
            <Select
              value={settings.provider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger data-testid="select-ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-4, GPT-5)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="kiteframe">Kiteframe (Managed Privacy)</SelectItem>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="custom">Custom Endpoint</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {settings.provider === 'openai' && (
            <div className="space-y-2">
              <Label>Model</Label>
              <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md text-sm">
                ✅ Using: <strong>GPT-4o</strong> (latest OpenAI model, no setup required)
              </div>
            </div>
          )}

          {settings.provider === 'kiteframe' && (
            <div className="space-y-2">
              <Label>Model</Label>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md text-sm">
                🔒 Using: <strong>Llama 3.2 3B</strong> (privacy-focused processing, no setup required)
              </div>
            </div>
          )}

          {settings.provider !== 'openai' && settings.provider !== 'kiteframe' && (
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
          )}

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
                placeholder="https://your-ollama-server.com"
                value={settings.customEndpoint || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, customEndpoint: e.target.value }))}
                data-testid="input-custom-endpoint"
              />
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p>Examples:</p>
                <p>• <code>https://ollama.your-domain.com</code> (recommended)</p>
                <p>• <code>http://192.168.1.100:11434</code> (local network)</p>
                <p>• <code>https://your-server.ngrok.io</code> (tunnel)</p>
              </div>
            </div>
          )}

          {settings.provider === 'ollama' && (
            <div className="space-y-2">
              <Label htmlFor="ollamaEndpoint">Ollama Endpoint (Optional)</Label>
              <Input
                id="ollamaEndpoint"
                placeholder="http://localhost:11434 (default)"
                value={settings.customEndpoint || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, customEndpoint: e.target.value }))}
                data-testid="input-ollama-endpoint"
              />
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <p>Leave empty for local Ollama (localhost:11434)</p>
                <p>Or specify your remote Ollama server URL</p>
              </div>
            </div>
          )}

          {settings.provider === 'ollama' && (
            <div className="space-y-2">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  🔒 Maximum Privacy Mode
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Your data never leaves your control - zero external sharing
                </p>
                <div className="text-xs text-green-600 dark:text-green-400 mt-2 space-y-1">
                  <div>• <strong>Local:</strong> Install Ollama on your machine</div>
                  <div>• <strong>Remote:</strong> Run Ollama on your own server</div>
                  <div>• <strong>Custom:</strong> Use "Custom Endpoint" for private Ollama servers</div>
                </div>
              </div>
            </div>
          )}

          {settings.provider === 'custom' && (
            <div className="space-y-2">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  🔒 Private Endpoint Mode
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Connect to your own AI service for complete data control
                </p>
                <div className="text-xs text-green-600 dark:text-green-400 mt-2 space-y-1">
                  <div>• <strong>Recommended:</strong> Your own Ollama server</div>
                  <div>• <strong>Alternative:</strong> Other self-hosted AI services</div>
                  <div>• <strong>Format:</strong> https://your-server.com (no /v1 needed)</div>
                </div>
              </div>
            </div>
          )}

          {settings.provider === 'kiteframe' && (
            <div className="space-y-2">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  🚀 Kiteframe Managed Privacy
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Maximum privacy with zero setup - KitelineAI runs secure Ollama for you
                </p>
                <div className="text-xs text-green-600 dark:text-green-400 mt-2 space-y-1">
                  <div>• <strong>No API key required</strong> - Ready to use immediately</div>
                  <div>• <strong>Data never stored</strong> - Processed only, never saved</div>
                  <div>• <strong>Private infrastructure</strong> - Your own dedicated AI server</div>
                  <div>• <strong>Model</strong> - Llama 3.2 3B (advanced reasoning)</div>
                  <div>• <strong>Cost optimized</strong> - Scales to zero when not in use</div>
                </div>
              </div>
            </div>
          )}

          {(settings.provider === 'openai' || settings.provider === 'anthropic') && (
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  ☁️ Cloud AI Service
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Convenient and reliable, with established privacy policies
                </p>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 space-y-1">
                  <div>• Data processed by {settings.provider === 'openai' ? 'OpenAI' : 'Anthropic'}</div>
                  <div>• Check their privacy policy for data handling details</div>
                  <div>• {settings.provider === 'openai' ? 'No API key needed - automatically configured' : 'API key required for authentication'}</div>
                </div>
              </div>
            </div>
          )}
          
          {settings.provider !== 'ollama' && settings.provider !== 'kiteframe' && settings.provider !== 'openai' && (
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
