import { LogIn, LogOut, User, ExternalLink, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect, useRef } from 'react';

export function AuthButton() {
  const { user, loading, signIn, signOut, isAuthenticated } = useAuth();
  const [isInIframe, setIsInIframe] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if we're running inside an iframe (like Replit preview)
    setIsInIframe(window.top !== window);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-1 p-1.5 rounded-full hover:bg-accent transition-colors"
          data-testid="button-user-profile"
          title={user.displayName || user.email || 'User profile'}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                // Fallback to generic icon if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <User 
            size={20} 
            className={`${user.photoURL ? 'hidden' : ''} text-muted-foreground`}
          />
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-md shadow-md z-50">
            <div className="py-1">
              <div className="px-3 py-2 text-sm border-b">
                <div className="font-medium truncate">
                  {user.displayName || 'User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.email}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  signOut();
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center space-x-2"
                data-testid="button-sign-out"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isInIframe) {
    // When in iframe (like Replit preview), show button to open in new tab
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => {
            const currentUrl = window.location.href;
            window.open(currentUrl, '_blank', 'noopener,noreferrer');
          }}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors"
          data-testid="button-open-in-tab"
          title="Open in external browser tab to sign in with Google"
        >
          <ExternalLink size={16} />
          <span>Open to Sign In</span>
        </button>
        <div className="text-xs text-muted-foreground max-w-48">
          Opens in browser where Google Auth works
        </div>
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