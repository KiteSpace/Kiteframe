import type { Request, Response, NextFunction } from "express";
import { creditService, getCreditCost } from "../creditService";
import { db } from "../db";
import { userGroupMemberships, userGroups, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isValidOptimizationSession, registerOptimizationSession, peekOptimizationSession } from "../optimizationSession";

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
    // SCOPE GUARD: only workflow_reasoning task turns may skip credit via a session.
    // This prevents a valid session ID from bypassing credits on unrelated endpoints
    // (e.g. wireframe generation, image analysis) that also use requireCredits middleware.
    const optimizationSessionId = req.body?.optimizationSessionId;
    const isWorkflowReasoning = req.body?.taskType === 'workflow_reasoning';
    if (isWorkflowReasoning && optimizationSessionId && isValidOptimizationSession(optimizationSessionId, userIdentifier)) {
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

    // If the client sent a session ID for a workflow_reasoning turn, register it now
    // atomically with the credit deduction. This ensures retries after a failed first
    // generation are free — the credit was already spent on this generation attempt.
    // Non-workflow turns do not register sessions (preserving scope guard above).
    const pendingSessionId = req.body?.optimizationSessionId;
    if (isWorkflowReasoning && pendingSessionId && typeof pendingSessionId === 'string') {
      registerOptimizationSession(pendingSessionId, userIdentifier);
    }
    
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

// === Background Job Credit Helpers ===
// Used by the async AI job flow (POST /api/ai/job) where we want to
// (a) verify the user is allowed to spend a credit before kicking off the job,
// (b) only deduct the credit AFTER the AI call has succeeded, and
// (c) preserve the same admin/group-bypass and optimization-session semantics
// as the synchronous requireCredits middleware.

export interface CreditPrecheckOk {
  ok: true;
  userIdentifier: string;
  isAuthenticated: boolean;
  taskType?: string;
  creditCost: number;
  // True when this request will not consume a credit at all (admin / group bypass / unlimited).
  isExempt: boolean;
  // True when an active optimization session would absorb this turn for free.
  isOptimizationSessionTurn: boolean;
  optimizationSessionId?: string;
  // How many credits we've reserved (held against this user's available balance)
  // until the job either succeeds (deducted) or fails (released). Zero for
  // exempt users and verified optimization-session free turns.
  reservedAmount: number;
}

export interface CreditPrecheckErr {
  ok: false;
  status: number;
  error: string;
  body?: Record<string, unknown>;
}

export type CreditPrecheckResult = CreditPrecheckOk | CreditPrecheckErr;

// Verify the request is allowed to start an AI job. Does NOT deduct credits.
// Mirrors the gating logic of `requireCredits` so behaviour is consistent across
// the sync and async endpoints.
export async function precheckCreditsForJob(req: Request): Promise<CreditPrecheckResult> {
  try {
    const userIdentifier = creditService.getUserIdentifier(req);
    const user = (req as any).user;
    const taskType = req.body?.taskType;
    const creditCost = getCreditCost(taskType);
    const isAuthenticated = creditService.isAuthenticatedUser(req);

    const userEmail = user?.email || user?.claims?.email;
    if (isAdminUser(userEmail)) {
      return { ok: true, userIdentifier, isAuthenticated, taskType, creditCost, isExempt: true, isOptimizationSessionTurn: false, reservedAmount: 0 };
    }

    const userId = user?.id || (userEmail ? await findUserIdByEmail(userEmail) : null);
    if (userId) {
      const groupControls = await getUserGroupAccessControls(userId);
      if (groupControls.bypassCreditCheck || groupControls.unlimitedCredits) {
        return { ok: true, userIdentifier, isAuthenticated, taskType, creditCost, isExempt: true, isOptimizationSessionTurn: false, reservedAmount: 0 };
      }
    }

    const optimizationSessionId = req.body?.optimizationSessionId;
    const isWorkflowReasoning = taskType === 'workflow_reasoning';
    // We pass the session id through so deductCreditsAfterSuccess can either
    // consume an existing free-turn (releasing the reservation) or register a
    // new session after a successful first-turn deduction.
    const isOptimizationSessionTurn =
      !!(isWorkflowReasoning && optimizationSessionId && typeof optimizationSessionId === 'string');

    await creditService.getOrCreateUserCredits(userIdentifier, isAuthenticated);

    // Optimization-session parity with sync requireCredits middleware: if the
    // session is owned by this user, unexpired, and has free turns remaining,
    // admit WITHOUT reserving credits. peekOptimizationSession does NOT consume
    // a turn, so the actual consumption happens in deductCreditsAfterSuccess
    // via isValidOptimizationSession. This restores the documented behavior
    // where users with valid sessions can keep iterating even if their daily
    // balance is empty.
    if (isOptimizationSessionTurn && peekOptimizationSession(optimizationSessionId, userIdentifier)) {
      return {
        ok: true,
        userIdentifier,
        isAuthenticated,
        taskType,
        creditCost,
        isExempt: false,
        isOptimizationSessionTurn,
        optimizationSessionId,
        reservedAmount: 0,
      };
    }

    // First-turn or invalid session: reserve credits at admission so concurrent
    // submissions can't all see the full balance and over-admit. The reservation
    // is released by the worker either as a deduction (success) or refund
    // (failure / stale timeout).
    const reservation = await creditService.tryReserveCredits(userIdentifier, creditCost, isAuthenticated);
    if (!reservation.ok) {
      return {
        ok: false,
        status: 403,
        error: "Daily credit limit reached. Credits reset every 24 hours. Contact info@kiteframe.space for a bonus unlock code.",
        body: { remainingCredits: Math.max(0, reservation.available), creditCost, resetsDaily: true },
      };
    }

    return {
      ok: true,
      userIdentifier,
      isAuthenticated,
      taskType,
      creditCost,
      isExempt: false,
      isOptimizationSessionTurn,
      optimizationSessionId: isOptimizationSessionTurn ? optimizationSessionId : undefined,
      reservedAmount: creditCost,
    };
  } catch (error) {
    console.error('precheckCreditsForJob error:', error);
    return { ok: false, status: 500, error: 'Could not verify credits.' };
  }
}

// Release a precheck's reservation without deducting. Call this when the AI job
// fails or times out so the held credits return to the user's available balance.
export function releasePrecheckReservation(precheck: CreditPrecheckOk): void {
  if (precheck.reservedAmount > 0) {
    creditService.releaseReservation(precheck.userIdentifier, precheck.reservedAmount);
  }
}

// Called AFTER a successful AI job. Performs the actual credit deduction
// (or skips it for exempt/optimization-session turns) and returns the resulting
// remaining-credits count for client display.
export async function deductCreditsAfterSuccess(precheck: CreditPrecheckOk): Promise<{
  charged: boolean;
  creditCost: number;
  remainingCredits: number;
}> {
  if (precheck.isExempt) {
    // No reservation was held for exempt users.
    return { charged: false, creditCost: precheck.creditCost, remainingCredits: 999999 };
  }

  // Try to consume an optimization-session free turn first. If still valid this
  // returns true and we skip the deduction. If the session has expired or been
  // exhausted between precheck and now, we fall through to the normal deduction.
  if (precheck.isOptimizationSessionTurn && precheck.optimizationSessionId) {
    const sessionConsumed = isValidOptimizationSession(precheck.optimizationSessionId, precheck.userIdentifier);
    if (sessionConsumed) {
      // Release any reservation held (only first-turn precheck reserves).
      releasePrecheckReservation(precheck);
      const remaining = await creditService.getRemainingCredits(precheck.userIdentifier, precheck.isAuthenticated);
      console.log(`[Session] Credit deduction skipped for active optimization session: ${precheck.optimizationSessionId.slice(0, 8)}...`);
      return { charged: false, creditCost: 0, remainingCredits: remaining };
    }
  }

  // Release the reservation BEFORE deducting so the deduction sees the real
  // balance (the reservation is just an admission control held in memory).
  releasePrecheckReservation(precheck);

  const deductResult = await creditService.deductCreditAtomic(
    precheck.userIdentifier,
    precheck.creditCost,
    precheck.isAuthenticated,
  );

  if (!deductResult.success) {
    // Reservation should have prevented this, but as a defence-in-depth measure
    // we surface the failure honestly. The caller MUST treat the AI output as
    // un-billed and may decide to discard it or warn the user.
    console.warn(`Post-success deduction failed for ${precheck.userIdentifier}: insufficient credits.`);
    return { charged: false, creditCost: precheck.creditCost, remainingCredits: 0 };
  }

  // Register optimization session for workflow_reasoning turns so subsequent
  // refinements within the session are free (matches sync requireCredits behaviour).
  if (precheck.taskType === 'workflow_reasoning' && precheck.optimizationSessionId) {
    registerOptimizationSession(precheck.optimizationSessionId, precheck.userIdentifier);
  }

  console.log(`[Job] Credit deducted (cost: ${precheck.creditCost}). User: ${precheck.userIdentifier}, Remaining: ${deductResult.remainingCredits}`);
  return {
    charged: true,
    creditCost: precheck.creditCost,
    remainingCredits: deductResult.remainingCredits,
  };
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
