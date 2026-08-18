/**
 * Shared date formatting utility.
 *
 * Accepts any date-like value (Date, ISO string, Unix timestamp in ms, null, or undefined)
 * and returns a localized string.  All options are optional.
 *
 * @param date    - The date to format.
 * @param options - Format options:
 *   - includeTime: also render hours + minutes (default false)
 *   - longMonth:   use the full month name, e.g. "January" instead of "Jan" (default false)
 *   - fallback:    string to return when `date` is null/undefined/falsy (default '-')
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  options: {
    includeTime?: boolean;
    longMonth?: boolean;
    fallback?: string;
  } = {}
): string {
  const { includeTime = false, longMonth = false, fallback = '-' } = options;

  if (!date) return fallback;

  const d = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return fallback;

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: longMonth ? 'long' : 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  };

  return d.toLocaleDateString('en-US', formatOptions);
}
