import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { usePromptContextStore } from '@/contexts/PromptContextStore';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KiteAIChatBrain, type WorkflowDraft } from '@/components/KiteAIChat';
import { AiProvider } from '@/ai/AiProvider';
import { OpenAICompatClient } from '@/ai/OpenAICompatClient';

export default function FullScreenChat() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const promptContextStore = usePromptContextStore();
  
  const aiClient = useMemo(() => {
    let baseURL = "/api/ai";
    const savedSettings = localStorage.getItem("ai_settings");
    let defaultModel = "gpt-4o";

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.provider === "custom" && settings.customEndpoint) {
          baseURL = settings.customEndpoint;
        } else if (settings.provider === "anthropic") {
          baseURL = "https://api.anthropic.com/v1";
        }
        defaultModel =
          settings.model === "custom" && settings.customModel
            ? settings.customModel
            : settings.model || defaultModel;
      } catch (e) {
        console.warn("Failed to parse saved AI settings");
      }
    }

    return new OpenAICompatClient({
      baseURL,
      apiKey: localStorage.getItem("openai_api_key") || "",
      defaultModel,
    });
  }, []);
  
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [promptConsumed, setPromptConsumed] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const prompt = params.get('prompt');
    // Set initialPrompt even if empty string - attachments-only case handled in KiteAIChat
    // Only skip if prompt is null (no param at all) or already consumed
    if (prompt !== null && !promptConsumed) {
      // For empty string, set to null to let attachments-only effect handle it
      setInitialPrompt(prompt || null);
    }
  }, [searchString, promptConsumed]);
  
  const handleInitialPromptConsumed = useCallback(() => {
    setPromptConsumed(true);
    setInitialPrompt(null);
  }, []);
  
  const handleCreateWorkflow = useCallback((draft: WorkflowDraft) => {
    localStorage.setItem('kiteframe-pending-workflow-draft', JSON.stringify(draft));
    navigate('/app?fromChat=true');
  }, [navigate]);
  
  const handleBack = useCallback(() => {
    navigate('/app');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-fullscreen-chat">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center px-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBack}
            className="mr-4"
            data-testid="button-back-home"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <span className="font-semibold">KiteAI Chat</span>
          </div>
        </div>
      </header>
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-6 flex flex-col">
        <AiProvider client={aiClient}>
          <KiteAIChatBrain
            mode="fullscreen"
            nodes={[]}
            edges={[]}
            canvasObjects={[]}
            initialPrompt={initialPrompt || undefined}
            onInitialPromptConsumed={handleInitialPromptConsumed}
            onCreateWorkflow={handleCreateWorkflow}
          />
        </AiProvider>
      </main>
    </div>
  );
}
