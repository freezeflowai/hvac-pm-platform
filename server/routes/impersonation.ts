import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";


function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}


const router = Router();

router.get("/status", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const userId = (req.user as any)?.id;
  const status = await storage.getImpersonationStatus(companyId, userId);
  res.json(status);
});

export default router;
