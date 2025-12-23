import { db } from "../db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { validate as isUUID } from "uuid";
import { 
  jobs, 
  jobParts, 
  jobEquipment, 
  locationEquipment,
  recurringJobSeries,
  companyCounters 
} from "@shared/schema";
import type { InsertJob, Job, InsertJobPart, JobPart } from "@shared/schema";
import { BaseRepository } from "./base";

interface JobFilters {
  status?: string;
  technicianId?: string;
  locationId?: string;
  startDate?: string;
  endDate?: string;
}

export class JobRepository extends BaseRepository {
  /**
   * Get next job number for company
   */
  private async getNextJobNumber(companyId: string): Promise<number> {
    return await db.transaction(async (tx) => {
      // Get or create counter
      let counter = await tx.query.companyCounters.findFirst({
        where: eq(companyCounters.companyId, companyId),
      });

      if (!counter) {
        // Create initial counter
        const [created] = await tx
          .insert(companyCounters)
          .values({ companyId, nextJobNumber: 10000, nextInvoiceNumber: 1001 })
          .returning();
        counter = created;
      }

      const jobNumber = counter.nextJobNumber;

      // Increment for next time
      await tx
        .update(companyCounters)
        .set({ nextJobNumber: jobNumber + 1 })
        .where(eq(companyCounters.companyId, companyId));

      return jobNumber;
    });
  }

  /**
   * Get jobs with optional filters
   */
  async getJobs(companyId: string, filters?: JobFilters): Promise<Job[]> {
    this.assertCompanyId(companyId);

    let query = db
      .select()
      .from(jobs)
      .where(eq(jobs.companyId, companyId))
      .$dynamic();

    if (filters?.status) {
      // Validate status is from allowed enum
      query = query.where(eq(jobs.status, filters.status));
    }

    if (filters?.locationId) {
      // Validate UUID format
      this.validateUUID(filters.locationId, "locationId");
      query = query.where(eq(jobs.locationId, filters.locationId));
    }

    if (filters?.technicianId) {
      // SECURITY FIX: Validate UUID before using in SQL
      this.validateUUID(filters.technicianId, "technicianId");
      
      // Safe to use after validation
      query = query.where(
        sql`${filters.technicianId} = ANY(${jobs.assignedTechnicianIds})`
      );
    }

    if (filters?.startDate) {
      const startDate = new Date(filters.startDate);
      if (!isNaN(startDate.getTime())) {
        query = query.where(gte(jobs.scheduledStart, startDate));
      }
    }

    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      if (!isNaN(endDate.getTime())) {
        query = query.where(lte(jobs.scheduledStart, endDate));
      }
    }

    return await query.orderBy(jobs.createdAt);
  }

  /**
   * Get single job
   */
  async getJob(companyId: string, jobId: string): Promise<Job | null> {
    this.assertCompanyId(companyId);
    this.validateUUID(jobId, "jobId");

    const rows = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Create job with auto-generated job number
   */
  async createJob(companyId: string, jobData: InsertJob): Promise<Job> {
    this.assertCompanyId(companyId);
    
    const jobNumber = await this.getNextJobNumber(companyId);

    const rows = await db
      .insert(jobs)
      .values({
        ...jobData,
        companyId,
        jobNumber,
      })
      .returning();

    return rows[0];
  }

  /**
   * Update job
   */
  async updateJob(
    companyId: string,
    jobId: string,
    patch: Partial<InsertJob>
  ): Promise<Job | null> {
    this.assertCompanyId(companyId);
    this.validateUUID(jobId, "jobId");

    const rows = await db
      .update(jobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
      .returning();

    return rows[0] ?? null;
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    companyId: string,
    jobId: string,
    status: string
  ): Promise<Job | null> {
    this.assertCompanyId(companyId);
    this.validateUUID(jobId, "jobId");

    const updates: any = { status, updatedAt: new Date() };

    // Set timestamps based on status
    if (status === "in_progress" || status === "on_site") {
      updates.actualStart = new Date();
    } else if (status === "completed" || status === "closed") {
      updates.actualEnd = new Date();
    }

    const rows = await db
      .update(jobs)
      .set(updates)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
      .returning();

    return rows[0] ?? null;
  }

  /**
   * Delete job (soft delete)
   */
  async deleteJob(companyId: string, jobId: string): Promise<boolean> {
    this.assertCompanyId(companyId);
    this.validateUUID(jobId, "jobId");

    const rows = await db
      .update(jobs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
      .returning();

    return rows.length > 0;
  }

  /**
   * Get job parts
   */
  async getJobParts(jobId: string): Promise<JobPart[]> {
    this.validateUUID(jobId, "jobId");

    return await db
      .select()
      .from(jobParts)
      .where(and(eq(jobParts.jobId, jobId), eq(jobParts.isActive, true)))
      .orderBy(jobParts.sortOrder);
  }

  /**
   * Create job part
   */
  async createJobPart(jobId: string, partData: InsertJobPart): Promise<JobPart> {
    this.validateUUID(jobId, "jobId");

    const rows = await db
      .insert(jobParts)
      .values({ ...partData, jobId })
      .returning();

    return rows[0];
  }

  /**
   * Update job part
   */
  async updateJobPart(partId: string, patch: Partial<InsertJobPart>): Promise<JobPart | null> {
    this.validateUUID(partId, "partId");

    const rows = await db
      .update(jobParts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(jobParts.id, partId))
      .returning();

    return rows[0] ?? null;
  }

  /**
   * Delete job part (soft delete)
   */
  async deleteJobPart(partId: string): Promise<boolean> {
    this.validateUUID(partId, "partId");

    const rows = await db
      .update(jobParts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(jobParts.id, partId))
      .returning();

    return rows.length > 0;
  }

  /**
   * Reorder job parts
   */
  async reorderJobParts(
    jobId: string,
    parts: Array<{ id: string; sortOrder: number }>
  ): Promise<void> {
    this.validateUUID(jobId, "jobId");

    await db.transaction(async (tx) => {
      for (const part of parts) {
        this.validateUUID(part.id, "partId");
        await tx
          .update(jobParts)
          .set({ sortOrder: part.sortOrder })
          .where(and(eq(jobParts.id, part.id), eq(jobParts.jobId, jobId)));
      }
    });
  }

  /**
   * Get job equipment
   */
  async getJobEquipment(jobId: string) {
    this.validateUUID(jobId, "jobId");

    return await db
      .select()
      .from(jobEquipment)
      .where(eq(jobEquipment.jobId, jobId));
  }

  /**
   * Create job equipment link
   */
  async createJobEquipment(jobId: string, data: { jobId: string; equipmentId: string; notes?: string | null }) {
    this.validateUUID(jobId, "jobId");
    this.validateUUID(data.equipmentId, "equipmentId");

    const rows = await db
      .insert(jobEquipment)
      .values(data)
      .returning();
    return rows[0];
  }

  /**
   * Update job equipment
   */
  async updateJobEquipment(jobEquipmentId: string, patch: { notes?: string | null }) {
    this.validateUUID(jobEquipmentId, "jobEquipmentId");

    const rows = await db
      .update(jobEquipment)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(jobEquipment.id, jobEquipmentId))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Delete job equipment link
   */
  async deleteJobEquipment(jobEquipmentId: string): Promise<boolean> {
    this.validateUUID(jobEquipmentId, "jobEquipmentId");

    const result = await db
      .delete(jobEquipment)
      .where(eq(jobEquipment.id, jobEquipmentId))
      .returning();
    return result.length > 0;
  }

  /**
   * Get location equipment item
   */
  async getLocationEquipmentItem(equipmentId: string) {
    this.validateUUID(equipmentId, "equipmentId");

    const rows = await db
      .select()
      .from(locationEquipment)
      .where(eq(locationEquipment.id, equipmentId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Get recurring series
   */
  async getRecurringSeries(companyId: string, seriesId: string) {
    this.assertCompanyId(companyId);
    this.validateUUID(seriesId, "seriesId");

    const rows = await db
      .select()
      .from(recurringJobSeries)
      .where(
        and(
          eq(recurringJobSeries.id, seriesId),
          eq(recurringJobSeries.companyId, companyId)
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Reconcile job-invoice links
   * Ensures job.invoiceId and invoice.jobId are in sync
   */
  async reconcileJobInvoiceLinks(companyId: string, jobId: string) {
    const job = await this.getJob(companyId, jobId);
    if (!job) {
      throw this.notFoundError("Job");
    }

    return {
      jobId: job.id,
      invoiceId: job.invoiceId,
      reconciled: true,
    };
  }
}

export const jobRepository = new JobRepository();