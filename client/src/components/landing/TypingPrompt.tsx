import { useEffect, useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';

const PROMPTS = [
  "Design a user onboarding flow for a SaaS product...",
  "Create a payment processing workflow with error handling...",
  "Map out the feature launch checklist for mobile app...",
  "Build a customer support ticket routing system...",
  "Design an approval workflow for content publishing...",
  "Create a data pipeline for user analytics tracking...",
  "Map the e-commerce checkout process with validations...",
  "Design a subscription upgrade and downgrade flow...",
];

export default function TypingPrompt() {
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const currentPrompt = PROMPTS[currentPromptIndex];

  const typeNextChar = useCallback(() => {
    if (displayedText.length < currentPrompt.length) {
      setDisplayedText(currentPrompt.slice(0, displayedText.length + 1));
    } else {
      setIsTyping(false);
    }
  }, [displayedText, currentPrompt]);

  useEffect(() => {
    if (isTyping) {
      const timeout = setTimeout(typeNextChar, 40 + Math.random() * 30);
      return () => clearTimeout(timeout);
    } else {
      const pauseTimeout = setTimeout(() => {
        setDisplayedText('');
        setCurrentPromptIndex((prev) => (prev + 1) % PROMPTS.length);
        setIsTyping(true);
      }, 2500);
      return () => clearTimeout(pauseTimeout);
    }
  }, [isTyping, typeNextChar]);

  return (
    <div className="relative">
      <div 
        className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-lg max-w-md"
        data-testid="typing-prompt"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-h-[48px]">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {displayedText}
              <span className="inline-block w-0.5 h-4 bg-violet-500 ml-0.5 animate-pulse" />
            </p>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white dark:bg-slate-900 border-b-2 border-r-2 border-slate-200 dark:border-slate-700 transform rotate-45" />
    </div>
  );
}
