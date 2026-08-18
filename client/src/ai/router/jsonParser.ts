import { z } from 'zod';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawText?: string;
}

/**
 * Tolerant JSON parser that handles:
 * - Raw JSON
 * - Fenced code blocks (```json ... ```)
 * - Whitespace noise
 * - Trailing content after valid JSON
 */
export function extractJSON(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  let cleaned = text.trim();

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const jsonStartIndex = cleaned.indexOf('{');
  const jsonArrayStartIndex = cleaned.indexOf('[');
  
  let startIndex = -1;
  let isArray = false;
  
  if (jsonStartIndex === -1 && jsonArrayStartIndex === -1) {
    return null;
  } else if (jsonStartIndex === -1) {
    startIndex = jsonArrayStartIndex;
    isArray = true;
  } else if (jsonArrayStartIndex === -1) {
    startIndex = jsonStartIndex;
  } else {
    if (jsonArrayStartIndex < jsonStartIndex) {
      startIndex = jsonArrayStartIndex;
      isArray = true;
    } else {
      startIndex = jsonStartIndex;
    }
  }

  cleaned = cleaned.substring(startIndex);

  const closingChar = isArray ? ']' : '}';
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let endIndex = -1;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (endIndex === -1) {
    return null;
  }

  return cleaned.substring(0, endIndex);
}

/**
 * Parse JSON with Zod schema validation
 */
export function parseWithSchema<T>(
  text: string,
  schema: z.ZodType<T>
): ParseResult<T> {
  const jsonStr = extractJSON(text);
  
  if (!jsonStr) {
    return {
      success: false,
      error: 'No valid JSON found in response',
      rawText: text,
    };
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const validated = schema.safeParse(parsed);
    
    if (validated.success) {
      return {
        success: true,
        data: validated.data,
      };
    } else {
      return {
        success: false,
        error: `Schema validation failed: ${validated.error.message}`,
        rawText: jsonStr,
      };
    }
  } catch (e) {
    return {
      success: false,
      error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
      rawText: jsonStr,
    };
  }
}

/**
 * Parse JSON without schema validation (legacy compatibility)
 */
export function parseJSON<T = unknown>(text: string): ParseResult<T> {
  const jsonStr = extractJSON(text);
  
  if (!jsonStr) {
    return {
      success: false,
      error: 'No valid JSON found in response',
      rawText: text,
    };
  }

  try {
    const parsed = JSON.parse(jsonStr) as T;
    return {
      success: true,
      data: parsed,
    };
  } catch (e) {
    return {
      success: false,
      error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
      rawText: jsonStr,
    };
  }
}

/**
 * PRD response schema
 */
export const PRDResponseSchema = z.object({
  overview: z.string().optional().default(''),
  requirements: z.string().optional().default(''),
  'user-flow': z.string().optional().default(''),
  'inputs-outputs': z.string().optional().default(''),
  'failure-scenarios': z.string().optional().default(''),
  'recovery-fallback': z.string().optional().default(''),
  'operational-risks': z.string().optional().default(''),
  'acceptance-criteria': z.string().optional().default(''),
});

/**
 * Proposal variant schema
 */
export const ProposalVariantSchema = z.object({
  title: z.string(),
  description: z.string(),
  nodes: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
    type: z.string().optional(),
  })),
  edges: z.array(z.object({
    from: z.union([z.number(), z.string()]),
    to: z.union([z.number(), z.string()]),
    label: z.string().optional(),
  })),
});

export const DualProposalSchema = z.object({
  proposed: ProposalVariantSchema,
  alternative: ProposalVariantSchema,
});

/**
 * Experiment response schema
 */
export const ExperimentSchema = z.object({
  title: z.string(),
  description: z.string(),
  nodes: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
    type: z.string().optional(),
  })),
  edges: z.array(z.object({
    from: z.union([z.number(), z.string()]),
    to: z.union([z.number(), z.string()]),
    label: z.string().optional(),
  })),
});

export const ExperimentsResponseSchema = z.object({
  experiments: z.array(ExperimentSchema),
});
