import { db } from "../db";
import { eq, and, or, like, sql } from "drizzle-orm";
import { parts } from "@shared/schema";
import type { InsertPart, Part } from "@shared/schema";
import { BaseRepository } from "./base";

export class PartRepository extends BaseRepository {
  /**
   * Get parts with optional search query
   */
  async getParts(companyId: string, searchQuery?: string): Promise<Part[]> {
    let query = db
      .select()
      .from(parts)
      .where(and(eq(parts.companyId, companyId), eq(parts.isActive, true)))
      .$dynamic();

    if (searchQuery) {
      const search = `%${searchQuery}%`;
      query = query.where(
        or(
          like(parts.name, search),
          like(parts.sku, search),
          like(parts.description, search),
          like(parts.filterType, search),
          like(parts.beltType, search)
        )
      );
    }

    return await query.orderBy(parts.name);
  }

  /**
   * Get single part
   */
  async getPart(companyId: string, partId: string): Promise<Part | null> {
    const rows = await db
      .select()
      .from(parts)
      .where(and(eq(parts.id, partId), eq(parts.companyId, companyId)))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Create part
   */
  async createPart(companyId: string, partData: any): Promise<Part> {
    // Auto-calculate unitPrice from cost and markup if provided
    let unitPrice = partData.unitPrice;
    if (!unitPrice && partData.cost && partData.markupPercent) {
      const cost = parseFloat(partData.cost);
      const markup = parseFloat(partData.markupPercent);
      unitPrice = (cost * (1 + markup / 100)).toFixed(2);
    }

    const rows = await db
      .insert(parts)
      .values({
        ...partData,
        companyId,
        userId: companyId, // TODO: Pass actual userId
        unitPrice: unitPrice || partData.unitPrice,
      })
      .returning();

    return rows[0];
  }

  /**
   * Update part
   */
  async updatePart(
    companyId: string,
    partId: string,
    patch: Partial<InsertPart>
  ): Promise<Part | null> {
    // Auto-calculate unitPrice from cost and markup if provided
    if (patch.cost && patch.markupPercent && !patch.unitPrice) {
      const cost = parseFloat(String(patch.cost));
      const markup = parseFloat(String(patch.markupPercent));
      patch.unitPrice = (cost * (1 + markup / 100)).toFixed(2);
    }

    const rows = await db
      .update(parts)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(parts.id, partId), eq(parts.companyId, companyId)))
      .returning();

    return rows[0] ?? null;
  }

  /**
   * Delete part (soft delete)
   */
  async deletePart(companyId: string, partId: string): Promise<{ success: boolean }> {
    const rows = await db
      .update(parts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(parts.id, partId), eq(parts.companyId, companyId)))
      .returning();

    return { success: rows.length > 0 };
  }
}

export const partRepository = new PartRepository();