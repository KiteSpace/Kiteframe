export type PromptAttachmentType = 'figma' | 'image' | 'document';

export interface PromptAttachment {
  id: string;
  type: PromptAttachmentType;
  displayName: string;
  thumbnailUrl?: string;
  status: 'loading' | 'ready' | 'error';
  errorMessage?: string;
  metadata?: {
    fileKey?: string;
    fileName?: string;
    nodeId?: string;
    fileSize?: number;
    mimeType?: string;
  };
  file?: File;
}

export interface PromptContext {
  textInput: string;
  attachments: PromptAttachment[];
}

export const MAX_FIGMA_ATTACHMENTS = 1;
export const MAX_IMAGE_ATTACHMENTS = 3;

export function canAddFigma(attachments: PromptAttachment[]): boolean {
  const figmaCount = attachments.filter(a => a.type === 'figma').length;
  return figmaCount < MAX_FIGMA_ATTACHMENTS;
}

export function canAddImage(attachments: PromptAttachment[]): boolean {
  const imageCount = attachments.filter(a => a.type === 'image').length;
  return imageCount < MAX_IMAGE_ATTACHMENTS;
}

export function isReadyToSend(context: PromptContext): boolean {
  const hasText = context.textInput.trim().length > 0;
  const hasReadyAttachments = context.attachments.some(a => a.status === 'ready');
  const hasLoadingAttachments = context.attachments.some(a => a.status === 'loading');
  return (hasText || hasReadyAttachments) && !hasLoadingAttachments;
}

export function hasAttachments(context: PromptContext): boolean {
  return context.attachments.length > 0;
}

export function createEmptyContext(): PromptContext {
  return {
    textInput: '',
    attachments: [],
  };
}
