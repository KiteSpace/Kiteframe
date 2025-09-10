import { LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function AuthButton() {
  const { user, loading, signIn, signOut, isAuthenticated } = useAuth();

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