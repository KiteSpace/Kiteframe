import { User, Bot, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '../KiteAIChat';

interface ChatBubbleProps {
  message: ChatMessage;
  onFollowUpClick?: (question: string) => void;
  showAvatar?: boolean;
  className?: string;
  'data-testid'?: string;
}

const getRoleLabel = (role: string): { label: string; emoji: string } => {
  switch (role) {
    case 'pm': return { label: 'Product Manager', emoji: '📋' };
    case 'dev': return { label: 'Developer', emoji: '💻' };
    case 'hybrid': return { label: 'Hybrid', emoji: '🔄' };
    default: return { label: role, emoji: '🤖' };
  }
};

export function ChatBubble({ 
  message,
  onFollowUpClick,
  showAvatar = true,
  className = '',
  'data-testid': testId
}: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  if (isSystem) {
    return (
      <div 
        className={`text-center py-2 ${className}`}
        data-testid={testId || `message-system-${message.id}`}
      >
        <span className="text-xs text-muted-foreground italic">{message.content}</span>
      </div>
    );
  }
  
  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${className}`}
      data-testid={testId || `message-${message.role}-${message.id}`}
    >
      {showAvatar && (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser 
            ? 'bg-primary' 
            : 'bg-gradient-to-r from-purple-600 to-blue-600'
        }`}>
          {isUser 
            ? <User className="w-4 h-4 text-primary-foreground" />
            : <Bot className="w-4 h-4 text-white" />
          }
        </div>
      )}
      
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block max-w-[85%] p-3 rounded-lg text-sm ${
          isUser
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
          
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
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
          )}
          
          {message.followUps && message.followUps.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.followUps.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUpClick?.(q)}
                  className="block w-full text-left p-2 text-xs bg-background/50 hover:bg-background rounded border border-border/50 hover:border-primary/50 transition-colors"
                  data-testid={`button-followup-${message.id}-${i}`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Workflow proposal rendered outside bubble as block child */}
        {message.workflowProposal && (
          <div className="mt-2 p-3 rounded-lg border border-border bg-muted/30 max-w-[85%]">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Generated: {message.workflowProposal.nodes.length} nodes, {message.workflowProposal.edges.length} edges
              </Badge>
            </div>
          </div>
        )}
        
        <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-2 ${isUser ? 'justify-end' : ''}`}>
          {!isUser && message.meta?.kiteRole && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted-foreground/10">
              {getRoleLabel(message.meta.kiteRole).emoji} {getRoleLabel(message.meta.kiteRole).label}
            </span>
          )}
          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}

interface LegacyChatBubbleProps {
  content: string;
  className?: string;
  'data-testid'?: string;
  showAvatar?: boolean;
}

export function UserBubble({ 
  content, 
  className = '',
  showAvatar = true,
  'data-testid': testId
}: LegacyChatBubbleProps) {
  return (
    <div className={`flex items-start gap-2 justify-end ${className}`}>
      <div 
        className="bg-primary text-primary-foreground rounded-2xl rounded-br-none px-4 py-3 max-w-[80%]"
        data-testid={testId}
      >
        <p className="text-sm whitespace-pre-wrap text-white">{content}</p>
      </div>
      {showAvatar && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

export function AIBubble({ 
  content, 
  className = '',
  showAvatar = true,
  'data-testid': testId
}: LegacyChatBubbleProps) {
  return (
    <div className={`flex items-start gap-2 justify-start ${className}`}>
      {showAvatar && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div 
        className="bg-muted rounded-2xl rounded-bl-none px-4 py-3 max-w-[80%]"
        data-testid={testId}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
