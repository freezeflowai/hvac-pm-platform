
import { db } from "../db";

export async function createTechnician(companyId: string, name: string, userId?: string) {
  return db.insertInto("technicians").values({ companyId, name, userId }).returning();
}
