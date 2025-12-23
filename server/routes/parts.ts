import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage/index";


function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}


const router = Router();

router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const q = String((req.query as any)?.q ?? "").trim();
  const rows = await storage.getParts(companyId, q || undefined);
  res.json(rows);
});

router.post("/", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const created = await storage.createPart(companyId, req.body);
  res.json(created);
});

router.put("/:id", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const updated = await storage.updatePart(companyId, req.params.id, req.body);
  res.json(updated);
});

router.delete("/:id", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const result = await storage.deletePart(companyId, req.params.id);
  res.json(result);
});

export default router;
