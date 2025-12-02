import DOMPurify from 'dompurify';

// Configure DOMPurify for strict sanitization
const strictConfig = {
  ALLOWED_TAGS: [] as string[], // No HTML tags allowed
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
  RETURN_DOM: false as const,
  RETURN_DOM_FRAGMENT: false as const,
  RETURN_TRUSTED_TYPE: false as const,
};

// Configure DOMPurify for basic formatting
const relaxedConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre'],
  ALLOWED_ATTR: ['class'],
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false as const,
};

/**
 * Sanitize plain text - removes ALL HTML
 */
export function sanitizeText(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';
  const result = DOMPurify.sanitize(input, strictConfig);
  return (typeof result === 'string' ? result : String(result)).trim();
}

/**
 * Sanitize text that may contain basic formatting
 */
export function sanitizeRichText(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';
  const result = DOMPurify.sanitize(input, relaxedConfig);
  return (typeof result === 'string' ? result : String(result)).trim();
}

/**
 * Sanitize node label for display
 */
export function sanitizeNodeLabel(label: string | undefined | null): string {
  const sanitized = sanitizeText(label);
  return sanitized.substring(0, 500);
}

/**
 * Sanitize node description for display
 */
export function sanitizeNodeDescription(description: string | undefined | null): string {
  const sanitized = sanitizeRichText(description);
  return sanitized.substring(0, 2000);
}

/**
 * Sanitize AI response before rendering
 */
export function sanitizeAiResponse(response: string | undefined | null): string {
  if (!response || typeof response !== 'string') return '';
  const result = DOMPurify.sanitize(response, relaxedConfig);
  return typeof result === 'string' ? result : String(result);
}

/**
 * Sanitize color value - only allow valid CSS colors
 */
export function sanitizeColor(color: string | undefined | null): string {
  if (!color || typeof color !== 'string') return '';
  
  const trimmed = color.trim();
  
  // Valid hex color
  if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Valid rgb/rgba
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+)?\s*\)$/.test(trimmed)) {
    return trimmed;
  }
  
  // Valid hsl/hsla
  if (/^hsla?\(\s*\d{1,3}\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+)?\s*\)$/.test(trimmed)) {
    return trimmed;
  }
  
  // Valid CSS color names
  const validColors = [
    'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
    'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime', 'navy',
    'teal', 'olive', 'maroon', 'aqua', 'fuchsia', 'silver', 'inherit', 'currentColor'
  ];
  
  if (validColors.includes(trimmed.toLowerCase())) {
    return trimmed.toLowerCase();
  }
  
  return '';
}

/**
 * Sanitize URL - only allow safe protocols
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
  const lowerUrl = trimmed.toLowerCase();
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }
  
  // Only allow http/https
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.substring(0, 2000);
  }
  
  // If no protocol, assume https for relative URLs
  if (!/^[a-z]+:\/\//i.test(trimmed) && trimmed.length > 0) {
    return `https://${trimmed}`.substring(0, 2000);
  }
  
  return '';
}

/**
 * Sanitize node data object for rendering
 */
export function sanitizeNodeData(data: any): any {
  if (!data || typeof data !== 'object') return {};
  
  return {
    ...data,
    label: sanitizeNodeLabel(data.label),
    description: sanitizeNodeDescription(data.description),
    icon: typeof data.icon === 'string' ? sanitizeText(data.icon).substring(0, 50) : data.icon,
  };
}

/**
 * Escape HTML entities for safe display in text context
 */
export function escapeHtml(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}
