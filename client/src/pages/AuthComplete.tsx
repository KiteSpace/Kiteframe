import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

export default function AuthComplete() {
  const [, setLocation] = useLocation();
  const [attempts, setAttempts] = useState(0);
  const [handoffDone, setHandoffDone] = useState(false);
  const maxAttempts = 10;

  const params = new URLSearchParams(window.location.search);
  // If user was redirected to login from an external workflow claim, honour that return URL
  const claimReturnUrl = localStorage.getItem('kiteframe-claim-return-url');
  const rawRedirect = params.get('redirect') || '/';
  // Only use the claim return URL if it points to a workflow page (safety check)
  const redirectTo = claimReturnUrl && claimReturnUrl.includes('/workflows/') ? claimReturnUrl : rawRedirect;
  const token = params.get('token');

  useEffect(() => {
    if (!token) {
      setHandoffDone(true);
      return;
    }

    fetch(`/api/auth/handoff?token=${encodeURIComponent(token)}`, {
      credentials: 'include',
    })
      .then((r) => {
        if (r.ok) {
          window.history.replaceState(
            {},
            '',
            `/auth-complete?redirect=${encodeURIComponent(redirectTo)}`
          );
          setHandoffDone(true);
        } else {
          console.error('[AuthComplete] Handoff failed with status:', r.status);
          setLocation('/signin?error=handoff_failed');
        }
      })
      .catch((err) => {
        console.error('[AuthComplete] Handoff fetch error:', err);
        setLocation('/signin?error=handoff_error');
      });
  }, []);

  useEffect(() => {
    if (!handoffDone) return;

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });

        if (response.ok) {
          console.log('[AuthComplete] Session confirmed, redirecting to:', redirectTo);
          queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
          queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          setLocation(redirectTo);
          return;
        }

        if (attempts < maxAttempts) {
          console.log('[AuthComplete] Session not ready, attempt:', attempts + 1);
          setAttempts((prev) => prev + 1);
        } else {
          console.error('[AuthComplete] Max attempts reached, redirecting to signin');
          setLocation('/signin?error=session_timeout');
        }
      } catch (error) {
        console.error('[AuthComplete] Auth check error:', error);
        if (attempts >= maxAttempts) {
          setLocation('/signin?error=auth_error');
        } else {
          setAttempts((prev) => prev + 1);
        }
      }
    };

    const timer = setTimeout(checkAuth, 200);
    return () => clearTimeout(timer);
  }, [handoffDone, attempts, setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
