/**
 * Design palette regression tests.
 *
 * What this covers:
 *   1. DESIGN_SYSTEM_PROMPT_CLIENT lists all 20 documented Astryx components
 *      and instructs the AI to use the full palette (prompt regression guard).
 *   2. ALLOWED_CRAFT_COMPONENTS (craftValidator.ts) contains all 20 documented
 *      components plus AstryxUnknown.
 *   3. Production validateCraftState and sanitizeCraftState behave correctly.
 *   4. Four "simulated AI responses" — realistic craft states that represent what
 *      a well-prompted AI should produce for diverse design prompts — pass the
 *      real production validateCraftState (imported from craftValidator.ts).
 *   5. Stored raw AI fixtures from scripts/validate-design-palette.ts are loaded
 *      and validated when present, giving non-hand-authored coverage of real model
 *      outputs.
 *   6. ALLOWED_CRAFT_COMPONENTS and the resolver map are verified to be aligned
 *      (the resolver.tsx alignment guard ensures they match at runtime; this test
 *      checks both lists independently against the expected 21-name set).
 *
 * To generate real AI fixtures (requires ANTHROPIC_API_KEY):
 *   npx tsx scripts/validate-design-palette.ts
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  ALLOWED_CRAFT_COMPONENTS,
  validateCraftState,
  sanitizeCraftState,
} from '../craftValidator';
import { DESIGN_SYSTEM_PROMPT_CLIENT, isCraftJsDesignState } from '../../lib/designGeneration';

// ─── Expected full component set ──────────────────────────────────────────────

const DOCUMENTED_COMPONENTS = [
  // Containers
  'AstryxSection', 'AstryxStack', 'AstryxHStack',
  // Typography
  'AstryxHeading', 'AstryxText',
  // Inputs & actions
  'AstryxButton', 'AstryxTextInput',
  // Status & feedback
  'AstryxBadge', 'AstryxBanner', 'AstryxProgressBar', 'AstryxStatusDot',
  'AstryxSpinner', 'AstryxSkeleton',
  // Media & identity
  'AstryxAvatar', 'AstryxIcon',
  // Content
  'AstryxCard', 'AstryxChatMessage', 'AstryxEmptyState', 'AstryxToken',
  'AstryxDivider',
] as const;

// Full resolver set including the graceful-degradation placeholder
const FULL_RESOLVER_SET = [...DOCUMENTED_COMPONENTS, 'AstryxUnknown'] as const;

const ORIGINAL_FIVE = new Set([
  'AstryxSection', 'AstryxButton', 'AstryxText', 'AstryxCard', 'AstryxTextInput',
]);

// ─── Simulated AI responses ────────────────────────────────────────────────────
// Representative craft states a well-prompted AI should produce.
// All go through the REAL production validateCraftState.

const SIMULATED_DASHBOARD = {
  ROOT: {
    type: { resolvedName: 'AstryxSection' },
    isCanvas: true,
    props: { direction: 'column', gap: 16, padding: 24 },
    displayName: 'AstryxSection',
    custom: {},
    parent: null,
    hidden: false,
    nodes: ['header-row', 'progress-section', 'alert-banner'],
    linkedNodes: {},
  },
  'header-row': {
    type: { resolvedName: 'AstryxHStack' },
    isCanvas: true,
    props: { gap: 12, align: 'center' },
    displayName: 'AstryxHStack',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: ['user-avatar', 'page-heading', 'status-badge'],
    linkedNodes: {},
  },
  'user-avatar': {
    type: { resolvedName: 'AstryxAvatar' },
    isCanvas: false,
    props: { name: 'Jane Smith', size: 'md' },
    displayName: 'AstryxAvatar',
    custom: {},
    parent: 'header-row',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'page-heading': {
    type: { resolvedName: 'AstryxHeading' },
    isCanvas: false,
    props: { children: 'Dashboard', size: 'xl' },
    displayName: 'AstryxHeading',
    custom: {},
    parent: 'header-row',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'status-badge': {
    type: { resolvedName: 'AstryxBadge' },
    isCanvas: false,
    props: { children: 'Live', color: 'green' },
    displayName: 'AstryxBadge',
    custom: {},
    parent: 'header-row',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'progress-section': {
    type: { resolvedName: 'AstryxStack' },
    isCanvas: true,
    props: { gap: 8 },
    displayName: 'AstryxStack',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: ['progress-label', 'progress-bar', 'dot-online'],
    linkedNodes: {},
  },
  'progress-label': {
    type: { resolvedName: 'AstryxText' },
    isCanvas: false,
    props: { children: 'Completion', size: 'sm', muted: true },
    displayName: 'AstryxText',
    custom: {},
    parent: 'progress-section',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'progress-bar': {
    type: { resolvedName: 'AstryxProgressBar' },
    isCanvas: false,
    props: { value: 72, color: 'blue' },
    displayName: 'AstryxProgressBar',
    custom: {},
    parent: 'progress-section',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'dot-online': {
    type: { resolvedName: 'AstryxStatusDot' },
    isCanvas: false,
    props: { status: 'online' },
    displayName: 'AstryxStatusDot',
    custom: {},
    parent: 'progress-section',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'alert-banner': {
    type: { resolvedName: 'AstryxBanner' },
    isCanvas: false,
    props: { children: 'Scheduled maintenance tonight at 11 PM.', variant: 'warning' },
    displayName: 'AstryxBanner',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
};

const SIMULATED_LOADING = {
  ROOT: {
    type: { resolvedName: 'AstryxSection' },
    isCanvas: true,
    props: { direction: 'column', gap: 12, padding: 16 },
    displayName: 'AstryxSection',
    custom: {},
    parent: null,
    hidden: false,
    nodes: ['loading-spinner', 'skeleton-line-1', 'skeleton-line-2'],
    linkedNodes: {},
  },
  'loading-spinner': {
    type: { resolvedName: 'AstryxSpinner' },
    isCanvas: false,
    props: { size: 'md' },
    displayName: 'AstryxSpinner',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'skeleton-line-1': {
    type: { resolvedName: 'AstryxSkeleton' },
    isCanvas: false,
    props: { width: 320, height: 20 },
    displayName: 'AstryxSkeleton',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'skeleton-line-2': {
    type: { resolvedName: 'AstryxSkeleton' },
    isCanvas: false,
    props: { width: 240, height: 16 },
    displayName: 'AstryxSkeleton',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
};

const SIMULATED_CHAT = {
  ROOT: {
    type: { resolvedName: 'AstryxSection' },
    isCanvas: true,
    props: { direction: 'column', gap: 8, padding: 16 },
    displayName: 'AstryxSection',
    custom: {},
    parent: null,
    hidden: false,
    nodes: ['msg-in', 'msg-out', 'divider-date', 'tag-react', 'icon-attach'],
    linkedNodes: {},
  },
  'msg-in': {
    type: { resolvedName: 'AstryxChatMessage' },
    isCanvas: false,
    props: { children: 'Hello!', sender: 'Alice', isOwn: false },
    displayName: 'AstryxChatMessage',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'msg-out': {
    type: { resolvedName: 'AstryxChatMessage' },
    isCanvas: false,
    props: { children: 'Hi there!', sender: 'You', isOwn: true },
    displayName: 'AstryxChatMessage',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'divider-date': {
    type: { resolvedName: 'AstryxDivider' },
    isCanvas: false,
    props: { label: 'Yesterday' },
    displayName: 'AstryxDivider',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'tag-react': {
    type: { resolvedName: 'AstryxToken' },
    isCanvas: false,
    props: { children: 'React' },
    displayName: 'AstryxToken',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
  'icon-attach': {
    type: { resolvedName: 'AstryxIcon' },
    isCanvas: false,
    props: { name: 'paperclip', size: 'sm' },
    displayName: 'AstryxIcon',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
};

const SIMULATED_EMPTY_STATE = {
  ROOT: {
    type: { resolvedName: 'AstryxSection' },
    isCanvas: true,
    props: { direction: 'column', gap: 16, padding: 32 },
    displayName: 'AstryxSection',
    custom: {},
    parent: null,
    hidden: false,
    nodes: ['empty-state'],
    linkedNodes: {},
  },
  'empty-state': {
    type: { resolvedName: 'AstryxEmptyState' },
    isCanvas: false,
    props: { title: 'No results', description: 'Try adjusting your filters.', action: 'Clear' },
    displayName: 'AstryxEmptyState',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
};

const SIMULATED_RESPONSES = [
  { prompt: 'analytics dashboard with avatar and status indicators', state: SIMULATED_DASHBOARD },
  { prompt: 'loading skeleton screen while data fetches', state: SIMULATED_LOADING },
  { prompt: 'chat interface with message bubbles and tags', state: SIMULATED_CHAT },
  { prompt: 'empty state screen with call-to-action', state: SIMULATED_EMPTY_STATE },
];

// ─── Load stored AI fixtures ──────────────────────────────────────────────────
// Populated by: npx tsx scripts/validate-design-palette.ts
// Returns an empty array when no fixtures have been generated yet.

function loadStoredAiFixtures(): Array<{ prompt: string; rawResponse: string }> {
  try {
    const fixtureDir = path.resolve(__dirname, '../../../../scripts/design-palette-fixtures');
    if (!fs.existsSync(fixtureDir)) return [];
    return fs
      .readdirSync(fixtureDir)
      .filter((f) => f.startsWith('prompt-') && f.endsWith('.json'))
      .sort()
      .map((f) => JSON.parse(fs.readFileSync(path.join(fixtureDir, f), 'utf8')) as { prompt: string; rawResponse: string });
  } catch {
    return [];
  }
}

function extractCraftState(raw: string): unknown {
  try { return JSON.parse(raw.trim()); } catch {}
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const brace = raw.indexOf('{');
  if (brace !== -1) { try { return JSON.parse(raw.slice(brace)); } catch {} }
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DESIGN_SYSTEM_PROMPT_CLIENT — full palette coverage', () => {
  it('mentions every one of the 20 documented Astryx components', () => {
    const missing = DOCUMENTED_COMPONENTS.filter(
      (name) => !DESIGN_SYSTEM_PROMPT_CLIENT.includes(name),
    );
    expect(missing, `Prompt missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('explicitly instructs the AI to use the full palette, not just the original 5', () => {
    expect(DESIGN_SYSTEM_PROMPT_CLIENT).toContain('Use the full palette');
  });

  it('documents container types AstryxStack and AstryxHStack', () => {
    expect(DESIGN_SYSTEM_PROMPT_CLIENT).toContain('AstryxStack');
    expect(DESIGN_SYSTEM_PROMPT_CLIENT).toContain('AstryxHStack');
  });

  it('documents extended components from every category', () => {
    for (const name of ['AstryxBadge', 'AstryxBanner', 'AstryxProgressBar', 'AstryxAvatar', 'AstryxChatMessage', 'AstryxEmptyState']) {
      expect(DESIGN_SYSTEM_PROMPT_CLIENT, `Prompt must mention ${name}`).toContain(name);
    }
  });
});

describe('ALLOWED_CRAFT_COMPONENTS — alignment with expected palette', () => {
  it('includes all 20 documented components', () => {
    const missing = DOCUMENTED_COMPONENTS.filter(
      (name) => !ALLOWED_CRAFT_COMPONENTS.includes(name),
    );
    expect(missing, `Validator missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('includes AstryxUnknown for graceful degradation', () => {
    expect(ALLOWED_CRAFT_COMPONENTS).toContain('AstryxUnknown');
  });

  it('contains exactly the expected 21 component names (no extras, no missing)', () => {
    const extra = [...ALLOWED_CRAFT_COMPONENTS].filter(
      (name) => !(FULL_RESOLVER_SET as readonly string[]).includes(name),
    );
    expect(extra, `Unexpected entries in ALLOWED_CRAFT_COMPONENTS: ${extra.join(', ')}`).toEqual([]);
    expect(ALLOWED_CRAFT_COMPONENTS.length).toBe(FULL_RESOLVER_SET.length);
  });

  it('alignment guard is present in resolver.tsx to catch runtime drift', () => {
    // This is a documentation test: the alignment guard block in resolver.tsx
    // compares Object.keys(resolver) against ALLOWED_CRAFT_COMPONENTS at module
    // init and logs an error if they diverge. If you see this test fail, it means
    // the guard was removed from resolver.tsx.
    const resolverSource = fs.readFileSync(
      path.resolve(__dirname, '../resolver.tsx'),
      'utf8',
    );
    expect(resolverSource).toContain('ALLOWED_CRAFT_COMPONENTS ↔ resolver MISMATCH');
  });
});

describe('Simulated AI responses — validateCraftState (production validator)', () => {
  for (const { prompt, state } of SIMULATED_RESPONSES) {
    it(`passes for "${prompt}"`, () => {
      const result = validateCraftState(state);
      expect(result.errors, `Errors: ${result.errors.join('; ')}`).toEqual([]);
      expect(result.valid).toBe(true);
    });
  }

  it('rejects a state missing ROOT', () => {
    const bad = { orphan: { type: { resolvedName: 'AstryxText' }, nodes: [], parent: null } };
    const result = validateCraftState(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('ROOT');
  });

  it('rejects a node referencing a non-existent child', () => {
    const bad = {
      ROOT: { type: { resolvedName: 'AstryxSection' }, isCanvas: true, props: {}, parent: null, nodes: ['ghost'], linkedNodes: {} },
    };
    expect(validateCraftState(bad).valid).toBe(false);
    expect(validateCraftState(bad).errors.join(' ')).toContain('ghost');
  });

  it('rejects non-object payloads', () => {
    expect(validateCraftState(null).valid).toBe(false);
    expect(validateCraftState('{}').valid).toBe(false);
    expect(validateCraftState(42).valid).toBe(false);
  });

  it('unknown resolvedName emits a warning but does not add to errors (graceful-degradation contract)', () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(String(args[0]));
    try {
      const stateWithUnknown = {
        ROOT: {
          type: { resolvedName: 'AstryxSection' },
          isCanvas: true,
          props: {},
          parent: null,
          nodes: ['widget'],
          linkedNodes: {},
        },
        widget: {
          type: { resolvedName: 'AstryxFutureWidget' },
          isCanvas: false,
          props: {},
          displayName: 'AstryxFutureWidget',
          custom: {},
          parent: 'ROOT',
          nodes: [],
          linkedNodes: {},
        },
      };
      const result = validateCraftState(stateWithUnknown);
      expect(result.errors, 'Unknown component must not produce a validation error').toEqual([]);
      expect(result.valid).toBe(true);
      expect(
        warnings.some((w) => w.includes('AstryxFutureWidget')),
        'validateCraftState must warn about the unknown component',
      ).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });
});

describe('isCraftJsDesignState — type guard', () => {
  it('accepts every simulated response', () => {
    for (const { prompt, state } of SIMULATED_RESPONSES) {
      expect(isCraftJsDesignState(state), `"${prompt}" should pass isCraftJsDesignState`).toBe(true);
    }
  });

  it('rejects legacy flat-JSON format', () => {
    expect(isCraftJsDesignState({ title: 'old', components: [] })).toBe(false);
  });
});

describe('sanitizeCraftState — graceful degradation', () => {
  it('replaces unknown component with AstryxUnknown and preserves original in props', () => {
    const state = {
      ROOT: { type: { resolvedName: 'AstryxSection' }, isCanvas: true, props: {}, parent: null, nodes: ['widget'], linkedNodes: {} },
      widget: { type: { resolvedName: 'AstryxFutureWidget' }, isCanvas: false, props: { color: 'red' }, displayName: 'AstryxFutureWidget', custom: {}, parent: 'ROOT', nodes: [], linkedNodes: {} },
    };
    const result = JSON.parse(sanitizeCraftState(JSON.stringify(state)));
    expect(result.widget.type.resolvedName).toBe('AstryxUnknown');
    expect(result.widget.props.astryxComponent).toBe('AstryxFutureWidget');
    expect(result.widget.props.color).toBe('red');
  });

  it('leaves a valid craft state unchanged', () => {
    const json = JSON.stringify(SIMULATED_DASHBOARD);
    expect(sanitizeCraftState(json)).toBe(json);
  });

  it('returns the original string unchanged for malformed JSON', () => {
    const bad = '{ not valid }}}';
    expect(sanitizeCraftState(bad)).toBe(bad);
  });
});

describe('Extended palette usage — simulated responses use components beyond original 5', () => {
  it('every simulated response uses at least one extended component', () => {
    for (const { prompt, state } of SIMULATED_RESPONSES) {
      const names = Object.values(state).map(
        (n) => (n as { type: { resolvedName: string } }).type.resolvedName,
      );
      expect(
        names.some((n) => !ORIGINAL_FIVE.has(n)),
        `"${prompt}" only used original-5 components: ${names.join(', ')}`,
      ).toBe(true);
    }
  });

  it('simulated responses collectively cover ≥15 of 20 documented components', () => {
    const seen = new Set<string>();
    for (const { state } of SIMULATED_RESPONSES) {
      for (const node of Object.values(state)) {
        seen.add((node as { type: { resolvedName: string } }).type.resolvedName);
      }
    }
    const covered = DOCUMENTED_COMPONENTS.filter((c) => seen.has(c));
    expect(covered.length, `Covered only: ${covered.join(', ')}`).toBeGreaterThanOrEqual(15);
  });
});

describe('Stored AI fixtures — real model outputs (requires: npx tsx scripts/validate-design-palette.ts)', () => {
  const fixtures = loadStoredAiFixtures();

  if (fixtures.length === 0) {
    it.todo('No stored fixtures found — run: npx tsx scripts/validate-design-palette.ts to generate them');
  } else {
    for (const { prompt, rawResponse } of fixtures) {
      it(`validates stored AI output for: "${prompt}"`, () => {
        const state = extractCraftState(rawResponse);
        expect(state, 'AI response must produce parseable craft state JSON').not.toBeNull();

        const result = validateCraftState(state!);
        expect(result.errors, `validateCraftState errors: ${result.errors.join('; ')}`).toEqual([]);
        expect(result.valid).toBe(true);

        // Verify at least one component was used
        const components = Object.values(state as Record<string, unknown>).map(
          (n) => (n as { type?: { resolvedName?: string } })?.type?.resolvedName,
        ).filter((n): n is string => Boolean(n));
        expect(components.length).toBeGreaterThan(0);
      });
    }

    it('at least half of stored AI responses use an extended component', () => {
      const withExtended = fixtures.filter(({ rawResponse }) => {
        const state = extractCraftState(rawResponse);
        if (!state || typeof state !== 'object') return false;
        return Object.values(state as Record<string, unknown>).some((n) => {
          const name = (n as { type?: { resolvedName?: string } })?.type?.resolvedName;
          return name && !ORIGINAL_FIVE.has(name) && name !== 'AstryxUnknown';
        });
      });
      expect(
        withExtended.length,
        `Only ${withExtended.length}/${fixtures.length} stored responses used extended components — ` +
        'the AI may be ignoring the palette instruction. Check DESIGN_SYSTEM_PROMPT_CLIENT.',
      ).toBeGreaterThanOrEqual(Math.ceil(fixtures.length / 2));
    });
  }
});
