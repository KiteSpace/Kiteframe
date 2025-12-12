export type InsightLevel = 'info' | 'warning' | 'risk';
export type InsightTargetType = 'workflow' | 'node' | 'prd-section';

export interface AIInsight {
  id: string;
  level: InsightLevel;
  message: string;
  targetType: InsightTargetType;
  targetId: string;
  createdAt: number;
  dismissed?: boolean;
}

export function createInsight(
  level: InsightLevel,
  message: string,
  targetType: InsightTargetType,
  targetId: string
): AIInsight {
  return {
    id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message: message.slice(0, 140),
    targetType,
    targetId,
    createdAt: Date.now()
  };
}

export function getInsightIcon(level: InsightLevel): string {
  switch (level) {
    case 'risk':
      return '⚠️';
    case 'warning':
      return '💡';
    case 'info':
    default:
      return 'ℹ️';
  }
}
