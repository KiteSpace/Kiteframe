import { useQuery } from '@tanstack/react-query';

export interface SubscriptionData {
  tier: 'free' | 'advanced' | 'pro';
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused' | null;
  billingPeriodEnd: string | null;
  monthlyCredits: number;
  features: {
    cloudProjects: boolean;
    prioritySupport: boolean;
    advancedExports: boolean;
    teamCollaboration: boolean;
  };
}

const TIER_CREDITS = {
  free: 25,
  advanced: 150,
  pro: 500,
} as const;

const TIER_FEATURES = {
  free: {
    cloudProjects: false,
    prioritySupport: false,
    advancedExports: false,
    teamCollaboration: false,
  },
  advanced: {
    cloudProjects: false,
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
  }>({
    queryKey: ['/api/subscription'],
  });

  const isAdmin = data?.isAdmin ?? false;
  const isUnlimited = data?.isUnlimited ?? false;
  
  // Admins always get Pro tier
  const tier = isAdmin ? 'pro' : ((data?.tier as 'free' | 'advanced' | 'pro') || 'free');
  const status = isAdmin ? 'active' : ((data?.status as SubscriptionData['status']) || null);

  const subscriptionData: SubscriptionData = {
    tier,
    status,
    billingPeriodEnd: data?.billingPeriodEnd || null,
    monthlyCredits: isUnlimited ? Infinity : TIER_CREDITS[tier],
    features: TIER_FEATURES[tier],
  };

  // Server considers user authenticated if subscription query returns data without 401
  const isServerAuthenticated = !isLoading && !error && data !== undefined;

  return {
    ...subscriptionData,
    isLoading,
    error,
    refetch,
    isAdmin,
    isUnlimited,
    isPro: tier === 'pro' && status === 'active',
    isAdvanced: (tier === 'advanced' || tier === 'pro') && status === 'active',
    isPaid: isAdmin || ((tier === 'advanced' || tier === 'pro') && status === 'active'),
    hasActiveSubscription: isAdmin || status === 'active',
    isServerAuthenticated,
  };
}
