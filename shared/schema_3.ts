
import { pgTable, uuid, varchar, timestamp, integer } from "drizzle-orm/pg-core";

export const technicians = pgTable("technicians", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const laborEntries = pgTable("labor_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  technicianId: uuid("technician_id").notNull(),
  jobId: uuid("job_id").notNull(),
  minutes: integer("minutes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
