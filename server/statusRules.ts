import type { JobStatus, InvoiceStatus } from "./schemas";

export const jobTransitions: Record<JobStatus, JobStatus[]> = {
  draft: ["scheduled", "dispatched", "cancelled"],
  scheduled: ["dispatched", "en_route", "in_progress", "on_hold", "cancelled"],
  dispatched: ["en_route", "on_site", "in_progress", "on_hold", "cancelled"],
  en_route: ["on_site", "in_progress", "on_hold", "cancelled"],
  on_site: ["in_progress", "needs_parts", "completed", "on_hold", "cancelled"],
  in_progress: ["needs_parts", "completed", "on_hold", "cancelled"],
  needs_parts: ["in_progress", "on_site", "on_hold", "cancelled"],
  on_hold: ["scheduled", "dispatched", "in_progress", "cancelled"],
  completed: ["invoiced", "closed", "archived"],
  invoiced: ["closed", "archived"],
  closed: ["archived"],
  archived: [],
  cancelled: [],
};

export const invoiceTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["pending", "sent", "void", "cancelled"],
  pending: ["sent", "void", "cancelled"],
  sent: ["paid", "void", "cancelled"],
  paid: ["void"],
  void: [],
  cancelled: [],
};

export function assertJobStatusTransition(from: JobStatus, to: JobStatus): void {
  if (from === to) return;
  
  const allowed = jobTransitions[from];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid job status transition: cannot move from '${from}' to '${to}'`);
  }
}

export function assertInvoiceStatusTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (from === to) return;
  
  const allowed = invoiceTransitions[from];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid invoice status transition: cannot move from '${from}' to '${to}'`);
  }
}

export function getValidJobTransitions(from: JobStatus): JobStatus[] {
  return jobTransitions[from] || [];
}

export function getValidInvoiceTransitions(from: InvoiceStatus): InvoiceStatus[] {
  return invoiceTransitions[from] || [];
}
