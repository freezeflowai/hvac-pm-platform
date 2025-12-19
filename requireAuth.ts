
import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.id || !req.user.companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
