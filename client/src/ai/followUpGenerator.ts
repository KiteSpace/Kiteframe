import type { WorkflowMaturity } from './workflowMaturity';
import type { KiteRole } from './roleSelector';

export interface FollowUpContext {
  maturity: WorkflowMaturity;
  role: KiteRole;
}

export function generateFollowUps(context: FollowUpContext): string[] {
  if (context.maturity === 'draft') {
    return [
      'What is the primary user goal this workflow is meant to support?',
      'Are there alternative paths or failure cases not shown yet?',
      'Is this intended to be exploratory or production-ready?'
    ];
  }

  return [
    'Are there constraints or edge cases not represented here?',
    'Should this workflow support future variants?'
  ];
}

export function shouldAskFollowUps(confidence: number): boolean {
  return confidence >= 0.4 && confidence < 0.7;
}
