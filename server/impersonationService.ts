import type { Request } from "express";
import { auditService } from "./auditService";
import crypto from "crypto";

const IMPERSONATION_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface ImpersonationSession {
  sessionId: string; // Opaque identifier
  platformAdminId: string;
  platformAdminEmail: string;
  targetUserId: string;
  targetCompanyId: string;
  reason: string;
  startedAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

// Server-side storage for impersonation sessions (not in client-writable session)
// In production, this should be Redis or database-backed for multi-server setups
const activeSessions = new Map<string, ImpersonationSession>();

// Extend Express session type to only store opaque session ID
declare module "express-session" {
  interface SessionData {
    impersonationSessionId?: string; // Only opaque ID, not full session data
  }
}

class ImpersonationService {
  /**
   * Generate a cryptographically secure session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get session from server-side storage
   */
  private getSessionById(sessionId: string): ImpersonationSession | null {
    const session = activeSessions.get(sessionId);
    return session || null;
  }

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
    const sessionId = this.generateSessionId();
    
    const session: ImpersonationSession = {
      sessionId,
      platformAdminId,
      platformAdminEmail,
      targetUserId,
      targetCompanyId,
      reason,
      startedAt: now,
      lastActivityAt: now,
      expiresAt: now + IMPERSONATION_DURATION_MS
    };

    // Store in server-side Map (not client session)
    activeSessions.set(sessionId, session);

    // Only store opaque session ID in client session
    req.session.impersonationSessionId = sessionId;

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
   * Validates that the requester is the original platform admin
   */
  async stopImpersonation(req: Request, requestingPlatformAdminId: string): Promise<void> {
    const sessionId = req.session.impersonationSessionId;
    if (!sessionId) {
      return;
    }

    const session = this.getSessionById(sessionId);
    if (!session) {
      // Session not found in server storage, just clear client session
      delete req.session.impersonationSessionId;
      return;
    }

    // CRITICAL: Verify the requesting platform admin is the one who started the session
    if (session.platformAdminId !== requestingPlatformAdminId) {
      throw new Error("Unauthorized: Only the original platform admin can stop this impersonation");
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

    // Remove from server-side storage
    activeSessions.delete(sessionId);
    
    // Clear from client session
    delete req.session.impersonationSessionId;
  }

  /**
   * Check if impersonation is active and valid
   * Returns the session if valid, null otherwise
   * Automatically ends session if expired or idle
   */
  async checkImpersonation(req: Request): Promise<ImpersonationSession | null> {
    const sessionId = req.session.impersonationSessionId;
    if (!sessionId) {
      return null;
    }

    // Retrieve from server-side storage (not client session!)
    const session = this.getSessionById(sessionId);
    if (!session) {
      // Session ID in client but not in server = cleared/expired
      delete req.session.impersonationSessionId;
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
      activeSessions.delete(sessionId);
      delete req.session.impersonationSessionId;
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
      activeSessions.delete(sessionId);
      delete req.session.impersonationSessionId;
      return null;
    }

    // Update last activity timestamp in server storage
    session.lastActivityAt = now;
    activeSessions.set(sessionId, session);

    return session;
  }

  /**
   * Get active impersonation session info (from server storage)
   */
  getActiveImpersonation(req: Request): ImpersonationSession | null {
    const sessionId = req.session.impersonationSessionId;
    if (!sessionId) {
      return null;
    }
    return this.getSessionById(sessionId);
  }

  /**
   * Get remaining time for impersonation session
   */
  getRemainingTime(req: Request): { minutes: number; seconds: number } | null {
    const session = this.getActiveImpersonation(req);
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
    const session = this.getActiveImpersonation(req);
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
    const session = this.getActiveImpersonation(req);
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
    const session = this.getActiveImpersonation(req);
    if (session) {
      return session.targetCompanyId;
    }
    return req.user?.companyId;
  }

  /**
   * Get the actual platform admin user (before impersonation merge)
   * Used for authorization checks and audit logging
   */
  getActualPlatformAdmin(req: Request): any {
    return (req as any).platformAdmin || null;
  }
}

export const impersonationService = new ImpersonationService();
