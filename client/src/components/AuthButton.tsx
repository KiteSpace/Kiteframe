import { LogIn, LogOut, User, ChevronDown, Settings } from 'lucide-react';
import { useReplitAuth } from '@/hooks/useReplitAuth';
import { useState, useRef, useEffect } from 'react';
import { SignInModal } from './SignInModal';
import { SignUpModal } from './SignUpModal';
import { useLocation } from 'wouter';

export function AuthButton() {
  const { user, isLoading, isAuthenticated } = useReplitAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

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

  const handleLogout = async () => {
    setShowDropdown(false);
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  };

  if (isLoading) {
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
          title={user.email || 'User profile'}
        >
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <User 
            size={20} 
            className={`${user.profileImageUrl ? 'hidden' : ''} text-muted-foreground`}
          />
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-md shadow-md z-50">
            <div className="py-1">
              <div className="px-3 py-2 text-sm border-b">
                <div className="font-medium truncate">
                  {user.firstName || user.email || 'User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.email}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  navigate('/account');
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center space-x-2"
                data-testid="button-account-settings"
              >
                <Settings size={16} />
                <span>Account Settings</span>
              </button>
              <button
                onClick={handleLogout}
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

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSignIn(true)}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-md hover:bg-accent text-sm font-medium transition-colors"
          data-testid="button-sign-in"
        >
          <LogIn size={16} />
          <span>Sign In</span>
        </button>
        <button
          onClick={() => setShowSignUp(true)}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
          data-testid="button-sign-up"
        >
          <span>Sign Up</span>
        </button>
      </div>

      <SignInModal
        open={showSignIn}
        onOpenChange={setShowSignIn}
        onSignUpClick={() => {
          setShowSignIn(false);
          setShowSignUp(true);
        }}
      />
      <SignUpModal
        open={showSignUp}
        onOpenChange={setShowSignUp}
        onSignInClick={() => {
          setShowSignUp(false);
          setShowSignIn(true);
        }}
      />
    </>
  );
}
