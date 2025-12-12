import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Sparkles, Loader2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAi } from '../ai/AiProvider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PreProjectChatProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (summary: string) => void;
  initialPrompt?: string;
}

const CLARIFICATION_SYSTEM_PROMPT = `You are KiteAI helping a user clarify what they want to build BEFORE creating a project.
Ask clarifying questions if needed.
Do not generate workflows yet.
Help the user refine intent.

Guidelines:
- Ask 1-2 focused questions at a time
- Understand the user's goals, constraints, and requirements
- Help identify edge cases and decision points
- When you have enough clarity, suggest they create the project
- Keep responses concise and conversational`;

export function PreProjectChat({
  isOpen,
  onClose,
  onCreateProject,
  initialPrompt = ''
}: PreProjectChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const aiClient = useAi();

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
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

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
  }, [messages, isLoading, aiClient]);

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

          <Button
            onClick={handleCreateProject}
            disabled={messages.length === 0}
            className="bg-primary hover:bg-primary/90"
            data-testid="button-create-project"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create project
          </Button>
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
