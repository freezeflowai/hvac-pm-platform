import { z } from "zod";

export const moneyNumber = z.coerce.number().min(0).finite();
export const optionalMoneyNumber = moneyNumber.nullable().optional();

export const jobStatusEnum = z.enum([
  "draft",
  "scheduled", 
  "dispatched",
  "en_route",
  "on_site",
  "in_progress",
  "needs_parts",
  "on_hold",
  "completed",
  "invoiced",
  "closed",
  "archived",
  "cancelled"
]);

export const invoiceStatusEnum = z.enum([
  "draft",
  "pending",
  "sent",
  "paid",
  "partial_paid",
  "voided",
  "cancelled"
]);

export type JobStatus = z.infer<typeof jobStatusEnum>;
export type InvoiceStatus = z.infer<typeof invoiceStatusEnum>;

export const itemBaseSchema = z.object({
  type: z.enum(["product", "service", "filter", "belt", "other"]),
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  cost: moneyNumber,
  markupPercent: optionalMoneyNumber,
  unitPrice: moneyNumber,
  isTaxable: z.coerce.boolean().default(true),
});

export type ItemInput = z.infer<typeof itemBaseSchema>;

export const jobCreateSchema = z.object({
  companyId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  summary: z.string().min(1, "Summary is required"),
  description: z.string().optional().nullable(),
  accessInstructions: z.string().optional().nullable(),
  jobType: z.enum(["maintenance", "repair", "inspection", "installation", "emergency"]).default("maintenance"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  scheduledStart: z.string().datetime().optional().nullable(),
  scheduledEnd: z.string().datetime().optional().nullable(),
  assignedTechnicianId: z.string().uuid().optional().nullable(),
  calendarAssignmentId: z.string().uuid().optional().nullable(),
});

export type JobCreateInput = z.infer<typeof jobCreateSchema>;

export const jobUpdateStatusSchema = z.object({
  status: jobStatusEnum,
});

export type JobUpdateStatusInput = z.infer<typeof jobUpdateStatusSchema>;

export const invoiceUpdateStatusSchema = z.object({
  status: invoiceStatusEnum,
});

export type InvoiceUpdateStatusInput = z.infer<typeof invoiceUpdateStatusSchema>;

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: moneyNumber.default(1),
  unitPrice: moneyNumber,
  lineSubtotal: moneyNumber.optional(),
  taxCode: z.string().optional().nullable(),
  qboItemRef: z.string().optional().nullable(),
  equipmentId: z.string().uuid().optional().nullable(),
  partId: z.string().uuid().optional().nullable(),
});

export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
