/**
 * Design-generation route handler extracted from routes.ts so it can be
 * integration-tested against the real Express request/response cycle
 * without standing up the entire app (Stripe, WebSocket, session, etc.).
 *
 * Behavior is identical to the inline handler in routes.ts.
 * The only external side-effect is the call to executeAiChat — that
 * dependency is mocked in tests via vi.mock('../aiChatExecutor').
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { executeAiChat } from './aiChatExecutor';
import { DESIGN_SYSTEM_PROMPT } from './lib/designPrompt';
import { mergeDesignPatch } from './lib/designPatchMerge';
import { sanitizeAiResponse } from './utils/sanitize';

const MODEL = 'claude-sonnet-4-5-20250929';

function logSuccess(entry: {
  prompt: string;
  selectedElementDisplayName?: string;
  targetArtboardLabel?: string;
  responseType: 'message' | 'state' | 'patch';
  nodeCount?: number;
  durationMs: number;
  model: string;
}) {
  // logging disabled
  void entry;
}

function logRejected(entry: {
  prompt: string;
  selectedElementDisplayName?: string;
  reason: string;
  durationMs: number;
  model: string;
  validationErrors?: string[];
}) {
  // logging disabled
  void entry;
}

export async function designGenerationHandler(req: Request, res: Response) {
  const startMs = Date.now();
  try {
    const schema = z.object({
      prompt: z.string().min(1).max(2000),
      currentCraftState: z.string().max(40000).optional(),
      targetArtboardLabel: z.string().max(200).optional(),
      conversationHistory: z
        .array(
          z.object({
            role: z.enum(['user', 'ai']),
            text: z.string().max(2000),
          }),
        )
        .max(12)
        .optional(),
      selectedElement: z
        .object({
          displayName: z.string().max(100),
          props: z.record(z.unknown()),
          nodeId: z.string().max(200).optional(),
        })
        .optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path.join('.') || 'request';
      const validationErrors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      logRejected({
        prompt: (req.body?.prompt ?? '').toString().slice(0, 200),
        reason: 'request_validation_failed',
        durationMs: Date.now() - startMs,
        model: MODEL,
        validationErrors,
      });
      return res
        .status(400)
        .json({ error: `Invalid ${field}: ${firstIssue?.message ?? 'validation failed'}` });
    }

    const { prompt, currentCraftState, targetArtboardLabel, conversationHistory, selectedElement } = parsed.data;
    const promptSnippet = prompt.slice(0, 200);
    const selectedElementDisplayName = selectedElement?.displayName;

    let userMessage = prompt;
    if (currentCraftState && currentCraftState.trim().length > 2) {
      userMessage += `\n\n<CURRENT_CANVAS>\n${currentCraftState}\n</CURRENT_CANVAS>`;
      if (targetArtboardLabel) {
        userMessage += `\n\nTarget artboard: "${targetArtboardLabel}"`;
      }
    }
    if (selectedElement) {
      const safeProps = JSON.stringify(selectedElement.props, null, 2).slice(0, 2000);
      userMessage += `\n\n<FOCUSED_ELEMENT>\nType: ${selectedElement.displayName}\nProps:\n${safeProps}\n</FOCUSED_ELEMENT>`;
    }

    // Build history messages (exclude last user turn — it's the current userMessage above)
    const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (conversationHistory && conversationHistory.length > 0) {
      for (const turn of conversationHistory) {
        historyMessages.push({
          role: turn.role === 'ai' ? 'assistant' : 'user',
          content: turn.text,
        });
      }
    }

    // Anthropic assistant-prefill: response continues from the opening '{'.
    const result = await executeAiChat({
      provider: 'anthropic',
      model: MODEL,
      maxTokens: 16000,
      messages: [
        ...historyMessages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: '{' },
      ],
    }, undefined, { systemPrompt: DESIGN_SYSTEM_PROMPT });

    if (!result.ok) {
      logRejected({ prompt: promptSnippet, selectedElementDisplayName, reason: 'ai_error', durationMs: Date.now() - startMs, model: MODEL });
      return res
        .status(result.status || 500)
        .json({ error: result.error || 'AI generation failed' });
    }

    const stopReason = (result as any).json?.stop_reason;
    if (stopReason === 'max_tokens') {
      logRejected({ prompt: promptSnippet, selectedElementDisplayName, reason: 'max_tokens', durationMs: Date.now() - startMs, model: MODEL });
      return res.status(500).json({
        error: 'Design was too complex — try a simpler prompt with fewer components',
      });
    }

    // Reconstruct full JSON: prefill started with '{', model continues from there.
    const raw = ('{' + (result.text || '')).trim();
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonEnd === -1) {
      logRejected({ prompt: promptSnippet, selectedElementDisplayName, reason: 'incomplete_response', durationMs: Date.now() - startMs, model: MODEL });
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
        logRejected({ prompt: promptSnippet, selectedElementDisplayName, reason: 'invalid_json', durationMs: Date.now() - startMs, model: MODEL });
        return res
          .status(500)
          .json({ error: 'AI returned invalid JSON — try rephrasing your prompt' });
      }
    }

    const responseType = parsedResponse?.type;

    if (responseType === 'message') {
      const text = sanitizeAiResponse(
        typeof parsedResponse.text === 'string' ? parsedResponse.text : 'I can help with that.',
      );
      logSuccess({ prompt: promptSnippet, selectedElementDisplayName, targetArtboardLabel, responseType: 'message', durationMs: Date.now() - startMs, model: MODEL });
      return res.json({ type: 'message', text });
    }

    if (responseType === 'patch') {
      const patchNodes = parsedResponse.nodes;
      if (!patchNodes || typeof patchNodes !== 'object') {
        logRejected({ prompt: promptSnippet, selectedElementDisplayName, reason: 'invalid_patch_nodes', durationMs: Date.now() - startMs, model: MODEL });
        return res
          .status(500)
          .json({ error: 'AI returned an invalid patch — try rephrasing your prompt' });
      }

      const patchNodeCount = Object.keys(patchNodes).length;
      const message =
        typeof parsedResponse.message === 'string'
          ? sanitizeAiResponse(parsedResponse.message)
          : undefined;

      if (currentCraftState && currentCraftState.trim().length > 2) {
        try {
          const existingState: Record<string, unknown> = JSON.parse(currentCraftState);
          const { merged, orphansRemoved } = mergeDesignPatch(
            existingState,
            patchNodes as Record<string, unknown>,
          );
          if (orphansRemoved > 0) {
            console.warn(`[design/patch] Removed ${orphansRemoved} orphan child ref(s) after merge`);
          }
          // nodeCount reflects the merged state actually sent in the response, not the raw patch.
          const mergedNodeCount = Object.keys(merged).length;
          logSuccess({ prompt: promptSnippet, selectedElementDisplayName, targetArtboardLabel, responseType: 'state', nodeCount: mergedNodeCount, durationMs: Date.now() - startMs, model: MODEL });
          return res.json({ type: 'state', craftState: JSON.stringify(merged), message });
        } catch (mergeErr) {
          console.warn('[design/patch] Server-side merge failed, falling back to raw patch:', mergeErr);
        }
      }

      logSuccess({ prompt: promptSnippet, selectedElementDisplayName, targetArtboardLabel, responseType: 'patch', nodeCount: patchNodeCount, durationMs: Date.now() - startMs, model: MODEL });
      return res.json({ type: 'patch', nodes: JSON.stringify(patchNodes), message });
    }

    // Default: full state replacement
    const craftStateObj = responseType === 'state' ? parsedResponse.craftState : parsedResponse;
    if (!craftStateObj || typeof craftStateObj !== 'object') {
      logRejected({ prompt: promptSnippet, selectedElementDisplayName, reason: 'invalid_craft_state', durationMs: Date.now() - startMs, model: MODEL });
      return res
        .status(500)
        .json({ error: 'AI returned an invalid design — try rephrasing your prompt' });
    }

    const nodeCount = Object.keys(craftStateObj).length;
    const stateMessage =
      typeof parsedResponse.message === 'string'
        ? sanitizeAiResponse(parsedResponse.message)
        : undefined;
    logSuccess({ prompt: promptSnippet, selectedElementDisplayName, targetArtboardLabel, responseType: 'state', nodeCount, durationMs: Date.now() - startMs, model: MODEL });
    return res.json({
      type: 'state',
      craftState: JSON.stringify(craftStateObj),
      message: stateMessage,
    });
  } catch (err: any) {
    console.error('Design generation error:', err);
    logRejected({ prompt: (req.body?.prompt ?? '').toString().slice(0, 200), reason: 'internal_error', durationMs: Date.now() - startMs, model: MODEL });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
