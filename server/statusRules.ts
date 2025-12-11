import type { JobStatus, InvoiceStatus } from "./schemas";

export const jobTransitions: Record<JobStatus, JobStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completed", "on_hold", "cancelled"],
  on_hold: ["in_progress", "scheduled", "cancelled"],
  completed: ["invoiced"],
  invoiced: [],
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
