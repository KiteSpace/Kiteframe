import { TextNodeData, StickyNoteData, ShapeNodeData } from '../types';
import { getThemeAwareDefaultTextColor } from '../utils/colorUtils';

/**
 * Feature flags for KiteFrame functionality
 */
export const DISABLE_SHAPE_TEXT = true;

/**
 * Centralized default values for all KiteFrame object types
 * These defaults provide consistent baseline values for reset functionality
 */


/**
 * Get theme-aware default values for TextNodeData objects
 * Returns appropriate text color based on current theme (dark/light mode)
 */
export function getDefaultTextNodeData(): TextNodeData {
  return {
    label: 'Text',
    text: 'Click to add text',
    // Typography styling
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    textDecoration: 'none',
    textTransform: 'none',
    lineHeight: 1.4,
    letterSpacing: 0,
    // Color styling - theme-aware
    textColor: getThemeAwareDefaultTextColor(),
    backgroundColor: 'transparent',
    // Border styling
    borderColor: '#e2e8f0',
    borderWidth: 0,
    borderStyle: 'solid',
    borderRadius: 4,
    // Effects
    opacity: 1,
    shadow: {
      enabled: false,
      color: '#000000',
      blur: 4,
      offsetX: 0,
      offsetY: 2
    },
    // Padding
    padding: {
      top: 8,
      right: 12,
      bottom: 8,
      left: 12
    }
  };
}

// Legacy constant for backward compatibility (static black color)
// Use getDefaultTextNodeData() for theme-aware defaults
export const DEFAULT_TEXT_NODE_DATA: TextNodeData = {
  label: 'Text',
  text: 'Click to add text',
  // Typography styling
  fontSize: 16,
  fontFamily: 'Inter',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  textDecoration: 'none',
  textTransform: 'none',
  lineHeight: 1.4,
  letterSpacing: 0,
  // Color styling
  textColor: '#000000', // Static black - use getDefaultTextNodeData() for theme-aware
  backgroundColor: 'transparent',
  // Border styling
  borderColor: '#e2e8f0',
  borderWidth: 0,
  borderStyle: 'solid',
  borderRadius: 4,
  // Effects
  opacity: 1,
  shadow: {
    enabled: false,
    color: '#000000',
    blur: 4,
    offsetX: 0,
    offsetY: 2
  },
  // Padding
  padding: {
    top: 8,
    right: 12,
    bottom: 8,
    left: 12
  }
};

// Default values for StickyNoteData objects
export const DEFAULT_STICKY_NOTE_DATA: StickyNoteData = {
  text: 'Add a note...',
  // Typography styling
  fontSize: 14,
  fontFamily: 'Inter',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  verticalAlign: 'top',
  textDecoration: 'none',
  lineHeight: 1.4,
  letterSpacing: 0,
  // Color styling
  backgroundColor: '#fef3c7', // Yellow sticky note color
  textColor: '#92400e', // Auto-calculated based on background
  autoTextColor: true,
  // Border styling
  borderColor: '#f59e0b',
  borderWidth: 0,
  borderStyle: 'solid',
  borderRadius: 4,
  // Effects
  opacity: 1,
  shadow: {
    enabled: true,
    color: '#00000020',
    blur: 8,
    offsetX: 0,
    offsetY: 4
  },
  // Padding
  padding: {
    top: 12,
    right: 16,
    bottom: 12,
    left: 16
  }
};

// Default values for ShapeNodeData objects
export const DEFAULT_SHAPE_NODE_DATA: ShapeNodeData = {
  shapeType: 'rectangle',
  // Fill styling
  fillColor: '#e5e7eb', // Light gray color
  fillOpacity: 0.7, // 70% opacity
  gradient: {
    enabled: false,
    type: 'linear',
    direction: 0,
    colors: [
      { color: '#e5e7eb', position: 0 },
      { color: '#d1d5db', position: 1 }
    ]
  },
  // Stroke/Border styling
  strokeColor: '#374151', // Dark gray color
  strokeWidth: 2,
  strokeOpacity: 1.0, // 100% opacity
  strokeStyle: 'solid',
  // Text content
  text: '',
  textColor: '#374151',
  fontSize: 14,
  fontFamily: 'Inter',
  fontWeight: 400,
  fontStyle: 'normal',
  textAlign: 'center',
  // Shape-specific styling
  borderRadius: 8, // For rectangles
  // General effects
  opacity: 1,
  shadow: {
    enabled: false,
    color: '#00000040',
    blur: 8,
    offsetX: 0,
    offsetY: 4
  },
  // Special properties for lines and arrows
  lineCap: 'round',
  arrowSize: 1
};

/**
 * Type-safe function to get default values for any object type
 */
export function getDefaults<T extends 'text' | 'sticky' | 'shape'>(
  objectType: T
): T extends 'text' ? TextNodeData 
  : T extends 'sticky' ? StickyNoteData 
  : T extends 'shape' ? ShapeNodeData 
  : never {
  switch (objectType) {
    case 'text':
      return DEFAULT_TEXT_NODE_DATA as any;
    case 'sticky':
      return DEFAULT_STICKY_NOTE_DATA as any;
    case 'shape':
      return DEFAULT_SHAPE_NODE_DATA as any;
    default:
      throw new Error(`Unknown object type: ${objectType}`);
  }
}

/**
 * Helper function to create a deep copy of default values
 * Useful for preventing mutations to the original defaults
 */
export function getDefaultsCopy<T extends 'text' | 'sticky' | 'shape'>(
  objectType: T
): T extends 'text' ? TextNodeData 
  : T extends 'sticky' ? StickyNoteData 
  : T extends 'shape' ? ShapeNodeData 
  : never {
  return JSON.parse(JSON.stringify(getDefaults(objectType)));
}

/**
 * Utility function to merge user data with defaults
 * Ensures all required properties are present while preserving user customizations
 */
export function mergeWithDefaults<T extends TextNodeData | StickyNoteData | ShapeNodeData>(
  userData: Partial<T>,
  defaults: T
): T {
  // Deep merge function that preserves nested objects
  function deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  
  return deepMerge(defaults, userData);
}

/**
 * Properties that should be preserved during resets for each object type
 * These are considered "identity" or "content" properties that define what the object is
 */
export const PRESERVED_PROPERTIES = {
  text: ['label', 'text'] as const,
  sticky: ['text'] as const,
  shape: ['shapeType', 'lineCap', 'arrowSize'] as const
} as const;

/**
 * Type-safe function to get styling properties for reset (excludes preserved properties)
 */
function getStylingProperties<T extends TextNodeData | StickyNoteData | ShapeNodeData>(
  data: T,
  objectType: 'text' | 'sticky' | 'shape'
): Partial<T> {
  const preservedKeys = PRESERVED_PROPERTIES[objectType];
  const result: Partial<T> = {};
  
  for (const key in data) {
    if (!preservedKeys.includes(key as any)) {
      result[key] = data[key];
    }
  }
  
  return result;
}

/**
 * Creates a partial reset that preserves identity/content properties while resetting styling
 * This maintains object identity and avoids unwanted overwrites
 */
export function createPartialReset<T extends TextNodeData | StickyNoteData | ShapeNodeData>(
  currentData: T,
  objectType: 'text' | 'sticky' | 'shape'
): Partial<T> {
  const defaults = getDefaults(objectType);
  const stylingDefaults = getStylingProperties(defaults, objectType);
  
  // Return only the styling properties from defaults, preserving current identity/content
  return stylingDefaults;
}

/**
 * Type-safe partial reset functions for each object type
 * These preserve content/identity while resetting only styling properties
 */
export const partialResetHelpers = {
  text: (currentData: TextNodeData): Partial<TextNodeData> => {
    return createPartialReset(currentData, 'text');
  },
  
  sticky: (currentData: StickyNoteData): Partial<StickyNoteData> => {
    return createPartialReset(currentData, 'sticky');
  },
  
  shape: (currentData: ShapeNodeData): Partial<ShapeNodeData> => {
    return createPartialReset(currentData, 'shape');
  }
};

/**
 * Enhanced merge function that properly handles identity preservation
 * Uses partial resets to avoid overwrites of identity properties
 */
export function mergeWithPartialReset<T extends TextNodeData | StickyNoteData | ShapeNodeData>(
  currentData: T,
  objectType: 'text' | 'sticky' | 'shape',
  customUpdates?: Partial<T>
): T {
  // Get the partial reset (styling only)
  const stylingReset = createPartialReset(currentData, objectType);
  
  // Merge current data with styling reset and any custom updates
  return {
    ...currentData,
    ...stylingReset,
    ...customUpdates
  };
}

/**
 * Validation helper to check if an object has all required properties
 */
export function validateObjectData<T extends TextNodeData | StickyNoteData | ShapeNodeData>(
  data: Partial<T>,
  defaults: T
): boolean {
  const requiredKeys = Object.keys(defaults);
  return requiredKeys.every(key => key in data);
}

// Export all defaults as a single object for convenience
export const KITEFRAME_DEFAULTS = {
  text: DEFAULT_TEXT_NODE_DATA,
  sticky: DEFAULT_STICKY_NOTE_DATA,
  shape: DEFAULT_SHAPE_NODE_DATA
} as const;