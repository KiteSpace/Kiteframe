/**
 * Font weight utilities for dynamic weight management
 */

// Export GOOGLE_FONTS data for use in other components
export const GOOGLE_FONTS = [
  { value: 'Inter', label: 'Inter', weight: '300;400;500;600;700' },
  { value: 'Roboto', label: 'Roboto', weight: '300;400;500;700' },
  { value: 'Open Sans', label: 'Open Sans', weight: '300;400;600;700' },
  { value: 'Lato', label: 'Lato', weight: '300;400;700' },
  { value: 'Montserrat', label: 'Montserrat', weight: '300;400;500;600;700' },
  { value: 'Poppins', label: 'Poppins', weight: '300;400;500;600;700' },
  { value: 'Playfair Display', label: 'Playfair Display', weight: '400;500;600;700' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro', weight: '300;400;600;700' },
  { value: 'Arial', label: 'Arial', weight: '' },
  { value: 'Georgia', label: 'Georgia', weight: '' },
  { value: 'Times New Roman', label: 'Times New Roman', weight: '' },
  { value: 'Courier New', label: 'Courier New', weight: '' },
  { value: 'Verdana', label: 'Verdana', weight: '' },
  { value: 'Helvetica', label: 'Helvetica', weight: '' }
];

// System fonts that don't have specific weight definitions
const SYSTEM_FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Helvetica'];

// Default weights for system fonts
const DEFAULT_SYSTEM_WEIGHTS = ['400', '700'];

// Map numeric weights to labels
export const WEIGHT_LABELS: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra Light',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semibold',
  '700': 'Bold',
  '800': 'Extra Bold',
  '900': 'Black'
};

// Map CSS weight names to numeric values
export const CSS_WEIGHT_TO_NUMERIC: Record<string, string> = {
  'normal': '400',
  'medium': '500',
  'semibold': '600',
  'bold': '700',
  'extrabold': '800'
};

// Map numeric values back to CSS names for backward compatibility
export const NUMERIC_TO_CSS_WEIGHT: Record<string, string> = {
  '400': 'normal',
  '500': 'medium',
  '600': 'semibold',
  '700': 'bold',
  '800': 'extrabold'
};

/**
 * Parse available weights from font metadata
 */
export function parseAvailableWeights(fontFamily: string): string[] {
  const font = GOOGLE_FONTS.find(f => f.value === fontFamily);
  
  if (!font || !font.weight || SYSTEM_FONTS.includes(fontFamily)) {
    // Return default weights for system fonts or fonts without weight data
    return DEFAULT_SYSTEM_WEIGHTS;
  }
  
  return font.weight.split(';').filter(weight => weight.trim() !== '');
}

/**
 * Get available weight options for dropdowns
 */
export function getAvailableWeightOptions(fontFamily: string): Array<{ value: string; label: string }> {
  const availableWeights = parseAvailableWeights(fontFamily);
  
  return availableWeights.map(weight => ({
    value: NUMERIC_TO_CSS_WEIGHT[weight] || weight,
    label: WEIGHT_LABELS[weight] || `Weight ${weight}`
  }));
}

/**
 * Find the closest available weight when current weight is not available
 * Prefers 400 (Regular), then finds the nearest available weight
 */
export function findFallbackWeight(
  currentWeight: string, 
  fontFamily: string
): string {
  const availableWeights = parseAvailableWeights(fontFamily);
  
  // Convert current weight to numeric if it's a CSS name
  const currentNumeric = CSS_WEIGHT_TO_NUMERIC[currentWeight] || currentWeight;
  
  // If current weight is available, return it
  if (availableWeights.includes(currentNumeric)) {
    return currentWeight;
  }
  
  // Prefer 400 (Regular) if available
  if (availableWeights.includes('400')) {
    return NUMERIC_TO_CSS_WEIGHT['400'] || '400';
  }
  
  // Find the nearest available weight
  const currentNumericValue = parseInt(currentNumeric);
  let closestWeight = availableWeights[0];
  let closestDifference = Math.abs(parseInt(availableWeights[0]) - currentNumericValue);
  
  for (const weight of availableWeights) {
    const difference = Math.abs(parseInt(weight) - currentNumericValue);
    if (difference < closestDifference) {
      closestWeight = weight;
      closestDifference = difference;
    }
  }
  
  return NUMERIC_TO_CSS_WEIGHT[closestWeight] || closestWeight;
}

/**
 * Check if a weight is available for a given font
 */
export function isWeightAvailable(weight: string, fontFamily: string): boolean {
  const availableWeights = parseAvailableWeights(fontFamily);
  const numericWeight = CSS_WEIGHT_TO_NUMERIC[weight] || weight;
  return availableWeights.includes(numericWeight);
}

/**
 * Convert font weight to numeric CSS value
 * Accepts both CSS weight names ('normal', 'bold', etc.) and numeric strings ('400', '700', etc.)
 * Returns numeric value suitable for CSS font-weight property
 */
export function toNumericWeight(weight: string | number | undefined): number {
  if (weight === undefined || weight === null) {
    return 400; // Default to normal weight
  }
  
  const weightStr = String(weight);
  
  // If it's already numeric, return as number
  const numericValue = parseInt(weightStr);
  if (!isNaN(numericValue)) {
    return numericValue;
  }
  
  // Convert CSS weight name to numeric value
  const mappedWeight = CSS_WEIGHT_TO_NUMERIC[weightStr];
  if (mappedWeight) {
    return parseInt(mappedWeight);
  }
  
  // Handle any edge cases with specific weight names
  switch (weightStr.toLowerCase()) {
    case 'light':
      return 300;
    case 'normal':
    case 'regular':
      return 400;
    case 'medium':
      return 500;
    case 'semibold':
    case 'semi-bold':
      return 600;
    case 'bold':
      return 700;
    case 'extrabold':
    case 'extra-bold':
    case 'ultrabold':
      return 800;
    case 'black':
    case 'heavy':
      return 900;
    default:
      return 400; // Default fallback
  }
}

/**
 * Load Google Font with specific weights
 */
export function loadGoogleFont(fontFamily: string, weights?: string) {
  // Skip if it's a system font
  if (SYSTEM_FONTS.includes(fontFamily)) {
    return;
  }
  
  const font = GOOGLE_FONTS.find(f => f.value === fontFamily);
  const weightsToLoad = weights || font?.weight;
  
  if (!weightsToLoad || document.querySelector(`link[href*="${fontFamily.replace(/\s+/g, '+')}"]`)) {
    return; // Already loaded or no weights specified
  }
  
  const link = document.createElement('link');
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@${weightsToLoad}&display=swap`;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}