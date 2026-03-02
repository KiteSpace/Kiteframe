import { useState, useRef, useEffect, useCallback, KeyboardEvent, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, RotateCcw, Sparkles, Loader2, Check, X, Link2, Unlink, RefreshCw, AlertCircle, Shield, Lightbulb, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRouter } from '@/ai/router';
import { useToast } from '@/hooks/use-toast';
import type { PRDNodeLink, PRDLinkTargetType } from '@/stores/prdNodeLinkStore';
import { type AIInsight, getChipTypeColor, type InsightChipType } from '@/ai/insights';
import type { PRDSuggestion } from '@/ai/prdSteward';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

interface DocSectionProps {
  title: string;
  content: string;
  sectionKey: string;
  manuallyEdited?: boolean;
  isStale?: boolean;
  confidence?: ConfidenceLevel;
  insights?: AIInsight[];
  reviewSuggestions?: PRDSuggestion[];
  onApplyReviewSuggestion?: (suggestion: PRDSuggestion) => void;
  onDismissReviewSuggestion?: (suggestion: PRDSuggestion) => void;
  isApplyingReviewSuggestion?: boolean;
  onSave: (sectionKey: string, value: string) => void;
  onResetToAI?: (sectionKey: string) => void;
  onRegenerateSection?: (sectionKey: string) => void;
  onDismissInsight?: (insightId: string) => void;
  enableAISuggestions?: boolean;
  linkedNodes?: PRDNodeLink[];
  onLinkNode?: () => void;
  onLinkEdge?: () => void;
  onUnlinkNode?: (nodeId: string) => void;
  onUnlinkItem?: (targetId: string, targetType: PRDLinkTargetType) => void;
  onFocusNode?: (nodeId: string) => void;
  onFocusEdge?: (edgeId: string) => void;
  isReadOnly?: boolean;
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config = {
    high: { 
      label: 'High Confidence', 
      bg: 'bg-green-100 dark:bg-green-900/30', 
      text: 'text-green-700 dark:text-green-300',
      icon: <Shield size={10} className="fill-current" />
    },
    medium: { 
      label: 'Medium', 
      bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
      text: 'text-yellow-700 dark:text-yellow-300',
      icon: <Shield size={10} />
    },
    low: { 
      label: 'Needs Detail', 
      bg: 'bg-orange-100 dark:bg-orange-900/30', 
      text: 'text-orange-700 dark:text-orange-300',
      icon: <AlertCircle size={10} />
    }
  };
  
  const { label, bg, text, icon } = config[level];
  
  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded font-medium",
        bg,
        text
      )}
      data-testid={`confidence-badge-${level}`}
    >
      {icon}
      {label}
    </span>
  );
}

function InsightChip({ 
  insight, 
  onDismiss 
}: { 
  insight: AIInsight; 
  onDismiss?: () => void;
}) {
  const chipType = insight.chipType || 'suggestion';
  const colors = getChipTypeColor(chipType);
  
  const icons: Record<InsightChipType, string> = {
    assumption: '🔮',
    risk: '⚠️',
    question: '❓',
    suggestion: '💡'
  };
  
  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded",
        colors.bg,
        colors.text
      )}
      data-testid={`insight-chip-${insight.id}`}
    >
      <span>{icons[chipType]}</span>
      <span className="max-w-[200px] truncate">{insight.message}</span>
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="ml-0.5 opacity-50 hover:opacity-100"
          data-testid={`dismiss-chip-${insight.id}`}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function ReviewSuggestionCard({ 
  suggestion, 
  onApply,
  onDismiss,
  isApplying
}: { 
  suggestion: PRDSuggestion; 
  onApply: () => void;
  onDismiss: () => void;
  isApplying?: boolean;
}) {
  const typeIcons = {
    improvement: <Lightbulb size={14} className="text-blue-500" />,
    missing: <AlertCircle size={14} className="text-orange-500" />,
    stale: <Clock size={14} className="text-yellow-500" />
  };

  const typeBorders = {
    improvement: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10',
    missing: 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10',
    stale: 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
  };

  return (
    <div 
      className={`border rounded-md p-3 mt-3 ${typeBorders[suggestion.type]}`}
      data-testid={`review-suggestion-${suggestion.sectionId}-${suggestion.type}`}
    >
      <div className="flex items-start gap-2">
        {typeIcons[suggestion.type]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{suggestion.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase">
              {suggestion.type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{suggestion.description}</p>
          {suggestion.suggestedContent && (
            <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded text-xs font-mono max-h-24 overflow-y-auto border border-gray-200 dark:border-gray-700">
              {suggestion.suggestedContent.substring(0, 200)}
              {suggestion.suggestedContent.length > 200 && '...'}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={onApply}
              disabled={isApplying}
              data-testid={`apply-review-suggestion-${suggestion.sectionId}`}
            >
              {isApplying ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <Check size={12} className="mr-1" />
              )}
              {isApplying ? 'Applying...' : 'Apply'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={onDismiss}
              disabled={isApplying}
              data-testid={`dismiss-review-suggestion-${suggestion.sectionId}`}
            >
              <X size={12} className="mr-1" />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const markdownComponents = {
  h1: ({ children }: { children: ReactNode }) => <h1 className="text-base font-bold mt-3 mb-1 text-foreground">{children}</h1>,
  h2: ({ children }: { children: ReactNode }) => <h2 className="text-sm font-semibold mt-2.5 mb-1 text-foreground">{children}</h2>,
  h3: ({ children }: { children: ReactNode }) => <h3 className="text-sm font-medium mt-2 mb-0.5 text-foreground">{children}</h3>,
  p:  ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed mb-1.5">{children}</p>,
  ul: ({ children }: { children: ReactNode }) => <ul className="list-disc list-inside space-y-0.5 my-1.5 text-sm">{children}</ul>,
  ol: ({ children }: { children: ReactNode }) => <ol className="list-decimal list-inside space-y-0.5 my-1.5 text-sm">{children}</ol>,
  li: ({ children }: { children: ReactNode }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: { children: ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }: { children: ReactNode }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-2 border-border" />,
};

export function DocSection({
  title,
  content,
  sectionKey,
  manuallyEdited = false,
  isStale = false,
  confidence,
  insights = [],
  reviewSuggestions = [],
  onApplyReviewSuggestion,
  onDismissReviewSuggestion,
  isApplyingReviewSuggestion = false,
  onSave,
  onResetToAI,
  onRegenerateSection,
  onDismissInsight,
  enableAISuggestions = true,
  linkedNodes = [],
  onLinkNode,
  onLinkEdge,
  onUnlinkNode,
  onUnlinkItem,
  onFocusNode,
  onFocusEdge,
  isReadOnly = false
}: DocSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [isHovered, setIsHovered] = useState(false);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setEditValue(content);
  }, [content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    if (editValue !== content) {
      onSave(sectionKey, editValue);
    }
    setIsEditing(false);
  }, [editValue, content, sectionKey, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(content);
    setIsEditing(false);
  }, [content]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    }
  }, [handleCancel, handleSave]);

  const handleContentClick = useCallback(() => {
    if (!isEditing && !isReadOnly) {
      setIsEditing(true);
    }
  }, [isEditing, isReadOnly]);

  const handleReset = useCallback(() => {
    onResetToAI?.(sectionKey);
  }, [sectionKey, onResetToAI]);

  const handleSuggestImprovements = useCallback(async () => {
    if (!content || isGeneratingSuggestion) return;

    setIsGeneratingSuggestion(true);
    setSuggestion(null);

    try {
      const router = getRouter();
      const response = await router.chat({
        taskType: 'prd_generation',
        messages: [
          {
            role: 'system',
            content: 'You are a technical writer improving PRD content. Return ONLY the improved text, no explanations or markdown code blocks.'
          },
          {
            role: 'user',
            content: `Improve this "${title}" section. Make it clearer, more specific, and professional. Keep a similar length.\n\nCurrent content:\n${content}`
          }
        ],
        temperature: 0.4,
        maxTokens: 1000
      });

      setSuggestion(response.text.trim());
    } catch (error) {
      toast({
        title: 'Suggestion failed',
        description: error instanceof Error ? error.message : 'Could not generate suggestion',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingSuggestion(false);
    }
  }, [content, title, toast, isGeneratingSuggestion]);

  const handleAcceptSuggestion = useCallback(() => {
    if (suggestion) {
      onSave(sectionKey, suggestion);
      setSuggestion(null);
      toast({ title: 'Suggestion applied', description: 'Content updated with AI suggestion.' });
    }
  }, [suggestion, sectionKey, onSave, toast]);

  const handleRejectSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);


  return (
    <section
      id={`prd-section-${sectionKey}`}
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`doc-section-${sectionKey}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {title}
          </h3>
          {confidence && <ConfidenceBadge level={confidence} />}
          {isStale && (
            <span 
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium"
              data-testid={`stale-badge-${sectionKey}`}
            >
              <AlertCircle size={10} />
              Needs Review
            </span>
          )}
          {manuallyEdited && !isStale && (
            <span 
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
              data-testid={`edited-badge-${sectionKey}`}
            >
              Edited
            </span>
          )}
        </div>
        
        <div className={cn(
          "flex items-center gap-1 transition-opacity duration-150",
          isHovered || isEditing || suggestion ? "opacity-100" : "opacity-0"
        )}>
          {!isReadOnly && isStale && onRegenerateSection && !isEditing && !suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:text-yellow-300 dark:hover:bg-yellow-900/30"
              onClick={() => onRegenerateSection(sectionKey)}
              data-testid={`regenerate-section-${sectionKey}`}
            >
              <RefreshCw size={10} className="mr-1" />
              Regenerate
            </Button>
          )}
          {!isReadOnly && enableAISuggestions && content && !isEditing && !suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={handleSuggestImprovements}
              disabled={isGeneratingSuggestion}
              data-testid={`suggest-${sectionKey}`}
            >
              {isGeneratingSuggestion ? (
                <Loader2 size={10} className="mr-1 animate-spin" />
              ) : (
                <Sparkles size={10} className="mr-1" />
              )}
              Suggest
            </Button>
          )}
          {!isReadOnly && manuallyEdited && onResetToAI && !suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={handleReset}
              data-testid={`reset-${sectionKey}`}
            >
              <RotateCcw size={10} className="mr-1" />
              Reset
            </Button>
          )}
          {!isReadOnly && onLinkNode && !isEditing && !suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={onLinkNode}
              data-testid={`link-${sectionKey}`}
            >
              <Link2 size={10} className="mr-1" />
              Link
            </Button>
          )}
          {!isReadOnly && !isEditing && !suggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
              data-testid={`edit-${sectionKey}`}
            >
              <Edit3 size={12} />
            </Button>
          )}
        </div>
      </div>

      {linkedNodes.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2" data-testid={`linked-nodes-${sectionKey}`}>
          {linkedNodes.map(link => {
            const isEdge = link.targetType === 'edge';
            const targetId = link.targetId || link.nodeId;
            const handleFocus = () => {
              if (isEdge) {
                onFocusEdge?.(targetId);
              } else {
                onFocusNode?.(targetId);
              }
            };
            const handleUnlink = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (onUnlinkItem) {
                onUnlinkItem(targetId, link.targetType || 'node');
              } else if (onUnlinkNode && !isEdge) {
                onUnlinkNode(targetId);
              }
            };
            return (
              <span
                key={`${link.targetType || 'node'}-${targetId}`}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors",
                  isEdge 
                    ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                    : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                )}
                onClick={handleFocus}
                data-testid={`linked-${link.targetType || 'node'}-${targetId}`}
              >
                {isEdge ? <ArrowRight size={8} /> : <Link2 size={8} />}
                {isEdge ? 'Edge' : 'Node'}
                {!isReadOnly && (onUnlinkItem || onUnlinkNode) && (
                  <button
                    onClick={handleUnlink}
                    className="ml-0.5 hover:text-red-500"
                    data-testid={`unlink-${targetId}`}
                  >
                    <X size={8} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {insights.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2" data-testid={`insights-${sectionKey}`}>
          {insights.map(insight => (
            <InsightChip
              key={insight.id}
              insight={insight}
              onDismiss={!isReadOnly && onDismissInsight ? () => onDismissInsight(insight.id) : undefined}
            />
          ))}
        </div>
      )}

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="min-h-[100px] text-sm leading-relaxed resize-none border-primary/20 focus:border-primary/40"
            placeholder="Enter content..."
            data-testid={`textarea-${sectionKey}`}
          />
          <div className="flex justify-end gap-2 text-[10px] text-muted-foreground">
            <span>Esc to cancel</span>
            <span>·</span>
            <span>⌘+Enter to save</span>
          </div>
        </div>
      ) : (
        <>
          <div
            onClick={handleContentClick}
            className={cn(
              "text-muted-foreground",
              !isReadOnly && "cursor-text hover:bg-accent/30",
              "rounded-md transition-colors duration-100 -mx-2 px-2 py-1",
              !content && "italic text-sm"
            )}
            data-testid={`content-${sectionKey}`}
          >
            {content ? (
              <ReactMarkdown components={markdownComponents as any}>
                {content}
              </ReactMarkdown>
            ) : (
              isReadOnly ? "No content" : "Click to add content..."
            )}
          </div>

          {!isReadOnly && suggestion && (
            <div className="mt-3 border border-primary/30 rounded-md bg-primary/5 p-3" data-testid={`suggestion-${sectionKey}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase text-primary font-medium flex items-center gap-1">
                  <Sparkles size={10} />
                  AI Suggestion
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={handleAcceptSuggestion}
                    data-testid={`accept-${sectionKey}`}
                  >
                    <Check size={10} className="mr-1" />
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-100"
                    onClick={handleRejectSuggestion}
                    data-testid={`reject-${sectionKey}`}
                  >
                    <X size={10} className="mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
              <div className="text-muted-foreground text-sm">
                {suggestion && (
                  <ReactMarkdown components={markdownComponents as any}>
                    {suggestion}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          )}

          {!isReadOnly && reviewSuggestions.length > 0 && (
            <div data-testid={`review-suggestions-${sectionKey}`}>
              {reviewSuggestions.map((reviewSuggestion, idx) => (
                <ReviewSuggestionCard
                  key={`${reviewSuggestion.sectionId}-${reviewSuggestion.type}-${idx}`}
                  suggestion={reviewSuggestion}
                  onApply={() => onApplyReviewSuggestion?.(reviewSuggestion)}
                  onDismiss={() => onDismissReviewSuggestion?.(reviewSuggestion)}
                  isApplying={isApplyingReviewSuggestion}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
