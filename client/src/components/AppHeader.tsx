import { Button } from '@/components/ui/button';
import { useReplitAuth } from '@/hooks/useReplitAuth';
import { LogOut, User, Settings, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocation } from 'wouter';

interface AppHeaderProps {
  onSignInClick: () => void;
  onSignUpClick: () => void;
}

export function AppHeader({ onSignInClick, onSignUpClick }: AppHeaderProps) {
  const { user, isAuthenticated } = useReplitAuth();
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="text-xl font-bold text-slate-900">KiteAI</div>

        <nav className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/pricing')}
            data-testid="button-nav-pricing"
          >
            Pricing
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/docs')}
            data-testid="button-nav-docs"
          >
            Docs
          </Button>

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  data-testid="button-user-menu"
                >
                  {user.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl || ''}
                      alt={user.email}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm font-medium text-slate-900">
                  {user.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/account')} data-testid="menu-account">
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSignInClick}
                data-testid="button-signin"
              >
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={onSignUpClick}
                data-testid="button-signup"
              >
                Sign Up
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
