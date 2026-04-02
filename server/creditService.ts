import { db } from "./db";
import { userCredits, unlockCodes, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { Request } from "express";
import { geolocationService } from "./geolocation";
import { analyticsService } from "./analyticsService";

const TIER_DAILY_CREDITS = {
  free: 25,
  advanced: 50,
  pro: 150,
} as const;

const UNAUTHENTICATED_DAILY_CREDITS = 5;

const DAILY_RESET_MS = 24 * 60 * 60 * 1000; // 24 hours

export type CreditCostType = 'general_chat' | 'vision_ingestion' | 'workflow_reasoning' | 'workflow_experiments' | 'prd_generation';

const CREDIT_COSTS: Record<CreditCostType, number> = {
  general_chat: 1,
  vision_ingestion: 5,
  workflow_reasoning: 3,
  workflow_experiments: 3,
  prd_generation: 3,
};

export function getCreditCost(taskType?: string): number {
  if (!taskType) return 1;
  return CREDIT_COSTS[taskType as CreditCostType] || 1;
}

export interface CreditCheckResult {
  hasCredits: boolean;
  remainingCredits: number;
  userIdentifier: string;
  creditCost: number;
}

export class CreditService {
  getUserIdentifier(req: Request): string {
    const user = req.user as any;
    if (user && (user.id || user.claims?.sub)) {
      return user.id || user.claims.sub;
    }
    return geolocationService.getUserIP(req);
  }

  isAuthenticatedUser(req: Request): boolean {
    const user = req.user as any;
    return !!(user && (user.id || user.claims?.sub));
  }

  private getDailyCreditsForIdentifier(isAuthenticated: boolean, tier?: string): number {
    if (!isAuthenticated) return UNAUTHENTICATED_DAILY_CREDITS;
    return TIER_DAILY_CREDITS[(tier as keyof typeof TIER_DAILY_CREDITS)] || TIER_DAILY_CREDITS.free;
  }

  private shouldResetCredits(lastResetAt: Date | null): boolean {
    if (!lastResetAt) return true;
    return Date.now() - lastResetAt.getTime() >= DAILY_RESET_MS;
  }

  async getOrCreateUserCredits(userIdentifier: string, isAuthenticated: boolean = true) {
    let credits = await db.query.userCredits.findFirst({
      where: eq(userCredits.userIdentifier, userIdentifier),
    });

    if (!credits) {
      let initialCredits: number;
      
      if (isAuthenticated) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, userIdentifier),
        });
        const tier = (user?.subscriptionTier as keyof typeof TIER_DAILY_CREDITS) || 'free';
        initialCredits = TIER_DAILY_CREDITS[tier] || TIER_DAILY_CREDITS.free;
      } else {
        initialCredits = UNAUTHENTICATED_DAILY_CREDITS;
      }
      
      const [newCredits] = await db.insert(userCredits).values({
        userIdentifier,
        credits: initialCredits,
        lastResetAt: new Date(),
      }).returning();
      credits = newCredits;
    }

    if (!credits.isUnlimited && this.shouldResetCredits(credits.lastResetAt)) {
      let dailyCredits: number;
      if (isAuthenticated) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, userIdentifier),
        });
        const tier = (user?.subscriptionTier as keyof typeof TIER_DAILY_CREDITS) || 'free';
        dailyCredits = TIER_DAILY_CREDITS[tier] || TIER_DAILY_CREDITS.free;
      } else {
        dailyCredits = UNAUTHENTICATED_DAILY_CREDITS;
      }

      const [resetCredits] = await db.update(userCredits)
        .set({
          credits: dailyCredits,
          lastResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userIdentifier, userIdentifier))
        .returning();
      credits = resetCredits;
    }

    return credits;
  }

  async checkCredits(req: Request, creditCost: number = 1): Promise<CreditCheckResult> {
    const userIdentifier = this.getUserIdentifier(req);
    const isAuthenticated = this.isAuthenticatedUser(req);
    const credits = await this.getOrCreateUserCredits(userIdentifier, isAuthenticated);

    return {
      hasCredits: credits.credits >= creditCost,
      remainingCredits: credits.credits,
      userIdentifier,
      creditCost,
    };
  }

  private async resolveDailyCredits(userIdentifier: string, isAuthenticated: boolean): Promise<number> {
    if (!isAuthenticated) return UNAUTHENTICATED_DAILY_CREDITS;
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userIdentifier),
      });
      if (user?.subscriptionTier) {
        return TIER_DAILY_CREDITS[(user.subscriptionTier as keyof typeof TIER_DAILY_CREDITS)] || TIER_DAILY_CREDITS.free;
      }
    } catch {}
    return TIER_DAILY_CREDITS.free;
  }

  async deductCreditAtomic(userIdentifier: string, creditCost: number = 1, isAuthenticated: boolean = true): Promise<{ success: boolean; remainingCredits: number; isUnlimited?: boolean; creditCost: number }> {
    try {
      const dailyCredits = await this.resolveDailyCredits(userIdentifier, isAuthenticated);

      const result = await db.transaction(async (tx) => {
        const current = await tx.query.userCredits.findFirst({
          where: eq(userCredits.userIdentifier, userIdentifier),
        });

        if (!current) {
          await tx.insert(userCredits).values({
            userIdentifier,
            credits: dailyCredits,
            isUnlimited: false,
            lastResetAt: new Date(),
          });
          if (dailyCredits < creditCost) {
            throw new Error('INSUFFICIENT_CREDITS');
          }
        }

        const fresh = current || await tx.query.userCredits.findFirst({
          where: eq(userCredits.userIdentifier, userIdentifier),
        });

        if (fresh?.isUnlimited) {
          return { credits: 999999, isUnlimited: true };
        }

        if (fresh && this.shouldResetCredits(fresh.lastResetAt)) {
          if (dailyCredits < creditCost) {
            throw new Error('INSUFFICIENT_CREDITS');
          }

          const [resetResult] = await tx.update(userCredits)
            .set({
              credits: dailyCredits - creditCost,
              lastResetAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(userCredits.userIdentifier, userIdentifier))
            .returning({ credits: userCredits.credits, isUnlimited: userCredits.isUnlimited });
          
          return resetResult;
        }

        const updated = await tx.update(userCredits)
          .set({ 
            credits: sql`${userCredits.credits} - ${creditCost}`,
            updatedAt: new Date(),
          })
          .where(and(
            eq(userCredits.userIdentifier, userIdentifier),
            sql`${userCredits.credits} >= ${creditCost}`
          ))
          .returning({ credits: userCredits.credits, isUnlimited: userCredits.isUnlimited });

        if (updated.length === 0) {
          throw new Error('INSUFFICIENT_CREDITS');
        }

        return updated[0];
      });

      return { success: true, remainingCredits: result.credits, isUnlimited: result.isUnlimited || false, creditCost };
    } catch (error: any) {
      if (error.message === 'INSUFFICIENT_CREDITS') {
        analyticsService.trackCreditLimitHit(userIdentifier).catch(console.error);
        return { success: false, remainingCredits: 0, isUnlimited: false, creditCost };
      }
      throw error;
    }
  }

  async refundCredit(userIdentifier: string, creditCost: number = 1): Promise<void> {
    await db.update(userCredits)
      .set({ 
        credits: sql`${userCredits.credits} + ${creditCost}`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userIdentifier, userIdentifier));
  }

  async redeemUnlockCode(code: string, userIdentifier: string, country?: string): Promise<{ success: boolean; message: string; credits?: number; isUnlimited?: boolean }> {
    try {
      const result = await db.transaction(async (tx) => {
        const unlockCode = await tx.query.unlockCodes.findFirst({
          where: eq(unlockCodes.code, code),
        });

        if (!unlockCode) {
          throw new Error('INVALID_CODE');
        }

        if (unlockCode.isRevoked) {
          throw new Error('CODE_REVOKED');
        }

        if (unlockCode.isUsed) {
          throw new Error('CODE_ALREADY_USED');
        }

        if (country && unlockCode.allowedCountries && unlockCode.allowedCountries.length > 0) {
          if (!unlockCode.allowedCountries.includes(country)) {
            throw new Error('COUNTRY_NOT_ALLOWED');
          }
        }

        await tx.update(unlockCodes)
          .set({
            isUsed: true,
            usedBy: userIdentifier,
            usedAt: new Date(),
          })
          .where(eq(unlockCodes.code, code));

        const existing = await tx.query.userCredits.findFirst({
          where: eq(userCredits.userIdentifier, userIdentifier),
        });

        if (unlockCode.grantsUnlimited) {
          if (!existing) {
            await tx.insert(userCredits).values({
              userIdentifier,
              credits: 999999,
              isUnlimited: true,
              lastResetAt: new Date(),
            });
          } else {
            await tx.update(userCredits)
              .set({
                credits: 999999,
                isUnlimited: true,
                updatedAt: new Date(),
              })
              .where(eq(userCredits.userIdentifier, userIdentifier));
          }
          return { credits: 999999, isUnlimited: true };
        }

        if (!existing) {
          await tx.insert(userCredits).values({
            userIdentifier,
            credits: unlockCode.creditsToAdd,
            isUnlimited: false,
            lastResetAt: new Date(),
          });
          return { credits: unlockCode.creditsToAdd, isUnlimited: false };
        }

        const updated = await tx.update(userCredits)
          .set({
            credits: sql`${userCredits.credits} + ${unlockCode.creditsToAdd}`,
            updatedAt: new Date(),
          })
          .where(eq(userCredits.userIdentifier, userIdentifier))
          .returning({ credits: userCredits.credits, isUnlimited: userCredits.isUnlimited });

        return updated[0];
      });

      analyticsService.trackCodeRedeemed(code, userIdentifier, country, result.credits).catch(console.error);

      return {
        success: true,
        message: result.isUnlimited ? 'Successfully activated unlimited credits' : `Successfully added ${result.credits} credits`,
        credits: result.credits,
        isUnlimited: result.isUnlimited || false,
      };
    } catch (error: any) {
      if (error.message === 'INVALID_CODE') {
        return { success: false, message: 'Invalid unlock code' };
      }
      if (error.message === 'CODE_REVOKED') {
        return { success: false, message: 'This unlock code has been disabled by the administrator' };
      }
      if (error.message === 'CODE_ALREADY_USED') {
        return { success: false, message: 'This unlock code has already been used' };
      }
      if (error.message === 'COUNTRY_NOT_ALLOWED') {
        return { success: false, message: 'This unlock code is not valid in your country' };
      }
      throw error;
    }
  }

  async getRemainingCredits(userIdentifier: string, isAuthenticated: boolean = true): Promise<number> {
    const credits = await this.getOrCreateUserCredits(userIdentifier, isAuthenticated);
    return credits.credits;
  }

  getCreditsForTier(tier: keyof typeof TIER_DAILY_CREDITS): number {
    return TIER_DAILY_CREDITS[tier] || TIER_DAILY_CREDITS.free;
  }

  async resetDailyCreditsForUser(userId: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) return;

    const tier = (user.subscriptionTier as keyof typeof TIER_DAILY_CREDITS) || 'free';
    const dailyCredits = this.getCreditsForTier(tier);

    await db.update(userCredits)
      .set({
        credits: dailyCredits,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userIdentifier, userId));
  }

  async syncUserCreditsWithTier(userId: string, tier: keyof typeof TIER_DAILY_CREDITS): Promise<void> {
    const dailyCredits = this.getCreditsForTier(tier);
    
    const existing = await db.query.userCredits.findFirst({
      where: eq(userCredits.userIdentifier, userId),
    });

    if (existing) {
      await db.update(userCredits)
        .set({
          credits: dailyCredits,
          lastResetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userIdentifier, userId));
    } else {
      await db.insert(userCredits).values({
        userIdentifier: userId,
        credits: dailyCredits,
        isUnlimited: tier === 'pro',
        lastResetAt: new Date(),
      });
    }
  }
}

export const creditService = new CreditService();
