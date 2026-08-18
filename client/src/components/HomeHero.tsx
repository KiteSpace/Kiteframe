import { useState, useCallback, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, ArrowUp, Lock, ChevronDown, Paintbrush, GitBranch, Check } from "lucide-react";
import { SiFigma } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FullBleedSection } from "@/components/layout/FullBleedSection";
import { InlineFigmaImport } from "./home/InlineFigmaImport";
import { AttachmentPreviewList } from "./attachments/AttachmentPreview";
import { usePromptContextStore } from "@/contexts/PromptContextStore";
import type { PromptAttachment } from "@/types/promptContext";

interface HomeHeroProps {
  onStartDesigning: (prompt: string) => void;
  onImportFigma?: () => boolean;
  onUploadImage: (files: FileList) => boolean;
  onUploadDocument?: () => void;
  isGenerating?: boolean;
  isDisabled?: boolean;
  isImageLocked?: boolean;
  generationMode?: "workflow" | "design";
  onGenerationModeChange?: (mode: "workflow" | "design") => void;
  isInterfaceGenerating?: boolean;
}

export function HomeHero({
  onStartDesigning,
  onImportFigma,
  onUploadImage,
  onUploadDocument,
  isGenerating = false,
  isDisabled = false,
  isImageLocked = false,
  generationMode = "workflow",
  onGenerationModeChange,
  isInterfaceGenerating = false,
}: HomeHeroProps) {
  const {
    context,
    setTextInput,
    addAttachment,
    removeAttachment,
    isReadyToSend,
    hasAttachments,
    canAddFigma,
    canAddImage,
    setOrigin,
  } = usePromptContextStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFigmaPanel, setShowFigmaPanel] = useState(false);

  useEffect(() => {
    setOrigin("homepage");
  }, [setOrigin]);

  const hasFigmaAttachment = !canAddFigma();
  const canAddMoreImages = canAddImage();
  const hasAnyAttachments = hasAttachments();

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTextInput(e.target.value);
    },
    [setTextInput],
  );

  const handleStartDesigning = useCallback(() => {
    if (isReadyToSend() && !isDisabled) {
      onStartDesigning(context.textInput.trim());
    }
  }, [context.textInput, isReadyToSend, onStartDesigning, isDisabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        (e.metaKey || e.ctrlKey) &&
        isReadyToSend() &&
        !isGenerating &&
        !isDisabled
      ) {
        handleStartDesigning();
      }
    },
    [isReadyToSend, isGenerating, isDisabled, handleStartDesigning],
  );

  const handleFigmaToggle = useCallback(() => {
    if (!hasFigmaAttachment) {
      if (onImportFigma && !onImportFigma()) {
        return;
      }
      setShowFigmaPanel(!showFigmaPanel);
    }
  }, [hasFigmaAttachment, onImportFigma, showFigmaPanel]);

  const handleFigmaAttachmentAdd = useCallback(
    (attachment: PromptAttachment) => {
      addAttachment(attachment);
      setShowFigmaPanel(false);
    },
    [addAttachment],
  );

  const handleImageClick = useCallback(() => {
    if (canAddMoreImages) {
      const emptyInput = document.createElement("input");
      emptyInput.type = "file";
      if (!onUploadImage(emptyInput.files as FileList)) {
        return;
      }
      fileInputRef.current?.click();
    }
  }, [canAddMoreImages, onUploadImage]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const imageCount = context.attachments.filter(
        (a) => a.type === "image",
      ).length;
      const remainingSlots = 1 - imageCount;
      const filesToAdd = Array.from(files).slice(0, remainingSlots);

      filesToAdd.forEach((file) => {
        const attachmentId = `image-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const thumbnailUrl = URL.createObjectURL(file);

        const attachment: PromptAttachment = {
          id: attachmentId,
          type: "image",
          displayName: file.name,
          thumbnailUrl,
          status: "ready",
          metadata: {
            fileSize: file.size,
            mimeType: file.type,
          },
          file,
        };

        addAttachment(attachment);
      });

      if (e.target) {
        e.target.value = "";
      }
    },
    [context.attachments, addAttachment],
  );

  const canSubmit = isReadyToSend() && !isGenerating && !isDisabled;

  const placeholderText = hasAnyAttachments
    ? "Do you have any additional details to add before we get started?"
    : "Describe your workflow, upload a photo, or start brainstorming with KiteAI";

  return (
    <FullBleedSection className="mb-10">
      {/* <div className="absolute inset-0 kiteframe-ambient-gradient" /> */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="relative z-10 py-20 pb-32 flex flex-col items-center max-w-6xl mx-auto px-6">
        <div
          className={`relative w-full max-w-4xl bg-white dark:bg-card rounded-2xl shadow-xl border border-border/50 ${isDisabled ? "opacity-60" : ""}`}
          style={{ minHeight: "280px" }}
        >
          {isInterfaceGenerating && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/80 backdrop-blur-sm">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">Generating your interface…</p>
            </div>
          )}
          <div className="p-6 pb-20">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              What are we working on today?
            </h1>

            {context.attachments.length > 0 && (
              <div className="mb-4">
                <AttachmentPreviewList
                  attachments={context.attachments}
                  onRemove={removeAttachment}
                  size="compact"
                  columns={2}
                />
              </div>
            )}

            {showFigmaPanel && (
              <div className="mb-4">
                <InlineFigmaImport
                  isExpanded={showFigmaPanel}
                  onToggle={handleFigmaToggle}
                  onAttachmentAdd={handleFigmaAttachmentAdd}
                  isDisabled={isDisabled}
                  hasExistingFigma={hasFigmaAttachment}
                />
              </div>
            )}

            <Textarea
              ref={textareaRef}
              placeholder={placeholderText}
              value={context.textInput}
              onChange={handleTextChange}
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
                  onClick={handleFigmaToggle}
                  disabled={isDisabled || hasFigmaAttachment}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                    hasFigmaAttachment
                      ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                  } disabled:opacity-50`}
                  data-testid="button-hero-figma"
                >
                  <SiFigma className="w-4 h-4" />
                  <div className="text-left">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-xs">Figma</span>
                      <span className="text-[9px] px-1 py-0.5 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded font-medium">Early Access</span>
                    </div>
                    <div className="text-[10px] opacity-70">
                      {hasFigmaAttachment ? "1/1 added" : "Import design"}
                    </div>
                  </div>
                </button>
              )}
              <button
                onClick={handleImageClick}
                disabled={isDisabled || (!isImageLocked && !canAddMoreImages)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                  isImageLocked
                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                    : !canAddMoreImages
                      ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                } disabled:opacity-50`}
                title={isImageLocked ? "Upgrade to Advanced to use image-to-workflow" : undefined}
                data-testid="button-hero-image"
              >
                {isImageLocked ? <Lock className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                <div className="text-left">
                  <div className="font-medium text-xs flex items-center gap-1">
                    Image
                    {isImageLocked && <span className="text-[9px] px-1 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded font-medium">Advanced</span>}
                  </div>
                  <div className="text-[10px] opacity-70">
                    {isImageLocked
                      ? "Upgrade to use"
                      : !canAddMoreImages
                        ? "1/1 added"
                        : `${context.attachments.filter((a) => a.type === "image").length}/1 added`}
                  </div>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file-upload"
              />
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

            <div className="flex items-center gap-2">
              {onGenerationModeChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={isDisabled}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-generation-mode"
                    >
                      {generationMode === "design" ? (
                        <Paintbrush className="w-3.5 h-3.5" />
                      ) : (
                        <GitBranch className="w-3.5 h-3.5" />
                      )}
                      <span>{generationMode === "design" ? "Design" : "Workflow"}</span>
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={() => onGenerationModeChange("workflow")}
                      className="flex items-center gap-2"
                    >
                      <GitBranch className="w-4 h-4" />
                      <span>Workflow</span>
                      {generationMode === "workflow" && (
                        <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onGenerationModeChange("design")}
                      className="flex items-center gap-2"
                    >
                      <Paintbrush className="w-4 h-4" />
                      <span>Design</span>
                      {generationMode === "design" && (
                        <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                onClick={handleStartDesigning}
                disabled={!canSubmit}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  canSubmit
                    ? "bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
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
      </div>
    </FullBleedSection>
  );
}
