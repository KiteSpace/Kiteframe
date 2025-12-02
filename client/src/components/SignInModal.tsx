import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Chrome, Github, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface SignInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignUpClick: () => void;
}

export function SignInModal({ open, onOpenChange, onSignUpClick }: SignInModalProps) {
  const { data: providersData, isLoading } = useQuery<{ providers: string[] }>({
    queryKey: ['/api/auth/available-providers'],
    enabled: open,
  });

  const availableProviders = providersData?.providers || [];

  const handleOAuthLogin = (provider: string) => {
    if (provider === 'google') {
      window.location.href = '/api/auth/google';
    } else if (provider === 'github') {
      window.location.href = '/api/auth/github';
    } else if (provider === 'replit') {
      window.location.href = '/api/login';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Sign In to Kiteframe</DialogTitle>
          <DialogDescription>
            Choose your preferred sign-in method
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {availableProviders.includes('google') && (
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin('google')}
                  data-testid="button-signin-google"
                >
                  <Chrome className="h-4 w-4 mr-2" />
                  Continue with Google
                </Button>
              )}

              {availableProviders.includes('github') && (
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin('github')}
                  data-testid="button-signin-github"
                >
                  <Github className="h-4 w-4 mr-2" />
                  Continue with GitHub
                </Button>
              )}

              {availableProviders.includes('replit') && (
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin('replit')}
                  data-testid="button-signin-replit"
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M3 3h4v4H3V3zm6 0h4v4H9V3zm6 0h4v4h-4V3zM3 9h4v4H3V9zm6 0h4v4H9V9zm6 0h4v4h-4V9zM3 15h4v4H3v-4zm6 0h4v4H9v-4zm6 0h4v4h-4v-4z" />
                  </svg>
                  Continue with Replit
                </Button>
              )}
            </>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400">or</span>
            </div>
          </div>

          <div className="text-center text-sm text-slate-600 dark:text-slate-300">
            Don't have an account yet?{' '}
            <button
              onClick={() => {
                onOpenChange(false);
                onSignUpClick();
              }}
              className="font-medium text-blue-600 hover:text-blue-700 underline"
              data-testid="button-goto-signup"
            >
              Sign up
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
