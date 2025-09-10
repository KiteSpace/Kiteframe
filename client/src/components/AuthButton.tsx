import { LogIn, LogOut, User, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';

export function AuthButton() {
  const { user, loading, signIn, signOut, isAuthenticated } = useAuth();
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Check if we're running inside an iframe (like Replit preview)
    setIsInIframe(window.top !== window);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center px-3 py-1.5 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 px-3 py-1.5 text-sm">
          <User size={16} className="text-muted-foreground" />
          <span className="text-foreground font-medium truncate max-w-32" title={user.displayName || user.email || 'User'}>
            {user.displayName || user.email || 'User'}
          </span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          data-testid="button-sign-out"
          title="Sign out"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    );
  }

  if (isInIframe) {
    // When in iframe (like Replit preview), show button to open in new tab
    return (
      <button
        onClick={() => {
          const currentUrl = window.location.href;
          window.open(currentUrl, '_blank', 'noopener,noreferrer');
        }}
        className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors"
        data-testid="button-open-in-tab"
        title="Open in new tab to sign in with Google"
      >
        <ExternalLink size={16} />
        <span>Open to Sign In</span>
      </button>
    );
  }

  return (
    <button
      onClick={signIn}
      className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
      data-testid="button-sign-in"
      title="Sign in with Google"
    >
      <LogIn size={16} />
      <span>Sign In</span>
    </button>
  );
}