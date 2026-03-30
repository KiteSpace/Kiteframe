import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/queryClient';

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
    queryClient.invalidateQueries({ queryKey: ['/api/credits'] });

    const timer = setTimeout(() => {
      setLocation('/app');
    }, 5000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <Sparkles className="h-6 w-6 text-blue-500 absolute -top-1 -right-1" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          You're all set!
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mb-2">
          Your 7-day free trial has started. Enjoy full Advanced access — cancel anytime before day 7 to pay nothing.
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-8">
          Redirecting you to the app in a moment…
        </p>
        <Button
          className="px-8"
          onClick={() => setLocation('/app')}
        >
          Go to app
        </Button>
      </div>
    </div>
  );
}
