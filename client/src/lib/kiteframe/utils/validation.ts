import { z } from 'zod';

// Color validation schemas
const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const rgbColorRegex = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
const rgbaColorRegex = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0?\.\d+|1(\.0)?)\s*\)$/;
const hslColorRegex = /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/;
const hslaColorRegex = /^hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*(0?\.\d+|1(\.0)?)\s*\)$/;

// Predefined safe color names
const safeColorNames = [
  'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 
  'cyan', 'magenta', 'gray', 'grey', 'orange', 'purple', 'brown'
];

export const colorSchema = z.string().refine((value) => {
  // Check for safe color names
  if (safeColorNames.includes(value.toLowerCase())) return true;
  
  // Check for hex colors
  if (hexColorRegex.test(value)) return true;
  
  // Check for rgb/rgba colors
  if (rgbColorRegex.test(value) || rgbaColorRegex.test(value)) {
    const matches = value.match(/\d+/g);
    if (matches) {
      const values = matches.slice(0, 3).map(Number);
      return values.every(v => v >= 0 && v <= 255);
    }
  }
  
  // Check for hsl/hsla colors
  if (hslColorRegex.test(value) || hslaColorRegex.test(value)) {
    const matches = value.match(/\d+/g);
    if (matches) {
      const [h, s, l] = matches.slice(0, 3).map(Number);
      return h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
    }
  }
  
  return false;
}, {
  message: 'Invalid color format. Use hex (#RGB or #RRGGBB), rgb(), rgba(), hsl(), hsla(), or a safe color name.'
});

// Text content validation - prevents script injection
export const safeTextSchema = z.string()
  .transform((val) => {
    // Remove any script tags or event handlers
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '');
  })
  .refine((val) => {
    // Check for remaining dangerous patterns
    return !/<script/i.test(val) && 
           !/javascript:/i.test(val) && 
           !/on\w+\s*=/i.test(val);
  }, {
    message: 'Text contains potentially unsafe content'
  });

// SVG attribute validation
export const svgAttributeSchema = z.object({
  stroke: colorSchema.optional(),
  strokeWidth: z.number().min(0).max(20).optional(),
  strokeDasharray: z.string().regex(/^[\d\s,\.]+$/).optional(),
  fill: colorSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
});

// Node data validation
export const nodeDataSchema = z.object({
  label: safeTextSchema,
  description: safeTextSchema.optional(),
  icon: z.string().regex(/^[A-Za-z0-9]+$/).optional(), // Only alphanumeric icon names
  iconColor: colorSchema.optional(),
  style: z.object({
    headerBackground: colorSchema.optional(),
    headerTextColor: colorSchema.optional(),
    bodyBackground: colorSchema.optional(),
    bodyTextColor: colorSchema.optional(),
    borderColor: colorSchema.optional(),
  }).optional(),
});

// Edge data validation
export const edgeDataSchema = z.object({
  label: safeTextSchema.optional(),
  animated: z.boolean().optional(),
  stroke: colorSchema.optional(),
  strokeWidth: z.number().min(0).max(20).optional(),
  strokeDasharray: z.string().regex(/^[\d\s,\.]+$/).optional(),
  markerEnd: z.enum(['arrow', 'arrowclosed', 'none']).optional(),
  markerStart: z.enum(['arrow', 'arrowclosed', 'none']).optional(),
});

// Workflow validation
export const workflowNameSchema = z.string()
  .max(100)
  .transform((val) => sanitizeText(val));
export const workflowDescriptionSchema = z.string()
  .max(500)
  .transform((val) => sanitizeText(val));

// Validation utilities
export function validateColor(color: string): boolean {
  try {
    colorSchema.parse(color);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeText(text: string): string {
  try {
    return safeTextSchema.parse(text);
  } catch {
    // Return empty string if validation fails
    return '';
  }
}

export function validateNodeData(data: any): any {
  try {
    return nodeDataSchema.parse(data);
  } catch (error) {
    console.warn('Invalid node data:', error);
    // Return safe defaults
    return {
      label: 'Node',
      description: '',
    };
  }
}

export function validateEdgeData(data: any): any {
  try {
    return edgeDataSchema.parse(data);
  } catch (error) {
    console.warn('Invalid edge data:', error);
    // Return safe defaults
    return {};
  }
}