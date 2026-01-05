import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, User, Loader2, FileText } from 'lucide-react';
import { getRoleLabel, type KiteRole } from '@/ai/roleSelector';
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

  const isDiscussionMode = mode === 'discussion';

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.role === 'user' 
                ? 'bg-primary' 
                : 'bg-gradient-to-r from-purple-600 to-blue-600'
            }`}>
              {message.role === 'user' 
                ? <User className="w-4 h-4 text-primary-foreground" />
                : <Bot className="w-4 h-4 text-white" />
              }
            </div>
            
            <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block max-w-[85%] p-3 rounded-lg text-sm ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-none'
                  : 'bg-muted rounded-bl-none'
              }`}>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {message.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-background/50 rounded">
                        {att.type === 'image' ? (
                          <>
                            {att.preview && (
                              <img src={att.preview} alt={att.name} className="w-16 h-16 object-cover rounded" />
                            )}
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4" />
                            <span className="text-xs truncate">{att.name}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc list-inside my-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside my-1">{children}</ol>,
                      li: ({ children }) => <li className="my-0.5">{children}</li>,
                      code: ({ children, className }) => {
                        if (className === 'language-json') return null;
                        return <code className="px-1 py-0.5 bg-muted rounded text-xs">{children}</code>;
                      },
                      pre: ({ children, ...props }) => {
                        const codeChild = (children as any)?.props;
                        if (codeChild?.className === 'language-json') return null;
                        return <pre className="bg-muted/50 p-2 rounded text-xs overflow-x-auto my-1" {...props}>{children}</pre>;
                      },
                    }}
                  >
                    {message.content.replace(/```json[\s\S]*?```/g, '').trim()}
                  </ReactMarkdown>
                </div>
                
                {message.followUps && message.followUps.length > 0 && onFollowUpClick && (
                  <div className="mt-3 space-y-2">
                    {message.followUps.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => onFollowUpClick(q)}
                        className="block w-full text-left p-2 text-xs bg-background/50 hover:bg-background rounded border border-border/50 hover:border-primary/50 transition-colors"
                        data-testid={`button-followup-${i}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                
                {message.workflowProposal && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <Badge variant="secondary" className="text-xs">
                      Generated: {message.workflowProposal.nodes.length} nodes, {message.workflowProposal.edges.length} edges
                    </Badge>
                  </div>
                )}
              </div>
              
              <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && message.meta?.kiteRole && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted-foreground/10">
                    {getRoleLabel(message.meta.kiteRole as KiteRole).emoji} {getRoleLabel(message.meta.kiteRole as KiteRole).label}
                  </span>
                )}
                <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
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
