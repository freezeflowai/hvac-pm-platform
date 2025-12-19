
import { Request, Response, NextFunction } from "express";

export function attachUserContext(req: Request, _res: Response, next: NextFunction) {
  // req.user must already be hydrated by auth middleware
  if (req.user) {
    req.companyId = req.user.companyId;
  }
  next();
}
