import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage/index";


function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}


const router = Router();

// Bulk endpoint expected by frontend: POST /api/client-parts/bulk
router.post("/bulk", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const items = Array.isArray(req.body) ? req.body : (req.body?.items ?? []);
  const result = await storage.upsertClientPartsBulk(companyId, items);
  res.json(result);
});

export default router;
