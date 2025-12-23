
import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Only require auth for API routes - let frontend routes pass through to Vite
  if (!req.path.startsWith("/api")) {
    return next();
  }
  
  if (!req.user || !req.user.id || !req.user.companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
