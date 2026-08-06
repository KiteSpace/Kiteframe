/**
 * Unit tests for detectNewScreenIntent and extractArtboardLabels.
 *
 * Covers:
 *  - True positives: messages that should trigger a new artboard
 *  - False positives (edit-focused messages that must NOT trigger):
 *      • Missing explicit "new" keyword
 *      • "new <screen-word>" followed by a structural noun (e.g. "section")
 *      • Message containing an existing artboard label
 */

import { describe, it, expect } from 'vitest';
import { detectNewScreenIntent, extractArtboardLabels } from '../newScreenIntent';
import { skeletonizeCraftState } from '../lib/craftStateSkeleton';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal raw craft.js state with one or more AstryxArtboard nodes. */
function rawCraftState(...labels: string[]): string {
  const nodes: Record<string, unknown> = {
    ROOT: { type: { resolvedName: 'div' }, props: {}, nodes: [], linkedNodes: {} },
  };
  labels.forEach((label, i) => {
    nodes[`artboard-${i}`] = {
      type: { resolvedName: 'AstryxArtboard' },
      props: { label, width: 390, height: 844 },
      nodes: [],
      linkedNodes: {},
    };
  });
  return JSON.stringify(nodes);
}

/** Skeleton-format state (output of skeletonizeCraftState) with one or more artboards. */
function skeletonState(...labels: string[]): string {
  return skeletonizeCraftState(rawCraftState(...labels)) ?? '{}';
}

// Keep old alias for backwards compatibility in tests below.
const craftState = rawCraftState;

const NO_CANVAS = '';
const EMPTY_CANVAS = '{}';

// ─── extractArtboardLabels ────────────────────────────────────────────────────

describe('extractArtboardLabels', () => {
  it('returns empty array for null / empty input', () => {
    expect(extractArtboardLabels(null)).toEqual([]);
    expect(extractArtboardLabels(undefined)).toEqual([]);
    expect(extractArtboardLabels('')).toEqual([]);
    expect(extractArtboardLabels('{}')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(extractArtboardLabels('not-json')).toEqual([]);
  });

  // ── Raw craft.js format ────────────────────────────────────────────────────

  it('returns labels from raw craft state (type.resolvedName / props.label)', () => {
    expect(extractArtboardLabels(rawCraftState('Login Screen'))).toEqual(['Login Screen']);
    expect(extractArtboardLabels(rawCraftState('Home', 'Profile'))).toEqual(['Home', 'Profile']);
  });

  it('ignores non-artboard nodes in raw format', () => {
    const state = JSON.stringify({
      ROOT: { type: { resolvedName: 'div' }, props: {}, nodes: [] },
      btn1: { type: { resolvedName: 'AstryxButton' }, props: { label: 'Sign in' }, nodes: [] },
    });
    expect(extractArtboardLabels(state)).toEqual([]);
  });

  it('ignores raw artboard nodes with missing or empty labels', () => {
    const state = JSON.stringify({
      ROOT: { type: { resolvedName: 'div' }, props: {} },
      ab1: { type: { resolvedName: 'AstryxArtboard' }, props: { label: '' } },
      ab2: { type: { resolvedName: 'AstryxArtboard' }, props: {} },
    });
    expect(extractArtboardLabels(state)).toEqual([]);
  });

  // ── Skeleton format (output of skeletonizeCraftState) ─────────────────────

  it('returns labels from skeleton format (type as string / text field)', () => {
    expect(extractArtboardLabels(skeletonState('Login Screen'))).toEqual(['Login Screen']);
  });

  it('returns multiple labels from skeleton format', () => {
    const labels = extractArtboardLabels(skeletonState('Home', 'Profile'));
    expect(labels).toContain('Home');
    expect(labels).toContain('Profile');
    expect(labels).toHaveLength(2);
  });

  it('extracts the same labels from raw and skeleton formats for the same canvas', () => {
    const raw = rawCraftState('Login Screen', 'Dashboard');
    const skeleton = skeletonizeCraftState(raw) ?? '{}';
    const rawLabels = extractArtboardLabels(raw).sort();
    const skeletonLabels = extractArtboardLabels(skeleton).sort();
    expect(skeletonLabels).toEqual(rawLabels);
  });
});

// ─── detectNewScreenIntent — true positives ────────────────────────────────────

describe('detectNewScreenIntent — true positives', () => {
  it('fires on "create a new screen for login"', () => {
    expect(detectNewScreenIntent('create a new screen for login', NO_CANVAS)).toBe(true);
  });

  it('fires on "design a new page for the settings flow"', () => {
    expect(detectNewScreenIntent('design a new page for the settings flow', NO_CANVAS)).toBe(true);
  });

  it('fires on "generate a new interface"', () => {
    expect(detectNewScreenIntent('generate a new interface', NO_CANVAS)).toBe(true);
  });

  it('fires on "build a new ui for checkout"', () => {
    expect(detectNewScreenIntent('build a new ui for checkout', NO_CANVAS)).toBe(true);
  });

  it('fires on "make a new layout"', () => {
    expect(detectNewScreenIntent('make a new layout', NO_CANVAS)).toBe(true);
  });

  it('fires on "add a new screen"', () => {
    expect(detectNewScreenIntent('add a new screen', NO_CANVAS)).toBe(true);
  });

  it('fires on "I need a new screen for the onboarding flow"', () => {
    expect(detectNewScreenIntent('I need a new screen for the onboarding flow', NO_CANVAS)).toBe(true);
  });

  it('fires on standalone "new screen for signup" (no existing artboards)', () => {
    expect(detectNewScreenIntent('new screen for signup', EMPTY_CANVAS)).toBe(true);
  });

  it('fires on standalone "new page for the dashboard"', () => {
    expect(detectNewScreenIntent('new page for the dashboard', NO_CANVAS)).toBe(true);
  });

  it('fires on "create a new design for the homepage"', () => {
    expect(detectNewScreenIntent('create a new design for the homepage', NO_CANVAS)).toBe(true);
  });

  it('fires even with existing artboards when message does NOT contain their name', () => {
    const state = craftState('Login Screen');
    expect(detectNewScreenIntent('create a new screen for the profile page', state)).toBe(true);
  });
});

// ─── detectNewScreenIntent — false positives (must NOT fire) ──────────────────

describe('detectNewScreenIntent — false positives (edit-focused messages)', () => {
  // ── Missing "new" keyword ──────────────────────────────────────────────────

  it('does NOT fire on "create a screen" without "new"', () => {
    expect(detectNewScreenIntent('create a screen', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "add a button to the screen"', () => {
    expect(detectNewScreenIntent('add a button to the screen', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "design a login page" without "new"', () => {
    expect(detectNewScreenIntent('design a login page', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "create an interface for the settings" without "new"', () => {
    expect(detectNewScreenIntent('create an interface for the settings', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "create a text input for the login screen"', () => {
    expect(detectNewScreenIntent('create a text input for the login screen', NO_CANVAS)).toBe(false);
  });

  // ── "new <screen-word>" followed by a structural noun ─────────────────────

  it('does NOT fire on "add a button to the new page section"', () => {
    expect(detectNewScreenIntent('add a button to the new page section', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "add items to the new screen section"', () => {
    expect(detectNewScreenIntent('add items to the new screen section', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "update the new page component"', () => {
    expect(detectNewScreenIntent('update the new page component', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "style the new interface panel"', () => {
    expect(detectNewScreenIntent('style the new interface panel', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "add fields to the new ui form"', () => {
    expect(detectNewScreenIntent('add fields to the new ui form', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "place a card in the new page area"', () => {
    expect(detectNewScreenIntent('place a card in the new page area', NO_CANVAS)).toBe(false);
  });

  // ── Verb-pattern + structural noun (the verb pattern must also be guarded) ─

  it('does NOT fire on "add a new UI component"', () => {
    expect(detectNewScreenIntent('add a new UI component', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "create a new page section"', () => {
    expect(detectNewScreenIntent('create a new page section', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "build a new interface panel"', () => {
    expect(detectNewScreenIntent('build a new interface panel', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "design a new layout section"', () => {
    expect(detectNewScreenIntent('design a new layout section', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "make a new screen component"', () => {
    expect(detectNewScreenIntent('make a new screen component', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "generate a new page tab"', () => {
    expect(detectNewScreenIntent('generate a new page tab', NO_CANVAS)).toBe(false);
  });

  // ── Edit-verb / prepositional context around "new screen/page" ────────────
  // These messages contain "new screen/page" mid-sentence as the *target* of
  // an edit, not as a creation request. The standalone pattern must not fire.

  it('does NOT fire on "update the new page"', () => {
    expect(detectNewScreenIntent('update the new page', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "add content to the new screen"', () => {
    expect(detectNewScreenIntent('add content to the new screen', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "move the header on the new page"', () => {
    expect(detectNewScreenIntent('move the header on the new page', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "change the background of the new interface"', () => {
    expect(detectNewScreenIntent('change the background of the new interface', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "resize items in the new screen"', () => {
    expect(detectNewScreenIntent('resize items in the new screen', NO_CANVAS)).toBe(false);
  });

  // ── Verb + "new" + screen-type used as a modifier of a content noun ────────
  // The screen-type word ("page", "ui", "screen") is followed by a content noun,
  // meaning the user is asking to add/edit a *thing on* the existing design.

  it('does NOT fire on "add a new page header"', () => {
    expect(detectNewScreenIntent('add a new page header', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "create a new screen footer"', () => {
    expect(detectNewScreenIntent('create a new screen footer', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "add a new UI button"', () => {
    expect(detectNewScreenIntent('add a new UI button', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "add a new UI card"', () => {
    expect(detectNewScreenIntent('add a new UI card', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "design a new page hero"', () => {
    expect(detectNewScreenIntent('design a new page hero', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on "build a new interface button group"', () => {
    expect(detectNewScreenIntent('build a new interface button group', NO_CANVAS)).toBe(false);
  });

  // ── Message references an existing artboard label (raw format) ───────────

  it('does NOT fire when message contains an existing artboard name (raw state)', () => {
    const state = rawCraftState('Login Screen');
    expect(detectNewScreenIntent('create a new screen for the Login Screen', state)).toBe(false);
  });

  it('does NOT fire when message references artboard name case-insensitively (raw state)', () => {
    const state = rawCraftState('Profile Page');
    expect(detectNewScreenIntent('add a new button to the profile page', state)).toBe(false);
  });

  it('does NOT fire when artboard name appears mid-sentence (raw state)', () => {
    const state = rawCraftState('Home');
    // "create a new screen" pattern fires but "Home" appears → suppressed
    expect(detectNewScreenIntent('create a new screen similar to Home', state)).toBe(false);
  });

  it('does NOT fire when one of multiple artboard names is mentioned (raw state)', () => {
    const state = rawCraftState('Login Screen', 'Dashboard');
    expect(detectNewScreenIntent('add a new section to the Dashboard', state)).toBe(false);
  });

  // ── Message references an existing artboard label (skeleton format) ───────
  // These mirror the production path: currentCraftState is the output of
  // skeletonizeCraftState(), not the raw craft.js JSON.

  it('does NOT fire when message contains artboard name from skeleton state', () => {
    const state = skeletonState('Login Screen');
    expect(detectNewScreenIntent('create a new screen for the Login Screen', state)).toBe(false);
  });

  it('does NOT fire when message references artboard name case-insensitively (skeleton state)', () => {
    const state = skeletonState('Profile Page');
    expect(detectNewScreenIntent('add a new button to the profile page', state)).toBe(false);
  });

  it('does NOT fire when artboard name appears mid-sentence (skeleton state)', () => {
    const state = skeletonState('Home');
    expect(detectNewScreenIntent('create a new screen similar to Home', state)).toBe(false);
  });

  it('does NOT fire when one of multiple skeleton artboard names is mentioned', () => {
    const state = skeletonState('Login Screen', 'Dashboard');
    expect(detectNewScreenIntent('add a new section to the Dashboard', state)).toBe(false);
  });

  it('DOES fire when no artboard name from skeleton state is in the message', () => {
    const state = skeletonState('Login Screen');
    expect(detectNewScreenIntent('create a new screen for profile', state)).toBe(true);
  });

  // ── Empty / whitespace messages ────────────────────────────────────────────

  it('does NOT fire on empty string', () => {
    expect(detectNewScreenIntent('', NO_CANVAS)).toBe(false);
  });

  it('does NOT fire on whitespace-only string', () => {
    expect(detectNewScreenIntent('   ', NO_CANVAS)).toBe(false);
  });
});
