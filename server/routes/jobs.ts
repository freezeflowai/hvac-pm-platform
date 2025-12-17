import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertJobSchema, updateJobSchema, insertRecurringJobSeriesSchema, insertRecurringJobPhaseSchema, jobStatusEnum } from "@shared/schema";
import { assertJobStatusTransition } from "../statusRules";
import type { JobStatus } from "../schemas";
import type { User } from "@shared/schema";

const router = Router();

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

router.get("/", isAuthenticated, async (req, res) => {
  try {
    const { status, technicianId, locationId, startDate, endDate } = req.query;
    const filters: {
      status?: string;
      technicianId?: string;
      locationId?: string;
      startDate?: string;
      endDate?: string;
    } = {};
    
    if (status && typeof status === 'string') filters.status = status;
    if (technicianId && typeof technicianId === 'string') filters.technicianId = technicianId;
    if (locationId && typeof locationId === 'string') filters.locationId = locationId;
    if (startDate && typeof startDate === 'string') filters.startDate = startDate;
    if (endDate && typeof endDate === 'string') filters.endDate = endDate;
    
    const jobs = await storage.getJobs(req.user!.companyId, Object.keys(filters).length > 0 ? filters : undefined);
    
    const enrichedJobs = await Promise.all(jobs.map(async (job) => {
      const location = await storage.getClient(req.user!.companyId, job.locationId);
      return {
        ...job,
        locationName: location?.companyName || 'Unknown',
        locationCity: location?.city || '',
        locationAddress: location?.address || '',
      };
    }));
    
    res.json(enrichedJobs);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: "Failed to get jobs" });
  }
});

router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const location = await storage.getClient(req.user!.companyId, job.locationId);
    let parentCompany = null;
    if (location?.parentCompanyId) {
      parentCompany = await storage.getCustomerCompany(req.user!.companyId, location.parentCompanyId);
    }
    
    let technicians: User[] = [];
    if (job.assignedTechnicianIds && job.assignedTechnicianIds.length > 0) {
      const allTechs = await storage.getTechniciansByCompanyId(req.user!.companyId);
      technicians = allTechs.filter(t => job.assignedTechnicianIds?.includes(t.id));
    }
    
    let recurringSeries = null;
    if (job.recurringSeriesId) {
      recurringSeries = await storage.getRecurringSeries(req.user!.companyId, job.recurringSeriesId);
    }
    
    res.json({
      ...job,
      location,
      parentCompany,
      technicians,
      recurringSeries,
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: "Failed to get job" });
  }
});

router.post("/", isAuthenticated, async (req, res) => {
  try {
    const data = insertJobSchema.parse(req.body);
    const job = await storage.createJob(req.user!.companyId, data);
    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid job data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create job" });
  }
});

router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const data = updateJobSchema.parse(req.body);
    const job = await storage.updateJob(req.user!.companyId, req.params.id, data);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  } catch (error) {
    console.error('Update job error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid job data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.patch("/:id/status", isAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !jobStatusEnum.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    const existingJob = await storage.getJob(req.user!.companyId, req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    try {
      assertJobStatusTransition(existingJob.status as JobStatus, status as JobStatus);
    } catch (transitionError: any) {
      return res.status(400).json({ error: transitionError.message });
    }
    
    const job = await storage.updateJobStatus(req.user!.companyId, req.params.id, status);
    res.json(job);
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: "Failed to update job status" });
  }
});

router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const deleted = await storage.deleteJob(req.user!.companyId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

router.get("/:jobId/parts", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const parts = await storage.getJobParts(req.params.jobId);
    res.json(parts);
  } catch (error) {
    console.error('Get job parts error:', error);
    res.status(500).json({ error: "Failed to get job parts" });
  }
});

router.post("/:jobId/parts", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    if (!req.body.description || !req.body.quantity) {
      return res.status(400).json({ error: "description and quantity are required" });
    }
    
    const jobPart = await storage.createJobPart(req.params.jobId, {
      ...req.body,
      jobId: req.params.jobId,
    });
    res.status(201).json(jobPart);
  } catch (error) {
    console.error('Create job part error:', error);
    res.status(500).json({ error: "Failed to create job part" });
  }
});

router.put("/:jobId/parts/:id", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const jobPart = await storage.updateJobPart(req.params.id, req.body);
    if (!jobPart) {
      return res.status(404).json({ error: "Job part not found" });
    }
    res.json(jobPart);
  } catch (error) {
    console.error('Update job part error:', error);
    res.status(500).json({ error: "Failed to update job part" });
  }
});

router.delete("/:jobId/parts/:id", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const deleted = await storage.deleteJobPart(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Job part not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete job part error:', error);
    res.status(500).json({ error: "Failed to delete job part" });
  }
});

router.patch("/:jobId/parts/reorder", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const { parts } = req.body;
    if (!Array.isArray(parts)) {
      return res.status(400).json({ error: "parts array is required" });
    }
    
    await storage.reorderJobParts(req.params.jobId, parts);
    res.json({ success: true });
  } catch (error) {
    console.error('Reorder job parts error:', error);
    res.status(500).json({ error: "Failed to reorder job parts" });
  }
});

router.get("/:jobId/equipment", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const equipment = await storage.getJobEquipment(req.params.jobId);
    res.json(equipment);
  } catch (error) {
    console.error('Get job equipment error:', error);
    res.status(500).json({ error: "Failed to get job equipment" });
  }
});

router.post("/:jobId/equipment", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const { equipmentId, notes } = req.body;
    if (!equipmentId) {
      return res.status(400).json({ error: "equipmentId is required" });
    }
    
    const existingEquipment = await storage.getLocationEquipmentItem(equipmentId);
    if (!existingEquipment) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    
    const jobEquipment = await storage.createJobEquipment(req.params.jobId, { jobId: req.params.jobId, equipmentId, notes });
    res.status(201).json(jobEquipment);
  } catch (error) {
    console.error('Create job equipment error:', error);
    res.status(500).json({ error: "Failed to add equipment to job" });
  }
});

router.put("/:jobId/equipment/:jobEquipmentId", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const { notes } = req.body;
    const updated = await storage.updateJobEquipment(req.params.jobEquipmentId, { notes });
    if (!updated) {
      return res.status(404).json({ error: "Job equipment not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error('Update job equipment error:', error);
    res.status(500).json({ error: "Failed to update job equipment" });
  }
});

router.delete("/:jobId/equipment/:jobEquipmentId", isAuthenticated, async (req, res) => {
  try {
    const job = await storage.getJob(req.user!.companyId, req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    const deleted = await storage.deleteJobEquipment(req.params.jobEquipmentId);
    if (!deleted) {
      return res.status(404).json({ error: "Job equipment not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete job equipment error:', error);
    res.status(500).json({ error: "Failed to remove equipment from job" });
  }
});



// Stage 4 utility: reconcile Job ↔ Invoice links for a specific job
router.post("/:id/reconcile-invoice-links", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id: jobId } = req.params;
    const result = await storage.reconcileJobInvoiceLinks(req.user!.companyId, jobId);
    res.json(result);
  } catch (error: any) {
    console.error("Reconcile job/invoice links error:", error);
    res.status(500).json({ error: error.message || "Failed to reconcile job/invoice links" });
  }
});

export default router;
