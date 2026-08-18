import { ArrowUp } from 'lucide-react';

interface ChatSendButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function ChatSendButton({
  onClick,
  disabled = false,
  isLoading = false,
  className = '',
  'data-testid': testId = 'button-send'
}: ChatSendButtonProps) {
  const canSubmit = !disabled && !isLoading;
  
  return (
    <button
      onClick={onClick}
      disabled={!canSubmit}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
        canSubmit 
          ? 'bg-foreground text-background hover:bg-foreground/90 cursor-pointer' 
          : 'bg-muted text-muted-foreground cursor-not-allowed'
      } ${className}`}
      data-testid={testId}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : (
        <ArrowUp className="w-5 h-5" />
      )}
    </button>
  );
}
