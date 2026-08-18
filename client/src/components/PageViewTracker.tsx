import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

export function PageViewTracker() {
  const [location] = useLocation();
  const lastTrackedRoute = useRef<string | null>(null);

  useEffect(() => {
    if (location === lastTrackedRoute.current) return;
    lastTrackedRoute.current = location;

    const trackPageView = async () => {
      try {
        await fetch('/api/analytics/pageview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            route: location,
            referrer: document.referrer || null,
          }),
        });
      } catch {
        // Silently fail - don't impact user experience
      }
    };

    // Small delay to avoid tracking during quick redirects
    const timer = setTimeout(trackPageView, 100);
    return () => clearTimeout(timer);
  }, [location]);

  return null;
}
