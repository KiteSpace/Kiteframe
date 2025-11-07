import { db } from "./db";
import { userCredits, unlockCodes } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { Request } from "express";
import { geolocationService } from "./geolocation";

export interface CreditCheckResult {
  hasCredits: boolean;
  remainingCredits: number;
  userIdentifier: string;
}

export class CreditService {
  getUserIdentifier(req: Request): string {
    return geolocationService.getUserIP(req);
  }

  async getOrCreateUserCredits(userIdentifier: string) {
    let credits = await db.query.userCredits.findFirst({
      where: eq(userCredits.userIdentifier, userIdentifier),
    });

    if (!credits) {
      const [newCredits] = await db.insert(userCredits).values({
        userIdentifier,
        credits: 10,
      }).returning();
      credits = newCredits;
    }

    return credits;
  }

  async checkCredits(req: Request): Promise<CreditCheckResult> {
    const userIdentifier = this.getUserIdentifier(req);
    const credits = await this.getOrCreateUserCredits(userIdentifier);

    return {
      hasCredits: credits.credits > 0,
      remainingCredits: credits.credits,
      userIdentifier,
    };
  }

  async deductCreditAtomic(userIdentifier: string): Promise<{ success: boolean; remainingCredits: number; isUnlimited?: boolean }> {
    try {
      const result = await db.transaction(async (tx) => {
        const existing = await tx.query.userCredits.findFirst({
          where: eq(userCredits.userIdentifier, userIdentifier),
        });

        if (!existing) {
          await tx.insert(userCredits).values({
            userIdentifier,
            credits: 10,
            isUnlimited: false,
          });
        }

        const current = await tx.query.userCredits.findFirst({
          where: eq(userCredits.userIdentifier, userIdentifier),
        });

        if (current?.isUnlimited) {
          return { credits: 999999, isUnlimited: true };
        }

        const updated = await tx.update(userCredits)
          .set({ 
            credits: sql`${userCredits.credits} - 1`,
            updatedAt: new Date(),
          })
          .where(and(
            eq(userCredits.userIdentifier, userIdentifier),
            sql`${userCredits.credits} > 0`
          ))
          .returning({ credits: userCredits.credits, isUnlimited: userCredits.isUnlimited });

        if (updated.length === 0) {
          throw new Error('INSUFFICIENT_CREDITS');
        }

        return updated[0];
      });

      return { success: true, remainingCredits: result.credits, isUnlimited: result.isUnlimited || false };
    } catch (error: any) {
      if (error.message === 'INSUFFICIENT_CREDITS') {
        return { success: false, remainingCredits: 0, isUnlimited: false };
      }
      throw error;
    }
  }

  async refundCredit(userIdentifier: string): Promise<void> {
    await db.update(userCredits)
      .set({ 
        credits: sql`${userCredits.credits} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userIdentifier, userIdentifier));
  }

  async redeemUnlockCode(code: string, userIdentifier: string): Promise<{ success: boolean; message: string; credits?: number; isUnlimited?: boolean }> {
    try {
      const result = await db.transaction(async (tx) => {
        const unlockCode = await tx.query.unlockCodes.findFirst({
          where: eq(unlockCodes.code, code),
        });

        if (!unlockCode) {
          throw new Error('INVALID_CODE');
        }

        if (unlockCode.isUsed) {
          throw new Error('CODE_ALREADY_USED');
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
      if (error.message === 'CODE_ALREADY_USED') {
        return { success: false, message: 'This unlock code has already been used' };
      }
      throw error;
    }
  }

  async getRemainingCredits(userIdentifier: string): Promise<number> {
    const credits = await this.getOrCreateUserCredits(userIdentifier);
    return credits.credits;
  }
}

export const creditService = new CreditService();
