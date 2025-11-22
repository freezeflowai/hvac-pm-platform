import type { Request } from "express";
import { auditService } from "./auditService";

const IMPERSONATION_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface ImpersonationSession {
  platformAdminId: string;
  platformAdminEmail: string;
  targetUserId: string;
  targetCompanyId: string;
  reason: string;
  startedAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

// Extend Express session type
declare module "express-session" {
  interface SessionData {
    impersonation?: ImpersonationSession;
  }
}

class ImpersonationService {
  /**
   * Start impersonation session
   */
  async startImpersonation(
    req: Request,
    platformAdminId: string,
    platformAdminEmail: string,
    targetUserId: string,
    targetCompanyId: string,
    reason: string
  ): Promise<ImpersonationSession> {
    const now = Date.now();
    const session: ImpersonationSession = {
      platformAdminId,
      platformAdminEmail,
      targetUserId,
      targetCompanyId,
      reason,
      startedAt: now,
      lastActivityAt: now,
      expiresAt: now + IMPERSONATION_DURATION_MS
    };

    // Store in Express session
    req.session.impersonation = session;

    // Log the impersonation start
    await auditService.logImpersonationStart(
      platformAdminId,
      platformAdminEmail,
      targetUserId,
      targetCompanyId,
      reason,
      req
    );

    return session;
  }

  /**
   * Stop impersonation session
   */
  async stopImpersonation(req: Request): Promise<void> {
    const session = req.session.impersonation;
    if (!session) {
      return;
    }

    const duration = Date.now() - session.startedAt;

    // Log the impersonation stop
    await auditService.logImpersonationStop(
      session.platformAdminId,
      session.platformAdminEmail,
      session.targetUserId,
      session.targetCompanyId,
      req,
      duration
    );

    // Clear from session
    delete req.session.impersonation;
  }

  /**
   * Check if impersonation is active and valid
   * Returns the session if valid, null otherwise
   * Automatically ends session if expired or idle
   */
  async checkImpersonation(req: Request): Promise<ImpersonationSession | null> {
    const session = req.session.impersonation;
    if (!session) {
      return null;
    }

    const now = Date.now();

    // Check if session has expired (60 minutes)
    if (now > session.expiresAt) {
      await auditService.logImpersonationTimeout(
        session.platformAdminId,
        session.platformAdminEmail,
        session.targetUserId,
        session.targetCompanyId,
        "expiry"
      );
      delete req.session.impersonation;
      return null;
    }

    // Check if session is idle (15 minutes of inactivity)
    const idleTime = now - session.lastActivityAt;
    if (idleTime > IDLE_TIMEOUT_MS) {
      await auditService.logImpersonationTimeout(
        session.platformAdminId,
        session.platformAdminEmail,
        session.targetUserId,
        session.targetCompanyId,
        "idle"
      );
      delete req.session.impersonation;
      return null;
    }

    // Update last activity timestamp
    session.lastActivityAt = now;
    req.session.impersonation = session;

    return session;
  }

  /**
   * Get active impersonation session info
   */
  getActiveImpersonation(req: Request): ImpersonationSession | null {
    return req.session.impersonation || null;
  }

  /**
   * Get remaining time for impersonation session
   */
  getRemainingTime(req: Request): { minutes: number; seconds: number } | null {
    const session = req.session.impersonation;
    if (!session) {
      return null;
    }

    const now = Date.now();
    const remainingMs = session.expiresAt - now;
    
    if (remainingMs <= 0) {
      return { minutes: 0, seconds: 0 };
    }

    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);

    return { minutes, seconds };
  }

  /**
   * Get idle time remaining before auto-logout
   */
  getIdleTimeRemaining(req: Request): { minutes: number; seconds: number } | null {
    const session = req.session.impersonation;
    if (!session) {
      return null;
    }

    const now = Date.now();
    const idleTime = now - session.lastActivityAt;
    const remainingMs = IDLE_TIMEOUT_MS - idleTime;

    if (remainingMs <= 0) {
      return { minutes: 0, seconds: 0 };
    }

    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);

    return { minutes, seconds };
  }

  /**
   * Check if user is a platform admin
   */
  isPlatformAdmin(user: any): boolean {
    return user?.role === "platform_admin";
  }

  /**
   * Get the effective user (impersonated or actual)
   * Returns the target user ID if impersonating, otherwise the current user ID
   */
  getEffectiveUserId(req: Request): string | undefined {
    const session = req.session.impersonation;
    if (session) {
      return session.targetUserId;
    }
    return req.user?.id;
  }

  /**
   * Get the effective company ID (impersonated or actual)
   * Returns the target company ID if impersonating, otherwise the current user's company
   */
  getEffectiveCompanyId(req: Request): string | undefined {
    const session = req.session.impersonation;
    if (session) {
      return session.targetCompanyId;
    }
    return req.user?.companyId;
  }
}

export const impersonationService = new ImpersonationService();
