import type { Request, Response, NextFunction } from "express";
import { creditService } from "../creditService";

// Check if user email is in admin list
function isAdminUser(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
}

export async function requireCredits(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userIdentifier = creditService.getUserIdentifier(req);
    const user = (req as any).user;
    
    // Admin users bypass credit check entirely
    const userEmail = user?.email || user?.claims?.email;
    if (isAdminUser(userEmail)) {
      req.creditDeducted = {
        userIdentifier,
        remainingCredits: 999999,
      };
      console.log(`Admin user bypassing credit check: ${userEmail}`);
      next();
      return;
    }
    
    const deductResult = await creditService.deductCreditAtomic(userIdentifier);
    
    if (!deductResult.success) {
      res.status(403).json({
        error: "Credit limit reached. Contact info@kiteframe.space for a new unlock code.",
        remainingCredits: 0,
      });
      return;
    }

    req.creditDeducted = {
      userIdentifier,
      remainingCredits: deductResult.remainingCredits,
    };
    
    console.log(`Credit deducted. User: ${userIdentifier}, Remaining: ${deductResult.remainingCredits}`);
    next();
  } catch (error) {
    console.error('Credit check error:', error);
    res.status(500).json({ 
      error: "Could not verify credits." 
    });
  }
}

declare global {
  namespace Express {
    interface Request {
      creditDeducted?: {
        userIdentifier: string;
        remainingCredits: number;
      };
    }
  }
}
