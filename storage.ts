
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, calendarAssignments } from "@shared/schema";

export const storage = {
  // --- AUTH SUPPORT ---
  async getUser(id: string) {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async getUserByEmail(email: string) {
    const normalized = (email || "").trim().toLowerCase();
    const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
    return rows[0] ?? null;
  },

  async createUser(values: any) {
    // Expect caller to pass hashed password + required fields
    const email = values?.email ? String(values.email).trim().toLowerCase() : values?.email;
    const insertValues = { ...values, email };
    const rows = await db.insert(users).values(insertValues).returning();
    return rows[0];
  },

  async updateUser(id: string, patch: any) {
    const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    return rows[0] ?? null;
  },

  // --- CALENDAR SUPPORT ---
  async getCalendarAssignments(companyId: string) {
    const rows = await db.select().from(calendarAssignments).where(eq(calendarAssignments.companyId, companyId));
    return rows;
  },
};
