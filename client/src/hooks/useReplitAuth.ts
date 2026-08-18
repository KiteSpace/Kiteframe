import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useReplitAuth() {
  const { data: user, isLoading, error, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user: user || null,
    isLoading,
    error,
    isAuthenticated: !!user,
    refetch,
  };
}
