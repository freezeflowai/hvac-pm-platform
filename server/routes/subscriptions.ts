import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage/index";


function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}


const router = Router();

router.get("/usage", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const usage = await storage.getSubscriptionUsage(companyId);
  res.json(usage);
});

router.get("/can-add-location", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const result = await storage.canAddLocation(companyId);
  res.json(result);
});

export default router;
