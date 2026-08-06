/**
 * New-screen intent detection for the AI design chat.
 *
 * Determines whether a user message is asking to create a brand-new artboard
 * versus editing content on an existing one.
 *
 * Design goals:
 *  - True positives:  "create a new screen for login", "design a new page for settings",
 *                     "add a new interface", "build a new ui"
 *  - False-positive guards:
 *      • Messages that contain an existing artboard label (e.g. "Login Screen") are
 *        edit-targeted — suppress newScreen even if the pattern would match.
 *      • "add a button to the new page section" / "add items to the new section" must
 *        not trigger — the standalone `new <screen-word>` pattern is suppressed when
 *        immediately followed by a structural noun like "section", "component", etc.
 *      • The verb+noun pattern now requires an *explicit* "new" so that
 *        "create a screen" alone does not fire (user is more likely editing).
 */

/**
 * Positive lookahead for what may follow a screen-type noun to confirm it is the
 * top-level artifact being requested, not a modifier of a content noun.
 *
 * Allowed continuations:
 *   - End of string (e.g. "create a new screen")
 *   - Sentence-ending punctuation (e.g. "create a new screen, please")
 *   - Purpose/clause introductors: for, called, named, to, that, which, with,
 *     and, or (e.g. "create a new screen for login", "a new page with dark mode")
 *
 * This purposefully excludes any continuation that is another content word
 * (header, footer, button, card, component, section, panel, …) so that phrases
 * like "add a new page header" or "add a new UI button" do not fire.
 */
const SCREEN_NOUN_POSITIVE_LOOKAHEAD =
  /(?=\s*$|\s*[.!?,;]|\s+(?:for|called|named|to|that|which|with|and|or)\b)/i;

/**
 * Matches an intent verb + explicit "new" + screen-type noun where the screen noun
 * is the top-level artifact (not a modifier of a following content word).
 *
 * Intent verbs include creation verbs (create, build, design, generate, make, add)
 * and desire verbs (need, want) so that "I need a new screen for X" is caught.
 *
 * True positives:   "create a new screen", "design a new page for X",
 *                   "I need a new interface", "I want a new ui for checkout"
 * False positives blocked by positive lookahead:
 *                   "add a new page header", "create a new screen footer",
 *                   "add a new UI button", "build a new interface panel"
 */
const VERB_NEW_SCREEN_PATTERN = new RegExp(
  /\b(create|build|design|generate|make|add|need|want)\s+(a\s+)?new\s+(ui|interface|screen|page|design|layout)\b/.source +
  SCREEN_NOUN_POSITIVE_LOOKAHEAD.source,
  'i',
);

/**
 * Standalone "new <screen-type>" pattern — ANCHORED TO THE START of the message.
 *
 * Only matches when "new screen/page/…" begins the trimmed message (optionally
 * preceded by "a"), and the noun is the top-level artifact (positive lookahead
 * applied). Anchoring prevents edit-context phrases mid-sentence — "update the
 * new page", "add content to the new screen" — from firing.
 */
const STANDALONE_NEW_SCREEN_PATTERN = new RegExp(
  /^\s*(a\s+)?new\s+(screen|page|interface|ui)\b/.source +
  SCREEN_NOUN_POSITIVE_LOOKAHEAD.source,
  'i',
);

// Exported for unit tests.
export { SCREEN_NOUN_POSITIVE_LOOKAHEAD as STRUCTURAL_NOUN_LOOKAHEAD };

/**
 * Extract artboard labels from a serialized craft.js state JSON string.
 *
 * Handles two formats:
 *
 * 1. **Raw craft.js format** — nodes have `type: { resolvedName: "AstryxArtboard" }`
 *    and the user-visible label lives in `props.label`.
 *
 * 2. **Skeleton format** (output of `skeletonizeCraftState`) — nodes have
 *    `type: "AstryxArtboard"` (plain string) and the label was mapped from
 *    `props.label` into the `text` field by the skeleton transform. The skeleton
 *    also preserves `custom.label` → `label` and `custom.artboardLabel` →
 *    `artboardLabel` if they were set.
 *
 * Returns an empty array when the state is missing, invalid, or contains no artboards.
 */
export function extractArtboardLabels(craftStateJson: string | null | undefined): string[] {
  if (!craftStateJson || craftStateJson.trim().length <= 2) return [];
  try {
    const state = JSON.parse(craftStateJson) as Record<string, Record<string, unknown>>;
    const labels: string[] = [];

    for (const node of Object.values(state)) {
      if (typeof node !== 'object' || node === null) continue;

      // Detect artboard nodes in both raw and skeleton formats.
      const rawType = node.type;
      const resolvedName =
        typeof rawType === 'string'
          ? rawType
          : typeof rawType === 'object' && rawType !== null
          ? (rawType as { resolvedName?: string }).resolvedName
          : undefined;

      if (resolvedName !== 'AstryxArtboard') continue;

      // Collect candidate label strings from all possible locations.
      const candidates: unknown[] = [
        // Skeleton: props.label mapped to node.text by skeletonizeCraftState
        node.text,
        // Skeleton: custom.label / custom.artboardLabel
        node.label,
        node.artboardLabel,
        // Raw: props.label
        (node.props as Record<string, unknown> | undefined)?.label,
      ];

      for (const c of candidates) {
        if (typeof c === 'string' && c.trim().length > 0) {
          labels.push(c.trim());
          break; // Use the first non-empty candidate per node.
        }
      }
    }

    return labels;
  } catch {
    return [];
  }
}

/**
 * Detect whether a user message is requesting a brand-new artboard.
 *
 * @param message       The raw user message text (will be trimmed internally).
 * @param craftStateJson  The current serialized craft.js state, used to extract
 *                        existing artboard labels for suppression.
 * @returns `true` when the message expresses intent to create a new artboard.
 */
export function detectNewScreenIntent(
  message: string,
  craftStateJson: string | null | undefined,
): boolean {
  const text = message.trim();
  if (!text) return false;

  // Check both patterns.
  const matched =
    VERB_NEW_SCREEN_PATTERN.test(text) || STANDALONE_NEW_SCREEN_PATTERN.test(text);
  if (!matched) return false;

  // Suppress when the message names an existing artboard — this indicates an edit.
  const labels = extractArtboardLabels(craftStateJson);
  if (labels.length > 0) {
    const lower = text.toLowerCase();
    if (labels.some((label) => lower.includes(label.toLowerCase()))) {
      return false;
    }
  }

  return true;
}
