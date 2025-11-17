import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  location: text("location"),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  roofLadderCode: text("roof_ladder_code"),
  notes: text("notes"),
  selectedMonths: integer("selected_months").array().notNull(),
  inactive: boolean("inactive").notNull().default(false),
  nextDue: text("next_due").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export const parts = pgTable("parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "filter", "belt", or "other"
  // Filter-specific fields
  filterType: text("filter_type"), // "Pleated", "Media", "Ecology", "Throwaway", "Other"
  // Belt-specific fields
  beltType: text("belt_type"), // "A", "B", "Other"
  // Shared between filters and belts
  size: text("size"),
  // Other parts fields
  name: text("name"),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertPartSchema = createInsertSchema(parts).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof parts.$inferSelect;

export const clientParts = pgTable("client_parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  partId: varchar("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
});

export const insertClientPartSchema = createInsertSchema(clientParts).omit({
  id: true,
  userId: true,
});

export type InsertClientPart = z.infer<typeof insertClientPartSchema>;
export type ClientPart = typeof clientParts.$inferSelect;

export const maintenanceRecords = pgTable("maintenance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  dueDate: text("due_date").notNull(),
  completedAt: text("completed_at"),
});

export const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).omit({
  id: true,
  userId: true,
});

export type InsertMaintenanceRecord = z.infer<typeof insertMaintenanceRecordSchema>;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;

export const calendarAssignments = pgTable("calendar_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  day: integer("day"),
  scheduledDate: text("scheduled_date").notNull(),
  autoDueDate: boolean("auto_due_date").notNull().default(true),
  completed: boolean("completed").notNull().default(false),
});

export const insertCalendarAssignmentSchema = createInsertSchema(calendarAssignments).omit({
  id: true,
  userId: true,
});

export const updateCalendarAssignmentSchema = z.object({
  day: z.number().int().min(1).max(31).nullable().optional(),
  scheduledDate: z.string().optional(),
  autoDueDate: z.boolean().optional(),
  completed: z.boolean().optional(),
});

export type InsertCalendarAssignment = z.infer<typeof insertCalendarAssignmentSchema>;
export type UpdateCalendarAssignment = z.infer<typeof updateCalendarAssignmentSchema>;
export type CalendarAssignment = typeof calendarAssignments.$inferSelect;

export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  userId: true,
  createdAt: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name"),
  address: text("address"),
  city: text("city"),
  provinceState: text("province_state"),
  postalCode: text("postal_code"),
  email: text("email"),
  phone: text("phone"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  userId: true,
  updatedAt: true,
});

export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;
