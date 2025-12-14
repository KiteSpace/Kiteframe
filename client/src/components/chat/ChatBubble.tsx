import { User, Bot } from 'lucide-react';

interface ChatBubbleProps {
  content: string;
  className?: string;
  'data-testid'?: string;
}

interface UserBubbleProps extends ChatBubbleProps {
  showAvatar?: boolean;
}

interface AIBubbleProps extends ChatBubbleProps {
  showAvatar?: boolean;
}

export function UserBubble({ 
  content, 
  className = '',
  showAvatar = true,
  'data-testid': testId
}: UserBubbleProps) {
  return (
    <div className={`flex items-start gap-2 justify-end ${className}`}>
      <div 
        className="bg-primary text-primary-foreground rounded-2xl rounded-br-none px-4 py-3 max-w-[80%]"
        data-testid={testId}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
      {showAvatar && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary-foreground" />
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
}: AIBubbleProps) {
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
