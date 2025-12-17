import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

export default function AuthComplete() {
  const [, setLocation] = useLocation();
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 10;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get('redirect') || '/';

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });

        if (response.ok) {
          console.log('[AuthComplete] Session confirmed, redirecting to:', redirectTo);
          setLocation(redirectTo);
          return;
        }

        if (attempts < maxAttempts) {
          console.log('[AuthComplete] Session not ready, attempt:', attempts + 1);
          setAttempts(prev => prev + 1);
        } else {
          console.error('[AuthComplete] Max attempts reached, redirecting to signin');
          setLocation('/signin?error=session_timeout');
        }
      } catch (error) {
        console.error('[AuthComplete] Auth check error:', error);
        if (attempts >= maxAttempts) {
          setLocation('/signin?error=auth_error');
        } else {
          setAttempts(prev => prev + 1);
        }
      }
    };

    const timer = setTimeout(checkAuth, 200);
    return () => clearTimeout(timer);
  }, [attempts, setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
