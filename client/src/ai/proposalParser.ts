/**
 * Phase 2: Deterministic Proposal Parsing
 * 
 * Replaces brittle regex JSON extraction with structured parsing and validation.
 * Ensures proposal updates never fail silently.
 */

export interface ProposalNode {
  id: string;
  label: string;
  description?: string;
  type?: string;
  icon?: string;
  iconColor?: string;
  data?: Record<string, unknown>;
}

export interface ProposalEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface WorkflowProposal {
  title?: string;
  summary?: string;
  nodes: ProposalNode[];
  edges: ProposalEdge[];
  assumptions?: string[];
}

export interface ProposalParseResult {
  success: boolean;
  proposal?: WorkflowProposal;
  error?: string;
  validationErrors?: string[];
  requestId?: string;
}

export interface EdgeCaseParseResult {
  success: boolean;
  edgeCases?: Array<{ id: string; label: string }>;
  error?: string;
  requestId?: string;
}

/**
 * Attempts to extract JSON from AI response text.
 * Tries multiple strategies:
 * 1. Direct JSON.parse on trimmed text
 * 2. Extract JSON block from markdown code fence
 * 3. Find JSON object with nodes/edges keys
 */
/**
 * Walks `src` from `startIndex` (which must be a `{`) and finds the matching
 * closing brace, treating string contents and `\\` escapes correctly. Any
 * `{`/`}` that occurs inside a JSON string is ignored. Returns the index of
 * the matching `}` or -1 if not found.
 */
function findMatchingBrace(src: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIndex; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function tryParseObjectFromBraces(src: string): unknown | null {
  const start = src.indexOf('{');
  if (start === -1) return null;
  const end = findMatchingBrace(src, start);
  if (end === -1) return null;
  const jsonStr = src.substring(start, end + 1);
  try {
    // Clean up common JSON issues (trailing commas before } or ]).
    const cleaned = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function extractJsonFromText(text: string): unknown | null {
  const trimmed = text.trim();

  // Strategy 1: Direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to other strategies
  }

  // Strategy 2: Try every markdown code fence (not just the first). Models
  // sometimes emit prose + a fenced JSON block + a trailing note, and the
  // first fence may not be the JSON one. We scan all fenced blocks and
  // return the first that parses.
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/g;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fenceRe.exec(trimmed)) !== null) {
    const inner = fenceMatch[1].trim();
    try {
      return JSON.parse(inner);
    } catch {
      // Try the brace-walk on the fence body too — handles fences that
      // wrap prose + JSON together.
      const fromBraces = tryParseObjectFromBraces(inner);
      if (fromBraces !== null) return fromBraces;
    }
  }

  // Strategy 3: String-aware brace walk over the full text. This is the
  // critical fix for workflows whose node labels/descriptions/edge labels
  // contain `{` or `}` (e.g. `"Return {status: 'ok'}"`). The previous
  // implementation counted every brace regardless of string context and
  // returned null whenever content braces existed.
  const fromBraces = tryParseObjectFromBraces(trimmed);
  if (fromBraces !== null) return fromBraces;

  return null;
}

/**
 * Validates that a proposal has required structure
 * Note: Relaxed constraints - allows 1+ nodes and 0+ edges for valid drafts
 */
function validateProposal(proposal: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!proposal || typeof proposal !== 'object') {
    errors.push('Response is not a valid object');
    return { valid: false, errors };
  }
  
  const p = proposal as Record<string, unknown>;
  
  // Check nodes - require at least 1 node
  if (!Array.isArray(p.nodes)) {
    errors.push('Missing or invalid "nodes" array');
  } else if (p.nodes.length < 1) {
    errors.push('Proposal has no nodes');
  } else {
    // Validate each node has required fields
    const nodeIds = new Set<string>();
    for (let i = 0; i < p.nodes.length; i++) {
      const node = p.nodes[i] as Record<string, unknown>;
      if (!node.id || typeof node.id !== 'string') {
        errors.push(`Node at index ${i} missing valid "id"`);
      } else {
        nodeIds.add(node.id);
      }
    }
    
    // Check edges - allow 0 edges for single-node drafts
    if (!Array.isArray(p.edges)) {
      errors.push('Missing or invalid "edges" array');
    } else if (p.edges.length > 0) {
      // Validate edge endpoints exist only if there are edges
      for (let i = 0; i < p.edges.length; i++) {
        const edge = p.edges[i] as Record<string, unknown>;
        if (!edge.id || typeof edge.id !== 'string') {
          errors.push(`Edge at index ${i} missing valid "id"`);
        }
        if (!edge.source || typeof edge.source !== 'string') {
          errors.push(`Edge at index ${i} missing valid "source"`);
        } else if (!nodeIds.has(edge.source)) {
          errors.push(`Edge "${edge.id}" has source "${edge.source}" that doesn't exist in nodes`);
        }
        if (!edge.target || typeof edge.target !== 'string') {
          errors.push(`Edge at index ${i} missing valid "target"`);
        } else if (!nodeIds.has(edge.target)) {
          errors.push(`Edge "${edge.id}" has target "${edge.target}" that doesn't exist in nodes`);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Parse a workflow proposal from AI response text.
 * Returns a structured result with success/failure and detailed errors.
 */
export function parseWorkflowProposal(
  responseText: string,
  requestId?: string
): ProposalParseResult {
  if (!responseText || responseText.trim().length === 0) {
    return {
      success: false,
      error: 'AI returned an empty response',
      requestId,
    };
  }
  
  const extracted = extractJsonFromText(responseText);
  
  if (extracted === null) {
    return {
      success: false,
      error: 'Could not extract valid JSON from AI response',
      requestId,
    };
  }
  
  const validation = validateProposal(extracted);
  
  if (!validation.valid) {
    return {
      success: false,
      error: 'Proposal validation failed',
      validationErrors: validation.errors,
      requestId,
    };
  }
  
  // Convert to WorkflowProposal format, preserving all existing fields
  const raw = extracted as Record<string, unknown>;
  const proposal: WorkflowProposal = {
    title: typeof raw.title === 'string' ? raw.title : undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    nodes: (raw.nodes as any[]).map(n => ({
      // Preserve all existing properties from AI response
      ...n,
      id: n.id,
      label: n.label || n.data?.label || n.id,
      description: n.description,
      type: n.type || 'process',
      icon: n.icon,
      iconColor: n.iconColor,
      // Preserve position if provided
      position: n.position,
      // Preserve all data fields
      data: n.data,
    })),
    edges: (raw.edges as any[]).map(e => ({
      // Preserve all existing properties from AI response
      ...e,
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || e.data?.label,
      data: e.data,
    })),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : undefined,
  };
  
  return {
    success: true,
    proposal,
    requestId,
  };
}

/**
 * Parse edge cases list from AI response text.
 */
export function parseEdgeCases(
  responseText: string,
  requestId?: string
): EdgeCaseParseResult {
  if (!responseText || responseText.trim().length === 0) {
    return {
      success: false,
      error: 'AI returned an empty response',
      requestId,
    };
  }
  
  const extracted = extractJsonFromText(responseText);
  
  if (extracted === null) {
    return {
      success: false,
      error: 'Could not extract valid JSON from AI response',
      requestId,
    };
  }
  
  const raw = extracted as Record<string, unknown>;
  
  if (!Array.isArray(raw.edgeCases)) {
    return {
      success: false,
      error: 'Response missing "edgeCases" array',
      requestId,
    };
  }
  
  const edgeCases = raw.edgeCases
    .filter((ec: unknown) => ec && typeof ec === 'object')
    .map((ec: unknown) => {
      const e = ec as Record<string, unknown>;
      return {
        id: String(e.id || `case-${Math.random().toString(36).slice(2, 8)}`),
        label: String(e.label || 'Unnamed edge case'),
      };
    });
  
  if (edgeCases.length === 0) {
    return {
      success: false,
      error: 'No valid edge cases found in response',
      requestId,
    };
  }
  
  return {
    success: true,
    edgeCases,
    requestId,
  };
}
