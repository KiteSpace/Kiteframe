export type InsightLevel = 'info' | 'warning' | 'risk';
export type InsightTargetType = 'workflow' | 'node' | 'prd-section';
export type InsightChipType = 'assumption' | 'risk' | 'question' | 'suggestion';

export interface AIInsight {
  id: string;
  level: InsightLevel;
  chipType?: InsightChipType;
  message: string;
  targetType: InsightTargetType;
  targetId: string;
  createdAt: number;
  dismissed?: boolean;
  source?: 'vision' | 'heuristic';
}

export interface CreateInsightOptions {
  level: InsightLevel;
  message: string;
  targetType: InsightTargetType;
  targetId: string;
  chipType?: InsightChipType;
  source?: 'vision' | 'heuristic';
}

export function createInsight(
  levelOrOptions: InsightLevel | CreateInsightOptions,
  message?: string,
  targetType?: InsightTargetType,
  targetId?: string
): AIInsight {
  if (typeof levelOrOptions === 'object') {
    const opts = levelOrOptions;
    return {
      id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level: opts.level,
      chipType: opts.chipType,
      message: opts.message.slice(0, 140),
      targetType: opts.targetType,
      targetId: opts.targetId,
      createdAt: Date.now(),
      source: opts.source,
    };
  }
  
  return {
    id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level: levelOrOptions,
    message: (message || '').slice(0, 140),
    targetType: targetType!,
    targetId: targetId!,
    createdAt: Date.now()
  };
}

export function getChipTypeIcon(chipType: InsightChipType): string {
  switch (chipType) {
    case 'assumption':
      return '🔮';
    case 'risk':
      return '⚠️';
    case 'question':
      return '❓';
    case 'suggestion':
      return '💡';
    default:
      return 'ℹ️';
  }
}

export function getChipTypeColor(chipType: InsightChipType): { bg: string; text: string } {
  switch (chipType) {
    case 'assumption':
      return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' };
    case 'risk':
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' };
    case 'question':
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' };
    case 'suggestion':
      return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' };
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300' };
  }
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

export function createInsightsFromVisionResult(
  result: { 
    assumptions?: string[]; 
    open_questions?: string[]; 
    usability_risks?: string[];
    suggested_improvements?: string[];
  },
  targetType: InsightTargetType,
  targetId: string,
  source: 'vision' | 'heuristic'
): AIInsight[] {
  const insights: AIInsight[] = [];
  
  if (result.assumptions) {
    result.assumptions.forEach(assumption => {
      insights.push(createInsight({
        level: 'info',
        chipType: 'assumption',
        message: assumption,
        targetType,
        targetId,
        source,
      }));
    });
  }
  
  if (result.open_questions) {
    result.open_questions.forEach(question => {
      insights.push(createInsight({
        level: 'warning',
        chipType: 'question',
        message: question,
        targetType,
        targetId,
        source,
      }));
    });
  }
  
  if (result.usability_risks) {
    result.usability_risks.forEach(risk => {
      insights.push(createInsight({
        level: 'risk',
        chipType: 'risk',
        message: risk,
        targetType,
        targetId,
        source,
      }));
    });
  }
  
  if (result.suggested_improvements) {
    result.suggested_improvements.forEach(suggestion => {
      insights.push(createInsight({
        level: 'info',
        chipType: 'suggestion',
        message: suggestion,
        targetType,
        targetId,
        source,
      }));
    });
  }
  
  return insights;
}
