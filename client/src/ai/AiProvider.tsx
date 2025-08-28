import React, { createContext, useContext } from 'react';
import type { AiClient } from './types';

const Ctx = createContext<AiClient | null>(null);
export const AiProvider: React.FC<{ client: AiClient; children: React.ReactNode }> = ({ client, children }) => <Ctx.Provider value={client}>{children}</Ctx.Provider>;
export function useAi(){ const ctx = useContext(Ctx); if(!ctx) throw new Error('useAi must be used within <AiProvider>'); return ctx; }