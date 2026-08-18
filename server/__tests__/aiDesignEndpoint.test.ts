/**
 * Integration tests for the POST /api/ai/design route handler.
 *
 * Verifies two key behaviours introduced when the token budget was raised for
 * workflow-to-design calls:
 *
 *   1. maxTokens is 24 000 when `source === "workflow"` (multi-screen generation).
 *   2. maxTokens remains 16 000 when `source` is omitted (chat-driven edits).
 *   3. A valid craft.js JSON state is returned (not an error) when the AI
 *      responds with a well-formed object — simulating a successful multi-screen
 *      workflow-to-design call end-to-end without truncation.
 *
 * Uses the same "replicate the handler inline" approach as
 * designRename.integration.test.ts so we don't need to bootstrap all of the
 * heavy top-level imports in routes.ts.  The handler logic is a faithful copy
 * of server/routes.ts lines ~2311-2434.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, {
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import { z } from 'zod';

// ─── Mock executeAiChat ───────────────────────────────────────────────────────
// Capture every call so we can assert on the `maxTokens` argument.

const executeAiChatMock = vi.fn();

vi.mock('../aiChatExecutor', () => ({
  executeAiChat: (...args: any[]) => executeAiChatMock(...args),
}));

// Import AFTER mock is registered
const { executeAiChat } = await import('../aiChatExecutor');

// ─── Minimal valid craft.js state ────────────────────────────────────────────
// Three artboards (screens) — represents a successful multi-screen generation.

const THREE_SCREEN_CRAFT_STATE = {
  ROOT: {
    type: { resolvedName: 'div' },
    isCanvas: true,
    props: {},
    displayName: 'App',
    custom: {},
    hidden: false,
    nodes: ['ab1', 'ab2', 'ab3'],
    linkedNodes: {},
    parent: null,
  },
  ab1: {
    type: { resolvedName: 'AstryxArtboard' },
    isCanvas: true,
    props: { label: 'Login' },
    displayName: 'AstryxArtboard',
    custom: {},
    hidden: false,
    nodes: [],
    linkedNodes: {},
    parent: 'ROOT',
  },
  ab2: {
    type: { resolvedName: 'AstryxArtboard' },
    isCanvas: true,
    props: { label: 'Dashboard' },
    displayName: 'AstryxArtboard',
    custom: {},
    hidden: false,
    nodes: [],
    linkedNodes: {},
    parent: 'ROOT',
  },
  ab3: {
    type: { resolvedName: 'AstryxArtboard' },
    isCanvas: true,
    props: { label: 'Settings' },
    displayName: 'AstryxArtboard',
    custom: {},
    hidden: false,
    nodes: [],
    linkedNodes: {},
    parent: 'ROOT',
  },
};

// ─── Inline handler (faithful copy of routes.ts /api/ai/design) ───────────────
// We replicate only the logic under test — prompt parsing, token selection,
// AI call, truncation check, and response routing.

function buildDesignApp() {
  const app = express();
  app.use(express.json());

  app.post('/api/ai/design', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        prompt: z.string().min(1).max(8000),
        currentCraftState: z.string().max(40000).optional(),
        targetArtboardLabel: z.string().max(200).optional(),
        source: z.enum(['workflow', 'chat']).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const field = firstIssue?.path.join('.') || 'request';
        return res
          .status(400)
          .json({ error: `Invalid ${field}: ${firstIssue?.message ?? 'validation failed'}` });
      }
      const { prompt, currentCraftState, targetArtboardLabel, source } = parsed.data;
      const isWorkflowGeneration = source === 'workflow';

      let userMessage = prompt;
      if (currentCraftState && currentCraftState.trim().length > 2) {
        userMessage += `\n\n<CURRENT_CANVAS>\n${currentCraftState}\n</CURRENT_CANVAS>`;
        if (targetArtboardLabel) {
          userMessage += `\n\nTarget artboard: "${targetArtboardLabel}"`;
        }
      }

      const maxTokens = isWorkflowGeneration ? 24000 : 16000;
      const result = await executeAiChat({
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        maxTokens,
        messages: [
          { role: 'system', content: 'SYSTEM' },
          { role: 'user', content: userMessage },
          { role: 'assistant', content: '{' },
        ],
      });

      if (!result.ok) {
        return res.status(result.status || 500).json({ error: result.error || 'AI generation failed' });
      }

      const stopReason = result.json?.stop_reason;
      if (stopReason === 'max_tokens') {
        const errorMessage = isWorkflowGeneration
          ? 'This workflow has too many screens to generate at once — try splitting it into smaller workflows or reducing the number of steps'
          : 'Design was too complex — try a simpler prompt with fewer components';
        return res.status(500).json({ error: errorMessage });
      }

      const raw = ('{' + (result.text || '')).trim();
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonEnd === -1) {
        return res
          .status(500)
          .json({ error: 'AI returned incomplete response — try rephrasing your prompt' });
      }
      const jsonStr = raw.slice(0, jsonEnd + 1);
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(jsonStr);
      } catch {
        const repaired = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        try {
          parsedResponse = JSON.parse(repaired);
        } catch {
          return res
            .status(500)
            .json({ error: 'AI returned invalid JSON — try rephrasing your prompt' });
        }
      }

      const responseType = parsedResponse?.type;

      if (responseType === 'message') {
        const text =
          typeof parsedResponse.text === 'string' ? parsedResponse.text : 'I can help with that.';
        return res.json({ type: 'message', text });
      }

      if (responseType === 'patch') {
        const patchNodes = parsedResponse.nodes;
        if (!patchNodes || typeof patchNodes !== 'object') {
          return res
            .status(500)
            .json({ error: 'AI returned an invalid patch — try rephrasing your prompt' });
        }
        return res.json({ type: 'patch', nodes: JSON.stringify(patchNodes) });
      }

      // Default: full state replacement
      const craftStateObj =
        responseType === 'state' ? parsedResponse.craftState : parsedResponse;
      if (!craftStateObj || typeof craftStateObj !== 'object') {
        return res
          .status(500)
          .json({ error: 'AI returned an invalid design — try rephrasing your prompt' });
      }
      const stateMessage =
        typeof parsedResponse.message === 'string' ? parsedResponse.message : undefined;
      return res.json({ type: 'state', craftState: JSON.stringify(craftStateObj), message: stateMessage });
    } catch (err: any) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/ai/design — token budget', () => {
  beforeEach(() => {
    executeAiChatMock.mockReset();
  });

  it('uses maxTokens=24000 when source="workflow"', async () => {
    // Simulate the AI returning a 3-screen craft state (no truncation)
    const aiText = JSON.stringify(THREE_SCREEN_CRAFT_STATE).slice(1); // strip leading '{'
    executeAiChatMock.mockResolvedValueOnce({
      ok: true,
      text: aiText,
      json: { stop_reason: 'end_turn' },
    });

    const app = buildDesignApp();
    const res = await request(app).post('/api/ai/design').send({
      prompt:
        'Generate a multi-screen UI for a task manager app with Login, Dashboard, and Settings screens.',
      source: 'workflow',
    });

    expect(res.status).toBe(200);
    // Confirm the AI was called with the higher 24 000-token budget
    expect(executeAiChatMock).toHaveBeenCalledOnce();
    const callArgs = executeAiChatMock.mock.calls[0][0];
    expect(callArgs.maxTokens).toBe(24000);
  });

  it('uses maxTokens=16000 when source is omitted (chat)', async () => {
    const aiText = JSON.stringify(THREE_SCREEN_CRAFT_STATE).slice(1);
    executeAiChatMock.mockResolvedValueOnce({
      ok: true,
      text: aiText,
      json: { stop_reason: 'end_turn' },
    });

    const app = buildDesignApp();
    const res = await request(app).post('/api/ai/design').send({
      prompt: 'Add a header to the existing design.',
      // source intentionally omitted
    });

    expect(res.status).toBe(200);
    expect(executeAiChatMock).toHaveBeenCalledOnce();
    const callArgs = executeAiChatMock.mock.calls[0][0];
    expect(callArgs.maxTokens).toBe(16000);
  });

  it('uses maxTokens=16000 when source="chat"', async () => {
    const aiText = JSON.stringify(THREE_SCREEN_CRAFT_STATE).slice(1);
    executeAiChatMock.mockResolvedValueOnce({
      ok: true,
      text: aiText,
      json: { stop_reason: 'end_turn' },
    });

    const app = buildDesignApp();
    const res = await request(app).post('/api/ai/design').send({
      prompt: 'Update the button color.',
      source: 'chat',
    });

    expect(res.status).toBe(200);
    const callArgs = executeAiChatMock.mock.calls[0][0];
    expect(callArgs.maxTokens).toBe(16000);
  });
});

describe('POST /api/ai/design — multi-screen end-to-end (workflow source)', () => {
  beforeEach(() => {
    executeAiChatMock.mockReset();
  });

  it('returns valid craft.js state JSON for a 3-screen workflow prompt', async () => {
    const aiText = JSON.stringify(THREE_SCREEN_CRAFT_STATE).slice(1);
    executeAiChatMock.mockResolvedValueOnce({
      ok: true,
      text: aiText,
      json: { stop_reason: 'end_turn' },
    });

    // A realistic multi-screen prompt that buildInterfacePromptFromWorkflow
    // would produce for a workflow with 3 input nodes.
    const multiScreenPrompt =
      'Generate a multi-screen UI interface design for a product called "Task Manager". ' +
      'This workflow has 12 steps across 3 distinct screens. ' +
      'Generate one AstryxArtboard per screen as specified in the SCREEN MAPPING below.\n\n' +
      'SCREEN MAPPING:\n' +
      'Screen "Login": User enters email, User enters password, Submit button\n' +
      'Screen "Dashboard": Task list, Add task button, Filter bar\n' +
      'Screen "Settings": Profile section, Notification toggles, Save button\n\n' +
      'Generate one AstryxArtboard for each screen in the SCREEN MAPPING above.';

    const app = buildDesignApp();
    const res = await request(app).post('/api/ai/design').send({
      prompt: multiScreenPrompt,
      source: 'workflow',
    });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('state');
    expect(typeof res.body.craftState).toBe('string');

    // Parse the returned craft state and verify it is a valid craft.js object
    const craftState = JSON.parse(res.body.craftState);
    expect(craftState).toHaveProperty('ROOT');
    // Should contain the three artboard nodes
    expect(craftState).toHaveProperty('ab1');
    expect(craftState).toHaveProperty('ab2');
    expect(craftState).toHaveProperty('ab3');
    expect(craftState.ab1.props.label).toBe('Login');
    expect(craftState.ab2.props.label).toBe('Dashboard');
    expect(craftState.ab3.props.label).toBe('Settings');
  });

  it('returns a 500 with a workflow-specific message when the AI is truncated', async () => {
    executeAiChatMock.mockResolvedValueOnce({
      ok: true,
      text: '{"ROOT": {},', // truncated — incomplete JSON isn't the signal; stop_reason is
      json: { stop_reason: 'max_tokens' },
    });

    const app = buildDesignApp();
    const res = await request(app).post('/api/ai/design').send({
      prompt: 'Generate a 10-screen UI.',
      source: 'workflow',
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/too many screens/i);
  });

  it('returns a 500 with a chat-specific message when the AI is truncated without source', async () => {
    executeAiChatMock.mockResolvedValueOnce({
      ok: true,
      text: '{"ROOT": {},',
      json: { stop_reason: 'max_tokens' },
    });

    const app = buildDesignApp();
    const res = await request(app).post('/api/ai/design').send({
      prompt: 'Make a complex design.',
      // source omitted
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/too complex/i);
  });
});
