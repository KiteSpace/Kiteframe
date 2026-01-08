import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ResolvedFeatureFlags } from '@shared/schema';

interface FeatureFlagContextValue {
  flags: ResolvedFeatureFlags;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isEnabled: (key: string) => boolean;
  getFlag: (key: string) => { enabled: boolean; source: string; groupName?: string } | undefined;
  refetch: () => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(undefined);

interface FeatureFlagProviderProps {
  children: React.ReactNode;
  fallbackFlags?: ResolvedFeatureFlags;
}

export function FeatureFlagProvider({ children, fallbackFlags = {} }: FeatureFlagProviderProps) {
  const queryClient = useQueryClient();

  const { data: flags = fallbackFlags, isLoading, isError, error, refetch } = useQuery<ResolvedFeatureFlags>({
    queryKey: ['/api/feature-flags'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const isEnabled = useCallback((key: string): boolean => {
    return flags[key]?.enabled ?? false;
  }, [flags]);

  const getFlag = useCallback((key: string) => {
    return flags[key];
  }, [flags]);

  const handleRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/feature-flags'] });
    refetch();
  }, [queryClient, refetch]);

  const value = useMemo(() => ({
    flags,
    isLoading,
    isError,
    error: error as Error | null,
    isEnabled,
    getFlag,
    refetch: handleRefetch,
  }), [flags, isLoading, isError, error, isEnabled, getFlag, handleRefetch]);

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    // In development, throw to catch wiring issues early
    if (import.meta.env.DEV) {
      throw new Error(
        '[FeatureFlags] useFeatureFlags must be used within FeatureFlagProvider. ' +
        'Ensure all React roots (main app, portals, overlays) are wrapped with FeatureFlagProvider.'
      );
    }
    // In production, log error and return safe fallback
    console.error('[FeatureFlags] useFeatureFlags called outside of FeatureFlagProvider - all flags disabled. This is a critical configuration error.');
    return {
      flags: {},
      isLoading: false,
      isError: false,
      error: null,
      isEnabled: () => false,
      getFlag: () => undefined,
      refetch: () => {},
    };
  }
  return context;
}

export function useFeatureFlag(key: string): { enabled: boolean; isLoading: boolean; isError: boolean; source?: string; groupName?: string } {
  const { flags, isLoading, isError, getFlag } = useFeatureFlags();
  const flag = getFlag(key);
  
  return useMemo(() => ({
    enabled: flag?.enabled ?? false,
    isLoading,
    isError,
    source: flag?.source,
    groupName: flag?.groupName,
  }), [flag, isLoading, isError]);
}

export function FeatureGate({ 
  flag, 
  children, 
  fallback = null 
}: { 
  flag: string; 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  const { enabled, isLoading } = useFeatureFlag(flag);
  
  if (isLoading) {
    return null;
  }
  
  return enabled ? <>{children}</> : <>{fallback}</>;
}
