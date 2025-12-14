import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { 
  type PromptContext, 
  type PromptAttachment,
  createEmptyContext,
  isReadyToSend,
  hasAttachments,
  canAddFigma,
  canAddImage,
} from '@/types/promptContext';

type PromptOrigin = 'homepage' | 'editor' | null;

interface PromptContextStoreState {
  context: PromptContext;
  origin: PromptOrigin;
  setTextInput: (text: string) => void;
  addAttachment: (attachment: PromptAttachment) => void;
  removeAttachment: (id: string) => void;
  clearStore: () => void;
  setOrigin: (origin: PromptOrigin) => void;
  isReadyToSend: () => boolean;
  hasAttachments: () => boolean;
  canAddFigma: () => boolean;
  canAddImage: () => boolean;
}

const PromptContextStoreContext = createContext<PromptContextStoreState | null>(null);

export function PromptContextStoreProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<PromptContext>(createEmptyContext);
  const [origin, setOrigin] = useState<PromptOrigin>(null);

  const setTextInput = useCallback((text: string) => {
    setContext(prev => ({ ...prev, textInput: text }));
  }, []);

  const addAttachment = useCallback((attachment: PromptAttachment) => {
    setContext(prev => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }));
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setContext(prev => {
      const attachment = prev.attachments.find(a => a.id === id);
      if (attachment?.thumbnailUrl && attachment.type === 'image') {
        URL.revokeObjectURL(attachment.thumbnailUrl);
      }
      return {
        ...prev,
        attachments: prev.attachments.filter(a => a.id !== id),
      };
    });
  }, []);

  const clearStore = useCallback(() => {
    setContext(prev => {
      prev.attachments.forEach(a => {
        if (a.thumbnailUrl && a.type === 'image') {
          URL.revokeObjectURL(a.thumbnailUrl);
        }
      });
      return createEmptyContext();
    });
    setOrigin(null);
  }, []);

  const checkIsReadyToSend = useCallback(() => isReadyToSend(context), [context]);
  const checkHasAttachments = useCallback(() => hasAttachments(context), [context]);
  const checkCanAddFigma = useCallback(() => canAddFigma(context.attachments), [context.attachments]);
  const checkCanAddImage = useCallback(() => canAddImage(context.attachments), [context.attachments]);

  return (
    <PromptContextStoreContext.Provider
      value={{
        context,
        origin,
        setTextInput,
        addAttachment,
        removeAttachment,
        clearStore,
        setOrigin,
        isReadyToSend: checkIsReadyToSend,
        hasAttachments: checkHasAttachments,
        canAddFigma: checkCanAddFigma,
        canAddImage: checkCanAddImage,
      }}
    >
      {children}
    </PromptContextStoreContext.Provider>
  );
}

export function usePromptContextStore(): PromptContextStoreState {
  const context = useContext(PromptContextStoreContext);
  if (!context) {
    throw new Error('usePromptContextStore must be used within a PromptContextStoreProvider');
  }
  return context;
}

export function usePromptContextStoreOptional(): PromptContextStoreState | null {
  return useContext(PromptContextStoreContext);
}
