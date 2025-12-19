
import { pgTable, uuid, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull(),
  userId: uuid("user_id"),
  action: varchar("action", { length: 64 }).notNull(),
  entity: varchar("entity", { length: 64 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersPatch = {
  disabled: boolean("disabled").default(false).notNull(),
};

export const invoicesPatch = {
  dirty: boolean("dirty").default(false).notNull(),
};
