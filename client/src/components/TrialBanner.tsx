import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useSubscription } from '@/hooks/useSubscription';

export function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { isTrialing, trialEnd } = useSubscription();

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/portal', {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  if (!isTrialing || dismissed) return null;

  const daysRemaining = trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const daysLabel =
    daysRemaining === null
      ? 'Trial active'
      : daysRemaining === 0
      ? 'Trial ends today'
      : daysRemaining === 1
      ? '1 day left in your trial'
      : `${daysRemaining} days left in your trial`;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium z-50 shrink-0">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>{daysLabel} — cancel before day 7 to pay nothing</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
          onClick={() => portalMutation.mutate()}
          disabled={portalMutation.isPending}
        >
          {portalMutation.isPending ? 'Loading...' : 'Manage trial'}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss trial banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
