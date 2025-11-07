import type { Request } from "express";

export interface GeolocationResult {
  country: string;
  ip: string;
}

export class GeolocationService {
  private apiKey: string;
  private cache: Map<string, GeolocationResult>;
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.apiKey = process.env.IPINFO_API_KEY || '';
    this.cache = new Map();
  }

  getUserIP(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }
    return req.socket.remoteAddress || req.ip || '127.0.0.1';
  }

  async getCountryCode(ip: string): Promise<string> {
    if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return 'US';
    }

    const cached = this.cache.get(ip);
    if (cached) {
      return cached.country;
    }

    try {
      const token = this.apiKey ? `?token=${this.apiKey}` : '';
      const response = await fetch(`https://ipinfo.io/${ip}${token}`);
      
      if (!response.ok) {
        console.error(`Geolocation API error: ${response.status}`);
        throw new Error('Could not verify location');
      }

      const data = await response.json();
      const country = data.country || 'UNKNOWN';
      
      this.cache.set(ip, { country, ip });
      
      setTimeout(() => {
        this.cache.delete(ip);
      }, this.cacheExpiry);

      return country;
    } catch (error) {
      console.error('Geolocation error:', error);
      throw new Error('Could not verify location');
    }
  }

  async isUSOnly(req: Request): Promise<boolean> {
    const ip = this.getUserIP(req);
    const country = await this.getCountryCode(ip);
    return country === 'US';
  }
}

export const geolocationService = new GeolocationService();
