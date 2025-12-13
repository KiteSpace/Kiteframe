/**
 * KiteAI Acceptance Tests
 * 
 * Non-negotiable tests that enforce quality standards for KiteAI.
 * These tests must pass before any release.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeActionability, ActionabilityResult } from '../actionability';
import {
  createInitialContext,
  computeNextState,
  applyTransition,
  isExecutionReady,
  isVagueReply,
  getConfidenceLevel,
  ConversationContext,
} from '../kiteaiState';
import {
  assertPromptActionable,
  assertWorkflowStructure,
  assertUserConfirmedGeneration,
  runAllGuards,
  assertPMDepth,
  WorkflowStructure,
  GenerationState,
  SemanticWorkflow,
  RoleContext,
} from '../guards/workflowGuards';

describe('KiteAI Acceptance Tests', () => {
  describe('A. Prompt Handling', () => {
    describe('Vague prompts should NOT create projects', () => {
      const vaguePrompts = [
        'user onboarding',
        'approval workflow',
        'login flow',
        'checkout',
        'signup',
        'dashboard',
        'authentication',
      ];

      vaguePrompts.forEach(prompt => {
        it(`"${prompt}" should have confidence < 0.7 and NOT generate workflow`, () => {
          const actionability = computeActionability(prompt);
          const guardResult = assertPromptActionable(prompt, actionability);

          expect(actionability.confidence).toBeLessThan(0.7);
          expect(guardResult.passed).toBe(false);
          expect(guardResult.reason).toContain('Insufficient actionability');
        });
      });

      it('should block "user onboarding" specifically', () => {
        const prompt = 'user onboarding';
        const actionability = computeActionability(prompt);
        
        expect(actionability.confidence).toBeLessThan(0.7);
        expect(actionability.score).toBeLessThan(3);
        expect(actionability.isActionable).toBe(false);
      });
    });

    describe('Question prompts should trigger chat mode', () => {
      const questionPrompts = [
        'How should onboarding work?',
        'What is the best way to handle auth?',
        'Can you help me design a flow?',
      ];

      questionPrompts.forEach(prompt => {
        it(`"${prompt}" should require clarification`, () => {
          const actionability = computeActionability(prompt);
          const context = createInitialContext('base');
          const transition = computeNextState(context, actionability);

          expect(transition.to).toBe('clarification');
          expect(actionability.isActionable).toBe(false);
        });
      });
    });

    describe('Actionable prompts should pass threshold', () => {
      const actionablePrompts = [
        'New user onboarding for a B2B SaaS with a trial period and admin approval where the user must complete email verification first, then they can access the dashboard',
        'Mobile onboarding where activation depends on completing 2 of 3 steps: phone verification, profile setup, or linking a bank account. If they skip too many steps, show a warning.',
        'When a customer submits an order, first validate the payment. If payment fails, retry up to 3 times. If it succeeds, send to fulfillment. If fulfillment fails, issue a refund.',
      ];

      it('should recognize detailed prompts as more actionable than vague ones', () => {
        const vaguePrompt = 'user onboarding';
        const detailedPrompt = 'When a customer submits an order, first validate the payment. If payment fails, retry up to 3 times. If it succeeds, send to fulfillment. If fulfillment fails, issue a refund.';
        
        const vagueResult = computeActionability(vaguePrompt);
        const detailedResult = computeActionability(detailedPrompt);
        
        // Detailed prompts should score higher than vague ones
        expect(detailedResult.confidence).toBeGreaterThan(vagueResult.confidence);
        expect(detailedResult.score).toBeGreaterThan(vagueResult.score);
      });
    });
  });

  describe('B. Workflow Quality', () => {
    describe('Valid workflows must have proper structure', () => {
      it('should reject purely linear workflows', () => {
        const linearWorkflow: WorkflowStructure = {
          nodes: [
            { id: '1', type: 'input', label: 'Start' },
            { id: '2', type: 'process', label: 'Step 1' },
            { id: '3', type: 'process', label: 'Step 2' },
            { id: '4', type: 'output', label: 'End' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '3', target: '4' },
          ],
        };

        const result = assertWorkflowStructure(linearWorkflow);
        
        expect(result.passed).toBe(false);
        expect(result.hasDecisionNode).toBe(false);
        expect(result.details).toContain('No decision/branch node found - workflow is purely linear');
      });

      it('should require at least one decision node', () => {
        const noDecisionWorkflow: WorkflowStructure = {
          nodes: [
            { id: '1', type: 'input', label: 'Start' },
            { id: '2', type: 'process', label: 'Process Data' },
            { id: '3', type: 'output', label: 'Complete' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
          ],
        };

        const result = assertWorkflowStructure(noDecisionWorkflow);
        
        expect(result.hasDecisionNode).toBe(false);
        expect(result.passed).toBe(false);
      });

      it('should require at least one failure/error path', () => {
        const noErrorPathWorkflow: WorkflowStructure = {
          nodes: [
            { id: '1', type: 'input', label: 'Start' },
            { id: '2', type: 'condition', label: 'Check Valid' },
            { id: '3', type: 'process', label: 'Process' },
            { id: '4', type: 'output', label: 'Done' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '3', target: '4' },
          ],
        };

        const result = assertWorkflowStructure(noErrorPathWorkflow);
        
        expect(result.hasFailurePath).toBe(false);
        expect(result.passed).toBe(false);
      });

      it('should accept workflows with proper structure', () => {
        const validWorkflow: WorkflowStructure = {
          nodes: [
            { id: '1', type: 'input', label: 'Start' },
            { id: '2', type: 'condition', label: 'Is Valid?' },
            { id: '3', type: 'process', label: 'Process Data' },
            { id: '4', type: 'error', label: 'Handle Error' },
            { id: '5', type: 'output', label: 'Complete' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3', label: 'Yes' },
            { id: 'e3', source: '2', target: '4', label: 'No' },
            { id: 'e4', source: '3', target: '5' },
          ],
        };

        const result = assertWorkflowStructure(validWorkflow);
        
        expect(result.hasDecisionNode).toBe(true);
        expect(result.hasFailurePath).toBe(true);
        expect(result.hasAlternativePath).toBe(true);
        expect(result.edgeCount).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('C. Project Creation Gate', () => {
    describe('Vague prompts must NOT create projects', () => {
      it('should block project creation for vague prompt', () => {
        const prompt = 'user onboarding';
        const actionability = computeActionability(prompt);
        const generationState: GenerationState = {
          userConfirmed: false,
          assumptionsAccepted: false,
          clarificationComplete: false,
        };

        const result = runAllGuards(prompt, actionability, null, generationState);
        
        expect(result.canProceed).toBe(false);
        expect(result.failures.length).toBeGreaterThan(0);
      });
    });

    describe('Confirmed assumptions should allow creation', () => {
      it('should allow project creation after user confirmation', () => {
        const generationState: GenerationState = {
          userConfirmed: true,
          assumptionsAccepted: false,
          clarificationComplete: true,
        };

        const result = assertUserConfirmedGeneration(generationState);
        
        expect(result.passed).toBe(true);
        expect(result.reason).toContain('User explicitly confirmed');
      });

      it('should allow project creation after accepting assumptions', () => {
        const generationState: GenerationState = {
          userConfirmed: false,
          assumptionsAccepted: true,
          clarificationComplete: true,
        };

        const result = assertUserConfirmedGeneration(generationState);
        
        expect(result.passed).toBe(true);
        expect(result.reason).toContain('assumptions');
      });

      it('should block if clarification not complete', () => {
        const generationState: GenerationState = {
          userConfirmed: true,
          assumptionsAccepted: false,
          clarificationComplete: false,
        };

        const result = assertUserConfirmedGeneration(generationState);
        
        expect(result.passed).toBe(false);
        expect(result.reason).toContain('Clarification process not complete');
      });
    });
  });

  describe('D. Confidence Level Tests', () => {
    it('should return "silent" for confidence < 0.4', () => {
      expect(getConfidenceLevel(0.0)).toBe('silent');
      expect(getConfidenceLevel(0.2)).toBe('silent');
      expect(getConfidenceLevel(0.39)).toBe('silent');
    });

    it('should return "clarify" for confidence 0.4-0.7', () => {
      expect(getConfidenceLevel(0.4)).toBe('clarify');
      expect(getConfidenceLevel(0.5)).toBe('clarify');
      expect(getConfidenceLevel(0.69)).toBe('clarify');
    });

    it('should return "proposeAssumptions" for confidence 0.7-0.85', () => {
      expect(getConfidenceLevel(0.7)).toBe('proposeAssumptions');
      expect(getConfidenceLevel(0.75)).toBe('proposeAssumptions');
      expect(getConfidenceLevel(0.84)).toBe('proposeAssumptions');
    });

    it('should return "execute" for confidence >= 0.85', () => {
      expect(getConfidenceLevel(0.85)).toBe('execute');
      expect(getConfidenceLevel(0.9)).toBe('execute');
      expect(getConfidenceLevel(1.0)).toBe('execute');
    });
  });

  describe('E. State Machine Tests', () => {
    let context: ConversationContext;

    beforeEach(() => {
      context = createInitialContext('base');
    });

    it('should start in clarification state', () => {
      expect(context.state).toBe('clarification');
    });

    it('should escalate after 2 vague replies', () => {
      const vagueActionability: ActionabilityResult = {
        score: 1,
        dimensions: { actor: true, trigger: false, goal: false, scope: false, flowSignal: false },
        missing: ['trigger', 'goal', 'scope', 'flowSignal'],
        present: ['actor'],
        confidence: 0.2,
        isActionable: false,
      };

      // First vague reply
      let transition = computeNextState(context, vagueActionability);
      context = applyTransition(context, transition, 'test');
      expect(context.state).toBe('clarification');
      expect(context.vagueReplyCount).toBe(1);

      // Second vague reply should trigger escalation
      transition = computeNextState(context, vagueActionability);
      expect(transition.to).toBe('escalation');
    });

    it('should NOT allow exit from escalation to clarification', () => {
      // Set up escalation state
      context = { ...context, state: 'escalation', vagueReplyCount: 2 };

      const vagueActionability: ActionabilityResult = {
        score: 1,
        dimensions: { actor: true, trigger: false, goal: false, scope: false, flowSignal: false },
        missing: ['trigger', 'goal', 'scope', 'flowSignal'],
        present: ['actor'],
        confidence: 0.3,
        isActionable: false,
      };

      const transition = computeNextState(context, vagueActionability);
      
      expect(transition.to).toBe('escalation');
      expect(transition.to).not.toBe('clarification');
    });

    it('should transition to execution-ready when threshold met', () => {
      const actionableResult: ActionabilityResult = {
        score: 4,
        dimensions: { actor: true, trigger: true, goal: true, scope: true, flowSignal: false },
        missing: ['flowSignal'],
        present: ['actor', 'trigger', 'goal', 'scope'],
        confidence: 0.9,
        isActionable: true,
      };

      const transition = computeNextState(context, actionableResult);
      
      expect(transition.to).toBe('execution-ready');
    });
  });

  describe('F. Regression Snapshot Tests', () => {
    describe('Expected workflow shapes', () => {
      it('onboarding workflow should require decision nodes', () => {
        const prompt = 'user onboarding';
        const actionability = computeActionability(prompt);
        
        expect(actionability.isActionable).toBe(false);
        expect(actionability.score).toBeLessThan(3);
      });

      it('approval flow should require decision nodes', () => {
        const prompt = 'approval workflow';
        const actionability = computeActionability(prompt);
        
        expect(actionability.isActionable).toBe(false);
        expect(actionability.score).toBeLessThan(3);
      });

      it('import flow should require decision nodes', () => {
        const prompt = 'import flow';
        const actionability = computeActionability(prompt);
        
        expect(actionability.isActionable).toBe(false);
        expect(actionability.score).toBeLessThan(3);
      });
    });
  });

  describe('G. PM Depth Guards', () => {
    const pmRoleContext: RoleContext = { role: 'pm', confidence: 0.8 };
    const developerRoleContext: RoleContext = { role: 'developer', confidence: 0.8 };

    describe('Shallow outlines should fail PM depth', () => {
      it('should reject workflow with no tradeoffs, risks, or meaningful decisions', () => {
        const shallowWorkflow: SemanticWorkflow = {
          nodes: [
            { id: '1', type: 'input', label: 'Begin' },
            { id: '2', type: 'process', label: 'Step A' },
            { id: '3', type: 'process', label: 'Step B' },
            { id: '4', type: 'output', label: 'End' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '3', target: '4' },
          ],
        };

        const result = assertPMDepth(shallowWorkflow, pmRoleContext);
        
        expect(result.passed).toBe(false);
        expect(result.reason).toContain('lacks meaningful product decisions');
      });

      it('should reject linear checklist disguised as workflow', () => {
        const checklistWorkflow: SemanticWorkflow = {
          nodes: [
            { id: '1', type: 'input', label: 'Start' },
            { id: '2', type: 'process', label: 'Do Thing' },
            { id: '3', type: 'process', label: 'Do Another Thing' },
            { id: '4', type: 'output', label: 'Done' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '3', target: '4' },
          ],
        };

        const result = assertPMDepth(checklistWorkflow, pmRoleContext);
        
        expect(result.passed).toBe(false);
      });
    });

    describe('Meaningful workflows should pass PM depth', () => {
      it('should pass workflow with explicit tradeoffs', () => {
        const tradeoffWorkflow: SemanticWorkflow = {
          nodes: [
            { id: '1', type: 'input', label: 'New User Registration' },
            { id: '2', type: 'condition', label: 'Identity Verification: Speed vs Security Tradeoff' },
            { id: '3', type: 'process', label: 'Quick Email Verification (faster but less secure)' },
            { id: '4', type: 'process', label: 'Full Document Verification (slower but more secure)' },
            { id: '5', type: 'output', label: 'Account Created' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3', label: 'Option A: Speed' },
            { id: 'e3', source: '2', target: '4', label: 'Option B: Security' },
            { id: 'e4', source: '3', target: '5' },
            { id: 'e5', source: '4', target: '5' },
          ],
        };

        const result = assertPMDepth(tradeoffWorkflow, pmRoleContext);
        
        expect(result.passed).toBe(true);
        expect(result.hasTradeoff).toBe(true);
        expect(result.detectedSignals.length).toBeGreaterThan(0);
      });

      it('should pass workflow with risk mitigation', () => {
        const riskWorkflow: SemanticWorkflow = {
          nodes: [
            { id: '1', type: 'input', label: 'Payment Submitted' },
            { id: '2', type: 'condition', label: 'Fraud Risk Assessment' },
            { id: '3', type: 'process', label: 'Process Payment' },
            { id: '4', type: 'process', label: 'Escalate to Fraud Team' },
            { id: '5', type: 'process', label: 'Fallback Manual Review' },
            { id: '6', type: 'output', label: 'Complete' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3', label: 'Low Risk' },
            { id: 'e3', source: '2', target: '4', label: 'High Risk' },
            { id: 'e4', source: '4', target: '5' },
            { id: 'e5', source: '3', target: '6' },
            { id: 'e6', source: '5', target: '6' },
          ],
        };

        const result = assertPMDepth(riskWorkflow, pmRoleContext);
        
        expect(result.passed).toBe(true);
        expect(result.hasRisk).toBe(true);
      });

      it('should pass workflow with irreversible decision points', () => {
        const irreversibleWorkflow: SemanticWorkflow = {
          nodes: [
            { id: '1', type: 'input', label: 'User Checkout' },
            { id: '2', type: 'condition', label: 'Review Order' },
            { id: '3', type: 'process', label: 'Confirm Payment - Charges Credit Card' },
            { id: '4', type: 'output', label: 'Order Submitted' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3', label: 'Confirm' },
            { id: 'e3', source: '3', target: '4' },
          ],
        };

        const result = assertPMDepth(irreversibleWorkflow, pmRoleContext);
        
        expect(result.passed).toBe(true);
        expect(result.hasIrreversible).toBe(true);
      });
    });

    describe('Role context should determine when guards apply', () => {
      it('should skip PM guards for developer role', () => {
        const shallowWorkflow: SemanticWorkflow = {
          nodes: [
            { id: '1', type: 'input', label: 'Start' },
            { id: '2', type: 'process', label: 'Process' },
            { id: '3', type: 'output', label: 'End' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
          ],
        };

        const result = assertPMDepth(shallowWorkflow, developerRoleContext);
        
        expect(result.passed).toBe(true);
        expect(result.reason).toContain('not applicable');
      });

      it('should apply PM guards for hybrid role with high confidence', () => {
        const hybridHighConfidence: RoleContext = { role: 'hybrid', confidence: 0.8 };
        const shallowWorkflow: SemanticWorkflow = {
          nodes: [
            { id: '1', type: 'input', label: 'Start' },
            { id: '2', type: 'condition', label: 'Check' },
            { id: '3', type: 'output', label: 'End' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
          ],
        };

        const result = assertPMDepth(shallowWorkflow, hybridHighConfidence);
        
        expect(result.passed).toBe(false);
      });

      it('should skip PM guards for hybrid role with low confidence', () => {
        const hybridLowConfidence: RoleContext = { role: 'hybrid', confidence: 0.5 };
        const shallowWorkflow: SemanticWorkflow = {
          nodes: [
            { id: '1', type: 'input', label: 'Start' },
            { id: '2', type: 'process', label: 'Process' },
            { id: '3', type: 'output', label: 'End' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
          ],
        };

        const result = assertPMDepth(shallowWorkflow, hybridLowConfidence);
        
        expect(result.passed).toBe(true);
        expect(result.reason).toContain('not applicable');
      });
    });

    describe('Integration with runAllGuards', () => {
      it('should include PM depth check in combined guards', () => {
        const prompt = 'detailed workflow';
        const actionability = computeActionability(prompt);
        const shallowWorkflow: WorkflowStructure = {
          nodes: [
            { id: '1', type: 'input', label: 'Begin' },
            { id: '2', type: 'process', label: 'Do Something' },
            { id: '3', type: 'process', label: 'Do More' },
            { id: '4', type: 'output', label: 'Finish' },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '2', target: '3' },
            { id: 'e3', source: '3', target: '4' },
          ],
        };
        const generationState: GenerationState = {
          userConfirmed: true,
          assumptionsAccepted: true,
          clarificationComplete: true,
        };

        const result = runAllGuards(prompt, actionability, shallowWorkflow, generationState, pmRoleContext);
        
        expect(result.pmDepthResult).not.toBeNull();
        expect(result.pmDepthResult?.passed).toBe(false);
      });
    });
  });
});
