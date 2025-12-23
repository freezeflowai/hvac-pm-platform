import { db } from "../db";
import { eq } from "drizzle-orm";
import { companySettings } from "@shared/schema";
import { BaseRepository } from "./base";

export class CompanyRepository extends BaseRepository {
  /**
   * Get company settings
   */
  async getCompanySettings(companyId: string) {
    const rows = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Upsert company settings
   */
  async upsertCompanySettings(companyId: string, settings: any) {
    const existing = await this.getCompanySettings(companyId);

    if (existing) {
      const [updated] = await db
        .update(companySettings)
        .set({ ...settings, updatedAt: new Date().toISOString() })
        .where(eq(companySettings.companyId, companyId))
        .returning();

      return updated;
    } else {
      const [created] = await db
        .insert(companySettings)
        .values({
          companyId,
          userId: companyId, // TODO: Pass actual userId
          ...settings,
        })
        .returning();

      return created;
    }
  }

  /**
   * Get impersonation status (placeholder for now)
   */
  async getImpersonationStatus(companyId: string, userId: string) {
    // This would check if the user is currently being impersonated
    // For now, return a default response
    return {
      isImpersonating: false,
      platformAdminId: null,
      targetUserId: null,
    };
  }
}

export const companyRepository = new CompanyRepository();