import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Redirect, Link } from 'wouter';
import { Loader2, ArrowLeft } from 'lucide-react';
import { SiGoogle, SiGithub } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getQueryFn } from '@/lib/queryClient';
import { GradientOrbs } from '@/components/landing/GradientOrbs';

const FloatingShapes = lazy(() => import('@/components/landing/FloatingShapes'));

interface AuthUser {
  id: string;
  email?: string;
  isBeta?: boolean;
  isAdmin?: boolean;
  waitlistRequestedAt?: string | null;
}

export default function SignIn() {
  const { data: user, isLoading: userLoading } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: providersData, isLoading: providersLoading } = useQuery<{ providers: string[] }>({
    queryKey: ['/api/auth/available-providers'],
  });

  const availableProviders = providersData?.providers || [];

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Admin or beta users go directly to app
  if (user?.isBeta || user?.isAdmin) {
    return <Redirect to="/app" />;
  }

  // Authenticated non-beta/non-admin users go to waitlist dashboard
  if (user && !user.isBeta && !user.isAdmin) {
    return <Redirect to="/waitlist" />;
  }

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
    <div className="min-h-screen relative overflow-hidden bg-white dark:bg-slate-950">
      <GradientOrbs />
      <Suspense fallback={null}>
        <FloatingShapes />
      </Suspense>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-home">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-foreground" data-testid="text-logo">Kiteframe</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 rounded-full">
              Beta
            </span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 pb-20">
          <Card className="w-full max-w-md shadow-lg border-slate-200 dark:border-slate-800" data-testid="card-signin">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold text-foreground" data-testid="text-signin-title">
                Welcome back
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Sign in to access your Kiteframe account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {providersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {availableProviders.includes('replit') && (
                    <Button
                      variant="outline"
                      className="w-full h-12 text-base font-medium border-2 hover:bg-slate-50 dark:hover:bg-slate-900"
                      onClick={() => handleOAuthLogin('replit')}
                      data-testid="button-signin-replit"
                    >
                      <svg className="h-5 w-5 mr-3" viewBox="0 0 32 32" fill="currentColor">
                        <path d="M7 5.5C7 4.67157 7.67157 4 8.5 4H15.5C16.3284 4 17 4.67157 17 5.5V12H8.5C7.67157 12 7 11.3284 7 10.5V5.5Z" />
                        <path d="M17 12H25.5C26.3284 12 27 12.6716 27 13.5V18.5C27 19.3284 26.3284 20 25.5 20H17V12Z" />
                        <path d="M7 21.5C7 20.6716 7.67157 20 8.5 20H17V26.5C17 27.3284 16.3284 28 15.5 28H8.5C7.67157 28 7 27.3284 7 26.5V21.5Z" />
                      </svg>
                      Continue with Replit
                    </Button>
                  )}
                  
                  {availableProviders.includes('google') && (
                    <Button
                      variant="outline"
                      className="w-full h-12 text-base font-medium border-2 hover:bg-slate-50 dark:hover:bg-slate-900"
                      onClick={() => handleOAuthLogin('google')}
                      data-testid="button-signin-google"
                    >
                      <SiGoogle className="h-5 w-5 mr-3" />
                      Continue with Google
                    </Button>
                  )}
                  
                  {availableProviders.includes('github') && (
                    <Button
                      variant="outline"
                      className="w-full h-12 text-base font-medium border-2 hover:bg-slate-50 dark:hover:bg-slate-900"
                      onClick={() => handleOAuthLogin('github')}
                      data-testid="button-signin-github"
                    >
                      <SiGithub className="h-5 w-5 mr-3" />
                      Continue with GitHub
                    </Button>
                  )}

                  {availableProviders.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No sign-in providers are currently available.
                    </p>
                  )}
                </div>
              )}

              <div className="pt-4 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Don't have access yet?{' '}
                  <Link href="/#waitlist-section" className="text-violet-600 hover:text-violet-700 dark:text-violet-400 font-medium" data-testid="link-request-access">
                    Request beta access
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By continuing, you acknowledge that you agree to Kiteframe's{' '}
                  <a href="/legal#terms" className="text-violet-600 hover:underline" data-testid="link-terms">Terms and Conditions</a>{' '}
                  and <a href="/legal#privacy" className="text-violet-600 hover:underline" data-testid="link-privacy">Privacy Policy</a>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
