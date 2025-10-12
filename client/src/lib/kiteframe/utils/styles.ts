import { CSSProperties } from 'react';

/**
 * CSP-compliant style management utilities
 * These utilities help create CSS classes instead of inline styles
 * to comply with strict Content Security Policy requirements
 */

// Style registry for dynamic styles
class StyleRegistry {
  private styles = new Map<string, string>();
  private styleElement: HTMLStyleElement | null = null;
  private styleCache = new Map<string, string>();
  private maxCacheSize = 1000; // Prevent unbounded growth
  
  constructor() {
    if (typeof document !== 'undefined') {
      this.styleElement = document.createElement('style');
      this.styleElement.setAttribute('data-kiteframe-styles', 'true');
      
      // Apply CSP nonce if available
      const nonce = this.getCSPNonce();
      if (nonce) {
        this.styleElement.setAttribute('nonce', nonce);
      }
      
      document.head.appendChild(this.styleElement);
    }
  }

  /**
   * Get CSP nonce from meta tag or global variable
   */
  private getCSPNonce(): string | null {
    // Check for meta tag first
    const metaTag = document.querySelector('meta[name="csp-nonce"]');
    if (metaTag && metaTag.getAttribute('content')) {
      return metaTag.getAttribute('content');
    }
    
    // Check for global variable
    if (typeof window !== 'undefined' && (window as any).__CSP_NONCE__) {
      return (window as any).__CSP_NONCE__;
    }
    
    return null;
  }

  /**
   * Register a dynamic style and return a class name
   */
  registerStyle(key: string, styles: CSSProperties): string {
    const className = `kf-${key}`;
    
    // Check cache first
    if (this.styleCache.has(key)) {
      return className;
    }
    
    const cssText = this.cssPropertiesToString(styles);
    
    if (!this.styles.has(key) || this.styles.get(key) !== cssText) {
      this.styles.set(key, cssText);
      this.styleCache.set(key, className);
      
      // Prevent unbounded cache growth
      if (this.styleCache.size > this.maxCacheSize) {
        const firstKey = this.styleCache.keys().next().value;
        if (firstKey) {
          this.styleCache.delete(firstKey);
          this.styles.delete(firstKey);
        }
      }
      
      this.updateStylesheet();
    }
    
    return className;
  }

  /**
   * Convert CSSProperties to CSS string
   */
  private cssPropertiesToString(styles: CSSProperties): string {
    return Object.entries(styles)
      .map(([key, value]) => {
        const cssKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        // Add !important to border-color to override Tailwind defaults
        const important = cssKey === 'border-color' ? ' !important' : '';
        return `${cssKey}: ${value}${important}`;
      })
      .join('; ');
  }

  /**
   * Update the stylesheet with all registered styles
   */
  private updateStylesheet() {
    if (!this.styleElement) return;
    
    const cssRules = Array.from(this.styles.entries())
      .map(([key, styles]) => `.kf-${key} { ${styles} }`)
      .join('\n');
    
    this.styleElement.textContent = cssRules;
  }

  /**
   * Clear all registered styles
   */
  clear() {
    this.styles.clear();
    this.styleCache.clear();
    if (this.styleElement) {
      this.styleElement.textContent = '';
    }
  }

  /**
   * Remove the style element from DOM
   */
  destroy() {
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
    this.styleElement = null;
    this.styles.clear();
    this.styleCache.clear();
  }
}

// Global style registry instance
export const styleRegistry = new StyleRegistry();

/**
 * Create a hash from style properties for consistent class naming
 */
export function createStyleHash(styles: CSSProperties): string {
  const str = JSON.stringify(styles);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get or create a class name for dynamic styles
 */
export function getDynamicClassName(styles: CSSProperties, prefix = 'dynamic'): string {
  const hash = createStyleHash(styles);
  const key = `${prefix}-${hash}`;
  return styleRegistry.registerStyle(key, styles);
}

/**
 * Create CSS variable declarations from an object
 */
export function createCSSVariables(variables: Record<string, string | number>, prefix = 'kf'): Record<string, string | number> {
  const cssVars: Record<string, string | number> = {};
  
  Object.entries(variables).forEach(([key, value]) => {
    const varName = `--${prefix}-${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`;
    cssVars[varName] = value;
  });
  
  return cssVars;
}

/**
 * Node style utilities
 */
export function getNodeStyleClasses(colors: {
  headerBackground?: string;
  bodyBackground?: string;
  borderColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
}): {
  headerClass: string;
  bodyClass: string;
  borderClass: string;
} {
  const headerClass = getDynamicClassName({
    backgroundColor: colors.headerBackground || '#f8fafc',
    color: colors.headerTextColor || '#1e293b'
  }, 'node-header');

  const bodyClass = getDynamicClassName({
    backgroundColor: colors.bodyBackground || '#ffffff',
    color: colors.bodyTextColor || '#64748b'
  }, 'node-body');

  const borderClass = getDynamicClassName({
    borderColor: colors.borderColor || '#e2e8f0'
  }, 'node-border');

  return { headerClass, bodyClass, borderClass };
}

/**
 * Edge style utilities
 */
export function getEdgeStyleClasses(style: {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}): string {
  return getDynamicClassName({
    stroke: style.stroke || '#6b7280',
    strokeWidth: style.strokeWidth || 2,
    strokeDasharray: style.strokeDasharray || 'none'
  }, 'edge');
}

/**
 * Position style utilities for absolute positioning
 */
export function getPositionClasses(position: { x: number; y: number }, size?: { width?: number; height?: number }): string {
  const styles: CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`
  };

  if (size?.width) {
    styles.width = `${size.width}px`;
  }
  if (size?.height) {
    styles.height = `${size.height}px`;
  }

  return getDynamicClassName(styles, 'position');
}

/**
 * Create data attributes for styling instead of inline styles
 */
export function createStyleDataAttributes(styles: {
  background?: string;
  color?: string;
  borderColor?: string;
  width?: number;
  height?: number;
}): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  if (styles.background) attrs['data-bg'] = styles.background;
  if (styles.color) attrs['data-color'] = styles.color;
  if (styles.borderColor) attrs['data-border'] = styles.borderColor;
  if (styles.width) attrs['data-width'] = styles.width.toString();
  if (styles.height) attrs['data-height'] = styles.height.toString();
  
  return attrs;
}

/**
 * Clean up style registry on unmount
 */
export function cleanupStyles() {
  styleRegistry.clear();
}