import sanitizeHtml from 'sanitize-html';

// Strict sanitization options for user content
const strictOptions: sanitizeHtml.IOptions = {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  selfClosing: [],
  allowedSchemes: [],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [],
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  parseStyleAttributes: false
};

// Relaxed options for descriptions that might need basic formatting
const relaxedOptions: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'br'],
  allowedAttributes: {},
  disallowedTagsMode: 'discard'
};

/**
 * Sanitize a plain text string - removes ALL HTML
 */
export function sanitizeText(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';
  return sanitizeHtml(input, strictOptions).trim();
}

/**
 * Sanitize a string that may contain basic formatting
 */
export function sanitizeRichText(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';
  return sanitizeHtml(input, relaxedOptions).trim();
}

/**
 * Sanitize node label - strict, no HTML allowed
 */
export function sanitizeNodeLabel(label: string | undefined | null): string {
  const sanitized = sanitizeText(label);
  // Limit length to prevent abuse
  return sanitized.substring(0, 500);
}

/**
 * Sanitize node description
 */
export function sanitizeNodeDescription(description: string | undefined | null): string {
  const sanitized = sanitizeRichText(description);
  return sanitized.substring(0, 2000);
}

/**
 * Sanitize AI prompt - prevent injection attacks
 */
export function sanitizeAiPrompt(prompt: string | undefined | null): string {
  if (!prompt || typeof prompt !== 'string') return '';
  
  // Remove any attempts at prompt injection
  let cleaned = prompt
    // Remove common injection patterns
    .replace(/ignore\s+(all\s+)?previous\s+(instructions?|prompts?)/gi, '')
    .replace(/disregard\s+(all\s+)?previous/gi, '')
    .replace(/you\s+are\s+now\s+/gi, '')
    .replace(/act\s+as\s+if\s+you/gi, '')
    .replace(/pretend\s+you\s+are/gi, '')
    // Remove code fence attempts that might try to escape context
    .replace(/```[\s\S]*?```/g, '[code block removed]')
    // Remove potential script tags
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Sanitize remaining HTML
  cleaned = sanitizeText(cleaned);
  
  // Limit length
  return cleaned.substring(0, 10000);
}

/**
 * Sanitize AI response before storing/rendering
 */
export function sanitizeAiResponse(response: string | undefined | null): string {
  if (!response || typeof response !== 'string') return '';
  
  // Keep the response mostly intact but remove dangerous HTML
  return sanitizeHtml(response, {
    allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre'],
    allowedAttributes: {
      'code': ['class']
    },
    disallowedTagsMode: 'discard'
  });
}

/**
 * Sanitize URL - only allow safe protocols
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Only allow http, https protocols
  if (!/^https?:\/\//i.test(trimmed)) {
    // If no protocol, assume https
    if (!/^[a-z]+:\/\//i.test(trimmed) && trimmed.length > 0) {
      return `https://${trimmed}`;
    }
    return '';
  }
  
  return trimmed.substring(0, 2000);
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
  
  // Valid CSS color names (common ones)
  const validColors = [
    'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange',
    'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'lime', 'navy',
    'teal', 'olive', 'maroon', 'aqua', 'fuchsia', 'silver'
  ];
  
  if (validColors.includes(trimmed.toLowerCase())) {
    return trimmed.toLowerCase();
  }
  
  return '';
}

/**
 * Sanitize workflow node data
 */
export function sanitizeNodeData(data: any): any {
  if (!data || typeof data !== 'object') return {};
  
  return {
    ...data,
    label: sanitizeNodeLabel(data.label),
    description: sanitizeNodeDescription(data.description),
    // Preserve other fields but sanitize strings
    icon: typeof data.icon === 'string' ? sanitizeText(data.icon).substring(0, 50) : data.icon,
    iconColor: sanitizeColor(data.iconColor) || data.iconColor,
  };
}

/**
 * Sanitize workflow edge data
 */
export function sanitizeEdgeData(edge: any): any {
  if (!edge || typeof edge !== 'object') return edge;
  
  return {
    ...edge,
    label: edge.label ? sanitizeNodeLabel(edge.label) : edge.label,
    style: edge.style ? {
      ...edge.style,
      strokeColor: sanitizeColor(edge.style.strokeColor) || edge.style.strokeColor,
    } : edge.style,
  };
}

/**
 * Sanitize entire workflow content
 */
export function sanitizeWorkflowContent(workflow: any): any {
  if (!workflow || typeof workflow !== 'object') return workflow;
  
  const sanitized = { ...workflow };
  
  // Sanitize nodes
  if (Array.isArray(sanitized.nodes)) {
    sanitized.nodes = sanitized.nodes.map((node: any) => ({
      ...node,
      data: sanitizeNodeData(node.data),
    }));
  }
  
  // Sanitize edges
  if (Array.isArray(sanitized.edges)) {
    sanitized.edges = sanitized.edges.map(sanitizeEdgeData);
  }
  
  // Sanitize metadata
  if (sanitized.metadata) {
    sanitized.metadata = {
      ...sanitized.metadata,
      name: sanitizeText(sanitized.metadata.name)?.substring(0, 200),
      description: sanitizeNodeDescription(sanitized.metadata.description),
    };
  }
  
  return sanitized;
}
