import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Upload, FileText } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { motion } from 'framer-motion';

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
    <div className="relative overflow-hidden rounded-2xl mb-10">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, hsl(220, 20%, 95%) 0%, hsl(280, 15%, 93%) 25%, hsl(200, 18%, 94%) 50%, hsl(260, 12%, 95%) 75%, hsl(220, 20%, 95%) 100%)',
            backgroundSize: '400% 400%',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{
            duration: 30,
            ease: 'linear',
            repeat: Infinity,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
      </div>

      <div className="dark:hidden absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, hsl(220, 20%, 95%) 0%, hsl(280, 15%, 93%) 25%, hsl(200, 18%, 94%) 50%, hsl(260, 12%, 95%) 75%, hsl(220, 20%, 95%) 100%)',
            backgroundSize: '400% 400%',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{
            duration: 30,
            ease: 'linear',
            repeat: Infinity,
          }}
        />
      </div>
      <div className="hidden dark:block absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, hsl(220, 15%, 12%) 0%, hsl(280, 10%, 14%) 25%, hsl(200, 12%, 13%) 50%, hsl(260, 8%, 15%) 75%, hsl(220, 15%, 12%) 100%)',
            backgroundSize: '400% 400%',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
          }}
          transition={{
            duration: 30,
            ease: 'linear',
            repeat: Infinity,
          }}
        />
      </div>

      <div className="relative z-10 px-8 py-12 flex flex-col items-center">
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
              className="text-xs px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
