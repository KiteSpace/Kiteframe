/**
 * Unit tests for buildInterfacePromptFromWorkflow
 *
 * Verifies that a 3–4-screen workflow (one with multiple `input`-type nodes)
 * produces a prompt that:
 *   1. Contains a SCREEN MAPPING section.
 *   2. Names each screen after the corresponding input node label.
 *   3. Includes the multi-screen artboard footer instruction.
 *   4. Does NOT generate a SCREEN MAPPING for a single-screen workflow.
 */
import { describe, it, expect } from 'vitest';
import { buildInterfacePromptFromWorkflow } from '../buildInterfacePrompt';
import type { Node, Edge } from '@/lib/kiteframe/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  type: string,
  label: string,
  extra?: Partial<Node>,
): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label },
    ...extra,
  } as Node;
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
  } as Edge;
}

// ─── 3-screen workflow fixture ────────────────────────────────────────────────
//
//  [input] Login  →  [process] Auth  →  [input] Dashboard  →  [process] LoadData
//                                                          ↘  [input] Settings  →  [process] SavePrefs

function makeThreeScreenWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    makeNode('login', 'input', 'Login'),
    makeNode('auth', 'process', 'Authenticate User'),
    makeNode('dashboard', 'input', 'Dashboard'),
    makeNode('load', 'process', 'Load Task List'),
    makeNode('settings', 'input', 'Settings'),
    makeNode('save', 'process', 'Save Preferences'),
  ];

  const edges: Edge[] = [
    makeEdge('login', 'auth'),
    makeEdge('auth', 'dashboard'),
    makeEdge('dashboard', 'load'),
    makeEdge('dashboard', 'settings'),
    makeEdge('settings', 'save'),
  ];

  return { nodes, edges };
}

// ─── 4-screen workflow fixture ────────────────────────────────────────────────

function makeFourScreenWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    makeNode('onboarding', 'input', 'Onboarding'),
    makeNode('welcome', 'process', 'Show Welcome'),
    makeNode('login', 'input', 'Login'),
    makeNode('auth', 'process', 'Authenticate'),
    makeNode('home', 'input', 'Home'),
    makeNode('feed', 'process', 'Load Feed'),
    makeNode('profile', 'input', 'Profile'),
    makeNode('loadProfile', 'process', 'Load Profile Data'),
  ];

  const edges: Edge[] = [
    makeEdge('onboarding', 'welcome'),
    makeEdge('welcome', 'login'),
    makeEdge('login', 'auth'),
    makeEdge('auth', 'home'),
    makeEdge('home', 'feed'),
    makeEdge('home', 'profile'),
    makeEdge('profile', 'loadProfile'),
  ];

  return { nodes, edges };
}

// ─── Single-screen workflow fixture ──────────────────────────────────────────

function makeSingleScreenWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    makeNode('start', 'input', 'Start'),
    makeNode('process1', 'process', 'Process'),
    makeNode('end', 'output', 'End'),
  ];
  const edges: Edge[] = [makeEdge('start', 'process1'), makeEdge('process1', 'end')];
  return { nodes, edges };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildInterfacePromptFromWorkflow — multi-screen workflows', () => {
  it('includes a SCREEN MAPPING section for a 3-screen workflow', () => {
    const { nodes, edges } = makeThreeScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'Task Manager');

    expect(prompt).toContain('SCREEN MAPPING');
    expect(prompt).toContain('Login');
    expect(prompt).toContain('Dashboard');
    expect(prompt).toContain('Settings');
  });

  it('instructs the model to generate one AstryxArtboard per screen', () => {
    const { nodes, edges } = makeThreeScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'Task Manager');

    expect(prompt).toMatch(/one AstryxArtboard per screen/i);
    expect(prompt).toMatch(/Generate one AstryxArtboard for each screen/i);
  });

  it('uses the workflow name in the prompt header', () => {
    const { nodes, edges } = makeThreeScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'My Cool App');

    expect(prompt).toContain('"My Cool App"');
  });

  it('includes a SCREEN MAPPING section for a 4-screen workflow', () => {
    const { nodes, edges } = makeFourScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'Social App');

    expect(prompt).toContain('SCREEN MAPPING');
    expect(prompt).toContain('Onboarding');
    expect(prompt).toContain('Login');
    expect(prompt).toContain('Home');
    expect(prompt).toContain('Profile');
  });

  it('includes each screen name as an artboard name hint in the footer', () => {
    const { nodes, edges } = makeThreeScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'Task Manager');

    // Footer should name at least the first two screen names explicitly
    expect(prompt).toContain('Login');
    expect(prompt).toContain('Dashboard');
  });
});

describe('buildInterfacePromptFromWorkflow — single-screen workflows', () => {
  it('does NOT include a SCREEN MAPPING section for a single-screen workflow', () => {
    const { nodes, edges } = makeSingleScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'Simple App');

    expect(prompt).not.toContain('SCREEN MAPPING');
  });

  it('falls back to a single-artboard instruction for a single-screen workflow', () => {
    const { nodes, edges } = makeSingleScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'Simple App');

    expect(prompt).toContain('Simple App');
    // Single-screen footer — no per-screen artboard list
    expect(prompt).toMatch(/production-ready/i);
  });

  it('handles an empty workflow gracefully', () => {
    const prompt = buildInterfacePromptFromWorkflow([], [], 'Empty');

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).not.toContain('SCREEN MAPPING');
  });
});

describe('buildInterfacePromptFromWorkflow — prompt length', () => {
  it('produces a prompt within the server 8000-char prompt limit for a 3-screen workflow', () => {
    const { nodes, edges } = makeThreeScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'Task Manager');

    // Server validates prompt.length <= 8000
    expect(prompt.length).toBeLessThanOrEqual(8000);
  });

  it('produces a prompt within the server limit for a 4-screen workflow', () => {
    const { nodes, edges } = makeFourScreenWorkflow();
    const prompt = buildInterfacePromptFromWorkflow(nodes, edges, 'Social App');

    expect(prompt.length).toBeLessThanOrEqual(8000);
  });
});
