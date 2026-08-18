/**
 * Phase 6A: Semantic Claim Extraction
 * 
 * Scans workflow nodes and insights for phrases that imply stateful behavior.
 * This is READ-ONLY - no workflow modification, no blocking.
 * 
 * Conservative detection: false negatives preferred over false positives.
 */

import type { Node } from '@/lib/kiteframe/types';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';
import type { 
  SemanticClaim, 
  SemanticClaimType, 
  ClaimPattern, 
  ClaimDetectionResult,
  EvidenceLocation 
} from './semanticClaims';

/**
 * Phrase patterns for detecting semantic claims
 * 
 * Each pattern includes:
 * - RegExp to match text
 * - Base confidence (adjusted by context)
 * - Optional threshold/time extraction
 * 
 * Patterns are ordered by specificity - more specific = higher confidence
 */
const CLAIM_PATTERNS: ClaimPattern[] = [
  // Repeated failure patterns
  {
    type: 'repeated_failure',
    patterns: [
      /repeated(ly)?\s+fail/i,
      /multiple\s+fail/i,
      /fail(s|ed|ure)?\s+(multiple|several|many)\s+times/i,
      /after\s+(\d+)\s+fail(ure)?s?/i,
      /consecutive\s+fail/i,
      /fail(s|ed)?\s+again/i,
    ],
    baseConfidence: 0.7,
    extractThreshold: true,
  },
  
  // Retry with limit patterns
  {
    type: 'retry_with_limit',
    patterns: [
      /retry\s+(\d+)\s+times?/i,
      /up\s+to\s+(\d+)\s+(retries|attempts)/i,
      /maximum\s+(\d+)\s+(retries|attempts)/i,
      /max\s+(\d+)\s+(retries|attempts)/i,
      /(\d+)\s+retry\s+limit/i,
      /retry\s+limit\s+(of\s+)?(\d+)/i,
      /attempt(s)?\s+(\d+)\s+times?/i,
      /try\s+(\d+)\s+times?/i,
      /after\s+(\d+)\s+attempts?/i,
    ],
    baseConfidence: 0.8,
    extractThreshold: true,
  },
  
  // Threshold escalation patterns
  {
    type: 'threshold_escalation',
    patterns: [
      /after\s+(\d+)\s+(times?|occurrences?|instances?)/i,
      /exceeds?\s+(\d+)/i,
      /more\s+than\s+(\d+)/i,
      /threshold\s+(of\s+)?(\d+)/i,
      /limit\s+(of\s+)?(\d+)/i,
      /(\d+)\s+or\s+more/i,
      /reaches?\s+(\d+)/i,
      /hits?\s+(\d+)/i,
    ],
    baseConfidence: 0.6,
    extractThreshold: true,
  },
  
  // Time-based escalation patterns
  {
    type: 'time_based_escalation',
    patterns: [
      /after\s+(\d+)\s*(hours?|minutes?|seconds?|days?|weeks?)/i,
      /within\s+(\d+)\s*(hours?|minutes?|seconds?|days?|weeks?)/i,
      /(\d+)\s*(hours?|minutes?|seconds?|days?|weeks?)\s+later/i,
      /timeout\s+(of\s+)?(\d+)/i,
      /wait\s+(\d+)\s*(hours?|minutes?|seconds?|days?|weeks?)/i,
      /delay\s+(of\s+)?(\d+)/i,
      /eventually/i,
      /over\s+time/i,
    ],
    baseConfidence: 0.6,
    extractTime: true,
  },
  
  // Quota limit patterns
  {
    type: 'quota_limit',
    patterns: [
      /quota/i,
      /rate\s+limit/i,
      /usage\s+limit/i,
      /daily\s+limit/i,
      /monthly\s+limit/i,
      /(\d+)\s+per\s+(day|hour|minute|month|week)/i,
      /maximum\s+usage/i,
      /allocation/i,
    ],
    baseConfidence: 0.7,
    extractThreshold: true,
  },
  
  // Manual intervention patterns
  {
    type: 'manual_intervention_required',
    patterns: [
      /manual\s+review/i,
      /human\s+review/i,
      /requires?\s+approval/i,
      /needs?\s+approval/i,
      /manual\s+approval/i,
      /escalate\s+to\s+(human|support|admin|manager)/i,
      /human\s+intervention/i,
      /manual\s+intervention/i,
      /flag\s+for\s+review/i,
      /pending\s+(review|approval)/i,
    ],
    baseConfidence: 0.8,
  },
];

/**
 * Lower confidence patterns - vague implications
 * These are detected but with lower confidence
 */
const VAGUE_PATTERNS: Array<{ type: SemanticClaimType; patterns: RegExp[]; baseConfidence: number }> = [
  {
    type: 'repeated_failure',
    patterns: [
      /keeps?\s+failing/i,
      /continues?\s+to\s+fail/i,
      /persistent\s+error/i,
    ],
    baseConfidence: 0.4,
  },
  {
    type: 'retry_with_limit',
    patterns: [
      /retry/i,
      /try\s+again/i,
      /reattempt/i,
    ],
    baseConfidence: 0.3,
  },
  {
    type: 'time_based_escalation',
    patterns: [
      /wait/i,
      /delay/i,
      /later/i,
    ],
    baseConfidence: 0.2,
  },
];

/**
 * Extract numeric threshold from text
 */
function extractThreshold(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (match) {
    for (const group of match) {
      const num = parseInt(group, 10);
      if (!isNaN(num) && num > 0 && num < 1000) {
        return num;
      }
    }
  }
  return undefined;
}

/**
 * Extract time value from text
 */
function extractTimeValue(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  if (match) {
    const fullMatch = match[0];
    const timeMatch = fullMatch.match(/(\d+)\s*(hours?|minutes?|seconds?|days?|weeks?)/i);
    if (timeMatch) {
      return timeMatch[0];
    }
  }
  return undefined;
}

/**
 * Scan text for semantic claims
 */
function scanText(
  text: string,
  location: EvidenceLocation,
  sourceNodeId?: string,
  sourceInsightId?: string
): SemanticClaim[] {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  const claims: SemanticClaim[] = [];
  const normalizedText = text.toLowerCase();
  
  // Check explicit patterns first
  for (const pattern of CLAIM_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = text.match(regex);
      if (match) {
        const claim: SemanticClaim = {
          type: pattern.type,
          sourceNodeId,
          sourceInsightId,
          confidence: pattern.baseConfidence,
          evidenceText: match[0],
          evidenceLocation: location,
        };
        
        // Extract threshold if applicable
        if (pattern.extractThreshold) {
          const threshold = extractThreshold(text, regex);
          if (threshold !== undefined) {
            claim.extractedThreshold = threshold;
            // Explicit threshold increases confidence
            claim.confidence = Math.min(0.95, claim.confidence + 0.1);
          }
        }
        
        // Extract time value if applicable
        if (pattern.extractTime) {
          const timeValue = extractTimeValue(text, regex);
          if (timeValue) {
            claim.extractedTimeValue = timeValue;
            claim.confidence = Math.min(0.95, claim.confidence + 0.1);
          }
        }
        
        // Boost confidence for node descriptions (more specific)
        if (location === 'node_description' || location === 'node_label') {
          claim.confidence = Math.min(0.95, claim.confidence + 0.05);
        }
        
        claims.push(claim);
        break; // Only match first pattern per type
      }
    }
  }
  
  // Check vague patterns (lower confidence)
  for (const pattern of VAGUE_PATTERNS) {
    // Skip if we already have a higher-confidence claim of this type
    if (claims.some(c => c.type === pattern.type)) {
      continue;
    }
    
    for (const regex of pattern.patterns) {
      const match = text.match(regex);
      if (match) {
        claims.push({
          type: pattern.type,
          sourceNodeId,
          sourceInsightId,
          confidence: pattern.baseConfidence,
          evidenceText: match[0],
          evidenceLocation: location,
        });
        break;
      }
    }
  }
  
  return claims;
}

/**
 * Deduplicate and merge claims of the same type
 * Higher confidence wins, evidence is combined
 */
function deduplicateClaims(claims: SemanticClaim[]): SemanticClaim[] {
  const claimsByType = new Map<SemanticClaimType, SemanticClaim[]>();
  
  for (const claim of claims) {
    const existing = claimsByType.get(claim.type) || [];
    existing.push(claim);
    claimsByType.set(claim.type, existing);
  }
  
  const result: SemanticClaim[] = [];
  
  for (const [type, typeClaims] of Array.from(claimsByType.entries())) {
    // Sort by confidence descending
    typeClaims.sort((a: SemanticClaim, b: SemanticClaim) => b.confidence - a.confidence);
    
    // Take highest confidence claim
    const best = typeClaims[0];
    
    // If multiple claims exist, boost confidence slightly
    if (typeClaims.length > 1) {
      best.confidence = Math.min(0.95, best.confidence + 0.05 * (typeClaims.length - 1));
    }
    
    result.push(best);
  }
  
  return result;
}

/**
 * Extract semantic claims from workflow nodes
 * 
 * Scans node labels and descriptions for phrases implying stateful behavior.
 */
export function extractClaimsFromNodes(nodes: Node[]): SemanticClaim[] {
  const allClaims: SemanticClaim[] = [];
  
  for (const node of nodes) {
    const label = node.data?.label || '';
    const description = node.data?.description || '';
    
    // Scan label
    if (label) {
      const labelClaims = scanText(label, 'node_label', node.id);
      allClaims.push(...labelClaims);
    }
    
    // Scan description
    if (description) {
      const descClaims = scanText(description, 'node_description', node.id);
      allClaims.push(...descClaims);
    }
  }
  
  return deduplicateClaims(allClaims);
}

/**
 * Extract semantic claims from insights
 * 
 * Scans insight titles and descriptions for phrases implying stateful behavior.
 */
export function extractClaimsFromInsights(insights: Insight[]): SemanticClaim[] {
  const allClaims: SemanticClaim[] = [];
  
  for (const insight of insights) {
    // Scan title
    if (insight.title) {
      const titleClaims = scanText(insight.title, 'insight_title', undefined, insight.id);
      allClaims.push(...titleClaims);
    }
    
    // Scan description
    if (insight.description) {
      const descClaims = scanText(insight.description, 'insight_description', undefined, insight.id);
      allClaims.push(...descClaims);
    }
  }
  
  return deduplicateClaims(allClaims);
}

/**
 * Extract all semantic claims from workflow content
 * 
 * This is the main entry point for Phase 6A claim extraction.
 * It is READ-ONLY - no workflow modification occurs.
 */
export function extractSemanticClaims(
  nodes: Node[],
  insights: Insight[] = []
): ClaimDetectionResult {
  const nodeClaims = extractClaimsFromNodes(nodes);
  const insightClaims = extractClaimsFromInsights(insights);
  
  // Merge all claims and deduplicate
  const allClaims = deduplicateClaims([...nodeClaims, ...insightClaims]);
  
  return {
    claims: allClaims,
    scannedNodes: nodes.length,
    scannedInsights: insights.length,
  };
}

/**
 * Filter claims by minimum confidence threshold
 */
export function filterByConfidence(
  claims: SemanticClaim[],
  minConfidence: number
): SemanticClaim[] {
  return claims.filter(c => c.confidence >= minConfidence);
}

/**
 * Get human-readable description of a claim type
 */
export function getClaimTypeDescription(type: SemanticClaimType): string {
  const descriptions: Record<SemanticClaimType, string> = {
    repeated_failure: 'Multiple failures before escalation',
    retry_with_limit: 'Retry with a maximum limit',
    threshold_escalation: 'Escalate after threshold is reached',
    time_based_escalation: 'Escalate after time period',
    quota_limit: 'Usage or rate limit enforcement',
    manual_intervention_required: 'Requires human review or approval',
  };
  return descriptions[type] || type;
}
