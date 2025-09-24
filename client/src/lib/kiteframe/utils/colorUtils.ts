/**
 * Color utility functions for luminance calculation and contrast optimization
 * Implements W3C WCAG contrast ratio algorithms
 */

export interface ColorContrast {
  calculateLuminance: (color: string) => number;
  getContrastRatio: (color1: string, color2: string) => number;
  getOptimalTextColor: (backgroundColor: string) => string;
  isLightColor: (color: string) => boolean;
}

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Handle 3-character hex codes
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate relative luminance of a color according to WCAG guidelines
 * Formula: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function calculateLuminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0;

  // Normalize RGB values (0-255) to (0-1)
  const { r, g, b } = rgb;
  
  // Apply gamma correction
  const getRGBForLuminance = (val: number): number => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };

  const rLum = getRGBForLuminance(r);
  const gLum = getRGBForLuminance(g);
  const bLum = getRGBForLuminance(b);

  // Calculate luminance using WCAG formula
  return 0.2126 * rLum + 0.7152 * gLum + 0.0722 * bLum;
}

/**
 * Calculate contrast ratio between two colors
 * Formula: (L1 + 0.05) / (L2 + 0.05), where L1 is lighter and L2 is darker
 */
export function getContrastRatio(color1: string, color2: string): number {
  const luminance1 = calculateLuminance(color1);
  const luminance2 = calculateLuminance(color2);
  
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine if a color is considered "light" based on luminance
 */
export function isLightColor(color: string): boolean {
  return calculateLuminance(color) > 0.5;
}

/**
 * Get optimal text color (black or white) for given background color
 * Returns black for light backgrounds, white for dark backgrounds
 */
export function getOptimalTextColor(backgroundColor: string): string {
  const whiteContrast = getContrastRatio('#ffffff', backgroundColor);
  const blackContrast = getContrastRatio('#000000', backgroundColor);
  
  // Return color with higher contrast ratio
  return whiteContrast > blackContrast ? '#ffffff' : '#000000';
}

/**
 * Generate a palette of complementary colors based on a base color
 */
export function generateColorPalette(baseColor: string): {
  primary: string[];
  secondary: string[];
  accent: string[];
  neutral: string[];
} {
  // Convert to HSL for better color manipulation
  const rgb = hexToRgb(baseColor);
  if (!rgb) {
    return {
      primary: ['#3b82f6', '#1d4ed8', '#1e40af'],
      secondary: ['#64748b', '#475569', '#334155'],
      accent: ['#f59e0b', '#d97706', '#b45309'],
      neutral: ['#f8fafc', '#f1f5f9', '#e2e8f0']
    };
  }

  // Simple palette generation - in a real app you'd want more sophisticated color theory
  const primary = [baseColor];
  const secondary = ['#64748b', '#475569', '#334155'];
  const accent = ['#f59e0b', '#d97706', '#b45309'];
  const neutral = ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8'];

  return { primary, secondary, accent, neutral };
}

/**
 * Default color contrast utility implementation
 */
export const colorContrast: ColorContrast = {
  calculateLuminance,
  getContrastRatio,
  getOptimalTextColor,
  isLightColor
};

/**
 * Check if a color is pure black (#000000, rgb(0,0,0), black)
 */
export function isPureBlack(color: string): boolean {
  if (!color) return false;
  
  const normalized = color.toLowerCase().trim();
  
  // Direct matches for common black formats
  if (normalized === '#000000' || normalized === '#000' || normalized === 'black') {
    return true;
  }
  
  // RGB format check
  if (normalized.startsWith('rgb(')) {
    const match = normalized.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      const [, r, g, b] = match;
      return r === '0' && g === '0' && b === '0';
    }
  }
  
  // RGBA format check
  if (normalized.startsWith('rgba(')) {
    const match = normalized.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/);
    if (match) {
      const [, r, g, b] = match;
      return r === '0' && g === '0' && b === '0';
    }
  }
  
  // HSL format check for black
  if (normalized.startsWith('hsl(')) {
    const match = normalized.match(/hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*\)/);
    if (match) {
      const lightness = parseFloat(match[1]);
      return lightness === 0;
    }
  }
  
  return false;
}

/**
 * Check if a color is pure white (#ffffff, rgb(255,255,255), white)
 */
export function isPureWhite(color: string): boolean {
  if (!color) return false;
  
  const normalized = color.toLowerCase().trim();
  
  // Direct matches for common white formats
  if (normalized === '#ffffff' || normalized === '#fff' || normalized === 'white') {
    return true;
  }
  
  // RGB format check
  if (normalized.startsWith('rgb(')) {
    const match = normalized.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      const [, r, g, b] = match;
      return r === '255' && g === '255' && b === '255';
    }
  }
  
  // RGBA format check
  if (normalized.startsWith('rgba(')) {
    const match = normalized.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/);
    if (match) {
      const [, r, g, b] = match;
      return r === '255' && g === '255' && b === '255';
    }
  }
  
  // HSL format check for white
  if (normalized.startsWith('hsl(')) {
    const match = normalized.match(/hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*\)/);
    if (match) {
      const lightness = parseFloat(match[1]);
      return lightness === 100;
    }
  }
  
  return false;
}

/**
 * Get theme-appropriate default text color based on current theme
 */
export function getThemeAwareDefaultTextColor(): string {
  const isDarkMode = document.documentElement.classList.contains('dark');
  return isDarkMode ? '#ffffff' : '#000000';
}

/**
 * Get the opposite color for theme switching (black->white, white->black)
 */
export function getOppositeTextColor(color: string): string {
  if (isPureBlack(color)) return '#ffffff';
  if (isPureWhite(color)) return '#000000';
  return color; // Return unchanged if not pure black/white
}

/**
 * Common preset colors organized by category
 */
export const colorPresets = {
  primary: ['#3b82f6', '#1d4ed8', '#1e40af', '#2563eb'],
  success: ['#22c55e', '#16a34a', '#15803d', '#166534'],
  warning: ['#f59e0b', '#d97706', '#b45309', '#92400e'],
  danger: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
  neutral: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'],
  purple: ['#a855f7', '#9333ea', '#7c3aed', '#6d28d9'],
  pink: ['#ec4899', '#db2777', '#be185d', '#9d174d'],
  cyan: ['#06b6d4', '#0891b2', '#0e7490', '#155e75']
};