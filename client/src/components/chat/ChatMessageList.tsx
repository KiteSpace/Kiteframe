import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2 } from 'lucide-react';
import { ChatBubble } from './ChatBubble';
import type { ChatMessage } from '../KiteAIChat';

export interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  mode: 'panel' | 'floating' | 'fullscreen' | 'discussion';
  onFollowUpClick?: (question: string) => void;
}

export interface ChatMessageListRef {
  scrollToBottom: () => void;
}

export const ChatMessageList = forwardRef<ChatMessageListRef, ChatMessageListProps>(({
  messages,
  isLoading = false,
  mode,
  onFollowUpClick
}, ref) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onFollowUpClick={onFollowUpClick}
            showAvatar={true}
          />
        ))}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted rounded-lg p-3 rounded-bl-none">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
});

ChatMessageList.displayName = 'ChatMessageList';
