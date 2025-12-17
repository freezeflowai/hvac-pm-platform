import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertInvoiceSchema, updateInvoiceSchema, insertInvoiceLineSchema, updateInvoiceLineSchema, insertPaymentSchema } from "@shared/schema";
import { assertInvoiceStatusTransition } from "../statusRules";
import type { InvoiceStatus } from "../schemas";

const router = Router();

const LOCKED_INVOICE_STATUSES = new Set(["sent", "paid", "partial_paid", "voided", "cancelled"]);

function assertInvoiceEditable(invoice: any) {
  const status = String(invoice?.status || "").toLowerCase();
  if (LOCKED_INVOICE_STATUSES.has(status)) {
    const err: any = new Error("Invoice is locked once it is sent (or later).");
    err.statusCode = 409;
    throw err;
  }
}


function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

router.get("/", isAuthenticated, async (req, res) => {
  try {
    const { locationId, customerCompanyId, jobId } = req.query;
    let invoices;
    if (jobId && typeof jobId === 'string') {
      invoices = await storage.getInvoicesByJob(req.user!.companyId, jobId);
    } else if (locationId && typeof locationId === 'string') {
      invoices = await storage.getInvoicesByLocation(req.user!.companyId, locationId);
    } else if (customerCompanyId && typeof customerCompanyId === 'string') {
      invoices = await storage.getInvoicesByCustomerCompany(req.user!.companyId, customerCompanyId);
    } else {
      invoices = await storage.getInvoices(req.user!.companyId);
    }
    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to get invoices";
    res.status(code).json({ error: msg });
  }
});

router.get("/stats", isAuthenticated, async (req, res) => {
  try {
    const stats = await storage.getInvoiceSummaryStats(req.user!.companyId);
    res.json(stats);
  } catch (error) {
    console.error('Get invoice stats error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to get invoice stats";
    res.status(code).json({ error: msg });
  }
});

router.get("/list", isAuthenticated, async (req, res) => {
  try {
    const { status, clientId, search, from, to } = req.query;
    const invoices = await storage.getInvoicesWithStats(req.user!.companyId, {
      status: status as string | undefined,
      clientId: clientId as string | undefined,
      search: search as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
    });
    res.json(invoices);
  } catch (error) {
    console.error('Get invoices list error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to get invoices list";
    res.status(code).json({ error: msg });
  }
});

router.post("/from-job/:jobId", isAuthenticated, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { includeLineItems = true, includeNotes = true, markJobCompleted = false } = req.body;
    
    const existingInvoices = await storage.getInvoicesByJob(req.user!.companyId, jobId);
    if (existingInvoices.length > 0) {
      return res.status(400).json({ 
        error: "An invoice already exists for this job", 
        existingInvoiceId: existingInvoices[0].id 
      });
    }
    
    if (markJobCompleted) {
      await storage.updateJob(req.user!.companyId, jobId, { status: "completed" });
    }
    
    const invoice = await storage.createInvoiceFromJob(req.user!.companyId, jobId, {
      includeLineItems,
      includeNotes,
    });
    res.status(201).json(invoice);
  } catch (error: any) {
    console.error('Create invoice from job error:', error);
    res.status(500).json({ error: error.message || "Failed to create invoice from job" });
  }
});

router.post("/:id/refresh-from-job", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (invoice.status !== "draft") {
      return res.status(400).json({ error: "Can only refresh draft invoices" });
    }
    if (!invoice.jobId) {
      return res.status(400).json({ error: "Invoice has no linked job" });
    }
    
    const updatedInvoice = await storage.refreshInvoiceFromJob(req.user!.companyId, id, invoice.jobId);
    res.json(updatedInvoice);
  } catch (error: any) {
    console.error('Refresh invoice from job error:', error);
    res.status(500).json({ error: error.message || "Failed to refresh invoice from job" });
  }
});

router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to get invoice";
    res.status(code).json({ error: msg });
  }
});

router.get("/:id/details", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const details = await storage.getInvoiceWithDetails(req.user!.companyId, id);
    if (!details) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(details);
  } catch (error) {
    console.error('Get invoice details error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to get invoice details";
    res.status(code).json({ error: msg });
  }
});

router.post("/", isAuthenticated, async (req, res) => {
  try {
    const data = insertInvoiceSchema.parse(req.body);
    const invoice = await storage.createInvoice(req.user!.companyId, data);
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Create invoice error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to create invoice";
    res.status(code).json({ error: msg });
  }
});

router.patch("/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateInvoiceSchema.parse(req.body);
    
    const existing = await storage.getInvoice(req.user!.companyId, req.params.id);
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    assertInvoiceEditable(existing);
    if (data.status) {
      const existingInvoice = await storage.getInvoice(req.user!.companyId, id);
      if (!existingInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      try {
        assertInvoiceStatusTransition(existingInvoice.status as InvoiceStatus, data.status as InvoiceStatus);
      } catch (transitionError: any) {
        return res.status(400).json({ error: transitionError.message });
      }
    }
    
    const invoice = await storage.updateInvoice(req.user!.companyId, id, data);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Update invoice error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to update invoice";
    res.status(code).json({ error: msg });
  }
});

router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await storage.deleteInvoice(req.user!.companyId, id);
    if (!deleted) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete invoice error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to delete invoice";
    res.status(code).json({ error: msg });
  }
});

router.post("/:id/void", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await storage.voidInvoice(req.user!.companyId, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Void invoice error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to void invoice";
    res.status(code).json({ error: msg });
  }
});

router.post("/:id/send", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await storage.sendInvoice(req.user!.companyId, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Send invoice error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to send invoice";
    res.status(code).json({ error: msg });
  }
});

router.get("/:invoiceId/payments", isAuthenticated, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const payments = await storage.getPayments(invoiceId);
    res.json(payments);
  } catch (error) {
    console.error('Get invoice payments error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to get invoice payments";
    res.status(code).json({ error: msg });
  }
});

router.post("/:invoiceId/payments", isAuthenticated, async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // Stage 6 hardening: prevent payments on draft/pending and void/cancelled
    const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const st = String(invoice.status || "").toLowerCase();
    if (st === "draft" || st === "pending") {
      return res.status(409).json({ error: "Invoice must be sent before recording payments" });
    }
    if (st === "voided" || st === "cancelled") {
      return res.status(409).json({ error: "Cannot record payments for a voided/cancelled invoice" });
    }

    const parseResult = insertPaymentSchema.safeParse({ ...req.body, invoiceId });
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid payment data", details: parseResult.error.flatten() });
    }
    const payment = await storage.createPayment(req.user!.companyId, invoiceId, parseResult.data);
    res.status(201).json(payment);
  } catch (error) {
    console.error('Create payment error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to create payment";
    res.status(code).json({ error: msg });
  }
});

router.delete("/:invoiceId/payments/:paymentId", isAuthenticated, async (req, res) => {
  try {
    const { invoiceId, paymentId } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const deleted = await storage.deletePayment(req.user!.companyId, invoiceId, paymentId);
    if (!deleted) {
      return res.status(404).json({ error: "Payment not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete payment error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to delete payment";
    res.status(code).json({ error: msg });
  }
});

router.get("/:invoiceId/lines", isAuthenticated, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const lines = await storage.getInvoiceLines(invoiceId);
    res.json(lines);
  } catch (error) {
    console.error('Get invoice lines error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to get invoice lines";
    res.status(code).json({ error: msg });
  }
});

router.post("/:invoiceId/lines", isAuthenticated, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    assertInvoiceEditable(invoice);

    const parseResult = insertInvoiceLineSchema.safeParse({ ...req.body, invoiceId });
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid line data", details: parseResult.error.flatten() });
    }
    const line = await storage.createInvoiceLine(parseResult.data);
    res.status(201).json(line);
  } catch (error) {
    console.error('Create invoice line error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to create invoice line";
    res.status(code).json({ error: msg });
  }
});

router.patch("/:invoiceId/lines/:lineId", isAuthenticated, async (req, res) => {
  try {
    const { invoiceId, lineId } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    assertInvoiceEditable(invoice);

    const parseResult = updateInvoiceLineSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid line data", details: parseResult.error.flatten() });
    }
    const line = await storage.updateInvoiceLine(invoiceId, lineId, parseResult.data);
    if (!line) {
      return res.status(404).json({ error: "Line not found" });
    }
    res.json(line);
  } catch (error) {
    console.error('Update invoice line error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to update invoice line";
    res.status(code).json({ error: msg });
  }
});

router.delete("/:invoiceId/lines/:lineId", isAuthenticated, async (req, res) => {
  try {
    const { invoiceId, lineId } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    assertInvoiceEditable(invoice);

    const deleted = await storage.deleteInvoiceLine(invoiceId, lineId);
    if (!deleted) {
      return res.status(404).json({ error: "Line not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete invoice line error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to delete invoice line";
    res.status(code).json({ error: msg });
  }
});

router.put("/:invoiceId/lines", isAuthenticated, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    assertInvoiceEditable(invoice);

    const { lines } = req.body;
    if (!Array.isArray(lines)) {
      return res.status(400).json({ error: "lines must be an array" });
    }
    
    const updated = await storage.replaceInvoiceLines(invoiceId, lines);
    res.json(updated);
  } catch (error) {
    console.error('Replace invoice lines error:', error);
        const code = (error as any)?.statusCode || 500;
    const msg = (error as any)?.statusCode ? (error as any)?.message : "Failed to replace invoice lines";
    res.status(code).json({ error: msg });
  }
});

export default router;
