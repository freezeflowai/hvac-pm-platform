import { db } from "./db";
import { auditLogs, type InsertAuditLog } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { Request } from "express";

export type AuditAction = 
  | "impersonation_start"
  | "impersonation_stop"
  | "impersonation_auto_timeout"
  | "cross_tenant_read"
  | "cross_tenant_write"
  | "auth_failure"
  | "billing_adjustment"
  | "trial_adjustment"
  | "company_status_change";

interface AuditLogParams {
  platformAdminId: string;
  platformAdminEmail: string;
  action: AuditAction;
  targetCompanyId?: string;
  targetUserId?: string;
  reason?: string;
  details?: Record<string, any>;
  req?: Request;
}

class AuditService {
  /**
   * Create an audit log entry
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      const {
        platformAdminId,
        platformAdminEmail,
        action,
        targetCompanyId,
        targetUserId,
        reason,
        details,
        req
      } = params;

      // Validate that impersonation actions include a reason
      if (action.startsWith("impersonation") && action !== "impersonation_auto_timeout" && !reason) {
        throw new Error("Reason is required for impersonation actions");
      }

      const auditLogData: InsertAuditLog = {
        platformAdminId,
        platformAdminEmail,
        action,
        targetCompanyId: targetCompanyId || null,
        targetUserId: targetUserId || null,
        reason: reason || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: req ? this.getIpAddress(req) : null,
        userAgent: req?.headers['user-agent'] || null,
      };

      await db.insert(auditLogs).values(auditLogData);
    } catch (error) {
      // Log error but don't throw - audit failures shouldn't break operations
      console.error("Audit logging failed:", error);
    }
  }

  /**
   * Log impersonation start
   */
  async logImpersonationStart(
    platformAdminId: string,
    platformAdminEmail: string,
    targetUserId: string,
    targetCompanyId: string,
    reason: string,
    req: Request
  ): Promise<void> {
    await this.log({
      platformAdminId,
      platformAdminEmail,
      action: "impersonation_start",
      targetCompanyId,
      targetUserId,
      reason,
      req,
      details: {
        expiresIn: "60 minutes",
        idleTimeout: "15 minutes"
      }
    });
  }

  /**
   * Log impersonation stop (manual)
   */
  async logImpersonationStop(
    platformAdminId: string,
    platformAdminEmail: string,
    targetUserId: string,
    targetCompanyId: string,
    req: Request,
    duration?: number
  ): Promise<void> {
    await this.log({
      platformAdminId,
      platformAdminEmail,
      action: "impersonation_stop",
      targetCompanyId,
      targetUserId,
      req,
      details: {
        durationMinutes: duration ? Math.round(duration / 60000) : undefined
      }
    });
  }

  /**
   * Log impersonation auto-timeout
   */
  async logImpersonationTimeout(
    platformAdminId: string,
    platformAdminEmail: string,
    targetUserId: string,
    targetCompanyId: string,
    timeoutType: "expiry" | "idle"
  ): Promise<void> {
    await this.log({
      platformAdminId,
      platformAdminEmail,
      action: "impersonation_auto_timeout",
      targetCompanyId,
      targetUserId,
      details: {
        timeoutType
      }
    });
  }

  /**
   * Log cross-tenant read operation
   */
  async logCrossTenantRead(
    platformAdminId: string,
    platformAdminEmail: string,
    targetCompanyId: string,
    resource: string,
    req: Request
  ): Promise<void> {
    await this.log({
      platformAdminId,
      platformAdminEmail,
      action: "cross_tenant_read",
      targetCompanyId,
      req,
      details: {
        resource
      }
    });
  }

  /**
   * Log cross-tenant write operation
   */
  async logCrossTenantWrite(
    platformAdminId: string,
    platformAdminEmail: string,
    targetCompanyId: string,
    resource: string,
    operation: string,
    req: Request
  ): Promise<void> {
    await this.log({
      platformAdminId,
      platformAdminEmail,
      action: "cross_tenant_write",
      targetCompanyId,
      req,
      details: {
        resource,
        operation
      }
    });
  }

  /**
   * Log failed authorization attempt
   */
  async logAuthFailure(
    userId: string,
    userEmail: string,
    attemptedAction: string,
    req: Request,
    reason?: string
  ): Promise<void> {
    await this.log({
      platformAdminId: userId,
      platformAdminEmail: userEmail,
      action: "auth_failure",
      req,
      details: {
        attemptedAction,
        failureReason: reason
      }
    });
  }

  /**
   * Log billing adjustment
   */
  async logBillingAdjustment(
    platformAdminId: string,
    platformAdminEmail: string,
    targetCompanyId: string,
    adjustment: Record<string, any>,
    req: Request
  ): Promise<void> {
    await this.log({
      platformAdminId,
      platformAdminEmail,
      action: "billing_adjustment",
      targetCompanyId,
      req,
      details: adjustment
    });
  }

  /**
   * Log trial adjustment
   */
  async logTrialAdjustment(
    platformAdminId: string,
    platformAdminEmail: string,
    targetCompanyId: string,
    adjustment: Record<string, any>,
    req: Request
  ): Promise<void> {
    await this.log({
      platformAdminId,
      platformAdminEmail,
      action: "trial_adjustment",
      targetCompanyId,
      req,
      details: adjustment
    });
  }

  /**
   * Get audit logs for a platform admin
   */
  async getLogsForAdmin(platformAdminId: string, limit = 100) {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.platformAdminId, platformAdminId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * Get audit logs for a company
   */
  async getLogsForCompany(companyId: string, limit = 100) {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetCompanyId, companyId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * Get recent audit logs (all)
   */
  async getRecentLogs(limit = 100) {
    return db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  /**
   * Extract IP address from request (handles proxies)
   */
  private getIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}

export const auditService = new AuditService();
