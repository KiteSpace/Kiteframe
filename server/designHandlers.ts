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

export async function designGenerationHandler(req: Request, res: Response) {
  try {
    const schema = z.object({
      prompt: z.string().min(1).max(2000),
      currentCraftState: z.string().max(40000).optional(),
      targetArtboardLabel: z.string().max(200).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path.join('.') || 'request';
      return res
        .status(400)
        .json({ error: `Invalid ${field}: ${firstIssue?.message ?? 'validation failed'}` });
    }

    const { prompt, currentCraftState, targetArtboardLabel } = parsed.data;

    let userMessage = prompt;
    if (currentCraftState && currentCraftState.trim().length > 2) {
      userMessage += `\n\n<CURRENT_CANVAS>\n${currentCraftState}\n</CURRENT_CANVAS>`;
      if (targetArtboardLabel) {
        userMessage += `\n\nTarget artboard: "${targetArtboardLabel}"`;
      }
    }

    // Anthropic assistant-prefill: response continues from the opening '{'.
    const result = await executeAiChat({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      maxTokens: 16000,
      messages: [
        { role: 'system', content: DESIGN_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: '{' },
      ],
    });

    if (!result.ok) {
      return res
        .status(result.status || 500)
        .json({ error: result.error || 'AI generation failed' });
    }

    const stopReason = (result as any).json?.stop_reason;
    if (stopReason === 'max_tokens') {
      return res.status(500).json({
        error: 'Design was too complex — try a simpler prompt with fewer components',
      });
    }

    // Reconstruct full JSON: prefill started with '{', model continues from there.
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

      const message =
        typeof parsedResponse.message === 'string' ? parsedResponse.message : undefined;

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
          return res.json({ type: 'state', craftState: JSON.stringify(merged), message });
        } catch (mergeErr) {
          console.warn('[design/patch] Server-side merge failed, falling back to raw patch:', mergeErr);
        }
      }

      return res.json({ type: 'patch', nodes: JSON.stringify(patchNodes), message });
    }

    // Default: full state replacement
    const craftStateObj = responseType === 'state' ? parsedResponse.craftState : parsedResponse;
    if (!craftStateObj || typeof craftStateObj !== 'object') {
      return res
        .status(500)
        .json({ error: 'AI returned an invalid design — try rephrasing your prompt' });
    }

    const stateMessage =
      typeof parsedResponse.message === 'string' ? parsedResponse.message : undefined;
    return res.json({
      type: 'state',
      craftState: JSON.stringify(craftStateObj),
      message: stateMessage,
    });
  } catch (err: any) {
    console.error('Design generation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
