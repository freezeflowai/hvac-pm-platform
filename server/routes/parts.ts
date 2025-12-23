import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage/index";

function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}

function getCompanyId(req: any): string | null {
  // Prefer tenant isolation context if present, fall back to user
  return (
    req?.tenant?.companyId ??
    req?.tenantContext?.companyId ??
    req?.companyId ??
    req?.user?.companyId ??
    null
  );
}

const router = Router();

router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "Missing company context" });

    const q = String((req.query as any)?.q ?? "").trim();
    const fn = (storage as any).getParts;
    if (typeof fn !== "function") {
      return res.status(501).json({ error: "Parts storage not implemented (getParts missing)" });
    }

    const rows = await fn(companyId, q || undefined);
    return res.json(rows ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to load parts" });
  }
});

router.post("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "Missing company context" });

    const fn = (storage as any).createPart;
    if (typeof fn !== "function") {
      return res.status(501).json({ error: "Parts storage not implemented (createPart missing)" });
    }

    const created = await fn(companyId, req.body);
    return res.json(created);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to create part" });
  }
});

router.put("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "Missing company context" });

    const fn = (storage as any).updatePart;
    if (typeof fn !== "function") {
      return res.status(501).json({ error: "Parts storage not implemented (updatePart missing)" });
    }

    const updated = await fn(companyId, req.params.id, req.body);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to update part" });
  }
});

router.delete("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) return res.status(400).json({ error: "Missing company context" });

    const fn = (storage as any).deletePart;
    if (typeof fn !== "function") {
      return res.status(501).json({ error: "Parts storage not implemented (deletePart missing)" });
    }

    const result = await fn(companyId, req.params.id);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete part" });
  }
});

export default router;
