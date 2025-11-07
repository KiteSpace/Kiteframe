import type { Request, Response, NextFunction } from "express";
import { geolocationService } from "../geolocation";

export async function requireUSOnly(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isUS = await geolocationService.isUSOnly(req);
    
    if (!isUS) {
      res.status(403).json({ 
        error: "Access Denied: This service is US only." 
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Region lock error:', error);
    res.status(403).json({ 
      error: "Could not verify location." 
    });
  }
}
