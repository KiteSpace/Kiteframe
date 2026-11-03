/**
 * A deliberately small YAML-frontmatter reader.
 *
 * The journal only needs strings, numbers, booleans, and flat lists, so parsing
 * that subset by hand avoids pulling in a YAML dependency. Anything more
 * elaborate — nested maps, anchors, multi-line scalars — is not supported, and
 * `parseFrontmatter` will simply hand back the raw string value.
 */

export type FrontmatterValue = string | number | boolean | string[];

export interface ParsedFrontmatter {
  data: Record<string, FrontmatterValue>;
  body: string;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length > 1)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function coerce(raw: string): FrontmatterValue {
  const value = raw.trim();

  // Inline list: [a, b, "c d"]
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map(stripQuotes).filter((entry) => entry !== "");
  }

  if (value === "true") return true;
  if (value === "false") return false;

  // Only treat it as a number when the whole value is one, so a date like
  // 2024-04-12 stays a string.
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);

  return stripQuotes(value);
}

/**
 * Splits a markdown file into its frontmatter fields and its body. A file with
 * no frontmatter block comes back with empty data and its content untouched.
 */
export function parseFrontmatter(source: string): ParsedFrontmatter {
  const normalized = source.replace(/^\uFEFF/, "");
  const match = FENCE.exec(normalized);
  if (!match) return { data: {}, body: normalized.trim() };

  const data: Record<string, FrontmatterValue> = {};
  const lines = match[1].split(/\r?\n/);

  let pendingKey: string | null = null;
  let pendingList: string[] = [];

  const flush = () => {
    if (pendingKey) data[pendingKey] = pendingList;
    pendingKey = null;
    pendingList = [];
  };

  for (const line of lines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    // Block list continuation:
    //   tags:
    //     - one
    //     - two
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem && pendingKey) {
      pendingList.push(stripQuotes(listItem[1]));
      continue;
    }

    const field = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!field) continue;

    flush();
    const [, key, rawValue] = field;

    if (rawValue.trim() === "") {
      // Either an empty value or the header of a block list; the next lines
      // decide, and `flush` writes an empty array if none follow.
      pendingKey = key;
      continue;
    }

    data[key] = coerce(rawValue);
  }

  flush();

  return {
    data,
    body: normalized.slice(match[0].length).trim(),
  };
}

/** Rough reading time, used when a post does not declare one. */
export function estimateReadingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
