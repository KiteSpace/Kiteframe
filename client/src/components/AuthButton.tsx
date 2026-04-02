import { LogIn, LogOut, User, ChevronDown, Settings, Crown, Sparkles, Shield, HelpCircle, Mail, Send, Loader2, Check, X } from 'lucide-react';
import { useReplitAuth } from '@/hooks/useReplitAuth';
import { useState, useRef, useEffect } from 'react';
import { SignInModal } from './SignInModal';
import { SignUpModal } from './SignUpModal';
import { useLocation } from 'wouter';
import { useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/badge';

function ContactModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [form, setForm] = useState({
    name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '',
    email: user?.email || '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !form.name || !form.email || !form.message) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, message: form.message }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-popover border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Mail size={18} className="text-primary" />
          <h2 className="text-base font-semibold">Contact Us</h2>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium text-sm">Message sent!</p>
            <p className="text-sm text-muted-foreground">We'll get back to you soon.</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full h-9 px-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="your@email.com"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder="How can we help?"
              />
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 h-9 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {submitting ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function AuthButton() {
  const { user, isLoading, isAuthenticated } = useReplitAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { tier, isPro, isAdvanced, isAdmin } = useSubscription();

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

  useEffect(() => {
    const handleOpenSignIn = () => setShowSignIn(true);
    const handleOpenSignUp = () => setShowSignUp(true);

    window.addEventListener('openSignIn', handleOpenSignIn);
    window.addEventListener('openSignUp', handleOpenSignUp);
    
    return () => {
      window.removeEventListener('openSignIn', handleOpenSignIn);
      window.removeEventListener('openSignUp', handleOpenSignUp);
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
      <>
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
            <div className="absolute right-0 top-full mt-1 w-52 bg-popover border rounded-md shadow-md z-50">
              <div className="py-1">
                <div className="px-3 py-2 text-sm border-b">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium truncate">
                      {user.firstName || user.email || 'User'}
                    </span>
                    {isAdmin ? (
                      <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-violet-600 text-white border-0 text-xs px-1.5 py-0">
                        <Shield className="h-3 w-3 mr-0.5" />
                        Admin
                      </Badge>
                    ) : isPro ? (
                      <Badge variant="default" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs px-1.5 py-0">
                        <Crown className="h-3 w-3 mr-0.5" />
                        Pro
                      </Badge>
                    ) : isAdvanced ? (
                      <Badge variant="default" className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 text-xs px-1.5 py-0">
                        <Sparkles className="h-3 w-3 mr-0.5" />
                        Advanced
                      </Badge>
                    ) : null}
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
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/faq');
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center space-x-2"
                  data-testid="button-faq"
                >
                  <HelpCircle size={16} />
                  <span>FAQ</span>
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowContact(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center space-x-2"
                  data-testid="button-contact-us"
                >
                  <Mail size={16} />
                  <span>Contact Us</span>
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

        {showContact && (
          <ContactModal user={user} onClose={() => setShowContact(false)} />
        )}
      </>
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
