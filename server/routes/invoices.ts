import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage/index";


function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Not authenticated" });
}


const router = Router();

router.get("/list", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const rows = await storage.getInvoices(companyId);
  res.json(rows);
});

router.get("/stats", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const rows = await storage.getInvoiceStats(companyId);
  res.json(rows);
});

router.get("/:id", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const invoice = await storage.getInvoice(companyId, req.params.id);
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.json(invoice);
});

router.get("/:id/lines", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const lines = await storage.getInvoiceLines(companyId, req.params.id);
  res.json(lines);
});

router.post("/:id/lines", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const created = await storage.createInvoiceLine(companyId, req.params.id, req.body);
  res.json(created);
});

router.delete("/:id/lines/:lineId", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const result = await storage.deleteInvoiceLine(companyId, req.params.id, req.params.lineId);
  res.json(result);
});

router.post("/:id/refresh-from-job", isAuthenticated, async (req: Request, res: Response) => {
  const companyId = (req.user as any)?.companyId;
  const result = await storage.refreshInvoiceFromJob(companyId, req.params.id);
  res.json(result);
});

export default router;
