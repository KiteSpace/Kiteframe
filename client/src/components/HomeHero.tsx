import { useState, useCallback, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, ArrowUp } from "lucide-react";
import { SiFigma } from "react-icons/si";
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
}

export function HomeHero({
  onStartDesigning,
  onImportFigma,
  onUploadImage,
  onUploadDocument,
  isGenerating = false,
  isDisabled = false,
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
      const remainingSlots = 3 - imageCount;
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
    : "Describe your workflow, upload a photo, import from Figma, or start brainstorming with KiteAI";

  return (
    <FullBleedSection className="mb-10">
      <div className="absolute inset-0 kiteframe-ambient-gradient" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="relative z-10 py-20 pb-32 flex flex-col items-center max-w-6xl mx-auto px-6">
        <div
          className={`relative w-full max-w-4xl bg-white dark:bg-card rounded-2xl shadow-xl border border-border/50 ${isDisabled ? "opacity-60" : ""}`}
          style={{ minHeight: "280px" }}
        >
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
                    <div className="font-medium text-xs">Figma</div>
                    <div className="text-[10px] opacity-70">
                      {hasFigmaAttachment ? "1/1 added" : "Import design"}
                    </div>
                  </div>
                </button>
              )}
              <button
                onClick={handleImageClick}
                disabled={isDisabled || !canAddMoreImages}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                  !canAddMoreImages
                    ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                } disabled:opacity-50`}
                data-testid="button-hero-image"
              >
                <Upload className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-medium text-xs">Image</div>
                  <div className="text-[10px] opacity-70">
                    {!canAddMoreImages
                      ? "3/3 added"
                      : `${context.attachments.filter((a) => a.type === "image").length}/3 added`}
                  </div>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
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
    </FullBleedSection>
  );
}
