import { useState, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, ArrowUp } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { FullBleedSection } from '@/components/layout/FullBleedSection';

interface HomeHeroProps {
  onStartDesigning: (prompt: string) => void;
  onImportFigma?: () => void;
  onUploadImage: () => void;
  onUploadDocument?: () => void;
  isGenerating?: boolean;
  isDisabled?: boolean;
}

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

  const handleStartDesigning = useCallback(() => {
    if (promptValue.trim() && !isDisabled) {
      onStartDesigning(promptValue.trim());
    }
  }, [promptValue, onStartDesigning, isDisabled]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && promptValue.trim() && !isGenerating && !isDisabled) {
      handleStartDesigning();
    }
  }, [promptValue, isGenerating, isDisabled, handleStartDesigning]);

  const canSubmit = promptValue.trim().length > 0 && !isGenerating && !isDisabled;

  return (
    <FullBleedSection className="mb-10">
      <div className="absolute inset-0 kiteframe-ambient-gradient" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="relative z-10 py-16 flex flex-col items-center max-w-6xl mx-auto px-6">
        <div 
          className={`relative w-full max-w-2xl bg-white dark:bg-card rounded-2xl shadow-xl border border-border/50 ${isDisabled ? 'opacity-60' : ''}`}
          style={{ minHeight: '280px' }}
        >
          <div className="p-6 pb-20">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              What would you like to build?
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              Describe your workflow, upload a photo, import from Figma, or start brainstorming with KiteAI
            </p>

            <Textarea
              ref={textareaRef}
              placeholder="Describe what you want to build..."
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base p-0 placeholder:text-muted-foreground/60"
              disabled={isDisabled}
              data-testid="input-hero-prompt"
            />
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div className="flex items-center gap-2">
              {onImportFigma && (
                <button
                  onClick={onImportFigma}
                  disabled={isDisabled}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm disabled:opacity-50"
                  data-testid="button-hero-figma"
                >
                  <SiFigma className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium text-xs">Figma</div>
                    <div className="text-[10px] opacity-70">Import design</div>
                  </div>
                </button>
              )}
              <button
                onClick={onUploadImage}
                disabled={isDisabled}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm disabled:opacity-50"
                data-testid="button-hero-image"
              >
                <Upload className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-medium text-xs">Image</div>
                  <div className="text-[10px] opacity-70">Upload photo</div>
                </div>
              </button>
              {onUploadDocument && (
                <button
                  onClick={onUploadDocument}
                  disabled={isDisabled}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm disabled:opacity-50"
                  data-testid="button-hero-document"
                >
                  <FileText className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium text-xs">Document</div>
                    <div className="text-[10px] opacity-70">Upload file</div>
                  </div>
                </button>
              )}
            </div>

            <button
              onClick={handleStartDesigning}
              disabled={!canSubmit}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                canSubmit 
                  ? 'bg-foreground text-background hover:bg-foreground/90 cursor-pointer' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
              data-testid="button-start-designing"
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </FullBleedSection>
  );
}
