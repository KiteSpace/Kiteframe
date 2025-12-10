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
  ctaAction: 'signup' | 'upgrade' | 'redeem';
  ctaButtonText: string;
  disabledMessage: string;
  openSignup: () => void;
  openPricing: () => void;
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
  let ctaAction: 'signup' | 'upgrade' | 'redeem';
  let ctaButtonText: string;
  let disabledMessage: string;

  if (!isAuthenticated) {
    ctaMessage = "You've run out of free trial credits. Create an account to get 25 credits monthly!";
    ctaAction = 'signup';
    ctaButtonText = 'Create Free Account';
    disabledMessage = 'Create an account to continue using AI features';
  } else if (tier === 'free') {
    ctaMessage = "You've run out of credits. Upgrade your plan to continue using AI features.";
    ctaAction = 'upgrade';
    ctaButtonText = 'Upgrade Plan';
    disabledMessage = 'Upgrade your plan to continue using AI features';
  } else {
    ctaMessage = "You've run out of credits. Enter an unlock code to continue using AI features.";
    ctaAction = 'redeem';
    ctaButtonText = 'Enter Unlock Code';
    disabledMessage = 'Enter an unlock code to continue using AI features';
  }

  const openSignup = () => {
    window.dispatchEvent(new CustomEvent('openSignUp'));
  };

  const openPricing = () => {
    window.location.href = '/pricing';
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
    openPricing,
    openCreditsDialog,
  };
}
