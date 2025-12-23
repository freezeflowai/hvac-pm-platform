import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage/index";


function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}


const router = Router();

router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const settings = await storage.getCompanySettings(companyId);
  res.json(settings ?? {});
});

router.put("/", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const settings = await storage.upsertCompanySettings(companyId, req.body ?? {});
  res.json(settings ?? {});
});

export default router;
