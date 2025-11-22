import type { Request, Response, NextFunction } from "express";
import { impersonationService } from "./impersonationService";
import { auditService } from "./auditService";
import type { IStorage } from "./storage";
import type { AuthenticatedUser } from "@shared/schema";

/**
 * Middleware that checks for active impersonation and merges impersonated user context
 * This makes all existing tenant-scoped validation work automatically
 */
export function impersonationMiddleware(storage: IStorage) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only process if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return next();
      }

      // Check for active impersonation session
      const session = await impersonationService.checkImpersonation(req);
      
      if (session) {
        // Fetch the target user that we're impersonating
        const targetUser = await storage.getUser(session.targetUserId);
        if (!targetUser) {
          // Target user no longer exists, end impersonation
          await impersonationService.stopImpersonation(req, session.platformAdminId);
          return next();
        }

        // Fetch the target company data
        const targetCompany = await storage.getCompanyById(session.targetCompanyId);
        if (!targetCompany) {
          // Target company no longer exists, end impersonation
          await impersonationService.stopImpersonation(req, session.platformAdminId);
          return next();
        }

        // Store the original platform admin user
        (req as any).platformAdmin = req.user;

        // Merge target user + company subscription data
        const impersonatedUser: AuthenticatedUser = {
          ...targetUser,
          trialEndsAt: targetCompany.trialEndsAt,
          subscriptionStatus: targetCompany.subscriptionStatus,
          subscriptionPlan: targetCompany.subscriptionPlan,
          stripeCustomerId: targetCompany.stripeCustomerId,
          stripeSubscriptionId: targetCompany.stripeSubscriptionId,
          billingInterval: targetCompany.billingInterval,
          currentPeriodEnd: targetCompany.currentPeriodEnd,
          cancelAtPeriodEnd: targetCompany.cancelAtPeriodEnd
        };

        // Replace req.user with the impersonated user
        // This makes all existing tenant-scoped validation work automatically
        req.user = impersonatedUser;

        // Add a flag to indicate we're impersonating
        (req as any).isImpersonating = true;
        (req as any).impersonationSession = session;
      }

      next();
    } catch (error) {
      console.error("Impersonation middleware error:", error);
      next(error);
    }
  };
}

/**
 * Middleware that requires platform admin role
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Check the actual user (not impersonated user)
  const actualUser = (req as any).platformAdmin || req.user;
  
  if (!impersonationService.isPlatformAdmin(actualUser)) {
    // Log failed authorization attempt
    auditService.logAuthFailure(
      actualUser.id,
      actualUser.email,
      "platform_admin_access",
      req,
      "User does not have platform_admin role"
    );
    return res.status(403).json({ error: "Platform admin access required" });
  }

  next();
}

/**
 * Middleware that blocks impersonated users from certain actions
 * Use this for sensitive operations that should never be done while impersonating
 */
export function blockImpersonation(req: Request, res: Response, next: NextFunction) {
  if ((req as any).isImpersonating) {
    return res.status(403).json({ 
      error: "This action cannot be performed while impersonating. Please stop impersonation first." 
    });
  }
  next();
}

/**
 * Middleware to update last activity timestamp on each request
 * This keeps the idle timeout fresh
 * Note: Activity tracking is now handled automatically in impersonationService.checkImpersonation()
 * This middleware is kept for backwards compatibility but does nothing
 */
export function trackActivity(req: Request, res: Response, next: NextFunction) {
  // Activity tracking is now handled in checkImpersonation()
  // which is called by impersonationMiddleware
  next();
}
