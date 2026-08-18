import { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONSENT_KEY = 'kiteframe_cookie_consent';

type ConsentValue = 'all' | 'necessary';

const VALID_VALUES: ConsentValue[] = ['all', 'necessary'];

function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentValue | null>(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      return stored && (VALID_VALUES as string[]).includes(stored)
        ? (stored as ConsentValue)
        : null;
    } catch {
      return null;
    }
  });

  const accept = (value: ConsentValue) => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {}
    setConsent(value);
  };

  return { consent, accept };
}

export function CookieBanner() {
  const { consent, accept } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [consent]);

  if (consent || !visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <Cookie className="h-5 w-5 text-violet-500 shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              We use cookies to keep you signed in and remember your preferences.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <a
              href="/legal#cookies"
              className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:underline whitespace-nowrap"
            >
              Cookies Policy
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => accept('necessary')}
              className="text-xs h-8"
            >
              Necessary Only
            </Button>
            <Button
              size="sm"
              onClick={() => accept('all')}
              className="text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white"
            >
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
