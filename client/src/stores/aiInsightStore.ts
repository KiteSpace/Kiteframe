import type { AIInsight } from '../ai/insights';

const STORAGE_KEY_PREFIX = 'kiteframe-ai-insights-';

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

export function loadInsights(projectId: string): AIInsight[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(getStorageKey(projectId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
  }
  return [];
}

export function saveInsights(projectId: string, insights: AIInsight[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(insights));
  } catch {
  }
}

export function addInsight(projectId: string, insight: AIInsight): AIInsight[] {
  const insights = loadInsights(projectId);
  const existingIndex = insights.findIndex(i => 
    i.targetType === insight.targetType && 
    i.targetId === insight.targetId &&
    i.message === insight.message
  );
  
  if (existingIndex >= 0) {
    return insights;
  }
  
  const updated = [...insights, insight];
  saveInsights(projectId, updated);
  return updated;
}

export function dismissInsight(projectId: string, insightId: string): AIInsight[] {
  const insights = loadInsights(projectId);
  const updated = insights.map(i => 
    i.id === insightId ? { ...i, dismissed: true } : i
  );
  saveInsights(projectId, updated);
  return updated;
}

export function removeInsight(projectId: string, insightId: string): AIInsight[] {
  const insights = loadInsights(projectId);
  const updated = insights.filter(i => i.id !== insightId);
  saveInsights(projectId, updated);
  return updated;
}

export function getActiveInsights(projectId: string): AIInsight[] {
  return loadInsights(projectId).filter(i => !i.dismissed);
}

export function getInsightsForTarget(
  projectId: string, 
  targetType: AIInsight['targetType'], 
  targetId: string
): AIInsight[] {
  return getActiveInsights(projectId).filter(
    i => i.targetType === targetType && i.targetId === targetId
  );
}

export function clearAllInsights(projectId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getStorageKey(projectId));
  } catch {
  }
}
