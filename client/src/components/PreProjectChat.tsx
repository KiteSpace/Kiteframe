import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Sparkles, Loader2, Rocket, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAi } from '../ai/AiProvider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  showActions?: boolean;
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
  onCreateProject: (summary: string) => void;
  initialPrompt?: string;
  context?: PreProjectContext | null;
}

const CLARIFICATION_SYSTEM_PROMPT = `You are KiteAI, a decisive product design and workflow assistant.

Your primary goal is to help the user move from idea → project creation with minimal friction.

You MUST follow these rules:

1. Bias toward action over clarification.
2. Do NOT trap the user in extended brainstorming loops.
3. Once the user intent is actionable, you MUST present a clear decision.
4. You are allowed to start a project even if details are incomplete.
5. Missing details can be refined after project creation.

Actionable intent means:
- A general goal exists
- A user or system is implied
- The problem space is identifiable
- Remaining questions are refinements, not blockers

Once intent is actionable:
- Ask at most 1–2 clarifying questions
- Then IMMEDIATELY present decision actions:
  - "Ready to start the project"
  - "Keep brainstorming"

If you have asked questions for more than 3 turns total, you MUST stop and present the decision actions.

You should summarize your understanding briefly (2–3 sentences max), then allow the user to decide.

Never hide project creation behind more questions.
Keep responses concise and conversational.`;

function calculateConfidenceScore(allMessages: Message[], hasUploadedFiles: boolean): number {
  let score = 0;
  const allText = allMessages.map(m => m.content.toLowerCase()).join(' ');
  
  const goalKeywords = ['build', 'design', 'create', 'workflow', 'tool', 'system', 'make', 'develop', 'implement', 'set up', 'automate'];
  if (goalKeywords.some(kw => allText.includes(kw))) {
    score += 25;
  }
  
  const userKeywords = ['ops team', 'users', 'admins', 'backend', 'product', 'customers', 'team', 'employee', 'manager', 'client', 'developer', 'engineer', 'designer', 'marketing', 'sales', 'support', 'hr', 'finance'];
  if (userKeywords.some(kw => allText.includes(kw))) {
    score += 20;
  }
  
  const problemKeywords = ['duplicate', 'confusion', 'slow', 'error', 'manual', 'tedious', 'inefficient', 'broken', 'problem', 'issue', 'pain', 'frustrating', 'difficult', 'complex', 'time-consuming', 'bottleneck', 'missed', 'forgot', 'lack'];
  if (problemKeywords.some(kw => allText.includes(kw))) {
    score += 20;
  }
  
  if (hasUploadedFiles) {
    score += 15;
  }
  const artifactKeywords = ['figma', 'image', 'doc', 'jira', 'screenshot', 'mockup', 'wireframe', 'diagram', 'spec', 'requirement', 'document', 'file', 'pdf', 'spreadsheet', 'csv'];
  if (artifactKeywords.some(kw => allText.includes(kw))) {
    score += 15;
  }
  
  const constraintKeywords = ['platform', 'scale', 'data', 'environment', 'api', 'integration', 'database', 'security', 'performance', 'deadline', 'budget', 'must', 'should', 'need to', 'require'];
  if (constraintKeywords.some(kw => allText.includes(kw))) {
    score += 10;
  }
  
  const confirmKeywords = ['yes', 'correct', 'exactly', 'that\'s right', 'sounds good', 'perfect', 'agreed', 'confirmed', 'looks good', 'that works'];
  const userMessages = allMessages.filter(m => m.role === 'user');
  if (userMessages.length > 1 && confirmKeywords.some(kw => userMessages[userMessages.length - 1].content.toLowerCase().includes(kw))) {
    score += 10;
  }
  
  return Math.min(score, 100);
}

function ActionButtons({ 
  onStartProject, 
  onKeepBrainstorming 
}: { 
  onStartProject: () => void; 
  onKeepBrainstorming: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="flex justify-start mt-3"
    >
      <div className="bg-muted/50 border border-border rounded-2xl p-4 max-w-[80%]">
        <p className="text-sm text-muted-foreground mb-3">
          Looks like we have enough to start. You can refine things inside the project.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={onStartProject}
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const aiClient = useAi();

  const hasUploadedFiles = useMemo(() => {
    return (context?.uploadedFiles?.length ?? 0) > 0;
  }, [context?.uploadedFiles]);

  const aiTurnCount = useMemo(() => {
    return messages.filter(m => m.role === 'assistant').length;
  }, [messages]);

  const confidenceScore = useMemo(() => {
    return calculateConfidenceScore(messages, hasUploadedFiles);
  }, [messages, hasUploadedFiles]);

  const shouldShowActions = useMemo(() => {
    if (actionButtonsDismissed) return false;
    if (messages.length === 0) return false;
    
    if (hasUploadedFiles && aiTurnCount >= 1) return true;
    if (aiTurnCount >= 3) return true;
    if (confidenceScore >= 70) return true;
    if (confidenceScore >= 50 && aiTurnCount >= 2) return true;
    
    return false;
  }, [actionButtonsDismissed, messages.length, hasUploadedFiles, aiTurnCount, confidenceScore]);

  useEffect(() => {
    if (shouldShowActions && !showActionButtons) {
      setShowActionButtons(true);
    }
  }, [shouldShowActions, showActionButtons]);

  useEffect(() => {
    if (isOpen && initialPrompt && !hasStarted) {
      setHasStarted(true);
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt, hasStarted]);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInputValue('');
      setHasStarted(false);
      setShowActionButtons(false);
      setActionButtonsDismissed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, showActionButtons]);

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

    const userMessage: Message = { role: 'user', content: content.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    if (actionButtonsDismissed) {
      setActionButtonsDismissed(false);
    }

    try {
      const response = await aiClient.chat({
        messages: [
          { role: 'system', content: CLARIFICATION_SYSTEM_PROMPT },
          ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: content.trim() }
        ],
        temperature: 0.7,
        maxTokens: 500
      });

      const assistantMessage: Message = { role: 'assistant', content: response.text };
      setMessages(prev => [...prev, assistantMessage]);
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
  }, [messages, isLoading, aiClient, actionButtonsDismissed]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  }, [inputValue, handleSendMessage]);

  const handleCreateProject = useCallback(() => {
    const conversationSummary = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
    
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserIntent = userMessages.length > 0 
      ? userMessages[userMessages.length - 1].content 
      : initialPrompt;

    const summary = userMessages.length > 1
      ? `Based on our conversation:\n${conversationSummary}\n\nCreate a workflow for: ${lastUserIntent}`
      : lastUserIntent || 'Create a new workflow';

    onCreateProject(summary);
  }, [messages, initialPrompt, onCreateProject]);

  const handleKeepBrainstorming = useCallback(() => {
    setShowActionButtons(false);
    setActionButtonsDismissed(true);
    inputRef.current?.focus();
  }, []);

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

          <div className="w-[120px]" />
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
                    I'll help you clarify what you want to build before we create your project.
                  </p>
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
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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

              {showActionButtons && !isLoading && messages.length > 0 && (
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
              <Button
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                className="h-[50px] w-[50px] shrink-0"
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
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
