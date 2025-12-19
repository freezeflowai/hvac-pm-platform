
import type { JobStatus, InvoiceStatus } from "./schemas";

export const JOB_STATUS_FLOW: Record<JobStatus, JobStatus[]> = {
  scheduled: ["on_site", "cancelled"],
  on_site: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completed", "on_hold", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export const INVOICE_STATUS_FLOW: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent"],
  sent: ["paid"],
  paid: [],
};
