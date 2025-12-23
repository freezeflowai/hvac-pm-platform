import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { users, companies, calendarAssignments } from "@shared/schema";

/**
 * Legacy storage surface kept for backward compatibility.
 *
 * IMPORTANT:
 * - New code should import from ./storage/index (folder-based repos).
 * - This file exists so older imports don't break during refactors.
 */

export interface IStorage {
  getUser(id: string): Promise<any | null>;
  getUserByEmail(email: string): Promise<any | null>;
  createUser(user: any): Promise<any>;
  updateUser(id: string, user: any): Promise<any>;
  getCompanyById(id: string): Promise<any | null>;
  getCalendarAssignments(companyId: string): Promise<any[]>;
}

// --- AUTH SUPPORT ---
export async function getUser(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const normalized = (email || "").trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(user: any) {
  const insert = {
    ...user,
    email: (user.email || "").trim().toLowerCase(),
  };
  const rows = await db.insert(users).values(insert).returning();
  return rows[0];
}

export async function updateUser(id: string, user: any) {
  const patch = {
    ...user,
    ...(user.email ? { email: String(user.email).trim().toLowerCase() } : {}),
  };
  const rows = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return rows[0];
}

export async function getCompanyById(id: string) {
  const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCalendarAssignments(companyId: string) {
  if (!companyId) return [];
  const rows = await db
    .select()
    .from(calendarAssignments)
    .where(eq(calendarAssignments.companyId, companyId));
  return rows;
}

// Backwards-compatible storage object (many files import { storage } or default storage)
export const storage: IStorage = {
  getUser,
  getUserByEmail,
  createUser,
  updateUser,
  getCompanyById,
  getCalendarAssignments,
};

export default storage;
