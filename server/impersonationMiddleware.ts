import type { Request, Response, NextFunction } from "express";
import { impersonationService } from "./impersonationService";
import { auditService } from "./auditService";
import type { IStorage } from "./storage";
import type { AuthenticatedUser } from "@shared/schema";

/**
 * Middleware that checks for active impersonation and merges impersonated user context.
 * Keeps tenant-scoped validation working automatically.
 *
 * NOTE:
 * - This intentionally uses runtime feature detection (service method existence)
 *   to stay compatible during refactors.
 */
export function impersonationMiddleware(storage: IStorage) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only process if user is authenticated
      if (!req.isAuthenticated?.() || !req.user) return next();

      const svc: any = impersonationService as any;

      // Some versions expose: checkImpersonation(req, storage)
      if (typeof svc.checkImpersonation === "function") {
        const result = await svc.checkImpersonation(req, storage);
        // If it returns an impersonated user context, ensure req.user is updated.
        if (result && typeof result === "object" && (result as any).id) {
          (req as any).user = result as AuthenticatedUser;
        }
      } else if (typeof svc.getActiveImpersonation === "function") {
        // Alternative API: getActiveImpersonation(userId)
        const active = await svc.getActiveImpersonation((req.user as any).id);
        if (active?.impersonatedUser) {
          (req as any).user = active.impersonatedUser as AuthenticatedUser;
        }
      }

      // Audit impersonation access if applicable
      const user: any = req.user;
      if (user?.impersonatedById) {
        const audit: any = auditService as any;
        if (typeof audit.log === "function") {
          await audit.log({
            action: "impersonation.request",
            userId: user.id,
            companyId: user.companyId,
            metadata: { 
              impersonatedById: user.impersonatedById, 
              path: req.path, 
              method: req.method 
            },
          });
        }
      }

      return next();
    } catch (err) {
      // SECURITY FIX: Log errors but don't block requests
      console.error('[IMPERSONATION] Error in impersonation middleware:', err);
      // Never block the request due to audit/impersonation plumbing issues
      return next();
    }
  };
}

/**
 * Middleware to update last activity timestamp on each request.
 * Kept for backwards compatibility.
 */
export function trackActivity(req: Request, _res: Response, next: NextFunction) {
  try {
    const svc: any = impersonationService as any;
    if (req.isAuthenticated?.() && req.user && typeof svc.trackActivity === "function") {
      svc.trackActivity((req.user as any).id);
    }
  } catch (err) {
    // SECURITY FIX: Log errors silently
    console.error('[IMPERSONATION] Error tracking activity:', err);
  }
  return next();
}