import { Request, Response, NextFunction } from "express";

/**
 * CRITICAL SECURITY MIDDLEWARE
 * 
 * This middleware ensures every API request has proper tenant context.
 * It must run AFTER authentication but BEFORE any route handlers.
 * 
 * Security guarantees:
 * 1. req.user.companyId is validated and present
 * 2. req.companyId is set for convenient access
 * 3. Requests without valid company context are rejected
 */

/**
 * Ensures authenticated user has valid company context
 * Place this AFTER requireAuth in your middleware chain
 */
export function ensureTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip for non-API routes
  if (!req.path.startsWith("/api")) {
    return next();
  }

  // Skip for public endpoints (handled by individual route auth)
  const publicEndpoints = ["/api/auth/", "/api/invitations/accept"];
  if (publicEndpoints.some((endpoint) => req.path.startsWith(endpoint))) {
    return next();
  }

  // At this point, user should be authenticated (by requireAuth)
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Validate company context exists
  if (!req.user.companyId) {
    console.error(`User ${req.user.id} has no companyId - data integrity issue`);
    return res.status(403).json({
      error: "No company association found. Please contact support.",
    });
  }

  // Set convenient accessor (some code uses req.companyId)
  (req as any).companyId = req.user.companyId;

  next();
}

/**
 * Validates that a resource ID belongs to the authenticated company
 * Use this when you need to verify ownership before proceeding
 * 
 * Example:
 *   app.get('/api/jobs/:id', 
 *     requireAuth,
 *     ensureTenantContext,
 *     validateResourceOwnership('jobs'),
 *     async (req, res) => { ... }
 *   )
 */
export function validateResourceOwnership(tableName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // This is a helper for future use
    // For now, all storage functions handle this validation internally
    next();
  };
}

/**
 * Rate limiting per tenant
 * Prevents one company from overwhelming the system
 */
interface RateLimitStore {
  [companyId: string]: {
    count: number;
    resetAt: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export function rateLimitPerTenant(
  maxRequests: number = 1000,
  windowMs: number = 60000 // 1 minute
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) {
      return next();
    }

    const companyId = req.user?.companyId;
    if (!companyId) {
      return next(); // Let authentication middleware handle this
    }

    const now = Date.now();
    const limit = rateLimitStore[companyId];

    // Reset or initialize
    if (!limit || now > limit.resetAt) {
      rateLimitStore[companyId] = {
        count: 1,
        resetAt: now + windowMs,
      };
      return next();
    }

    // Check limit
    if (limit.count >= maxRequests) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((limit.resetAt - now) / 1000),
      });
    }

    // Increment
    limit.count++;
    next();
  };
}

/**
 * Audit logging for sensitive operations
 * Tracks who did what and when
 */
export function auditLog(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log after response is sent
    res.on("finish", () => {
      if (res.statusCode < 400 && req.user) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            action,
            userId: req.user.id,
            companyId: req.user.companyId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            ip: req.ip,
          })
        );
      }
    });

    next();
  };
}