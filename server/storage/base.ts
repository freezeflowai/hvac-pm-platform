import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";

/**
 * Base repository class with tenant isolation
 * All domain repositories extend this for automatic security
 */
export class BaseRepository {
  /**
   * Ensures a record belongs to the specified company
   * Throws 404 if not found or doesn't belong to company
   */
  protected async validateTenantOwnership<T extends { companyId: string }>(
    record: T | null,
    companyId: string,
    resourceName: string
  ): Promise<T> {
    if (!record) {
      const err: any = new Error(`${resourceName} not found`);
      err.status = 404;
      throw err;
    }

    if (record.companyId !== companyId) {
      // Security: Don't reveal that resource exists in another tenant
      const err: any = new Error(`${resourceName} not found`);
      err.status = 404;
      throw err;
    }

    return record;
  }

  /**
   * Validates that a user belongs to the specified company
   */
  protected async validateUserInCompany(
    userId: string,
    companyId: string
  ): Promise<void> {
    const result = await db.query.users.findFirst({
      where: (users, { eq, and }) => 
        and(eq(users.id, userId), eq(users.companyId, companyId))
    });

    if (!result) {
      const err: any = new Error("User not found or not in company");
      err.status = 403;
      throw err;
    }
  }

  /**
   * Creates a not found error
   */
  protected notFoundError(resourceName: string): Error {
    const err: any = new Error(`${resourceName} not found`);
    err.status = 404;
    return err;
  }

  /**
   * Creates a validation error
   */
  protected validationError(message: string): Error {
    const err: any = new Error(message);
    err.status = 400;
    return err;
  }

  /**
   * Creates a forbidden error
   */
  protected forbiddenError(message: string): Error {
    const err: any = new Error(message);
    err.status = 403;
    return err;
  }
}

/**
 * Tenant isolation helper - adds companyId filter to where clause
 */
export function withCompanyId<T extends Record<string, any>>(
  table: T,
  companyId: string
) {
  return eq((table as any).companyId, companyId);
}

/**
 * Safely parse numeric values from text fields
 */
export function parseDecimal(value: string | null | undefined, defaultValue = "0"): string {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : value;
}

/**
 * Format date to ISO date string (YYYY-MM-DD)
 */
export function formatDateOnly(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}