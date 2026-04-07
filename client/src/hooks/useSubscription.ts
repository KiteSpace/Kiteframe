import { useQuery } from '@tanstack/react-query';

export interface SubscriptionData {
  tier: 'free' | 'advanced' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused' | null;
  billingPeriodEnd: string | null;
  dailyCredits: number;
  projectLimit: number;
  features: {
    cloudProjects: boolean;
    prioritySupport: boolean;
    advancedExports: boolean;
    teamCollaboration: boolean;
  };
}

const TIER_DAILY_CREDITS = {
  free: 25,
  advanced: 50,
  pro: 150,
} as const;

const TIER_PROJECT_LIMITS = {
  free: 10,
  advanced: 50,
  pro: 100,
} as const;

const TIER_FEATURES = {
  free: {
    cloudProjects: true,
    prioritySupport: false,
    advancedExports: false,
    teamCollaboration: false,
  },
  advanced: {
    cloudProjects: true,
    prioritySupport: true,
    advancedExports: true,
    teamCollaboration: false,
  },
  pro: {
    cloudProjects: true,
    prioritySupport: true,
    advancedExports: true,
    teamCollaboration: true,
  },
} as const;

export function useSubscription() {
  const { data, isLoading, error, refetch } = useQuery<{
    tier?: string;
    status?: string;
    billingPeriodEnd?: string;
    isAdmin?: boolean;
    isUnlimited?: boolean;
    trialEnd?: string | null;
  }>({
    queryKey: ['/api/subscription'],
  });

  const isAdmin = data?.isAdmin ?? false;
  const isUnlimited = data?.isUnlimited ?? false;
  
  // Admins always get Pro tier
  const tier = isAdmin ? 'pro' : ((data?.tier as 'free' | 'advanced' | 'pro') || 'free');
  const status = isAdmin ? 'active' : ((data?.status as SubscriptionData['status']) || null);
  const isTrialing = status === 'trialing';
  const trialEnd = data?.trialEnd ?? null;

  const subscriptionData: SubscriptionData = {
    tier,
    status,
    billingPeriodEnd: data?.billingPeriodEnd || null,
    dailyCredits: isUnlimited ? Infinity : TIER_DAILY_CREDITS[tier],
    projectLimit: TIER_PROJECT_LIMITS[tier],
    features: TIER_FEATURES[tier],
  };

  // Server considers user authenticated if subscription query returns data without 401
  const isServerAuthenticated = !isLoading && !error && data !== undefined;

  // Trialing users on advanced or pro get full paid benefits
  const isPaidOrTrialing = (tier === 'advanced' || tier === 'pro') && (status === 'active' || isTrialing);

  return {
    ...subscriptionData,
    isLoading,
    error,
    refetch,
    isAdmin,
    isUnlimited,
    isTrialing,
    trialEnd,
    isPro: tier === 'pro' && (status === 'active' || isTrialing),
    isAdvanced: (tier === 'advanced' || tier === 'pro') && (status === 'active' || isTrialing),
    isPaid: isAdmin || isPaidOrTrialing,
    hasActiveSubscription: isAdmin || status === 'active' || isTrialing,
    isServerAuthenticated,
  };
}
