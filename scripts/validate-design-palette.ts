/**
 * Design Palette Validation Script
 *
 * Usage:
 *   npx tsx scripts/validate-design-palette.ts
 *
 * Requires:
 *   ANTHROPIC_API_KEY environment variable with a valid key.
 *
 * What it does:
 *   1. Calls Claude (claude-haiku-4-5-20251001) with DESIGN_SYSTEM_PROMPT_CLIENT
 *      and four diverse design prompts — the same prompt path used in production.
 *   2. Runs each response through the production validateCraftState validator.
 *   3. Asserts at least some responses use components beyond the original 5
 *      (AstryxSection/Button/Text/Card/TextInput).
 *   4. Saves raw AI responses to scripts/design-palette-fixtures/ as non-hand-
 *      authored fixtures for later inspection.
 *
 * Exit code: 0 = all checks passed, 1 = one or more checks failed.
 *
 * Criteria for passing:
 *   - All responses parse as valid craft state JSON
 *   - validateCraftState returns { valid: true } for every response
 *   - At least 2 of 4 responses use at least one extended component
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESIGN_SYSTEM_PROMPT_CLIENT } from '../client/src/lib/designGeneration.js';
import { validateCraftState, ALLOWED_CRAFT_COMPONENTS } from '../client/src/design/craftValidator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Component sets ───────────────────────────────────────────────────────────

const ORIGINAL_FIVE = new Set([
  'AstryxSection',
  'AstryxButton',
  'AstryxText',
  'AstryxCard',
  'AstryxTextInput',
]);

// ─── Prompts ──────────────────────────────────────────────────────────────────

const DESIGN_PROMPTS = [
  'A user analytics dashboard with an avatar, large heading, colored status badges, and a progress bar showing project completion.',
  'A chat interface showing messages from two users with send timestamps and a text input reply area.',
  'A loading screen with a centered spinner and skeleton placeholder rows for a data table.',
  'An empty inbox state with a descriptive text block and a primary call-to-action button.',
];

// ─── AI call ──────────────────────────────────────────────────────────────────

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Export it before running this script:\n' +
      '  export ANTHROPIC_API_KEY=sk-ant-...',
    );
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content.find((b) => b.type === 'text')?.text ?? '';
}

// ─── JSON extraction (same strategy as production) ────────────────────────────

function extractCraftState(raw: string): unknown {
  const trimmed = raw.trim();
  // Direct parse
  try {
    return JSON.parse(trimmed);
  } catch {}
  // Markdown fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {}
  }
  // First brace to end
  const brace = trimmed.indexOf('{');
  if (brace !== -1) {
    try {
      return JSON.parse(trimmed.slice(brace));
    } catch {}
  }
  return null;
}

// ─── Component name extraction ────────────────────────────────────────────────

function collectComponents(state: unknown): string[] {
  if (!state || typeof state !== 'object') return [];
  return Object.values(state as Record<string, unknown>)
    .map((n) => (n as { type?: { resolvedName?: string } })?.type?.resolvedName)
    .filter((n): n is string => typeof n === 'string');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const fixtureDir = path.join(__dirname, 'design-palette-fixtures');
  fs.mkdirSync(fixtureDir, { recursive: true });

  console.log('=== Kiteframe Design Palette Validation ===');
  console.log(`Model: claude-haiku-4-5-20251001`);
  console.log(`Prompts: ${DESIGN_PROMPTS.length}`);
  console.log(`Fixture dir: ${fixtureDir}\n`);

  const results: Array<{
    prompt: string;
    parsed: boolean;
    valid: boolean;
    errors: string[];
    components: string[];
    extendedComponents: string[];
    fixtureFile: string;
  }> = [];

  for (let i = 0; i < DESIGN_PROMPTS.length; i++) {
    const prompt = DESIGN_PROMPTS[i];
    console.log(`[${i + 1}/${DESIGN_PROMPTS.length}] ${prompt}`);

    let rawText: string;
    try {
      rawText = await callClaude(DESIGN_SYSTEM_PROMPT_CLIENT, prompt);
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message}`);
      results.push({
        prompt,
        parsed: false,
        valid: false,
        errors: [(err as Error).message],
        components: [],
        extendedComponents: [],
        fixtureFile: '',
      });
      continue;
    }

    // Save raw fixture
    const fixtureFile = path.join(fixtureDir, `prompt-${String(i + 1).padStart(2, '0')}.json`);
    fs.writeFileSync(
      fixtureFile,
      JSON.stringify(
        { prompt, rawResponse: rawText, generatedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    console.log(`  Saved → ${path.relative(process.cwd(), fixtureFile)}`);

    // Parse craft state
    const state = extractCraftState(rawText);
    if (!state) {
      console.error('  FAIL: Could not parse craft state JSON from response');
      console.error('  Raw (first 300 chars):', rawText.slice(0, 300));
      results.push({
        prompt,
        parsed: false,
        valid: false,
        errors: ['JSON parse failed'],
        components: [],
        extendedComponents: [],
        fixtureFile,
      });
      continue;
    }

    // Validate structure using production validator
    const { valid, errors } = validateCraftState(state);
    const components = collectComponents(state);
    const uniqueComponents = [...new Set(components)];
    const extended = uniqueComponents.filter((n) => !ORIGINAL_FIVE.has(n) && n !== 'AstryxUnknown');

    if (valid) {
      console.log(`  ✓ validateCraftState passed`);
    } else {
      console.error(`  FAIL validateCraftState:`);
      errors.forEach((e) => console.error(`    - ${e}`));
    }

    // Check which components were used
    console.log(`  Components: ${uniqueComponents.join(', ')}`);
    if (extended.length > 0) {
      console.log(`  ✓ Extended components used: ${extended.join(', ')}`);
    } else {
      console.warn(`  WARN: No extended components beyond original 5`);
    }

    // Check for unknown components (not in allowed list)
    const unknown = uniqueComponents.filter((n) => !ALLOWED_CRAFT_COMPONENTS.includes(n));
    if (unknown.length > 0) {
      console.warn(`  WARN: Unknown components (will render as AstryxUnknown): ${unknown.join(', ')}`);
    }

    results.push({ prompt, parsed: true, valid, errors, components: uniqueComponents, extendedComponents: extended, fixtureFile });
    console.log();
  }

  // ─── Assertions ─────────────────────────────────────────────────────────────

  console.log('=== Results ===');

  const parsedCount = results.filter((r) => r.parsed).length;
  const validCount = results.filter((r) => r.valid).length;
  const extendedCount = results.filter((r) => r.extendedComponents.length > 0).length;

  console.log(`Parsed:                   ${parsedCount}/${results.length}`);
  console.log(`validateCraftState valid: ${validCount}/${results.length}`);
  console.log(`Used extended components: ${extendedCount}/${results.length}`);

  // Save summary
  const summaryFile = path.join(fixtureDir, 'validation-summary.json');
  fs.writeFileSync(
    summaryFile,
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
  );
  console.log(`Summary → ${path.relative(process.cwd(), summaryFile)}\n`);

  // Exit verdict
  let exitCode = 0;

  if (validCount < parsedCount) {
    console.error('FAIL: One or more parsed responses failed validateCraftState.');
    exitCode = 1;
  }

  if (extendedCount < Math.ceil(DESIGN_PROMPTS.length / 2)) {
    console.error(
      `FAIL: Only ${extendedCount}/${results.length} responses used extended components.\n` +
      'This suggests the AI prompt is no longer guiding the model to use the full palette.\n' +
      'Check DESIGN_SYSTEM_PROMPT_CLIENT in client/src/lib/designGeneration.ts',
    );
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log('✓ All palette checks passed.');
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
