/**
 * PM Depth Guards - Product Manager Level Reasoning Constraints
 * 
 * These guards ensure workflows contain meaningful product decisions,
 * not just structural validity. They enforce PM-level reasoning depth.
 */

import type { WorkflowStructure, WorkflowNode, WorkflowEdge, GuardResult } from './workflowGuards';

export interface SemanticWorkflow extends WorkflowStructure {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface PMDepthResult extends GuardResult {
  hasTradeoff: boolean;
  hasRisk: boolean;
  hasIrreversible: boolean;
  hasNonRetryBranches: boolean;
  detectedSignals: string[];
}

export interface RoleContext {
  role: 'pm' | 'hybrid' | 'developer' | 'designer';
  confidence: number;
}

const TRADEOFF_KEYWORDS = [
  'tradeoff', 'trade-off', 'trade off',
  ' vs ', ' versus ',
  'option a', 'option b', 'option 1', 'option 2',
  'alternative approach', 'choose between',
  'speed vs', 'accuracy vs', 'cost vs',
  'friction vs', 'conversion vs',
  'simplicity vs', 'complexity vs',
  'fast vs', 'slow vs',
  'manual vs', 'automated vs',
  'balance between', 'prioritize over',
  'at the cost of', 'sacrifice',
];

const RISK_KEYWORDS = [
  'risk', 'failure', 'fail',
  'mitigation', 'mitigate',
  'fraud', 'abuse', 'churn',
  'error', 'exception',
  'fallback', 'recovery',
  'timeout', 'retry limit',
  'blocked', 'rejected',
  'invalid', 'unauthorized',
  'escalate', 'escalation',
  'alert', 'notify admin',
  'rollback', 'revert',
  'quarantine', 'suspend'
];

const IRREVERSIBLE_KEYWORDS = [
  'create account', 'account creation',
  'submit order', 'submit payment', 'submit application',
  'confirm purchase', 'confirm payment', 'confirm order',
  'finalize order', 'finalize payment',
  'charge card', 'charge credit', 'process payment', 'payment processed',
  'delete account', 'delete permanently', 'remove permanently',
  'publish live', 'deploy to production',
  'execute transaction', 'execute transfer',
  'sign contract', 'agree to terms', 'accept terms',
  'enroll in', 'subscribe to',
  'wire transfer', 'bank transfer', 'withdraw funds',
];

const RETRY_ONLY_PATTERNS = [
  /retry/i,
  /try again/i,
  /attempt/i,
  /loop back/i,
  /repeat/i
];

/**
 * Detect explicit tradeoffs in workflow
 * Looks for: speed vs accuracy, friction vs conversion, option A/B patterns
 */
export function detectTradeoff(workflow: SemanticWorkflow): { detected: boolean; signals: string[] } {
  const signals: string[] = [];
  const allText = extractAllText(workflow);
  
  for (const keyword of TRADEOFF_KEYWORDS) {
    if (allText.toLowerCase().includes(keyword.toLowerCase())) {
      signals.push(`Tradeoff signal: "${keyword}"`);
    }
  }
  
  const hasMultipleOutgoingFromDecision = workflow.edges.some((edge, _, edges) => {
    const sameSourceEdges = edges.filter(e => e.source === edge.source);
    if (sameSourceEdges.length >= 2) {
      const sourceNode = workflow.nodes.find(n => n.id === edge.source);
      if (sourceNode && isDecisionNode(sourceNode)) {
        const edgeLabels = sameSourceEdges.map(e => e.label?.toLowerCase() || '');
        const trivialLabels = ['yes', 'no', 'true', 'false', 'success', 'failure', 'valid', 'invalid', 'retry', 'pass', 'fail'];
        const hasNonTrivialBranches = edgeLabels.filter(l => l.length > 0).some(l => 
          !trivialLabels.some(t => l === t || l.includes(t))
        );
        if (hasNonTrivialBranches) {
          signals.push(`Decision node with meaningful alternatives: ${sourceNode.label || sourceNode.id}`);
          return true;
        }
      }
    }
    return false;
  });
  
  return { detected: signals.length > 0, signals };
}

/**
 * Detect risk-driven decisions in workflow
 * Looks for: fraud, churn, abuse mentions with mitigations
 */
export function detectRisk(workflow: SemanticWorkflow): { detected: boolean; signals: string[] } {
  const signals: string[] = [];
  const allText = extractAllText(workflow);
  
  for (const keyword of RISK_KEYWORDS) {
    if (allText.toLowerCase().includes(keyword.toLowerCase())) {
      signals.push(`Risk signal: "${keyword}"`);
    }
  }
  
  const hasRiskMitigation = workflow.nodes.some(node => {
    const label = (node.label || '').toLowerCase();
    const hasRiskKeyword = RISK_KEYWORDS.some(k => label.includes(k.toLowerCase()));
    if (hasRiskKeyword) {
      const outgoingEdges = workflow.edges.filter(e => e.source === node.id);
      const hasMitigationPath = outgoingEdges.some(e => {
        const targetNode = workflow.nodes.find(n => n.id === e.target);
        const targetLabel = (targetNode?.label || '').toLowerCase();
        return targetLabel.includes('handle') || 
               targetLabel.includes('recover') ||
               targetLabel.includes('notify') ||
               targetLabel.includes('escalate') ||
               targetLabel.includes('fallback');
      });
      if (hasMitigationPath) {
        signals.push(`Risk mitigation pattern: ${node.label} -> handled`);
      }
    }
    return hasRiskKeyword;
  });
  
  return { detected: signals.length > 0, signals };
}

/**
 * Detect irreversible decision points in workflow
 * Looks for: account creation, data submission, payments
 */
export function detectIrreversible(workflow: SemanticWorkflow): { detected: boolean; signals: string[] } {
  const signals: string[] = [];
  const allText = extractAllText(workflow);
  
  for (const keyword of IRREVERSIBLE_KEYWORDS) {
    if (allText.toLowerCase().includes(keyword.toLowerCase())) {
      signals.push(`Irreversible action: "${keyword}"`);
    }
  }
  
  const hasConfirmationBeforeIrreversible = workflow.nodes.some(node => {
    const label = (node.label || '').toLowerCase();
    const isIrreversible = IRREVERSIBLE_KEYWORDS.some(k => label.includes(k.toLowerCase()));
    if (isIrreversible) {
      const incomingEdges = workflow.edges.filter(e => e.target === node.id);
      const hasConfirmStep = incomingEdges.some(e => {
        const sourceNode = workflow.nodes.find(n => n.id === e.source);
        const sourceLabel = (sourceNode?.label || '').toLowerCase();
        return sourceLabel.includes('confirm') || 
               sourceLabel.includes('review') ||
               sourceLabel.includes('verify') ||
               sourceLabel.includes('check');
      });
      if (hasConfirmStep) {
        signals.push(`Confirmation before irreversible: ${node.label}`);
      }
    }
    return isIrreversible;
  });
  
  return { detected: signals.length > 0, signals };
}

/**
 * Detect meaningful branching (not just retry loops)
 * Validates branches lead to different user states/outcomes
 */
export function detectNonRetryBranches(workflow: SemanticWorkflow): { detected: boolean; signals: string[] } {
  const signals: string[] = [];
  
  const decisionNodes = workflow.nodes.filter(isDecisionNode);
  
  for (const node of decisionNodes) {
    const outgoingEdges = workflow.edges.filter(e => e.source === node.id);
    
    if (outgoingEdges.length < 2) continue;
    
    const targetNodes = outgoingEdges.map(e => 
      workflow.nodes.find(n => n.id === e.target)
    ).filter(Boolean) as WorkflowNode[];
    
    const trivialLabels = ['yes', 'no', 'true', 'false', 'success', 'failure', 'valid', 'invalid', 'pass', 'fail', ''];
    const isRetryOnly = outgoingEdges.every(edge => {
      const label = (edge.label || '').toLowerCase().trim();
      return RETRY_ONLY_PATTERNS.some(p => p.test(label)) ||
             trivialLabels.includes(label);
    });
    
    if (!isRetryOnly) {
      const distinctOutcomes = new Set(targetNodes.map(n => categorizeNode(n)));
      if (distinctOutcomes.size >= 2) {
        signals.push(`Meaningful branch: ${node.label || node.id} -> ${distinctOutcomes.size} distinct outcomes`);
      }
    }
    
    const branchTerminals = targetNodes.map(target => {
      const terminals = findReachableTerminals(target.id, workflow);
      return new Set(terminals.map(t => `${categorizeNode(t)}:${t.label || t.id}`));
    });
    
    if (branchTerminals.length >= 2) {
      const allTerminalSets = branchTerminals.filter(s => s.size > 0);
      if (allTerminalSets.length >= 2) {
        const firstSet = allTerminalSets[0];
        const hasDifferentTerminals = allTerminalSets.some((set, i) => {
          if (i === 0) return false;
          const intersection = Array.from(set).filter(t => firstSet.has(t));
          return intersection.length === 0 || intersection.length < Math.min(set.size, firstSet.size);
        });
        
        if (hasDifferentTerminals) {
          signals.push(`Branch leads to distinct terminals: ${node.label || node.id}`);
        }
      }
    }
  }
  
  return { detected: signals.length > 0, signals };
}

/**
 * Main PM Depth Assertion
 * 
 * Checks for AT LEAST ONE of:
 * - Explicit Tradeoff
 * - Risk-Driven Decision  
 * - Irreversible Decision Point
 * - Meaningful (non-retry) Branching
 * 
 * Only applies when: role === 'pm' OR (role === 'hybrid' AND confidence >= 0.7)
 */
export function assertPMDepth(
  workflow: SemanticWorkflow,
  roleContext?: RoleContext
): PMDepthResult {
  const shouldApply = shouldApplyPMGuards(roleContext);
  
  if (!shouldApply) {
    console.log(`[KiteAI PM Guard] SKIPPED: Role context does not require PM depth (role: ${roleContext?.role}, confidence: ${roleContext?.confidence})`);
    return {
      passed: true,
      reason: 'PM depth guards not applicable for this role/confidence level',
      hasTradeoff: false,
      hasRisk: false,
      hasIrreversible: false,
      hasNonRetryBranches: false,
      detectedSignals: [],
    };
  }
  
  const tradeoffResult = detectTradeoff(workflow);
  const riskResult = detectRisk(workflow);
  const irreversibleResult = detectIrreversible(workflow);
  const branchResult = detectNonRetryBranches(workflow);
  
  const allSignals = [
    ...tradeoffResult.signals,
    ...riskResult.signals,
    ...irreversibleResult.signals,
    ...branchResult.signals,
  ];
  
  const hasAtLeastOne = 
    tradeoffResult.detected ||
    riskResult.detected ||
    irreversibleResult.detected ||
    branchResult.detected;
  
  if (!hasAtLeastOne) {
    console.log(`[KiteAI PM Guard] BLOCKED: Workflow lacks PM-level depth`);
    return {
      passed: false,
      reason: '⚠️ This workflow is structurally valid but lacks meaningful product decisions.',
      details: [
        'A PM-level workflow must include at least ONE of:',
        '• Explicit tradeoff (e.g., speed vs accuracy, friction vs conversion)',
        '• Risk-driven decision with mitigation (e.g., fraud detection, error handling)',
        '• Irreversible decision point (e.g., account creation, payment, data submission)',
        '• Meaningful branching that leads to different user outcomes (not just retry loops)',
        '',
        'This workflow appears to be a structural outline without product substance.',
        'Please add decisions that reflect real user consequences and business tradeoffs.',
      ],
      hasTradeoff: tradeoffResult.detected,
      hasRisk: riskResult.detected,
      hasIrreversible: irreversibleResult.detected,
      hasNonRetryBranches: branchResult.detected,
      detectedSignals: allSignals,
    };
  }
  
  console.log(`[KiteAI PM Guard] PASSED: Workflow has PM-level depth (${allSignals.length} signals detected)`);
  return {
    passed: true,
    reason: 'Workflow contains meaningful product decisions',
    hasTradeoff: tradeoffResult.detected,
    hasRisk: riskResult.detected,
    hasIrreversible: irreversibleResult.detected,
    hasNonRetryBranches: branchResult.detected,
    detectedSignals: allSignals,
  };
}

// ============ Helper Functions ============

function shouldApplyPMGuards(roleContext?: RoleContext): boolean {
  if (!roleContext) return true;
  
  if (roleContext.role === 'pm') return true;
  if (roleContext.role === 'hybrid' && roleContext.confidence >= 0.7) return true;
  
  return false;
}

function extractAllText(workflow: SemanticWorkflow): string {
  const nodeTexts = workflow.nodes.map(n => 
    `${n.label || ''} ${n.type} ${JSON.stringify(n.data || {})}`
  );
  const edgeTexts = workflow.edges.map(e => e.label || '');
  return [...nodeTexts, ...edgeTexts].join(' ');
}

function isDecisionNode(node: WorkflowNode): boolean {
  const type = node.type.toLowerCase();
  const label = (node.label || '').toLowerCase();
  return ['condition', 'decision', 'branch', 'switch', 'gateway', 'if'].some(t => 
    type.includes(t) || label.includes(t)
  );
}

function categorizeNode(node: WorkflowNode): string {
  const type = node.type.toLowerCase();
  const label = (node.label || '').toLowerCase();
  
  if (type.includes('error') || label.includes('error') || label.includes('fail')) {
    return 'error';
  }
  if (type.includes('success') || label.includes('success') || label.includes('complete')) {
    return 'success';
  }
  if (type.includes('exit') || label.includes('exit') || label.includes('cancel')) {
    return 'exit';
  }
  if (type.includes('process') || type.includes('action')) {
    return 'process';
  }
  return 'other';
}

function findReachableTerminals(
  startId: string, 
  workflow: SemanticWorkflow,
  visited: Set<string> = new Set()
): WorkflowNode[] {
  if (visited.has(startId)) return [];
  visited.add(startId);
  
  const node = workflow.nodes.find(n => n.id === startId);
  if (!node) return [];
  
  const outgoingEdges = workflow.edges.filter(e => e.source === startId);
  
  if (outgoingEdges.length === 0) {
    return [node];
  }
  
  const terminals: WorkflowNode[] = [];
  for (const edge of outgoingEdges) {
    terminals.push(...findReachableTerminals(edge.target, workflow, visited));
  }
  
  return terminals;
}
