
import { pgTable, uuid, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked"
]);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: invitationStatusEnum("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
