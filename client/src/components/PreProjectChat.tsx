import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChatSendButton } from '@/components/chat';
import { ArrowLeft, Sparkles, Loader2, Rocket, MessageCircle, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { useAi } from '../ai/AiProvider';
import { buildKiteAIContext, inferRoleFromIntent, type KiteAIRole } from '../lib/ai/buildKiteAIContext';
import { useKiteAIConversation } from '@/hooks/useKiteAIConversation';
import { getSystemPrompt, buildFollowUpEnforcement } from '@/ai/kiteaiPrompts';
import { usePromptContextStore } from '@/contexts/PromptContextStore';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
}

interface PreProjectContext {
  prompt: string;
  uploadedFiles?: File[];
  aiSummary?: string;
  isHighConfidence?: boolean;
  clarifyingQuestions?: string[];
}

interface PreProjectChatProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (summary: string, generatePRD?: boolean) => void;
  initialPrompt?: string;
  context?: PreProjectContext | null;
}

function ActionButtons({ 
  onStartProject, 
  onKeepBrainstorming 
}: { 
  onStartProject: (generatePRD: boolean) => void; 
  onKeepBrainstorming: () => void;
}) {
  const [generatePRD, setGeneratePRD] = useState(true);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="flex justify-start mt-3"
    >
      <div className="bg-muted/50 border border-border rounded-2xl p-4 max-w-[80%]">
        <p className="text-sm text-muted-foreground mb-3">
          I have enough context to create your workflow now. You can refine it further inside the project.
        </p>
        
        <div className="flex items-center gap-2 mb-3">
          <Checkbox
            id="generate-prd"
            checked={generatePRD}
            onCheckedChange={(checked) => setGeneratePRD(checked === true)}
            data-testid="checkbox-generate-prd"
          />
          <label 
            htmlFor="generate-prd" 
            className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Generate first draft PRD automatically
          </label>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => onStartProject(generatePRD)}
            className="bg-primary hover:bg-primary/90"
            data-testid="button-ready-to-start"
          >
            <Rocket className="w-4 h-4 mr-2" />
            Start the project
          </Button>
          <Button
            variant="outline"
            onClick={onKeepBrainstorming}
            data-testid="button-keep-brainstorming"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Keep brainstorming
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function EscalationOptions({
  options,
  onSelect
}: {
  options: string[];
  onSelect: (option: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start mt-3"
    >
      <div className="bg-muted/50 border border-border rounded-2xl p-4 max-w-[85%]">
        <p className="text-sm font-medium mb-3">
          Let me suggest some concrete directions:
        </p>
        <div className="space-y-2">
          {options.map((option, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start text-left h-auto py-3 px-4"
              onClick={() => onSelect(option)}
              data-testid={`button-escalation-option-${index}`}
            >
              <span className="text-sm">{option}</span>
            </Button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function StateIndicator({ 
  state, 
  score, 
  confidence 
}: { 
  state: string; 
  score: number; 
  confidence: number;
}) {
  const getStateColor = () => {
    if (state === 'execution-ready') return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (state === 'escalation') return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  };

  const getStateIcon = () => {
    if (state === 'execution-ready') return <CheckCircle2 className="w-3 h-3" />;
    if (state === 'escalation') return <AlertCircle className="w-3 h-3" />;
    return <Sparkles className="w-3 h-3" />;
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="outline" className={`${getStateColor()} flex items-center gap-1`}>
        {getStateIcon()}
        <span className="capitalize">{state.replace('-', ' ')}</span>
      </Badge>
      <span className="text-muted-foreground">
        Score: {score}/5 | Confidence: {Math.round(confidence * 100)}%
      </span>
    </div>
  );
}

export function PreProjectChat({
  isOpen,
  onClose,
  onCreateProject,
  initialPrompt = '',
  context = null
}: PreProjectChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [actionButtonsDismissed, setActionButtonsDismissed] = useState(false);
  const [currentRole, setCurrentRole] = useState<KiteAIRole>('brainstorm');
  const [escalationOptions, setEscalationOptions] = useState<string[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const aiClient = useAi();

  const { context: promptContext, clearStore } = usePromptContextStore();

  const { 
    state: conversationState, 
    processUserInput, 
    reset: resetConversation,
    addAssistantMessage,
    getAccumulatedSummary,
    addConversationSource,
    getSources,
  } = useKiteAIConversation('base');

  const hasUploadedFiles = useMemo(() => {
    const filesFromStore = promptContext.attachments.filter(a => a.file).length;
    const filesFromContext = context?.uploadedFiles?.length ?? 0;
    return filesFromStore > 0 || filesFromContext > 0;
  }, [promptContext.attachments, context?.uploadedFiles]);

  const convertFilesToBase64 = useCallback(async (files: File[]): Promise<string[]> => {
    return Promise.all(
      files.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      }))
    );
  }, []);

  const aiTurnCount = useMemo(() => {
    return messages.filter(m => m.role === 'assistant').length;
  }, [messages]);

  const canStartProject = conversationState.canStartProject;
  const currentState = conversationState.context.state;
  const currentScore = conversationState.currentScore;
  const currentConfidence = conversationState.currentConfidence;

  const shouldShowActions = useMemo(() => {
    if (actionButtonsDismissed) return false;
    if (messages.length === 0) return false;
    return canStartProject;
  }, [actionButtonsDismissed, messages.length, canStartProject]);

  useEffect(() => {
    if (shouldShowActions && !showActionButtons) {
      setShowActionButtons(true);
    }
  }, [shouldShowActions, showActionButtons]);

  useEffect(() => {
    if (isOpen && initialPrompt && !hasStarted) {
      setHasStarted(true);
      const inferredRole = inferRoleFromIntent(initialPrompt, hasUploadedFiles);
      setCurrentRole(inferredRole);
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt, hasStarted, hasUploadedFiles]);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInputValue('');
      setHasStarted(false);
      setShowActionButtons(false);
      setActionButtonsDismissed(false);
      setCurrentRole('brainstorm');
      setEscalationOptions([]);
      resetConversation();
      clearStore();
    }
  }, [isOpen, resetConversation, clearStore]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, showActionButtons, escalationOptions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Get image preview for display in first message
    const imageAttachment = promptContext.attachments.find(a => a.type === 'image' && a.thumbnailUrl);
    const imagePreviewForMessage = messages.length === 0 && imageAttachment ? imageAttachment.thumbnailUrl : undefined;

    const userMessage: Message = { 
      role: 'user', 
      content: content.trim(),
      imagePreview: imagePreviewForMessage
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setEscalationOptions([]);
    
    if (actionButtonsDismissed) {
      setActionButtonsDismissed(false);
    }

    const inferredRole = inferRoleFromIntent(content, hasUploadedFiles);
    setCurrentRole(inferredRole);

    const processResult = processUserInput(content);

    try {
      const systemPrompt = getSystemPrompt('base');
      
      let enhancedSystemPrompt = systemPrompt;
      
      // Add confidence enforcement to ALL states
      const confidenceEnforcement = buildFollowUpEnforcement(processResult.actionability.confidence);
      enhancedSystemPrompt += confidenceEnforcement;
      
      if (processResult.newState === 'clarification' && processResult.guidancePrompt) {
        enhancedSystemPrompt += `\n\n${processResult.guidancePrompt}`;
      } else if (processResult.newState === 'escalation') {
        enhancedSystemPrompt += `\n\n${processResult.guidancePrompt}`;
      } else if (processResult.newState === 'execution-ready') {
        enhancedSystemPrompt += `\n\nThe user has provided sufficient information (score=${processResult.actionability.score}/5, confidence=${Math.round(processResult.actionability.confidence * 100)}%). Confirm that you're ready to create their workflow and summarize what you understood.`;
      }

      let userContent: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = content.trim();
      
      // Only include image attachments (not Figma) when sending to AI
      const imageFilesFromStore = promptContext.attachments
        .filter(a => a.type === 'image' && a.file)
        .map(a => a.file!);
      const allImageFiles = [...imageFilesFromStore, ...(context?.uploadedFiles ?? [])];
      
      if (allImageFiles.length > 0 && messages.length === 0) {
        try {
          const imageDataUrls = await convertFilesToBase64(allImageFiles);
          userContent = [
            { type: 'text', text: content.trim() },
            ...imageDataUrls.map(url => ({ type: 'image_url' as const, image_url: { url } }))
          ];
          
          // Add image sources to conversation context for unified vision pipeline
          // Vision signals will be extracted from AI response and boost actionability
          for (let i = 0; i < allImageFiles.length; i++) {
            addConversationSource(
              'image',
              {
                fileName: allImageFiles[i].name,
                fileSize: allImageFiles[i].size,
                dataUrl: imageDataUrls[i],
              },
              0.5, // Initial confidence, will be boosted by AI analysis
              undefined // Vision signals extracted from AI response later
            );
          }
          console.log('[PreProjectChat] Added', allImageFiles.length, 'image sources to conversation');
        } catch (err) {
          console.error('Error converting images to base64:', err);
        }
      }
      
      // Also add Figma attachments as sources
      const figmaAttachments = promptContext.attachments.filter(a => a.type === 'figma' && a.figmaData);
      if (figmaAttachments.length > 0 && getSources().filter(s => s.type === 'figma-frame').length === 0) {
        for (const attachment of figmaAttachments) {
          addConversationSource(
            'figma-frame',
            {
              fileKey: attachment.figmaData?.fileKey,
              frameName: attachment.figmaData?.frameName,
              thumbnailUrl: attachment.thumbnailUrl,
              semantic: attachment.figmaData?.semantic,
            },
            0.6, // Figma frames often have good structure
            {
              flowsDetected: Boolean(attachment.figmaData?.semantic?.elements?.length),
              branching: Boolean(attachment.figmaData?.semantic?.navigationTargets?.length),
              screensDetected: attachment.figmaData?.frameName ? [attachment.figmaData.frameName] : undefined,
              primaryCTA: attachment.figmaData?.semantic?.elements?.find((e: { isPrimaryAction?: boolean }) => e.isPrimaryAction)?.text,
            }
          );
        }
        console.log('[PreProjectChat] Added', figmaAttachments.length, 'Figma sources to conversation');
      }

      const response = await aiClient.chat({
        messages: [
          { role: 'system', content: enhancedSystemPrompt },
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: userContent }
        ],
        temperature: 0.7,
        maxTokens: 600
      });

      const assistantMessage: Message = { role: 'assistant', content: response.text };
      setMessages(prev => [...prev, assistantMessage]);
      addAssistantMessage(response.text);

      if (processResult.newState === 'escalation') {
        const options = extractEscalationOptions(response.text);
        if (options.length > 0) {
          setEscalationOptions(options);
        }
      }

      if (processResult.newState === 'execution-ready') {
        setShowActionButtons(true);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: "I'm having trouble connecting right now. Please try again." 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, isLoading, aiClient, actionButtonsDismissed, hasUploadedFiles, processUserInput, addAssistantMessage, context, convertFilesToBase64, promptContext.attachments, addConversationSource, getSources]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  }, [inputValue, handleSendMessage]);

  const handleCreateProject = useCallback((generatePRD: boolean) => {
    const summary = getAccumulatedSummary();
    
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserIntent = userMessages.length > 0 
      ? userMessages[userMessages.length - 1].content 
      : initialPrompt;

    const fullSummary = userMessages.length > 1
      ? `${summary}\n\nLatest request: ${lastUserIntent}`
      : lastUserIntent || 'Create a new workflow';

    console.log('[KiteAI] Creating project with summary:', fullSummary, 'generatePRD:', generatePRD);
    onCreateProject(fullSummary, generatePRD);
  }, [messages, initialPrompt, onCreateProject, getAccumulatedSummary]);

  const handleKeepBrainstorming = useCallback(() => {
    setShowActionButtons(false);
    setActionButtonsDismissed(true);
    inputRef.current?.focus();
  }, []);

  const handleEscalationSelect = useCallback((option: string) => {
    setEscalationOptions([]);
    // Use a structured format that signals clear selection
    const structuredSelection = `I want to build this: ${option}. Please confirm this is what we'll create and ask me any final clarifying questions.`;
    handleSendMessage(structuredSelection);
  }, [handleSendMessage]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background flex flex-col"
        data-testid="preproject-chat-overlay"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-chat-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-medium">KiteAI</span>
          </div>

          {messages.length > 0 && (
            <StateIndicator 
              state={currentState} 
              score={currentScore} 
              confidence={currentConfidence} 
            />
          )}
          
          {messages.length === 0 && <div className="w-[120px]" />}
        </header>

        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 h-0">
            <div className="py-6 space-y-6">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Let's refine your idea</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    I'll help you clarify what you want to build. I need to understand:
                  </p>
                  <div className="mt-4 text-sm text-muted-foreground max-w-sm mx-auto text-left space-y-1">
                    <p>• <strong>Who</strong> will use this workflow</p>
                    <p>• <strong>What</strong> triggers it to start</p>
                    <p>• <strong>What</strong> success looks like</p>
                    <p>• <strong>What's</strong> in or out of scope</p>
                    <p>• <strong>What</strong> steps are involved</p>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                    data-testid={`message-${message.role}-${index}`}
                  >
                    {message.imagePreview && (
                      <div className="mb-2">
                        <img 
                          src={message.imagePreview} 
                          alt="Uploaded context" 
                          className="max-w-full max-h-48 rounded-lg object-contain"
                        />
                      </div>
                    )}
                    <div className={`text-sm whitespace-pre-wrap prose prose-sm max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 ${
                      message.role === 'user' ? 'prose-invert' : 'dark:prose-invert'
                    }`}>
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
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {escalationOptions.length > 0 && !isLoading && (
                <EscalationOptions 
                  options={escalationOptions} 
                  onSelect={handleEscalationSelect} 
                />
              )}

              {showActionButtons && !isLoading && messages.length > 0 && canStartProject && (
                <ActionButtons 
                  onStartProject={handleCreateProject}
                  onKeepBrainstorming={handleKeepBrainstorming}
                />
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border bg-background">
            <div className="flex items-end gap-3">
              <Textarea
                ref={inputRef}
                placeholder="Describe what you want to build..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[50px] max-h-[200px] resize-none"
                disabled={isLoading}
                data-testid="input-chat-message"
              />
              <ChatSendButton
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim()}
                isLoading={isLoading}
                className="h-[50px] w-[50px] shrink-0"
                data-testid="button-send-message"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line, ESC to go back
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function extractEscalationOptions(responseText: string): string[] {
  const options: string[] = [];
  
  const numberedPattern = /(?:^|\n)\s*(?:\d+[.)]\s*|[-•]\s*)(.+?)(?=\n\s*(?:\d+[.)]\s*|[-•]\s*)|$)/g;
  let match;
  while ((match = numberedPattern.exec(responseText)) !== null) {
    const option = match[1].trim();
    if (option.length > 10 && option.length < 200) {
      options.push(option);
    }
  }
  
  return options.slice(0, 3);
}
