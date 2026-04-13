import type { Request, Response, NextFunction } from "express";
import { creditService, getCreditCost } from "../creditService";
import { db } from "../db";
import { userGroupMemberships, userGroups, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isValidOptimizationSession } from "../optimizationSession";

interface GroupAccessControls {
  unlimitedCredits?: boolean;
  subscriptionTierOverride?: 'free' | 'advanced' | 'pro';
  bypassCreditCheck?: boolean;
  monthlyCreditsOverride?: number;
  features?: string[];
}

interface MergedAccessControls {
  unlimitedCredits: boolean;
  bypassCreditCheck: boolean;
  subscriptionTierOverride?: 'free' | 'advanced' | 'pro';
  monthlyCreditsOverride?: number;
  features: string[];
}

function isAdminUser(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
}

async function getUserGroupAccessControls(userId: string): Promise<MergedAccessControls> {
  const merged: MergedAccessControls = {
    unlimitedCredits: false,
    bypassCreditCheck: false,
    features: [],
  };

  try {
    const memberships = await db
      .select({
        groupId: userGroupMemberships.groupId,
        accessControls: userGroups.accessControls,
      })
      .from(userGroupMemberships)
      .innerJoin(userGroups, eq(userGroupMemberships.groupId, userGroups.id))
      .where(eq(userGroupMemberships.userId, userId));

    for (const membership of memberships) {
      const controls = membership.accessControls as GroupAccessControls | null;
      if (!controls) continue;

      if (controls.unlimitedCredits) {
        merged.unlimitedCredits = true;
      }
      if (controls.bypassCreditCheck) {
        merged.bypassCreditCheck = true;
      }
      if (controls.subscriptionTierOverride) {
        const tierPriority = { free: 0, advanced: 1, pro: 2 };
        const currentPriority = merged.subscriptionTierOverride ? tierPriority[merged.subscriptionTierOverride] : -1;
        const newPriority = tierPriority[controls.subscriptionTierOverride];
        if (newPriority > currentPriority) {
          merged.subscriptionTierOverride = controls.subscriptionTierOverride;
        }
      }
      if (controls.monthlyCreditsOverride !== undefined) {
        if (merged.monthlyCreditsOverride === undefined || controls.monthlyCreditsOverride > merged.monthlyCreditsOverride) {
          merged.monthlyCreditsOverride = controls.monthlyCreditsOverride;
        }
      }
      if (controls.features && Array.isArray(controls.features)) {
        for (const feature of controls.features) {
          if (!merged.features.includes(feature)) {
            merged.features.push(feature);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching user group access controls:', error);
  }

  return merged;
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  try {
    const result = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

export async function requireCredits(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userIdentifier = creditService.getUserIdentifier(req);
    const user = (req as any).user;
    const taskType = req.body?.taskType;
    const creditCost = getCreditCost(taskType);
    
    const userEmail = user?.email || user?.claims?.email;
    if (isAdminUser(userEmail)) {
      req.creditDeducted = {
        userIdentifier,
        remainingCredits: 999999,
        creditCost,
      };
      console.log(`Admin user bypassing credit check: ${userEmail}`);
      next();
      return;
    }
    
    const userId = user?.id || (userEmail ? await findUserIdByEmail(userEmail) : null);
    
    if (userId) {
      const groupControls = await getUserGroupAccessControls(userId);
      
      if (groupControls.bypassCreditCheck || groupControls.unlimitedCredits) {
        req.creditDeducted = {
          userIdentifier,
          remainingCredits: 999999,
          creditCost,
        };
        console.log(`User ${userId} bypassing credit check via group permissions (bypass: ${groupControls.bypassCreditCheck}, unlimited: ${groupControls.unlimitedCredits})`);
        next();
        return;
      }
    }
    
    // Check for active optimization session: authenticated refinements within the same
    // session do not consume a credit. The session ID is generated client-side on first
    // generation and validated here server-side against the in-memory session store.
    // We verify both existence and user ownership — never trust a bare client-passed flag.
    const optimizationSessionId = req.body?.optimizationSessionId;
    if (optimizationSessionId && isValidOptimizationSession(optimizationSessionId, userIdentifier)) {
      req.creditDeducted = {
        userIdentifier,
        remainingCredits: 999999,
        creditCost: 0,
      };
      console.log(`[Session] Credit deduction skipped for active optimization session: ${String(optimizationSessionId).slice(0, 8)}...`);
      next();
      return;
    }

    const isAuthenticated = creditService.isAuthenticatedUser(req);
    await creditService.getOrCreateUserCredits(userIdentifier, isAuthenticated);
    
    const deductResult = await creditService.deductCreditAtomic(userIdentifier, creditCost, isAuthenticated);
    
    if (!deductResult.success) {
      res.status(403).json({
        error: "Daily credit limit reached. Credits reset every 24 hours. Contact info@kiteframe.space for a bonus unlock code.",
        remainingCredits: 0,
        creditCost,
        resetsDaily: true,
      });
      return;
    }

    req.creditDeducted = {
      userIdentifier,
      remainingCredits: deductResult.remainingCredits,
      creditCost,
    };
    
    console.log(`Credit deducted (cost: ${creditCost}). User: ${userIdentifier}, Remaining: ${deductResult.remainingCredits}`);
    next();
  } catch (error) {
    console.error('Credit check error:', error);
    res.status(500).json({ 
      error: "Could not verify credits." 
    });
  }
}

export async function requireAdvancedOrPro(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (req as any).user;
    const userEmail = user?.email || user?.claims?.email;

    if (isAdminUser(userEmail)) {
      next();
      return;
    }

    if (user) {
      // Primary: look up by userId (most reliable path)
      const userId = user.claims?.sub || user.id || null;
      const resolvedId = userId || (userEmail ? await findUserIdByEmail(userEmail) : null);

      if (resolvedId) {
        // Check group-based tier overrides first (same pattern as requireCredits)
        const groupControls = await getUserGroupAccessControls(resolvedId);
        if (groupControls.bypassCreditCheck || groupControls.unlimitedCredits) {
          next();
          return;
        }
        const groupTier = groupControls.subscriptionTierOverride;
        if (groupTier && ['advanced', 'pro'].includes(groupTier)) {
          next();
          return;
        }

        // Then check DB subscription tier
        const result = await db
          .select({ subscriptionTier: users.subscriptionTier, email: users.email })
          .from(users)
          .where(eq(users.id, resolvedId))
          .limit(1);
        const dbUser = result[0];
        if (dbUser) {
          if (isAdminUser(dbUser.email)) {
            next();
            return;
          }
          if (['advanced', 'pro'].includes(dbUser.subscriptionTier || '')) {
            next();
            return;
          }
        }
      }
    }

    res.status(403).json({
      error: 'This feature requires an Advanced or Pro plan. Upgrade at kiteframe.space/pricing.',
      requiresUpgrade: true,
    });
  } catch (error) {
    console.error('Tier check error:', error);
    res.status(500).json({ error: 'Could not verify plan tier.' });
  }
}

export { getUserGroupAccessControls, MergedAccessControls };

declare global {
  namespace Express {
    interface Request {
      creditDeducted?: {
        userIdentifier: string;
        remainingCredits: number;
        creditCost: number;
      };
    }
  }
}
