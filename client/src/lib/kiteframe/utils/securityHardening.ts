/**
 * Security Hardening System
 * Rate limiting, input validation, XSS prevention, and security monitoring
 */

import { z } from 'zod';
import { sanitizeText } from './validation';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier?: string;
}

export interface SecurityEvent {
  type: 'rate-limit' | 'xss-attempt' | 'validation-failure' | 'suspicious-activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  timestamp: number;
  blocked: boolean;
}

/**
 * Client-side Rate Limiter
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private blocked: Map<string, number> = new Map();
  
  constructor(private config: RateLimitConfig) {}
  
  /**
   * Check if operation is allowed
   */
  isAllowed(identifier?: string): boolean {
    const key = identifier || this.config.identifier || 'default';
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Clean old requests
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => time > windowStart);
    
    // Check if blocked
    if (this.blocked.has(key)) {
      const blockExpiry = this.blocked.get(key)!;
      if (blockExpiry && now < blockExpiry) {
        return false;
      }
      this.blocked.delete(key);
    }
    
    // Check rate limit
    if (validRequests.length >= this.config.maxRequests) {
      // Block for additional time
      this.blocked.set(key, now + this.config.windowMs);
      this.logSecurityEvent({
        type: 'rate-limit',
        severity: 'medium',
        details: { key, requests: validRequests.length },
        timestamp: now,
        blocked: true
      });
      return false;
    }
    
    // Record request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }
  
  /**
   * Reset limits for identifier
   */
  reset(identifier?: string) {
    const key = identifier || this.config.identifier || 'default';
    this.requests.delete(key);
    this.blocked.delete(key);
  }
  
  private logSecurityEvent(event: SecurityEvent) {
    console.warn('[Security]', event);
    // Could send to telemetry here
  }
}

/**
 * Enhanced Input Validation System
 */
export class InputValidator {
  private static instance: InputValidator | null = null;
  private suspiciousPatterns = [
    /<script[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /file:\/\//gi,
    /\.\.\//, // Path traversal
    /\${.*}/, // Template injection
    /{{.*}}/, // Template injection
  ];
  
  private sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi,
    /(--)|(\/\*[\s\S]*?\*\/)/g, // SQL comments
    /(';)|(";)/, // SQL injection attempts
  ];
  
  static getInstance(): InputValidator {
    if (!InputValidator.instance) {
      InputValidator.instance = new InputValidator();
    }
    return InputValidator.instance;
  }
  
  /**
   * Validate and sanitize user input
   */
  validateInput(input: any, schema?: z.ZodSchema): { valid: boolean; sanitized: any; errors?: string[] } {
    const errors: string[] = [];
    
    // Type validation
    if (schema) {
      try {
        const validated = schema.parse(input);
        input = validated;
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(...error.errors.map(e => e.message));
          return { valid: false, sanitized: null, errors };
        }
      }
    }
    
    // String sanitization
    if (typeof input === 'string') {
      // Check for suspicious patterns
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(input)) {
          this.logSecurityEvent({
            type: 'xss-attempt',
            severity: 'high',
            details: { pattern: pattern.toString(), input: input.substring(0, 100) },
            timestamp: Date.now(),
            blocked: true
          });
          errors.push('Input contains potentially malicious content');
          return { valid: false, sanitized: sanitizeText(input), errors };
        }
      }
      
      // Check for SQL patterns
      for (const pattern of this.sqlPatterns) {
        if (pattern.test(input)) {
          this.logSecurityEvent({
            type: 'suspicious-activity',
            severity: 'medium',
            details: { type: 'sql-pattern', input: input.substring(0, 100) },
            timestamp: Date.now(),
            blocked: false
          });
        }
      }
      
      // Sanitize
      input = sanitizeText(input);
    }
    
    // Object/Array deep validation
    if (typeof input === 'object' && input !== null) {
      input = this.deepSanitize(input);
    }
    
    return { valid: errors.length === 0, sanitized: input, errors };
  }
  
  /**
   * Deep sanitize objects and arrays
   */
  private deepSanitize(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Validate key
        const sanitizedKey = sanitizeText(key);
        if (sanitizedKey !== key) {
          this.logSecurityEvent({
            type: 'suspicious-activity',
            severity: 'low',
            details: { type: 'key-sanitization', original: key },
            timestamp: Date.now(),
            blocked: false
          });
        }
        
        // Recursively sanitize value
        if (typeof value === 'string') {
          sanitized[sanitizedKey] = sanitizeText(value);
        } else if (typeof value === 'object') {
          sanitized[sanitizedKey] = this.deepSanitize(value);
        } else {
          sanitized[sanitizedKey] = value;
        }
      }
      return sanitized;
    }
    
    return obj;
  }
  
  /**
   * Validate file uploads
   */
  validateFile(file: File, config: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'],
      allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg']
    } = config;
    
    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum of ${maxSize / 1024 / 1024}MB`);
    }
    
    // Check MIME type
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
      this.logSecurityEvent({
        type: 'validation-failure',
        severity: 'medium',
        details: { type: 'file-type', mime: file.type },
        timestamp: Date.now(),
        blocked: true
      });
    }
    
    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      errors.push(`File extension ${extension} is not allowed`);
    }
    
    // Check for double extensions (e.g., file.php.png)
    const parts = file.name.split('.');
    if (parts.length > 2) {
      const suspiciousExtensions = ['.php', '.js', '.exe', '.bat', '.sh'];
      for (let i = 0; i < parts.length - 1; i++) {
        if (suspiciousExtensions.includes('.' + parts[i].toLowerCase())) {
          errors.push('Suspicious file name detected');
          this.logSecurityEvent({
            type: 'suspicious-activity',
            severity: 'high',
            details: { type: 'double-extension', filename: file.name },
            timestamp: Date.now(),
            blocked: true
          });
          break;
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private logSecurityEvent(event: SecurityEvent) {
    console.warn('[Security]', event);
    // Send to telemetry if available
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('kiteframe:security-event', { detail: event }));
    }
  }
}

/**
 * Content Security Policy Helper
 */
export class CSPManager {
  private static instance: CSPManager | null = null;
  private nonce: string | null = null;
  private trustedTypes: any = null;
  
  private constructor() {
    this.initializeTrustedTypes();
  }
  
  static getInstance(): CSPManager {
    if (!CSPManager.instance) {
      CSPManager.instance = new CSPManager();
    }
    return CSPManager.instance;
  }
  
  private initializeTrustedTypes() {
    // Initialize Trusted Types if available
    if ('trustedTypes' in window && (window as any).trustedTypes.createPolicy) {
      try {
        this.trustedTypes = (window as any).trustedTypes.createPolicy('kiteframe', {
          createHTML: (html: string) => this.sanitizeHTML(html),
          createScript: (script: string) => this.sanitizeScript(script),
          createScriptURL: (url: string) => this.sanitizeURL(url)
        });
      } catch (error) {
        console.warn('Failed to create Trusted Types policy:', error);
      }
    }
  }
  
  /**
   * Sanitize HTML content
   */
  sanitizeHTML(html: string): string {
    // Remove dangerous elements and attributes
    const dangerous = /<(script|iframe|object|embed|form|input|button)/gi;
    html = html.replace(dangerous, '&lt;$1');
    
    // Remove event handlers
    html = html.replace(/on\w+\s*=/gi, 'data-blocked=');
    
    // Remove javascript: URLs
    html = html.replace(/javascript:/gi, 'blocked:');
    
    return html;
  }
  
  /**
   * Sanitize script content
   */
  sanitizeScript(script: string): string {
    // Block eval and similar
    if (/\b(eval|Function|setTimeout|setInterval)\s*\(/.test(script)) {
      console.warn('Blocked potentially dangerous script');
      return '';
    }
    return script;
  }
  
  /**
   * Sanitize URLs
   */
  sanitizeURL(url: string): string {
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerUrl = url.toLowerCase();
    
    for (const protocol of dangerousProtocols) {
      if (lowerUrl.startsWith(protocol)) {
        console.warn('Blocked dangerous URL protocol:', protocol);
        return 'about:blank';
      }
    }
    
    return url;
  }
  
  /**
   * Get or generate CSP nonce
   */
  getNonce(): string {
    if (!this.nonce) {
      // Try to get from meta tag
      const meta = document.querySelector('meta[property="csp-nonce"]');
      if (meta) {
        this.nonce = meta.getAttribute('content') || null;
      }
      
      // Generate if not found
      if (!this.nonce) {
        this.nonce = this.generateNonce();
      }
    }
    return this.nonce;
  }
  
  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(Array.from(array).map(b => String.fromCharCode(b)).join(''));
  }
}

/**
 * Security Monitor
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor | null = null;
  private events: SecurityEvent[] = [];
  private maxEvents = 1000;
  private callbacks: ((event: SecurityEvent) => void)[] = [];
  
  private constructor() {
    this.setupListeners();
  }
  
  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }
  
  private setupListeners() {
    // Listen for security events
    window.addEventListener('kiteframe:security-event', (event: any) => {
      this.recordEvent(event.detail);
    });
  }
  
  recordEvent(event: SecurityEvent) {
    this.events.push(event);
    
    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    
    // Notify callbacks
    this.callbacks.forEach(cb => cb(event));
    
    // Critical events
    if (event.severity === 'critical') {
      this.handleCriticalEvent(event);
    }
  }
  
  private handleCriticalEvent(event: SecurityEvent) {
    console.error('[CRITICAL SECURITY EVENT]', event);
    // Could trigger lockdown mode or alert administrators
  }
  
  getEvents(filter?: { type?: string; severity?: string; blocked?: boolean }): SecurityEvent[] {
    let events = [...this.events];
    
    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        events = events.filter(e => e.severity === filter.severity);
      }
      if (filter.blocked !== undefined) {
        events = events.filter(e => e.blocked === filter.blocked);
      }
    }
    
    return events;
  }
  
  onSecurityEvent(callback: (event: SecurityEvent) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }
  
  getStatistics() {
    const stats = {
      total: this.events.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      blocked: 0,
      allowed: 0
    };
    
    this.events.forEach(event => {
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      if (event.blocked) stats.blocked++;
      else stats.allowed++;
    });
    
    return stats;
  }
}

// Export singleton instances
export const inputValidator = InputValidator.getInstance();
export const cspManager = CSPManager.getInstance();
export const securityMonitor = SecurityMonitor.getInstance();

// Rate limiter factory
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

// React hooks
export function useRateLimiter(config: RateLimitConfig) {
  const limiter = React.useRef(new RateLimiter(config));
  
  return {
    isAllowed: (identifier?: string) => limiter.current.isAllowed(identifier),
    reset: (identifier?: string) => limiter.current.reset(identifier)
  };
}

export function useSecurityMonitor() {
  const [events, setEvents] = React.useState<SecurityEvent[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  
  React.useEffect(() => {
    const updateStats = () => {
      setEvents(securityMonitor.getEvents());
      setStats(securityMonitor.getStatistics());
    };
    
    const unsubscribe = securityMonitor.onSecurityEvent(updateStats);
    updateStats();
    
    return unsubscribe;
  }, []);
  
  return { events, stats };
}

export function useInputValidator() {
  return {
    validate: (input: any, schema?: z.ZodSchema) => inputValidator.validateInput(input, schema),
    validateFile: (file: File, config?: any) => inputValidator.validateFile(file, config),
    sanitizeHTML: (html: string) => cspManager.sanitizeHTML(html),
    sanitizeURL: (url: string) => cspManager.sanitizeURL(url)
  };
}

import React from 'react';