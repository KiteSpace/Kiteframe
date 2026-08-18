import type { Request } from "express";
import { analyticsService } from "./analyticsService";

export interface GeolocationResult {
  country: string;
  ip: string;
  source: 'cloudflare' | 'api' | 'localhost' | 'cache' | 'unknown';
}

interface RegionCheckResult {
  allowed: boolean;
  country: string;
  source: string;
  reason?: string;
}

export class GeolocationService {
  private apiKey: string;
  private cache: Map<string, { result: GeolocationResult; timestamp: number }>;
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.apiKey = process.env.IPINFO_API_KEY || '';
    this.cache = new Map();
  }

  private isPrivateIP(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip === 'localhost' ||
      ip === '::1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') ||
      ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') ||
      ip.startsWith('172.2') ||
      ip.startsWith('172.3') ||
      ip.startsWith('fc00:') ||
      ip.startsWith('fd00:')
    );
  }

  getUserIP(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      const clientIP = ips.split(',')[0].trim();
      
      // Validate it's not a private IP (could be spoofed)
      if (!this.isPrivateIP(clientIP)) {
        return clientIP;
      }
    }
    
    const realIP = req.headers['x-real-ip'];
    if (realIP && typeof realIP === 'string' && !this.isPrivateIP(realIP)) {
      return realIP;
    }
    
    return req.socket.remoteAddress || req.ip || '127.0.0.1';
  }

  async getCountryCode(req: Request): Promise<GeolocationResult> {
    // Method 1: Use Cloudflare's cf-ipcountry header (most reliable on Replit)
    const cfCountry = req.headers['cf-ipcountry'];
    if (cfCountry && typeof cfCountry === 'string' && cfCountry !== 'XX') {
      console.log(`🌍 Region check: ${cfCountry} (Cloudflare header)`);
      return {
        country: cfCountry,
        ip: this.getUserIP(req),
        source: 'cloudflare'
      };
    }

    // Method 2: Check if it's a local/private IP
    const ip = this.getUserIP(req);
    if (this.isPrivateIP(ip)) {
      console.log(`🏠 Region check: US (localhost/private IP: ${ip})`);
      return {
        country: 'US',
        ip,
        source: 'localhost'
      };
    }

    // Method 3: Check cache
    const cached = this.cache.get(ip);
    if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
      console.log(`💾 Region check: ${cached.result.country} (cache)`);
      return { ...cached.result, source: 'cache' };
    }

    // Method 4: Fallback to IPinfo API
    try {
      const token = this.apiKey ? `?token=${this.apiKey}` : '';
      const response = await fetch(`https://ipinfo.io/${ip}/json${token}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`⚠️ IPinfo API error: ${response.status}`);
        throw new Error(`API returned ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('⚠️ IPinfo returned non-JSON response');
        throw new Error('Invalid API response format');
      }

      const data = await response.json();
      const country = data.country || 'UNKNOWN';
      
      const result: GeolocationResult = {
        country,
        ip,
        source: 'api'
      };
      
      this.cache.set(ip, {
        result,
        timestamp: Date.now()
      });
      
      console.log(`🌐 Region check: ${country} (IPinfo API)`);
      return result;
    } catch (error) {
      console.error('❌ Geolocation API failed:', error);
      throw error;
    }
  }

  async checkRegion(req: Request): Promise<RegionCheckResult> {
    try {
      const result = await this.getCountryCode(req);
      const isUS = result.country === 'US';
      
      const userIdentifier = this.getUserIP(req);
      analyticsService.trackGeolocationCheck(userIdentifier, result.country, result.source).catch(console.error);
      
      return {
        allowed: isUS,
        country: result.country,
        source: result.source,
        reason: isUS ? 'US access granted' : 'Non-US location detected'
      };
    } catch (error) {
      // Fail-open: Allow access when geolocation check fails
      // This prevents legitimate US users from being blocked by API issues
      console.error('⚠️ Region check failed, allowing access (fail-open):', error);
      return {
        allowed: true,
        country: 'UNKNOWN',
        source: 'unknown',
        reason: 'Geolocation verification failed - access granted (fail-open)'
      };
    }
  }
}

export const geolocationService = new GeolocationService();
