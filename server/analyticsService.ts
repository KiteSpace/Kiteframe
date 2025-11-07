import { db } from './db';
import { analyticsEvents } from '@shared/schema';
import type { InsertAnalyticsEvent } from '@shared/schema';

export class AnalyticsService {
  async trackEvent(event: InsertAnalyticsEvent): Promise<void> {
    try {
      await db.insert(analyticsEvents).values(event);
    } catch (error) {
      console.error('Failed to track analytics event:', error);
    }
  }

  async trackCreditLimitHit(userIdentifier: string, country?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'credit_limit_hit',
      userIdentifier,
      country: country || null,
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  async trackGeolocationCheck(userIdentifier: string, country: string, source: string): Promise<void> {
    await this.trackEvent({
      eventType: 'geolocation_check',
      userIdentifier,
      country,
      metadata: { source },
    });
  }

  async trackCodeRedeemed(code: string, userIdentifier: string, country?: string, creditsAdded?: number): Promise<void> {
    await this.trackEvent({
      eventType: 'code_redeemed',
      userIdentifier,
      country: country || null,
      metadata: { code, creditsAdded },
    });
  }

  async trackAIRequest(userIdentifier: string, country?: string, requestType?: string): Promise<void> {
    await this.trackEvent({
      eventType: 'ai_request',
      userIdentifier,
      country: country || null,
      metadata: { requestType: requestType || 'unknown' },
    });
  }
}

export const analyticsService = new AnalyticsService();
