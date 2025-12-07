import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table - each HVAC business is a company
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  provinceState: text("province_state"),
  postalCode: text("postal_code"),
  email: text("email"),
  phone: text("phone"),
  // Subscription and trial fields (moved from users to companies)
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionStatus: text("subscription_status").notNull().default("trial"),
  subscriptionPlan: text("subscription_plan"),
  billingInterval: text("billing_interval"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("technician"), // "platform_admin", "owner", "admin", "technician"
  fullName: text("full_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Authenticated user type that merges User with Company subscription data
export type AuthenticatedUser = User & Pick<Company, 
  "trialEndsAt" | 
  "subscriptionStatus" | 
  "subscriptionPlan" | 
  "stripeCustomerId" | 
  "stripeSubscriptionId" | 
  "billingInterval" | 
  "currentPeriodEnd" | 
  "cancelAtPeriodEnd"
>;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  requestedIp: text("requested_ip"),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Audit logs for tracking impersonation and cross-tenant actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platformAdminId: varchar("platform_admin_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platformAdminEmail: text("platform_admin_email").notNull(),
  targetCompanyId: varchar("target_company_id").references(() => companies.id, { onDelete: "set null" }),
  targetUserId: varchar("target_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // "impersonation_start", "impersonation_stop", "cross_tenant_read", "cross_tenant_write", "auth_failure"
  reason: text("reason"), // Required for impersonation actions
  details: text("details"), // JSON string with additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Customer Companies - Parent entities that map to QBO Customers
// These represent the corporate entity (e.g. "ABC Holdings Inc")
export const customerCompanies = pgTable("customer_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  // Company information
  name: text("name").notNull(), // Main company name (maps to QBO DisplayName for parent)
  legalName: text("legal_name"), // Official legal name if different
  phone: text("phone"),
  email: text("email"),
  // Billing address (used for QBO BillAddr)
  billingStreet: text("billing_street"),
  billingCity: text("billing_city"),
  billingProvince: text("billing_province"),
  billingPostalCode: text("billing_postal_code"),
  billingCountry: text("billing_country"),
  // Status
  isActive: boolean("is_active").notNull().default(true),
  // QBO sync fields
  qboCustomerId: text("qbo_customer_id"), // QBO Customer.Id
  qboSyncToken: text("qbo_sync_token"), // QBO Customer.SyncToken (required for updates)
  qboLastSyncedAt: timestamp("qbo_last_synced_at"),
  // Metadata
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at"),
});

export const insertCustomerCompanySchema = createInsertSchema(customerCompanies).omit({
  id: true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomerCompanySchema = insertCustomerCompanySchema.partial();

export type InsertCustomerCompany = z.infer<typeof insertCustomerCompanySchema>;
export type UpdateCustomerCompany = z.infer<typeof updateCustomerCompanySchema>;
export type CustomerCompany = typeof customerCompanies.$inferSelect;

// Clients (Locations) - Child entities that map to QBO Sub-Customers
// These represent specific sites/locations (e.g. "Toronto Warehouse")
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Parent company reference (optional - if null, this is a standalone client)
  parentCompanyId: varchar("parent_company_id").references(() => customerCompanies.id, { onDelete: "set null" }),
  companyName: text("company_name").notNull(),
  location: text("location"), // Location/site name (e.g. "Toronto Warehouse")
  // Service address
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  // Contact info
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  roofLadderCode: text("roof_ladder_code"),
  notes: text("notes"),
  // PM scheduling
  selectedMonths: integer("selected_months").array().notNull(),
  inactive: boolean("inactive").notNull().default(false),
  nextDue: text("next_due").notNull(),
  // QBO sync fields
  billWithParent: boolean("bill_with_parent").notNull().default(true), // Maps to QBO "Bill with parent"
  qboCustomerId: text("qbo_customer_id"), // QBO Sub-Customer.Id
  qboParentCustomerId: text("qbo_parent_customer_id"), // QBO parent Customer.Id (mirrors QBO ParentRef)
  qboSyncToken: text("qbo_sync_token"), // QBO Sub-Customer.SyncToken
  qboLastSyncedAt: timestamp("qbo_last_synced_at"),
  // Metadata
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  companyId: true,
  userId: true,
  createdAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const parts = pgTable("parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "filter", "belt", "other", "service", "product"
  // Filter-specific fields
  filterType: text("filter_type"), // "Pleated", "Media", "Ecology", "Throwaway", "Other"
  // Belt-specific fields
  beltType: text("belt_type"), // "A", "B", "Other"
  // Shared between filters and belts
  size: text("size"),
  // Other parts/products/services fields
  name: text("name"),
  description: text("description"),
  // Pricing fields (for products and services)
  cost: text("cost"), // Cost price in dollars (stored as text to preserve decimals)
  unitPrice: text("unit_price"), // Selling price in dollars
  taxExempt: boolean("tax_exempt").default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertPartSchema = createInsertSchema(parts).omit({
  id: true,
  companyId: true,
  userId: true,
  createdAt: true,
});

export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof parts.$inferSelect;

export const clientParts = pgTable("client_parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  partId: varchar("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
});

export const insertClientPartSchema = createInsertSchema(clientParts).omit({
  id: true,
  companyId: true,
  userId: true,
});

export type InsertClientPart = z.infer<typeof insertClientPartSchema>;
export type ClientPart = typeof clientParts.$inferSelect;

export const maintenanceRecords = pgTable("maintenance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  dueDate: text("due_date").notNull(),
  completedAt: text("completed_at"),
});

export const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).omit({
  id: true,
  companyId: true,
  userId: true,
});

export type InsertMaintenanceRecord = z.infer<typeof insertMaintenanceRecordSchema>;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;

export const calendarAssignments = pgTable("calendar_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  jobNumber: integer("job_number").notNull(),
  assignedTechnicianIds: varchar("assigned_technician_ids").array(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day"),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledHour: integer("scheduled_hour"),
  autoDueDate: boolean("auto_due_date").notNull().default(true),
  completed: boolean("completed").notNull().default(false),
  completionNotes: text("completion_notes"),
});

// Company counters table - tracks sequential counters per company (e.g., job numbers)
export const companyCounters = pgTable("company_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().unique().references(() => companies.id, { onDelete: "cascade" }),
  nextJobNumber: integer("next_job_number").notNull().default(10000),
});

export const insertCalendarAssignmentSchema = createInsertSchema(calendarAssignments).omit({
  id: true,
  companyId: true,
  userId: true,
  jobNumber: true,
});

export const updateCalendarAssignmentSchema = z.object({
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  scheduledHour: z.number().int().min(0).max(23).nullable().optional(),
  autoDueDate: z.boolean().optional(),
  completed: z.boolean().optional(),
  completionNotes: z.string().nullable().optional(),
  assignedTechnicianIds: z.array(z.string()).optional(),
  assignedTechnicianId: z.string().nullable().optional(), // Legacy support
});

export type InsertCalendarAssignment = z.infer<typeof insertCalendarAssignmentSchema>;
export type UpdateCalendarAssignment = z.infer<typeof updateCalendarAssignmentSchema>;
export type CalendarAssignment = typeof calendarAssignments.$inferSelect;

export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type"),
  modelNumber: text("model_number"),
  serialNumber: text("serial_number"),
  location: text("location"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  companyId: true,
  userId: true,
  createdAt: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().unique().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name"),
  address: text("address"),
  city: text("city"),
  provinceState: text("province_state"),
  postalCode: text("postal_code"),
  email: text("email"),
  phone: text("phone"),
  calendarStartHour: integer("calendar_start_hour").notNull().default(8),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  companyId: true,
  userId: true,
  updatedAt: true,
});

export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

// Invitation tokens for technician onboarding
export const invitationTokens = pgTable("invitation_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  email: text("email"),
  role: text("role").notNull().default("technician"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  usedByUserId: varchar("used_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertInvitationTokenSchema = createInsertSchema(invitationTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertInvitationToken = z.infer<typeof insertInvitationTokenSchema>;
export type InvitationToken = typeof invitationTokens.$inferSelect;

export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  status: text("status").notNull().default("new"),
  archived: boolean("archived").notNull().default(false),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  companyId: true,
  userId: true,
  userEmail: true,
  createdAt: true,
  status: true,
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  stripePriceId: text("stripe_price_id"),
  monthlyPriceCents: integer("monthly_price_cents"),
  locationLimit: integer("location_limit").notNull(),
  isTrial: boolean("is_trial").notNull().default(false),
  trialDays: integer("trial_days"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// Job notes table - stores multiple timestamped notes per assignment with optional images
export const jobNotes = pgTable("job_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  assignmentId: varchar("assignment_id").notNull().references(() => calendarAssignments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteText: text("note_text").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertJobNoteSchema = createInsertSchema(jobNotes).omit({
  id: true,
  companyId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateJobNoteSchema = z.object({
  noteText: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
});

export type InsertJobNote = z.infer<typeof insertJobNoteSchema>;
export type UpdateJobNote = z.infer<typeof updateJobNoteSchema>;
export type JobNote = typeof jobNotes.$inferSelect;

// Client notes table - stores multiple timestamped notes per client
export const clientNotes = pgTable("client_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteText: text("note_text").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertClientNoteSchema = createInsertSchema(clientNotes).omit({
  id: true,
  companyId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientNoteSchema = z.object({
  noteText: z.string().optional(),
});

export type InsertClientNote = z.infer<typeof insertClientNoteSchema>;
export type UpdateClientNote = z.infer<typeof updateClientNoteSchema>;
export type ClientNote = typeof clientNotes.$inferSelect;
