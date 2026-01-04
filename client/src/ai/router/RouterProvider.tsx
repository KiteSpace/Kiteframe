import { createContext, useContext, useMemo } from 'react';
import { useAi } from '../AiProvider';
import { createAiRouter, type AiRouter } from './aiRouter';

const RouterContext = createContext<AiRouter | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const baseClient = useAi();
  
  const router = useMemo(() => createAiRouter(baseClient), [baseClient]);
  
  return (
    <RouterContext.Provider value={router}>
      {children}
    </RouterContext.Provider>
  );
}

export function useAiRouter(): AiRouter {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useAiRouter must be used within <RouterProvider>');
  }
  return ctx;
}
