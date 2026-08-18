import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';

interface CreditsResponse {
  success: boolean;
  credits: number;
  userIdentifier: string;
}

interface CreditsGateResult {
  credits: number;
  isLoading: boolean;
  isOutOfCredits: boolean;
  isLowCredits: boolean;
  isUnlimited: boolean;
  isAuthenticated: boolean;
  isServerAuthenticated: boolean;
  tier: 'free' | 'advanced' | 'pro';
  ctaMessage: string;
  ctaAction: 'signup' | 'redeem';
  ctaButtonText: string;
  disabledMessage: string;
  openSignup: () => void;
  openCreditsDialog: () => void;
}

export function useCreditsGate(): CreditsGateResult {
  const { isAuthenticated } = useAuth();
  const { tier, isServerAuthenticated, isAdmin, isUnlimited: subscriptionUnlimited } = useSubscription();

  const { data: creditsData, isLoading } = useQuery<CreditsResponse>({
    queryKey: ['/api/credits'],
    refetchInterval: 30000,
  });

  const credits = creditsData?.credits ?? 0;
  // User has unlimited credits if they're admin, have subscription unlimited flag, or credits >= 999999
  const isUnlimited = isAdmin || subscriptionUnlimited || credits >= 999999;
  // Don't consider out of credits while still loading, or if user has unlimited credits
  const isOutOfCredits = !isLoading && credits === 0 && !isUnlimited;
  const isLowCredits = credits <= 2 && !isUnlimited;

  let ctaMessage: string;
  let ctaAction: 'signup' | 'redeem';
  let ctaButtonText: string;
  let disabledMessage: string;

  if (!isAuthenticated) {
    ctaMessage = "You've used your daily credits. Create an account to get 25 credits per day!";
    ctaAction = 'signup';
    ctaButtonText = 'Create Free Account';
    disabledMessage = 'Create an account to continue using AI features';
  } else if (tier === 'free') {
    ctaMessage = "You've used all your daily credits. They'll reset in 24 hours, or use an unlock code for bonus credits.";
    ctaAction = 'redeem';
    ctaButtonText = 'Enter Unlock Code';
    disabledMessage = 'Daily credits used up. They reset every 24 hours.';
  } else {
    ctaMessage = "You've used all your daily credits. They'll reset in 24 hours, or use an unlock code for bonus credits.";
    ctaAction = 'redeem';
    ctaButtonText = 'Enter Unlock Code';
    disabledMessage = 'Daily credits used up. They reset every 24 hours.';
  }

  const openSignup = () => {
    window.dispatchEvent(new CustomEvent('openSignUp'));
  };

  const openCreditsDialog = () => {
    window.dispatchEvent(new CustomEvent('openCreditsDialog'));
  };

  return {
    credits,
    isLoading,
    isOutOfCredits,
    isLowCredits,
    isUnlimited,
    isAuthenticated,
    isServerAuthenticated,
    tier,
    ctaMessage,
    ctaAction,
    ctaButtonText,
    disabledMessage,
    openSignup,
    openCreditsDialog,
  };
}
