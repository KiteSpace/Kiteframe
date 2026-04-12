import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '../KiteAIChat';

/**
 * Sanitize assistant message content by removing leading scaffolding tokens
 * that may leak from model responses (e.g., "json", "JSON:", etc.)
 * Preserves valid fenced code blocks and inline code.
 * Only targets the very start of the message - never modifies mid-content.
 */
function sanitizeAssistantContent(content: string): string {
  let cleaned = content;
  
  // Only remove scaffolding tokens at the absolute start of the message
  // Pattern: standalone "json" or "JSON" or "JSON:" on first line before real content
  cleaned = cleaned.replace(/^json\s*\n/i, '');    // "json\n" at start
  cleaned = cleaned.replace(/^JSON:\s*\n?/, '');   // "JSON:" at start
  
  return cleaned.trim();
}

interface ChatBubbleProps {
  message: ChatMessage;
  onFollowUpClick?: (question: string) => void;
  onWorkflowChipSelect?: (chipId: string) => void;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
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
  onWorkflowChipSelect,
  isFirstInGroup = true,
  isLastInGroup = true,
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
  
  if (isUser) {
    return (
      <div
        className={`flex justify-end ${className}`}
        data-testid={testId || `message-user-${message.id}`}
      >
        <div className="max-w-[85%]">
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-2 space-y-1 flex justify-end">
              {message.attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded inline-flex">
                  {att.type === 'image' ? (
                    <>
                      {att.preview && (
                        <img src={att.preview} alt={att.name} className="w-16 h-16 object-cover rounded" />
                      )}
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs truncate text-muted-foreground">{att.name}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="bg-neutral-200 dark:bg-neutral-800 px-4 py-2.5 rounded-2xl rounded-br-sm text-sm">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          
          {isLastInGroup && (
            <div className="text-[10px] text-muted-foreground mt-1 text-right">
              <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={`${className}`}
      data-testid={testId || `message-assistant-${message.id}`}
    >
      <div className="max-w-[65ch]">
        <div className="text-sm leading-[1.6] prose prose-sm dark:prose-invert max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              code: ({ children, className }) => {
                return <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{children}</code>;
              },
              pre: ({ children, ...props }) => {
                return <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto my-2 font-mono" {...props}>{children}</pre>;
              },
            }}
          >
            {sanitizeAssistantContent(message.content)}
          </ReactMarkdown>
        </div>
        
        {message.followUps && message.followUps.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.followUps.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUpClick?.(q)}
                className="block w-full text-left px-3 py-2 text-xs bg-muted/50 hover:bg-muted rounded-lg border border-border/30 hover:border-primary/40 transition-colors"
                data-testid={`button-followup-${message.id}-${i}`}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        
        {message.workflowChips && message.workflowChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.workflowChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => onWorkflowChipSelect?.(chip.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 hover:border-primary/50 rounded-full transition-colors"
                data-testid={`chip-workflow-${chip.id}`}
              >
                <span className="w-2 h-2 rounded-full bg-primary" />
                {chip.label} ({chip.nodeCount} nodes)
              </button>
            ))}
          </div>
        )}
      </div>
      
      {message.workflowProposal && (
        <div className="mt-3 p-3 rounded-lg border border-border bg-muted/20 max-w-[65ch]">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Generated: {message.workflowProposal.nodes.length} nodes, {message.workflowProposal.edges.length} edges
            </Badge>
          </div>
        </div>
      )}
      
      {isLastInGroup && (
        <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-2">
          {message.meta?.kiteRole && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 text-[10px]">
              {getRoleLabel(message.meta.kiteRole).emoji} {getRoleLabel(message.meta.kiteRole).label}
            </span>
          )}
          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
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
  'data-testid': testId
}: LegacyChatBubbleProps) {
  return (
    <div className={`flex justify-end ${className}`}>
      <div 
        className="bg-neutral-200 dark:bg-neutral-800 px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[80%]"
        data-testid={testId}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

export function AIBubble({ 
  content, 
  className = '',
  'data-testid': testId
}: LegacyChatBubbleProps) {
  return (
    <div className={`${className}`}>
      <div 
        className="max-w-[80%]"
        data-testid={testId}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
