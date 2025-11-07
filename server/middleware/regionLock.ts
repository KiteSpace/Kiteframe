import type { Request, Response, NextFunction } from "express";
import { geolocationService } from "../geolocation";

export async function requireUSOnly(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await geolocationService.checkRegion(req);
  
  // Structured logging for audit trail
  console.log(`🔒 Region Lock Decision: ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`, {
    country: result.country,
    source: result.source,
    reason: result.reason,
    ip: geolocationService.getUserIP(req),
    path: req.path,
    timestamp: new Date().toISOString()
  });
  
  if (!result.allowed) {
    res.status(500).json({ 
      error: "Something went wrong. Contact web master for help." 
    });
    return;
  }
  
  next();
}
