import { FileText, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '../KiteAIChat';
import { EdgeCaseSelector } from '../EdgeCaseSelector';
import { WorkflowThumbnail } from './WorkflowThumbnail';
import { useOpenDesign } from '@/design/DesignTabHost';
import type { DesignPreview } from '@/lib/kiteaiTranscript';

/**
 * Inline card showing the screens a generation produced, so the result is
 * visible in the conversation itself rather than only on the canvas.
 */
function DesignPreviewCard({ preview }: { preview: DesignPreview }) {
  const openDesign = useOpenDesign();
  const { designId, title, screenLabels = [] } = preview;
  const count = screenLabels.length;

  return (
    <div
      className="mt-3 border border-border rounded-lg overflow-hidden bg-muted/30"
      data-testid={`design-preview-${designId}`}
    >
      {/* No preview image: it could only ever show a cropped band of the first
          screen, so the screen list below carries the summary on its own. */}
      <div className="p-3">
        <div className="text-xs font-medium truncate" data-testid="design-preview-title">
          {title ?? 'Generated design'}
        </div>
        {count > 0 && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {count} screen{count === 1 ? '' : 's'}
          </div>
        )}
        {count > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {screenLabels.slice(0, 6).map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="inline-block px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary border border-primary/20"
              >
                {label}
              </span>
            ))}
            {count > 6 && (
              <span className="inline-block px-2 py-0.5 text-[10px] text-muted-foreground">
                +{count - 6} more
              </span>
            )}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-7 text-xs"
          onClick={() => openDesign(designId, title ?? undefined)}
          data-testid={`design-preview-open-${designId}`}
        >
          Open design
        </Button>
      </div>
    </div>
  );
}

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
  onEdgeCaseSubmit?: (messageId: string, selectedIds: string[], edgeCases: import('../EdgeCaseSelector').EdgeCase[]) => void;
  onModifyEdgeCaseSelection?: (messageId: string) => void;
  onCancelEdgeCaseSelector?: (messageId: string) => void;
  isLoading?: boolean;
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
  onEdgeCaseSubmit,
  onModifyEdgeCaseSelection,
  onCancelEdgeCaseSelector,
  isLoading = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  className = '',
  'data-testid': testId
}: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  if (isSystem) {
    if (message.type === 'edge_case_selector') {
      const edgeCases = message.meta?.edgeCases ?? [];
      const preSelectedIds = message.meta?.preSelectedIds;
      return (
        <div className={`my-2 ${className}`} data-testid={testId || `message-edge-case-selector-${message.id}`}>
          <p className="text-xs text-muted-foreground mb-2">Select which edge cases to include:</p>
          <EdgeCaseSelector
            edgeCases={edgeCases}
            initialSelectedIds={preSelectedIds}
            onSubmit={(selectedIds) => onEdgeCaseSubmit?.(message.id, selectedIds, edgeCases)}
            onCancel={() => onCancelEdgeCaseSelector?.(message.id)}
            disabled={isLoading}
          />
        </div>
      );
    }

    if (message.type === 'edge_case_selected') {
      const selected = message.meta?.selectedEdgeCases ?? [];
      return (
        <div
          className={`my-2 rounded-lg bg-muted/40 border border-border/40 px-4 py-3 ${className}`}
          data-testid={testId || `message-edge-case-selected-${message.id}`}
        >
          <p className="text-xs font-medium text-muted-foreground mb-2">Edge cases included:</p>
          <ul className="space-y-1 mb-3">
            {selected.map(ec => (
              <li key={ec.id} className="flex items-start gap-1.5 text-xs">
                <span className="mt-0.5 text-green-500">✓</span>
                <span>{ec.label}</span>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onModifyEdgeCaseSelection?.(message.id)}
            disabled={isLoading}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            data-testid={`button-modify-edge-case-selection-${message.id}`}
          >
            <Pencil className="w-3 h-3 mr-1" />
            Modify selection
          </Button>
        </div>
      );
    }

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
              // list-outside + padding: with list-inside, a loose list (items
              // wrapped in <p>) orphans the marker onto its own line.
              ul: ({ children }) => <ul className="list-disc list-outside pl-5 my-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-outside pl-5 my-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="my-0.5 [&>p]:my-0">{children}</li>,
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
        <WorkflowThumbnail
          nodes={message.workflowProposal.nodes}
          edges={message.workflowProposal.edges}
        />
      )}

      {message.designPreview && (
        <DesignPreviewCard preview={message.designPreview} />
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
