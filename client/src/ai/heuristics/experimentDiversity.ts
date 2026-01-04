import type { Insight } from '@/lib/kiteframe/utils/insights/types';

export type RiskDimension =
  | 'failure_mode'
  | 'load_scale'
  | 'human_error'
  | 'missing_dependency'
  | 'timing_ordering'
  | 'data_integrity'
  | 'security'
  | 'negative_scenario';

export interface ExperimentDiversityConfig {
  requiredDimensions: RiskDimension[];
  mustIncludeContradiction: boolean;
  mustIncludeNegativeScenario: boolean;
}

const DIMENSION_PROMPTS: Record<RiskDimension, string> = {
  failure_mode: 'What happens if this step fails completely? Model the failure path and recovery.',
  load_scale: 'What happens under 10x or 100x the expected load? Model scaling stress.',
  human_error: 'What if a user makes a mistake at this step? Model the error and handling.',
  missing_dependency: 'What if a required dependency is unavailable? Model degraded operation.',
  timing_ordering: 'What if steps execute out of order or with unexpected delays?',
  data_integrity: 'What if the data is malformed, missing, or corrupted?',
  security: 'What if an unauthorized actor attempts to exploit this step?',
  negative_scenario: 'Model the worst reasonable outcome and how to detect/recover from it.',
};

export function selectExperimentDimensions(): RiskDimension[] {
  const allDimensions: RiskDimension[] = [
    'failure_mode',
    'load_scale',
    'human_error',
    'missing_dependency',
    'timing_ordering',
    'data_integrity',
    'security',
    'negative_scenario',
  ];
  
  const selected: RiskDimension[] = [];
  
  selected.push('failure_mode');
  
  selected.push('negative_scenario');
  
  const remaining = allDimensions.filter(d => !selected.includes(d));
  
  let seed = Date.now() % remaining.length;
  while (selected.length < 4) {
    const dim = remaining[seed % remaining.length];
    if (!selected.includes(dim)) {
      selected.push(dim);
    }
    seed = (seed + 1) % remaining.length;
  }
  
  return selected.slice(0, 4);
}

export function getExperimentDiversityGuidance(insight: Insight): string {
  const dimensions = selectExperimentDimensions();
  
  const parts: string[] = [
    'Generate 4 experiments that each test a DIFFERENT risk dimension:',
    '',
  ];
  
  dimensions.forEach((dim, idx) => {
    parts.push(`Experiment ${idx + 1}: ${DIMENSION_PROMPTS[dim]}`);
  });
  
  parts.push('');
  parts.push('DIVERSITY RULES:');
  parts.push('- No two experiments should test the same risk.');
  parts.push('- At least one experiment MUST contradict the expected happy path.');
  parts.push('- At least one experiment MUST model a negative scenario.');
  parts.push('- Each experiment should reveal a different type of weakness.');
  
  return parts.join('\n');
}

export function validateExperimentDiversity(
  experiments: Array<{ title: string; description: string }>
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (experiments.length !== 4) {
    issues.push(`Expected 4 experiments, got ${experiments.length}`);
  }
  
  const titleWords = experiments.map(e => 
    e.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );
  
  for (let i = 0; i < titleWords.length; i++) {
    for (let j = i + 1; j < titleWords.length; j++) {
      const overlap = titleWords[i].filter(w => titleWords[j].includes(w));
      if (overlap.length > 2) {
        issues.push(`Experiments ${i + 1} and ${j + 1} may be testing similar scenarios`);
      }
    }
  }
  
  const allText = experiments.map(e => `${e.title} ${e.description}`).join(' ').toLowerCase();
  const negativeKeywords = ['fail', 'error', 'crash', 'miss', 'wrong', 'invalid', 'negative', 'worst', 'bad'];
  const hasNegative = negativeKeywords.some(k => allText.includes(k));
  
  if (!hasNegative) {
    issues.push('No experiment appears to model a negative scenario');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}
