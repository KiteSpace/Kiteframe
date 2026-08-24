/**
 * The PRD reader renders each section title itself. AI responses occasionally
 * repeat that title as their first markdown heading, which produces a duplicate
 * heading in the reader. Remove only that wrapper heading; headings that name
 * distinct inner parts of a section are intentional and must remain.
 */
function normalizeHeadingText(value: string): string {
  return value
    .replace(/\\([\\`*_[\]~])/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function titleMatches(candidate: string, sectionTitle: string): boolean {
  return normalizeHeadingText(candidate) === normalizeHeadingText(sectionTitle);
}

const ATX_HEADING = /^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/;
const SETEXT_UNDERLINE = /^\s{0,3}(?:=+|-+)\s*$/;

/**
 * Removes a leading ATX or setext markdown heading only when it repeats the
 * title already supplied by the surrounding PRD section UI.
 */
export function normalizeGeneratedPrdSection(content: string, sectionTitle: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';

  const lines = trimmed.split(/\r?\n/);
  const atxMatch = lines[0]?.match(ATX_HEADING);
  if (atxMatch) {
    const headingText = atxMatch[1].replace(/[ \t]+#+[ \t]*$/, '');
    if (titleMatches(headingText, sectionTitle)) {
      return lines.slice(1).join('\n').trim();
    }
    return trimmed;
  }

  if (
    lines.length >= 2
    && SETEXT_UNDERLINE.test(lines[1])
    && titleMatches(lines[0], sectionTitle)
  ) {
    return lines.slice(2).join('\n').trim();
  }

  return trimmed;
}