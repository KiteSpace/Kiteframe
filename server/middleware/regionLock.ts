import type { Request, Response, NextFunction } from "express";
import { geolocationService } from "../geolocation";

export async function requireUSOnly(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only allow bypass in development environment (never in production)
  if (process.env.NODE_ENV !== 'production' && process.env.BYPASS_GEO_BLOCK === 'true') {
    next();
    return;
  }

  const result = await geolocationService.checkRegion(req);
  
  // Only log blocked requests to reduce noise (security audit trail)
  if (!result.allowed) {
    console.log(`🚫 GEO-BLOCKED REQUEST`, {
      country: result.country,
      source: result.source,
      reason: result.reason,
      ip: geolocationService.getUserIP(req),
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent')?.substring(0, 100),
      timestamp: new Date().toISOString()
    });
    
    // Return bare 404 to hide that geo-blocking exists (no body, minimal headers)
    res.sendStatus(404);
    return;
  }
  
  next();
}
