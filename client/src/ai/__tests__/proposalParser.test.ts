/**
 * Tests for parseWorkflowProposal — focused on the JSON-extraction
 * fixes from Task #68:
 *   - The brace-walk strategy must ignore `{`/`}` characters that occur
 *     inside JSON string values (e.g. node labels containing
 *     `"Return {status: 'ok'}"`). The previous implementation counted
 *     every brace and returned null whenever content braces existed.
 *   - Multiple markdown code fences must be tried, not just the first
 *     match (models sometimes precede the JSON fence with a prose
 *     fence or include trailing notes).
 *   - Pre-existing happy paths (direct parse, single fence, trailing
 *     commas) must keep working.
 */
import { describe, it, expect } from 'vitest';
import { parseWorkflowProposal } from '../proposalParser';

const validProposal = {
  nodes: [
    { id: 'n1', type: 'start', label: 'Start' },
    { id: 'n2', type: 'process', label: 'Do thing' },
  ],
  edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'go' }],
};

describe('parseWorkflowProposal — extraction', () => {
  it('parses bare JSON', () => {
    const r = parseWorkflowProposal(JSON.stringify(validProposal), 'r1');
    expect(r.success).toBe(true);
    expect(r.proposal?.nodes).toHaveLength(2);
  });

  it('parses JSON inside a single ```json fence', () => {
    const txt = "Here's your workflow:\n```json\n" +
      JSON.stringify(validProposal) + '\n```';
    const r = parseWorkflowProposal(txt, 'r2');
    expect(r.success).toBe(true);
  });

  it('parses JSON inside the second of multiple fences (prose fence first)', () => {
    const txt =
      '```\nSome notes about what I did.\n```\n\n' +
      'And here is the workflow:\n' +
      '```json\n' + JSON.stringify(validProposal) + '\n```\n' +
      'Hope that helps!';
    const r = parseWorkflowProposal(txt, 'r3');
    expect(r.success).toBe(true);
    expect(r.proposal?.edges).toHaveLength(1);
  });

  it('parses JSON whose string values contain literal braces', () => {
    // This is THE regression that motivated Task #68. Before the fix,
    // the `}` inside the description string would unbalance the brace
    // counter and the extractor returned null.
    const proposalWithBraces = {
      nodes: [
        { id: 'n1', type: 'start', label: 'Start' },
        {
          id: 'n2',
          type: 'process',
          label: 'Return response',
          description: "Return {status: 'ok', payload: {}} to caller",
        },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'next' }],
    };
    // Wrap in prose so the direct-parse path is forced to fail and the
    // brace-walk strategy is exercised.
    const txt =
      "I've added an edge case for the response handler.\n\n" +
      JSON.stringify(proposalWithBraces) +
      '\n\nLet me know if that works!';
    const r = parseWorkflowProposal(txt, 'r4');
    expect(r.success).toBe(true);
    expect(r.proposal?.nodes).toHaveLength(2);
  });

  it('tolerates trailing commas before } and ]', () => {
    const txt =
      'Here you go:\n' +
      '{ "nodes": [ { "id": "n1", "type": "start", "label": "S", }, ], "edges": [], }';
    const r = parseWorkflowProposal(txt, 'r5');
    expect(r.success).toBe(true);
  });

  it('returns success=false with an error when no JSON object is present', () => {
    const r = parseWorkflowProposal('Just some prose, no JSON here.', 'r6');
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('does not get confused by a brace inside an escaped string', () => {
    // The label contains an escaped quote followed by braces — the
    // escape handling in findMatchingBrace must keep us inside the
    // string until the real closing quote.
    const tricky = {
      nodes: [
        {
          id: 'n1',
          type: 'start',
          label: 'literal \\"}{\\" inside',
        },
      ],
      edges: [],
    };
    const txt = 'Output:\n' + JSON.stringify(tricky);
    const r = parseWorkflowProposal(txt, 'r7');
    expect(r.success).toBe(true);
    expect(r.proposal?.nodes[0].label).toContain('inside');
  });
});
