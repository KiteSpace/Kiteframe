import { useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ChevronDown } from 'lucide-react';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '../KiteAIChat';

export interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  mode: 'panel' | 'floating' | 'fullscreen' | 'discussion';
  onFollowUpClick?: (question: string) => void;
  onWorkflowChipSelect?: (chipId: string) => void;
}

export interface ChatMessageListRef {
  scrollToBottom: () => void;
}

interface MessageGroupInfo {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isRoleChange: boolean;
}

const SCROLL_THRESHOLD = 150;

export const ChatMessageList = forwardRef<ChatMessageListRef, ChatMessageListProps>(({
  messages,
  isLoading = false,
  mode,
  onFollowUpClick,
  onWorkflowChipSelect
}, ref) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessageCountRef = useRef(messages.length);
  const wasNearBottomRef = useRef(true);
  const prevLoadingRef = useRef(isLoading);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setHasNewMessages(false);
  }, []);

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => scrollToBottom('smooth')
  }));

  const checkNearBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return true;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom < SCROLL_THRESHOLD;
  }, []);

  const handleScroll = useCallback(() => {
    const nearBottom = checkNearBottom();
    setIsNearBottom(nearBottom);
    wasNearBottomRef.current = nearBottom;
    
    if (nearBottom) {
      setHasNewMessages(false);
    }
  }, [checkNearBottom]);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    
    const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    viewportRef.current = viewport;
    
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll);
      return () => {
        viewport.removeEventListener('scroll', handleScroll);
        viewportRef.current = null;
      };
    }
  }, [handleScroll, mode]);

  useEffect(() => {
    const newMessageCount = messages.length;
    const hadNewMessages = newMessageCount > prevMessageCountRef.current;
    const lastMessage = messages[messages.length - 1];
    const isUserMessage = lastMessage?.role === 'user';
    
    prevMessageCountRef.current = newMessageCount;
    
    if (hadNewMessages) {
      if (isUserMessage || wasNearBottomRef.current) {
        scrollToBottom('smooth');
      } else {
        setHasNewMessages(true);
      }
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      if (wasNearBottomRef.current) {
        scrollToBottom('smooth');
      }
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, scrollToBottom]);

  useEffect(() => {
    scrollToBottom('instant');
  }, []);

  const messageGroupInfo = useMemo(() => {
    const info: Map<string, MessageGroupInfo> = new Map();
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prevMsg = i > 0 ? messages[i - 1] : null;
      const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;
      
      const isFirstInGroup = !prevMsg || prevMsg.role !== msg.role;
      const isLastInGroup = !nextMsg || nextMsg.role !== msg.role;
      const isRoleChange = !prevMsg || prevMsg.role !== msg.role;
      
      info.set(msg.id, { isFirstInGroup, isLastInGroup, isRoleChange });
    }
    
    return info;
  }, [messages]);

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className={`flex flex-col p-4 ${mode === 'fullscreen' ? 'pb-24' : ''}`}>
          {messages.map((message) => {
            const groupInfo = messageGroupInfo.get(message.id);
            const marginClass = groupInfo?.isRoleChange ? 'mt-4 first:mt-0' : 'mt-1.5';
            
            return (
              <ChatBubble
                key={message.id}
                message={message}
                onFollowUpClick={onFollowUpClick}
                onWorkflowChipSelect={onWorkflowChipSelect}
                isFirstInGroup={groupInfo?.isFirstInGroup}
                isLastInGroup={groupInfo?.isLastInGroup}
                className={marginClass}
              />
            );
          })}
          
          {isLoading && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      {hasNewMessages && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => scrollToBottom('smooth')}
            className="shadow-lg flex items-center gap-1.5 text-xs px-3 py-1.5 h-auto"
            data-testid="button-new-messages"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            New messages
          </Button>
        </div>
      )}
    </div>
  );
});

ChatMessageList.displayName = 'ChatMessageList';
