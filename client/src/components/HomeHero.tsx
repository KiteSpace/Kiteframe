import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Upload, FileText } from 'lucide-react';
import { SiFigma } from 'react-icons/si';

interface HomeHeroProps {
  onStartDesigning: (prompt: string) => void;
  onImportFigma?: () => void;
  onUploadImage: () => void;
  onUploadDocument?: () => void;
  isGenerating?: boolean;
  isDisabled?: boolean;
}

const quickExamples = [
  { label: 'User Onboarding', prompt: 'Create a user onboarding workflow that includes account creation, email verification, profile setup, and a welcome tutorial' },
  { label: 'API Handler', prompt: 'Design an API request handling workflow with authentication, rate limiting, request validation, processing, and response formatting' },
  { label: 'Support Tree', prompt: 'Build a customer support decision tree workflow that routes inquiries to the right department based on issue type and priority' },
];

export function HomeHero({
  onStartDesigning,
  onImportFigma,
  onUploadImage,
  onUploadDocument,
  isGenerating = false,
  isDisabled = false
}: HomeHeroProps) {
  const [promptValue, setPromptValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleExampleClick = useCallback((prompt: string) => {
    setPromptValue(prompt);
    textareaRef.current?.focus();
  }, []);

  const handleStartDesigning = useCallback(() => {
    if (promptValue.trim() || !isDisabled) {
      onStartDesigning(promptValue.trim());
    }
  }, [promptValue, onStartDesigning, isDisabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && promptValue.trim() && !isGenerating && !isDisabled) {
      handleStartDesigning();
    }
  }, [promptValue, isGenerating, isDisabled, handleStartDesigning]);

  return (
    <div className="relative w-full -mx-6 px-6 mb-10">
      <div className="absolute inset-0 kiteframe-ambient-gradient" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="relative z-10 py-16 flex flex-col items-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
            What would you like to build?
          </h1>
          <p className="text-muted-foreground">
            Describe your workflow, upload a design, or import from Figma
          </p>
        </div>

        <div className={`w-full max-w-2xl bg-card/90 backdrop-blur-sm border border-border rounded-xl p-4 shadow-lg ${isDisabled ? 'opacity-60' : ''}`}>
          <Textarea
            ref={textareaRef}
            placeholder="Describe the workflow you want to create..."
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            disabled={isDisabled}
            data-testid="input-hero-prompt"
          />

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              {onImportFigma && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onImportFigma}
                  disabled={isDisabled}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-hero-figma"
                >
                  <SiFigma className="w-4 h-4 mr-1.5" />
                  Figma
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onUploadImage}
                disabled={isDisabled}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-hero-image"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Image
              </Button>
              {onUploadDocument && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUploadDocument}
                  disabled={isDisabled}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-hero-document"
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  Document
                </Button>
              )}
            </div>

            <Button
              onClick={handleStartDesigning}
              disabled={isGenerating || isDisabled}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-start-designing"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Working...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start designing
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {quickExamples.map((example) => (
            <button
              key={example.label}
              onClick={() => handleExampleClick(example.prompt)}
              className="text-xs px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
              disabled={isDisabled}
              data-testid={`button-example-${example.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
