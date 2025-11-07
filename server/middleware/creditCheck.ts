import type { Request, Response, NextFunction } from "express";
import { creditService } from "../creditService";

export async function requireCredits(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userIdentifier = creditService.getUserIdentifier(req);
    
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
