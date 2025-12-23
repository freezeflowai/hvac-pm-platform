import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage/index";


function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}


const router = Router();

router.get("/recently-completed", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const limit = Number((req.query as any)?.limit ?? 50);
  const rows = await storage.getMaintenanceRecentlyCompleted(companyId, Number.isFinite(limit) ? limit : 50);
  res.json(rows);
});

router.get("/statuses", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const rows = await storage.getMaintenanceStatuses(companyId);
  res.json(rows);
});

export default router;
