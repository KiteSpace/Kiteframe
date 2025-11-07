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
      res.status(500).json({ 
        error: "Something went wrong. Contact web master for help." 
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Region lock error:', error);
    res.status(500).json({ 
      error: "Something went wrong. Contact web master for help." 
    });
  }
}
