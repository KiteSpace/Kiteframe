import { LogIn, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface SharedViewHeaderProps {
  projectName: string;
}

export function SharedViewHeader({ projectName }: SharedViewHeaderProps) {
  const { user, loading, signIn } = useAuth();

  return (
    <header
      className="h-10 flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0 z-50"
      data-testid="shared-view-header"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-semibold text-primary tracking-tight flex-shrink-0">
          Kiteframe
        </span>
        <span className="text-muted-foreground/40 text-sm flex-shrink-0">·</span>
        <span
          className="text-sm text-foreground truncate"
          data-testid="shared-view-project-name"
          title={projectName}
        >
          {projectName}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {!loading && !user && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={signIn}
            data-testid="button-sign-in"
          >
            <LogIn size={12} />
            Sign in
          </Button>
        )}
        {!loading && user && (
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="shared-view-user"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <User size={14} />
            )}
            <span className="max-w-[120px] truncate">
              {user.displayName || user.email || 'Signed in'}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
