import { useState, useRef, useEffect } from 'react';
import { Coins, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSubscription } from '@/hooks/useSubscription';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CreditsResponse {
  credits: number;
  isUnlimited?: boolean;
}

function getResetInfo() {
  const now = new Date();
  const midnightUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  );
  const msLeft = midnightUTC.getTime() - now.getTime();
  const hours = Math.floor(msLeft / (1000 * 60 * 60));
  const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
  const resetTimeLocal = midnightUTC.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return { hours, minutes, resetTimeLocal };
}

function formatCountdown(hours: number, minutes: number): string {
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function CreditsTierPill() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAdvanced, isPro, isAdmin, dailyCredits, isServerAuthenticated } = useSubscription();
  const [resetInfo, setResetInfo] = useState(getResetInfo);

  const { data: creditsData } = useQuery<CreditsResponse>({
    queryKey: ['/api/credits'],
    refetchInterval: 30000,
  });

  useEffect(() => {
    const id = setInterval(() => setResetInfo(getResetInfo()), 60000);
    return () => clearInterval(id);
  }, []);

  const isCreditsLoading = creditsData === undefined;
  const credits = creditsData?.credits ?? 0;
  const isUnlimited = (creditsData?.isUnlimited ?? false) || credits >= 999999;
  const maxCredits = dailyCredits || 25;
  const creditsPercent = isUnlimited ? 100 : Math.min(100, Math.round((credits / maxCredits) * 100));
  const isLow = !isUnlimited && credits <= 8;

  const tierLabel = isAdmin ? 'Admin' : isPro ? 'Pro' : (isAdvanced ? 'Advanced' : 'Free');

  const isSignedIn = isAuthenticated || isServerAuthenticated;
  const showUpgradeCard = isSignedIn && !isAdmin && !isAdvanced && !isPro;

  const countdownLabel = formatCountdown(resetInfo.hours, resetInfo.minutes);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Pill button with reset tooltip */}
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(!open)}
              data-testid="button-credits-pill"
              className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm ${
                isLow
                  ? 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800'
                  : 'bg-muted text-foreground border-border hover:bg-accent'
              }`}
            >
              <Coins size={12} className={isLow ? 'text-orange-500' : 'text-amber-500'} />
              <span data-testid="text-credits-count">{isUnlimited ? '∞' : isCreditsLoading ? '…' : credits}</span>
              <span className="text-muted-foreground font-normal">·</span>
              <span className={isLow ? 'text-orange-700 dark:text-orange-400' : 'text-muted-foreground'}>
                {tierLabel}
              </span>

              {isLow && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 ring-1 ring-background" />
              )}
            </button>
          </TooltipTrigger>
          {!isUnlimited && (
            <TooltipContent side="bottom" className="text-xs">
              Resets in {countdownLabel}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-lg shadow-lg z-[200] overflow-hidden">
          {/* Credits section */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Coins size={14} className="text-amber-500" />
                <span className="text-sm font-semibold text-foreground">AI Credits</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {isUnlimited ? '∞' : isCreditsLoading ? '…' : `${credits} / ${maxCredits}`} today
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isLow ? 'bg-orange-500' : 'bg-primary'}`}
                style={{ width: `${creditsPercent}%` }}
              />
            </div>

            {/* Reset time */}
            {!isUnlimited && (
              <div className="flex items-center gap-1.5 mt-2">
                <Clock size={11} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Resets at {resetInfo.resetTimeLocal}
                  <span className="text-muted-foreground/60 ml-1">· {countdownLabel}</span>
                </span>
              </div>
            )}

            {isLow && !isUnlimited && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1.5 leading-tight">
                Running low — credits reset daily.
              </p>
            )}

            <button
              className="mt-2 text-xs text-primary hover:underline"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent('openCreditsDialog'));
              }}
              data-testid="button-manage-credits"
            >
              Usage Details →
            </button>
          </div>

          {/* Upgrade card — free authenticated users only */}
          {showUpgradeCard && (
            <>
              <div className="border-t border-border" />
              <div className="p-3">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-3 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={13} />
                      <span className="text-xs font-semibold">Advanced plan</span>
                    </div>
                    <span className="text-[10px] opacity-80 bg-white/20 rounded px-1.5 py-0.5">
                      50 credits/day
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 mb-2.5 leading-snug">
                    Unlock 2× credits, workflow reasoning &amp; PRD generation.
                  </p>
                  <button
                    className="w-full py-1.5 rounded-md bg-white/20 hover:bg-white/30 border border-white/40 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    onClick={() => {
                      setOpen(false);
                      navigate('/pricing');
                    }}
                    data-testid="button-upgrade-plan"
                  >
                    <TrendingUp size={11} />
                    Upgrade plan
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
