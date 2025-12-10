import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { subscriptionService } from "./subscriptionService";
import { routeOptimizationService } from "./routeOptimizationService";
import { sendInvitationEmail } from "./emailService";
import { impersonationService } from "./impersonationService";
import { auditService } from "./auditService";
import { requirePlatformAdmin, blockImpersonation } from "./impersonationMiddleware";
import { insertClientSchema, insertPartSchema, insertClientPartSchema, insertUserSchema, insertEquipmentSchema, insertCompanySettingsSchema, insertCalendarAssignmentSchema, updateCalendarAssignmentSchema, insertFeedbackSchema, insertJobNoteSchema, updateJobNoteSchema, insertClientNoteSchema, updateClientNoteSchema, insertCustomerCompanySchema, updateCustomerCompanySchema, insertInvoiceSchema, updateInvoiceSchema, insertInvoiceLineSchema, updateInvoiceLineSchema, insertPaymentSchema, insertJobSchema, updateJobSchema, insertRecurringJobSeriesSchema, insertRecurringJobPhaseSchema, jobStatusEnum, type Client, type Part, type User, type AuthenticatedUser, calendarAssignments, clients, companies } from "@shared/schema";
import { passport, isAdmin, requireAdmin } from "./auth";
import { z } from "zod";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";

// Initialize Stripe (optional - will be undefined if keys not set)
let stripe: Stripe | undefined;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
}

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, invitationToken, firstName, lastName } = req.body;
      
      // Validate email and password (don't use insertUserSchema since we don't have companyId yet)
      const signupSchema = z.object({
        email: z.string().email("Please enter a valid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      });
      signupSchema.parse({ email, password });
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      let companyId: string;
      let userRole: string;
      let invitation: any = null;
      
      // Handle invitation-based signup (technician joining existing company)
      if (invitationToken) {
        invitation = await storage.getInvitationByToken(invitationToken);
        
        if (!invitation) {
          return res.status(400).json({ error: "Invalid or expired invitation" });
        }
        
        // Optionally verify email matches invitation
        if (invitation.email && invitation.email !== email) {
          return res.status(400).json({ error: "Email does not match invitation" });
        }
        
        companyId = invitation.companyId;
        userRole = invitation.role || "technician";
      } else {
        // Regular signup - create new company and owner
        const allUsers = await storage.getAllUsers();
        const isFirstUser = allUsers.length === 0;
        
        // Create new company
        const newCompany = await db.insert(companies).values({
          name: email.split('@')[0] + "'s Company",
        }).returning();
        companyId = newCompany[0].id;
        userRole = isFirstUser ? "owner" : "owner"; // Each signup creates their own company as owner
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ 
        email, 
        password: hashedPassword,
        companyId,
        role: userRole,
        firstName,
        lastName,
      });
      
      // Mark invitation as used if this was an invitation signup
      if (invitation) {
        await storage.markInvitationUsed(invitation.id, user.id);
      }
      
      // Only assign trial/seed parts for company owners
      if (userRole === "owner") {
        if (subscriptionService.isEnabled()) {
          await subscriptionService.assignPlanToUser(user.id, 'trial', true);
        } else {
          const trialDays = parseInt(process.env.TRIAL_DAYS || "30", 10);
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
          await storage.updateCompanyTrial(companyId, trialEndsAt);
        }
        
        // Seed standard parts for new company owners
        await storage.seedUserParts(user.companyId, user.id);
      }
      
      // Fetch company data to merge subscription fields
      const company = await storage.getCompanyById(user.companyId);
      if (!company) {
        return res.status(500).json({ error: "Failed to load company data" });
      }
      
      // Merge user + company subscription data
      const authenticatedUser: AuthenticatedUser = {
        ...user,
        trialEndsAt: company.trialEndsAt,
        subscriptionStatus: company.subscriptionStatus,
        subscriptionPlan: company.subscriptionPlan,
        stripeCustomerId: company.stripeCustomerId,
        stripeSubscriptionId: company.stripeSubscriptionId,
        billingInterval: company.billingInterval,
        currentPeriodEnd: company.currentPeriodEnd,
        cancelAtPeriodEnd: company.cancelAtPeriodEnd
      };
      
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to regenerate session" });
        }
        req.login(authenticatedUser, (err) => {
          if (err) {
            return res.status(500).json({ error: "Failed to login after signup" });
          }
          res.json({ id: authenticatedUser.id, email: authenticatedUser.email, role: authenticatedUser.role, companyId: authenticatedUser.companyId });
        });
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(400).json({ error: error.message || "Invalid signup data" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", async (err: any, user: Express.User | false, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      
      try {
        // Cast user to proper User type (it's actually a User from storage)
        const userRecord = user as unknown as User;
        
        // Fetch company data to merge subscription fields
        const company = await storage.getCompanyById(userRecord.companyId);
        if (!company) {
          return res.status(500).json({ error: "Failed to load company data" });
        }
        
        // Merge user + company subscription data
        const authenticatedUser: AuthenticatedUser = {
          ...userRecord,
          trialEndsAt: company.trialEndsAt,
          subscriptionStatus: company.subscriptionStatus,
          subscriptionPlan: company.subscriptionPlan,
          stripeCustomerId: company.stripeCustomerId,
          stripeSubscriptionId: company.stripeSubscriptionId,
          billingInterval: company.billingInterval,
          currentPeriodEnd: company.currentPeriodEnd,
          cancelAtPeriodEnd: company.cancelAtPeriodEnd
        };
        
        req.session.regenerate((err) => {
          if (err) {
            return res.status(500).json({ error: "Failed to regenerate session" });
          }
          req.login(authenticatedUser, (err) => {
            if (err) {
              return res.status(500).json({ error: "Failed to login" });
            }
            res.json({ id: authenticatedUser.id, email: authenticatedUser.email, role: authenticatedUser.role, companyId: authenticatedUser.companyId });
          });
        });
      } catch (error) {
        return res.status(500).json({ error: "Login failed" });
      }
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to destroy session" });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      res.json({ id: req.user.id, email: req.user.email, role: req.user.role, companyId: req.user.companyId });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Diagnostic endpoint to check production environment
  app.get("/api/diagnostic", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const userCount = allUsers.length;
      const adminUsers = allUsers.filter(u => u.role === "owner" || u.role === "admin");
      const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT;
      
      res.json({
        environment: process.env.NODE_ENV || "development",
        replitDeployment: process.env.REPLIT_DEPLOYMENT ? "YES" : "NO",
        isProductionDetected: isProduction,
        sessionSecret: process.env.SESSION_SECRET ? "SET" : "NOT SET",
        databaseUrl: process.env.DATABASE_URL ? "SET" : "NOT SET",
        totalUsers: userCount,
        adminUsers: adminUsers.length,
        isAuthenticated: req.isAuthenticated(),
        currentUser: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : null,
        sessionCookieSettings: {
          secure: isProduction,
          sameSite: "lax"
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Diagnostic failed", message: String(error) });
    }
  });

  // Impersonation routes
  app.post("/api/impersonation/start", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      const { targetUserId, reason } = req.body;
      
      if (!targetUserId || !reason) {
        return res.status(400).json({ error: "targetUserId and reason are required" });
      }

      if (reason.trim().length < 10) {
        return res.status(400).json({ error: "Reason must be at least 10 characters" });
      }

      // Get the target user
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "Target user not found" });
      }

      // Cannot impersonate another platform admin
      if (impersonationService.isPlatformAdmin(targetUser)) {
        return res.status(403).json({ error: "Cannot impersonate another platform admin" });
      }

      // Get the actual platform admin (never use potentially impersonated user for audit logs)
      const actualUser = (req as any).platformAdmin || req.user;
      if (!actualUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Start impersonation session
      const session = await impersonationService.startImpersonation(
        req,
        actualUser.id,
        actualUser.email,
        targetUserId,
        targetUser.companyId,
        reason
      );

      res.json({ 
        success: true, 
        session: {
          targetUserId: session.targetUserId,
          targetCompanyId: session.targetCompanyId,
          expiresAt: session.expiresAt,
          remainingMinutes: Math.floor((session.expiresAt - Date.now()) / 60000)
        }
      });
    } catch (error) {
      console.error("Start impersonation error:", error);
      res.status(500).json({ error: "Failed to start impersonation" });
    }
  });

  app.post("/api/impersonation/stop", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      const session = impersonationService.getActiveImpersonation(req);
      if (!session) {
        return res.status(400).json({ error: "No active impersonation session" });
      }

      // Get the actual platform admin (not the impersonated user)
      const actualUser = (req as any).platformAdmin || req.user;
      if (!actualUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Pass platform admin ID for verification
      await impersonationService.stopImpersonation(req, actualUser.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Stop impersonation error:", error);
      res.status(500).json({ error: "Failed to stop impersonation" });
    }
  });

  app.get("/api/impersonation/status", isAuthenticated, (req, res) => {
    const session = impersonationService.getActiveImpersonation(req);
    if (!session) {
      return res.json({ isImpersonating: false });
    }

    const remaining = impersonationService.getRemainingTime(req);
    const idleRemaining = impersonationService.getIdleTimeRemaining(req);

    res.json({
      isImpersonating: true,
      session: {
        targetUserId: session.targetUserId,
        targetCompanyId: session.targetCompanyId,
        platformAdminEmail: session.platformAdminEmail,
        reason: session.reason,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        remainingTime: remaining,
        idleTimeRemaining: idleRemaining
      }
    });
  });

  // Support Console routes (Platform Admin only)
  app.get("/api/admin/companies", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      
      // Get user count and location count for each company
      const companiesWithStats = await Promise.all(
        companies.map(async (company: any) => {
          const users = await storage.getUsersByCompanyId(company.id);
          const clients = await storage.getAllClients(company.id);
          const activeClients = clients.filter((c: Client) => !c.inactive);
          
          return {
            ...company,
            userCount: users.length,
            locationCount: activeClients.length,
            totalClients: clients.length
          };
        })
      );

      res.json(companiesWithStats);
    } catch (error) {
      console.error("Get companies error:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/admin/companies/:companyId", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      const { companyId } = req.params;
      
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      const users = await storage.getUsersByCompanyId(companyId);
      const clients = await storage.getAllClients(companyId);
      const activeClients = clients.filter((c: Client) => !c.inactive);

      res.json({
        company,
        users,
        stats: {
          userCount: users.length,
          locationCount: activeClients.length,
          totalClients: clients.length,
          inactiveClients: clients.filter((c: Client) => c.inactive).length
        }
      });
    } catch (error) {
      console.error("Get company details error:", error);
      res.status(500).json({ error: "Failed to fetch company details" });
    }
  });

  app.get("/api/admin/audit-logs", isAuthenticated, requirePlatformAdmin, async (req, res) => {
    try {
      const { companyId, action, limit = 100 } = req.query;
      
      let logs;
      if (companyId && typeof companyId === 'string') {
        logs = await auditService.getLogsForCompany(companyId, Number(limit));
      } else if (action && typeof action === 'string') {
        // Filter by action type if needed
        const allLogs = await auditService.getRecentLogs(Number(limit));
        logs = allLogs.filter((log: any) => log.action === action);
      } else {
        logs = await auditService.getRecentLogs(Number(limit));
      }

      res.json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.patch("/api/admin/companies/:companyId/trial", isAuthenticated, requirePlatformAdmin, blockImpersonation, async (req, res) => {
    try {
      const { companyId } = req.params;
      const { days } = req.body;

      if (!days || typeof days !== 'number' || days <= 0) {
        return res.status(400).json({ error: "Valid days value required" });
      }

      const actualUser = (req as any).platformAdmin || req.user;
      const newTrialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      await storage.updateCompanyTrial(companyId, newTrialEnd, actualUser.companyId);

      // Log the trial adjustment
      await auditService.logTrialAdjustment(
        actualUser.id,
        actualUser.email,
        companyId,
        { daysAdded: days, newTrialEnd: newTrialEnd.toISOString() },
        req
      );

      res.json({ success: true, newTrialEnd });
    } catch (error) {
      console.error("Update trial error:", error);
      res.status(500).json({ error: "Failed to update trial" });
    }
  });

  app.patch("/api/admin/companies/:companyId/subscription", isAuthenticated, requirePlatformAdmin, blockImpersonation, async (req, res) => {
    try {
      const { companyId } = req.params;
      const { plan, status } = req.body;

      if (!plan || !status) {
        return res.status(400).json({ error: "Plan and status are required" });
      }

      const actualUser = (req as any).platformAdmin || req.user;

      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Update subscription
      await storage.updateCompany(companyId, {
        subscriptionPlan: plan,
        subscriptionStatus: status
      });

      // Log the billing adjustment
      await auditService.logBillingAdjustment(
        actualUser.id,
        actualUser.email,
        companyId,
        { plan, status, previousPlan: company.subscriptionPlan, previousStatus: company.subscriptionStatus },
        req
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Update subscription error:", error);
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  // Password reset routes
  const passwordResetRequestSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
  });

  const passwordResetConfirmSchema = z.object({
    tokenId: z.string(),
    token: z.string(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  app.post("/api/auth/password-reset-request", async (req, res) => {
    try {
      const { email } = passwordResetRequestSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ success: true, message: "If an account exists with this email, you will receive a password reset link" });
      }

      // Invalidate any existing tokens for this user
      await storage.invalidateUserTokens(user.id);

      // Generate a secure random token (32 bytes = 64 hex characters)
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, 10);

      // Token expires in 30 minutes
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      const resetToken = await storage.createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
        requestedIp: req.ip || req.socket.remoteAddress || null,
      });

      // SECURITY NOTE: In development mode only, log reset URL to console for testing
      // IMPORTANT: This should NEVER be enabled in production as it exposes secrets in logs
      if (process.env.NODE_ENV === 'development') {
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?tokenId=${resetToken.id}&token=${rawToken}`;
        console.log('\n📧 [DEV ONLY] Password Reset Request');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Email: ${email}`);
        console.log(`Reset URL: ${resetUrl}`);
        console.log('Token expires in 30 minutes');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }

      // In production, this would send an email with the reset link
      // For now, the reset link is only logged in development mode

      res.json({ success: true, message: "If an account exists with this email, you will receive a password reset link" });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.get("/api/auth/password-reset/:tokenId", async (req, res) => {
    try {
      const { tokenId } = req.params;
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Invalid reset link" });
      }

      const resetToken = await storage.getPasswordResetToken(tokenId);

      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }

      // Check if token is already used
      if (resetToken.usedAt) {
        return res.status(400).json({ error: "This reset link has already been used" });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "This reset link has expired" });
      }

      // Verify the token hash matches
      const isValidToken = await bcrypt.compare(token, resetToken.tokenHash);
      if (!isValidToken) {
        return res.status(400).json({ error: "Invalid reset link" });
      }

      res.json({ valid: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid reset link" });
    }
  });

  app.post("/api/auth/password-reset/confirm", async (req, res) => {
    try {
      const { tokenId, token, password } = passwordResetConfirmSchema.parse(req.body);

      const resetToken = await storage.getPasswordResetToken(tokenId);

      if (!resetToken) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }

      // Check if token is already used
      if (resetToken.usedAt) {
        return res.status(400).json({ error: "This reset link has already been used" });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ error: "This reset link has expired" });
      }

      // Verify the token hash matches
      const isValidToken = await bcrypt.compare(token, resetToken.tokenHash);
      if (!isValidToken) {
        return res.status(400).json({ error: "Invalid reset link" });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the user's password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      // Mark the token as used
      await storage.markTokenUsed(tokenId);

      // Invalidate all other tokens for this user
      await storage.invalidateUserTokens(resetToken.userId);

      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Subscription routes
  app.get("/api/subscriptions/plans", isAuthenticated, async (req, res) => {
    try {
      const plans = await subscriptionService.getActivePlans();
      // Transform monthlyPriceCents to price (in dollars)
      const transformedPlans = plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        price: (plan.monthlyPriceCents ?? 0) / 100,
        locationLimit: plan.locationLimit,
        active: plan.active,
      }));
      res.json(transformedPlans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  app.get("/api/subscriptions/usage", isAuthenticated, async (req, res) => {
    try {
      const usage = await subscriptionService.getUsageInfo(req.user!.id);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch usage info" });
    }
  });

  app.get("/api/subscriptions/can-add-location", isAuthenticated, async (req, res) => {
    try {
      const result = await subscriptionService.canAddLocation(req.user!.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to check location limit" });
    }
  });

  // Admin-only: Update user subscription
  app.patch("/api/admin/users/:userId/subscription", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { planName } = req.body;

      if (!planName) {
        return res.status(400).json({ error: "Plan name is required" });
      }

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify plan exists
      const plans = await subscriptionService.getActivePlans();
      const planExists = plans.some(p => p.name === planName);
      if (!planExists) {
        const validPlans = plans.map(p => p.name).join(", ");
        return res.status(400).json({ error: `Invalid plan name. Valid plans are: ${validPlans}` });
      }

      const plan = await subscriptionService.assignPlanToUser(userId, planName, false);
      res.json({ success: true, plan });
    } catch (error: any) {
      console.error("Subscription update error:", error);
      res.status(500).json({ error: error.message || "Failed to update subscription" });
    }
  });

  // Client routes
  app.get("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const clients = await storage.getAllClients(req.user!.companyId);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", isAuthenticated, async (req, res) => {
    try {
      // Check subscription limits
      const limitCheck = await subscriptionService.canAddLocation(req.user!.id);
      if (!limitCheck.allowed) {
        return res.status(403).json({ 
          error: limitCheck.reason,
          current: limitCheck.current,
          limit: limitCheck.limit,
          subscriptionLimitReached: true
        });
      }

      const { parts, ...clientData } = req.body;
      const validated = insertClientSchema.parse(clientData);
      
      let client: Client;
      
      // If parts are provided, use transactional method
      if (parts && Array.isArray(parts) && parts.length > 0) {
        const partsSchema = z.array(z.object({
          partId: z.string().uuid(),
          quantity: z.number().int().positive()
        }));
        
        const validatedParts = partsSchema.parse(parts);
        client = await storage.createClientWithParts(req.user!.companyId, req.user!.id, validated, validatedParts);
      } else {
        // No parts, use regular client creation
        client = await storage.createClient(req.user!.companyId, req.user!.id, validated);
      }
      
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid client or parts data", details: error.errors });
      }
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.post("/api/clients/import-simple", isAuthenticated, async (req, res) => {
    try {
      const { clients } = req.body;
      
      if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ error: "Invalid import data: clients array is required" });
      }

      // Check if user can import this many clients
      const usage = await subscriptionService.getUsageInfo(req.user!.id);
      const availableSlots = usage.plan ? usage.plan.locationLimit - usage.usage.locations : 999999;
      
      if (subscriptionService.isEnabled() && clients.length > availableSlots) {
        return res.status(403).json({ 
          error: `Cannot import ${clients.length} clients. You have ${availableSlots} available locations on your ${usage.plan?.displayName} plan.`,
          subscriptionLimitReached: true,
          current: usage.usage.locations,
          limit: usage.plan?.locationLimit || 0,
          requested: clients.length
        });
      }

      let imported = 0;
      const errors: string[] = [];

      for (const clientData of clients) {
        try {
          const validated = insertClientSchema.parse(clientData);
          await storage.createClient(req.user!.companyId, req.user!.id, validated);
          imported++;
        } catch (error) {
          errors.push(`Failed to import ${clientData.companyName || 'unknown client'}`);
        }
      }

      res.json({ 
        imported, 
        errors: errors.length > 0 ? errors : undefined,
        total: clients.length 
      });
    } catch (error) {
      console.error('Simple import error:', error);
      res.status(500).json({ error: "Failed to import clients" });
    }
  });

  app.post("/api/clients/import", isAuthenticated, async (req, res) => {
    try {
      const { clients } = req.body;
      
      if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ error: "Invalid import data: clients array is required" });
      }

      let imported = 0;
      const errors: string[] = [];

      for (const clientData of clients) {
        try {
          const { parts, equipment, ...clientInfo } = clientData;
          const validated = insertClientSchema.parse(clientInfo);
          const client = await storage.createClient(req.user!.companyId, req.user!.id, validated);
          imported++;
          
          // Import parts if present
          if (parts && Array.isArray(parts) && parts.length > 0) {
            for (const partData of parts) {
              try {
                // Create part as "other" type with the name from backup
                const part = await storage.createPart(req.user!.companyId, req.user!.id, {
                  type: 'other',
                  name: partData.name,
                  filterType: null,
                  beltType: null,
                  size: null,
                  description: null,
                });
                
                // Link part to client
                await storage.addClientPart(req.user!.companyId, req.user!.id, {
                  clientId: client.id,
                  partId: part.id,
                  quantity: partData.quantity || 1,
                });
              } catch (partError) {
                console.error(`Failed to import part for ${client.companyName}:`, partError);
              }
            }
          }
          
          // Import equipment if present
          if (equipment && Array.isArray(equipment) && equipment.length > 0) {
            for (const equipData of equipment) {
              try {
                await storage.createEquipment(req.user!.companyId, req.user!.id, {
                  clientId: client.id,
                  name: equipData.name,
                  modelNumber: equipData.modelNumber || null,
                  serialNumber: equipData.serialNumber || null,
                  notes: null,
                });
              } catch (equipError) {
                console.error(`Failed to import equipment for ${client.companyName}:`, equipError);
              }
            }
          }
        } catch (error) {
          console.error('Import client error:', error);
          errors.push(`Failed to import ${clientData.companyName || 'unknown client'}`);
        }
      }

      res.json({ 
        imported, 
        errors: errors.length > 0 ? errors : undefined,
        total: clients.length 
      });
    } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({ error: "Failed to import clients" });
    }
  });

  app.get("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const client = await storage.getClient(req.user!.companyId, req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.get("/api/clients/:id/report", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const clientId = req.params.id;
      console.log(`[Report] Fetching report for companyId: ${companyId}, clientId: ${clientId}`);
      
      const report = await storage.getClientReport(companyId, clientId);
      if (!report) {
        console.log(`[Report] Client not found - companyId: ${companyId}, clientId: ${clientId}`);
        return res.status(404).json({ error: "Client not found" });
      }
      
      console.log(`[Report] Successfully generated report for: ${report.client.companyName}`);
      res.json(report);
    } catch (error) {
      console.error('[Report] Error generating report:', error);
      res.status(500).json({ error: "Failed to generate client report" });
    }
  });

  app.put("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const validated = insertClientSchema.partial().parse(req.body);
      const companyId = req.user!.companyId;
      const clientId = req.params.id;
      
      // Check if selectedMonths is being updated
      const isUpdatingPmMonths = validated.selectedMonths !== undefined;
      
      // Update the client
      const client = await storage.updateClient(companyId, clientId, validated);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // If PM months were updated, cleanup invalid calendar assignments
      let cleanupResult = { removedCount: 0 };
      if (isUpdatingPmMonths && client.selectedMonths) {
        cleanupResult = await storage.cleanupInvalidCalendarAssignments(
          companyId,
          clientId,
          client.selectedMonths
        );
      }
      
      res.json({
        ...client,
        _cleanupInfo: cleanupResult
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  // PATCH route for partial client updates (used by LocationFormModal)
  app.patch("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const validated = insertClientSchema.partial().parse(req.body);
      const companyId = req.user!.companyId;
      const clientId = req.params.id;
      
      const client = await storage.updateClient(companyId, clientId, validated);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      res.json(client);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.delete("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteAllClientParts(req.user!.companyId, req.params.id);
      const deleted = await storage.deleteClient(req.user!.companyId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  app.post("/api/clients/bulk-delete", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.string().uuid()).min(1).max(200)
      });
      const { ids } = schema.parse(req.body);
      
      const result = await storage.deleteClients(req.user!.companyId, ids);
      
      res.json({
        deletedIds: result.deletedIds,
        notFoundIds: result.notFoundIds,
        deletedCount: result.deletedIds.length,
        notFoundCount: result.notFoundIds.length
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request: must provide 1-200 client IDs" });
      }
      res.status(500).json({ error: "Failed to delete clients" });
    }
  });

  // Part routes
  app.get("/api/parts", isAuthenticated, async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const category = typeof req.query.category === 'string' ? req.query.category : 'all';
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 1000);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      
      const parts = await storage.getAllParts(req.user!.companyId);
      
      // Filter by category
      let filtered: typeof parts;
      if (category === 'products') {
        // Products include: filter, belt, other, and product types (physical items)
        filtered = parts.filter(p => ['filter', 'belt', 'other', 'product'].includes(p.type));
      } else if (category === 'services') {
        // Services are service-type items
        filtered = parts.filter(p => p.type === 'service');
      } else {
        // All items (no category filter for 'all')
        filtered = parts;
      }
      
      // Apply search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        filtered = filtered.filter(p => {
          const name = (p.name || '').toLowerCase();
          const description = (p.description || '').toLowerCase();
          return name.includes(query) || description.includes(query);
        });
      }
      
      // Sort alphabetically by name
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      // Paginate
      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);
      const hasMore = offset + limit < total;
      
      res.json({
        items: paginated,
        total,
        offset,
        limit,
        hasMore
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parts" });
    }
  });

  app.post("/api/parts", isAuthenticated, async (req, res) => {
    try {
      const validated = insertPartSchema.parse(req.body);
      
      // Calculate unitPrice from markup if cost and markupPercent are provided but unitPrice is not
      let computedUnitPrice = validated.unitPrice;
      if (validated.cost && validated.markupPercent && !validated.unitPrice) {
        const cost = parseFloat(validated.cost);
        const markupPercent = parseFloat(validated.markupPercent);
        if (!isNaN(cost) && !isNaN(markupPercent)) {
          computedUnitPrice = (cost * (1 + markupPercent / 100)).toFixed(2);
        }
      }
      
      // Check for duplicate part
      const existingPart = await storage.findDuplicatePart(req.user!.companyId, validated);
      
      if (existingPart) {
        let errorMessage = "A part with these details already exists";
        if (validated.type === 'filter') {
          errorMessage = `A filter with type "${validated.filterType}" and size "${validated.size}" already exists`;
        } else if (validated.type === 'belt') {
          errorMessage = `A belt with type "${validated.beltType}" and size "${validated.size}" already exists`;
        } else if (validated.type === 'other' || validated.type === 'product' || validated.type === 'service') {
          errorMessage = `An item named "${validated.name}" already exists`;
        }
        
        return res.status(409).json({ error: errorMessage });
      }
      
      const part = await storage.createPart(req.user!.companyId, req.user!.id, {
        ...validated,
        unitPrice: computedUnitPrice ?? validated.unitPrice
      });
      res.json(part);
    } catch (error) {
      res.status(400).json({ error: "Invalid part data" });
    }
  });

  app.post("/api/parts/bulk", isAuthenticated, async (req, res) => {
    try {
      const parts = Array.isArray(req.body) ? req.body : [req.body];
      const validated = parts.map(p => insertPartSchema.parse(p));
      
      const createdParts = [];
      const errors = [];
      
      for (let i = 0; i < validated.length; i++) {
        const partData = validated[i];
        
        // Check for duplicate
        const existingPart = await storage.findDuplicatePart(req.user!.companyId, partData);
        
        if (existingPart) {
          let errorMessage = "Duplicate";
          if (partData.type === 'filter') {
            errorMessage = `${partData.filterType} ${partData.size} already exists`;
          } else if (partData.type === 'belt') {
            errorMessage = `${partData.beltType} ${partData.size} already exists`;
          } else if (partData.type === 'other') {
            errorMessage = `${partData.name} already exists`;
          }
          errors.push({ index: i, error: errorMessage });
        } else {
          const part = await storage.createPart(req.user!.companyId, req.user!.id, partData);
          createdParts.push(part);
        }
      }
      
      res.json({ 
        created: createdParts,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid parts data" });
    }
  });

  app.put("/api/parts/:id", isAuthenticated, async (req, res) => {
    try {
      const validated = insertPartSchema.partial().parse(req.body);
      
      // Calculate unitPrice from markup if cost and markupPercent are provided
      let computedUnitPrice = validated.unitPrice;
      if (validated.cost && validated.markupPercent && validated.unitPrice === undefined) {
        const cost = parseFloat(validated.cost);
        const markupPercent = parseFloat(validated.markupPercent);
        if (!isNaN(cost) && !isNaN(markupPercent)) {
          computedUnitPrice = (cost * (1 + markupPercent / 100)).toFixed(2);
        }
      }
      
      const part = await storage.updatePart(req.user!.companyId, req.params.id, {
        ...validated,
        unitPrice: computedUnitPrice ?? validated.unitPrice
      });
      if (!part) {
        return res.status(404).json({ error: "Part not found" });
      }
      res.json(part);
    } catch (error) {
      res.status(400).json({ error: "Invalid part data" });
    }
  });

  app.post("/api/parts/seed", isAuthenticated, async (req, res) => {
    try {
      await storage.seedUserParts(req.user!.companyId, req.user!.id);
      res.json({ 
        message: "Standard parts seeded successfully"
      });
    } catch (error) {
      console.error('Seed error:', error);
      res.status(500).json({ error: "Failed to seed parts data" });
    }
  });

  app.delete("/api/parts/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deletePart(req.user!.companyId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Part not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete part" });
    }
  });

  app.post("/api/parts/bulk-delete", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        ids: z.array(z.string().uuid()).min(1).max(200)
      });
      const { ids } = schema.parse(req.body);
      
      const result = await storage.deleteParts(req.user!.companyId, ids);
      
      res.json({
        deletedIds: result.deletedIds,
        notFoundIds: result.notFoundIds,
        deletedCount: result.deletedIds.length,
        notFoundCount: result.notFoundIds.length
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request: must provide 1-200 part IDs" });
      }
      res.status(500).json({ error: "Failed to delete parts" });
    }
  });

  // Export products/services to CSV with all Item fields (QBO aligned)
  app.get("/api/parts/export", isAuthenticated, async (req, res) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : 'all';
      const parts = await storage.getAllParts(req.user!.companyId);
      
      // Filter by category
      let filtered: typeof parts;
      if (category === 'products') {
        // Products include: filter, belt, other, and product types (physical items)
        filtered = parts.filter(p => ['filter', 'belt', 'other', 'product'].includes(p.type));
      } else if (category === 'services') {
        filtered = parts.filter(p => p.type === 'service');
      } else {
        // All items (no category filter for 'all')
        filtered = parts;
      }
      
      // Sort alphabetically
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      // Create CSV
      const escapeCSV = (value: string | null | undefined | boolean) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      // Include all Item fields as per spec
      const headers = ['type', 'name', 'sku', 'description', 'cost', 'markup_percent', 'unit_price', 'is_taxable', 'tax_code', 'category', 'is_active'];
      const rows = filtered.map(p => [
        escapeCSV(p.type),
        escapeCSV(p.name),
        escapeCSV(p.sku),
        escapeCSV(p.description),
        escapeCSV(p.cost),
        escapeCSV(p.markupPercent),
        escapeCSV(p.unitPrice),
        escapeCSV(p.isTaxable ?? true),
        escapeCSV(p.taxCode),
        escapeCSV(p.category),
        escapeCSV(p.isActive ?? true)
      ].join(','));
      
      const csv = [headers.join(','), ...rows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${category}_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export products/services" });
    }
  });

  // Import products/services from CSV with all Item fields and update-existing option
  app.post("/api/parts/import", isAuthenticated, async (req, res) => {
    try {
      const requestSchema = z.object({
        csvData: z.string(),
        skipDuplicates: z.boolean().optional().default(true),
        updateExisting: z.boolean().optional().default(false),
        defaultType: z.enum(['product', 'service']).optional()
      });
      const { csvData, skipDuplicates, updateExisting, defaultType } = requestSchema.parse(req.body);
      
      // Parse CSV values (handles quoted values properly)
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };
      
      // Parse boolean values from CSV
      const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
        if (!value) return defaultValue;
        const lower = value.toLowerCase().trim();
        if (['true', 'yes', '1', 'y'].includes(lower)) return true;
        if (['false', 'no', '0', 'n'].includes(lower)) return false;
        return defaultValue;
      };
      
      // Split lines, keeping empty lines for accurate row numbers
      const allLines = csvData.split(/\r?\n/);
      const lines: { index: number; content: string }[] = [];
      
      for (let i = 0; i < allLines.length; i++) {
        if (allLines[i].trim()) {
          lines.push({ index: i, content: allLines[i] });
        }
      }
      
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV must have a header row and at least one data row" });
      }
      
      // Parse header using the same CSV parser
      const headerValues = parseCSVLine(lines[0].content);
      const headers = headerValues.map(h => h.toLowerCase().replace(/^"|"$/g, '').replace(/_/g, '').trim());
      
      // Map common column name variations
      const headerMap: Record<string, string> = {
        'name': 'name',
        'sku': 'sku',
        'type': 'type',
        'description': 'description',
        'cost': 'cost',
        'markuppercent': 'markupPercent',
        'markup': 'markupPercent',
        'unitprice': 'unitPrice',
        'price': 'unitPrice',
        'istaxable': 'isTaxable',
        'taxable': 'isTaxable',
        'taxcode': 'taxCode',
        'category': 'category',
        'isactive': 'isActive',
        'active': 'isActive'
      };
      
      // Validate required header (name only, type can default)
      if (!headers.includes('name')) {
        return res.status(400).json({ error: "Missing required column: name" });
      }
      
      const results = {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [] as { row: number; error: string }[]
      };
      
      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const { index, content } = lines[i];
        const rowNumber = index + 1;
        const values = parseCSVLine(content);
        
        if (values.every(v => !v)) continue;
        
        try {
          // Map values to normalized headers
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            const normalizedHeader = headerMap[h] || h;
            row[normalizedHeader] = values[idx] !== undefined ? values[idx] : '';
          });
          
          // Extract and normalize values
          const name = row['name']?.trim();
          if (!name) {
            results.errors.push({ row: rowNumber, error: 'Name is required' });
            continue;
          }
          
          // Type can default based on context or defaultType parameter
          let typeRaw = (row['type'] || '').toLowerCase().trim();
          if (!typeRaw && defaultType) {
            typeRaw = defaultType;
          }
          if (typeRaw !== 'product' && typeRaw !== 'service') {
            results.errors.push({ row: rowNumber, error: `Type must be "product" or "service", got "${row['type'] || '(empty)'}"` });
            continue;
          }
          
          const sku = row['sku']?.trim() || null;
          const description = row['description']?.trim() || null;
          const cost = row['cost']?.trim() || null;
          const markupPercent = row['markupPercent']?.trim() || null;
          let unitPrice = row['unitPrice']?.trim() || null;
          const isTaxable = parseBoolean(row['isTaxable'], true);
          const taxCode = row['taxCode']?.trim() || null;
          const category = row['category']?.trim() || null;
          const isActive = parseBoolean(row['isActive'], true);
          
          // Calculate unitPrice from markup if not provided
          if (!unitPrice && cost && markupPercent) {
            const costNum = parseFloat(cost);
            const markupNum = parseFloat(markupPercent);
            if (!isNaN(costNum) && !isNaN(markupNum)) {
              unitPrice = (costNum * (1 + markupNum / 100)).toFixed(2);
            }
          }
          
          // Build part data
          const partData = {
            type: typeRaw as 'product' | 'service',
            name,
            sku,
            description,
            cost,
            markupPercent,
            unitPrice,
            isTaxable,
            taxCode,
            category,
            isActive
          };
          
          // Check for existing item by SKU first, then by name
          let existingPart = sku ? await storage.getPartBySku(req.user!.companyId, sku) : null;
          if (!existingPart) {
            existingPart = await storage.findDuplicatePart(req.user!.companyId, partData);
          }
          
          if (existingPart) {
            if (updateExisting) {
              // Update existing item (don't update QBO fields from CSV)
              await storage.updatePart(req.user!.companyId, existingPart.id, partData);
              results.updated++;
            } else if (skipDuplicates) {
              results.skipped++;
            } else {
              results.errors.push({ row: rowNumber, error: `"${name}" already exists` });
            }
            continue;
          }
          
          await storage.createPart(req.user!.companyId, req.user!.id, partData);
          results.imported++;
        } catch (err) {
          results.errors.push({ row: rowNumber, error: 'Invalid data format' });
        }
      }
      
      res.json(results);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
      }
      res.status(500).json({ error: "Failed to import products/services" });
    }
  });

  // Client-Part routes
  app.get("/api/client-parts/bulk", isAuthenticated, async (req, res) => {
    try {
      const bulkParts = await storage.getAllClientPartsBulk(req.user!.companyId);
      res.json(bulkParts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bulk client parts" });
    }
  });

  app.get("/api/clients/:id/parts", isAuthenticated, async (req, res) => {
    try {
      const clientParts = await storage.getClientParts(req.user!.companyId, req.params.id);
      res.json(clientParts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client parts" });
    }
  });

  app.post("/api/clients/:id/parts", isAuthenticated, async (req, res) => {
    try {
      const parts = req.body.parts as Array<{ partId: string; quantity: number }>;
      
      // Delete existing parts for this client
      await storage.deleteAllClientParts(req.user!.companyId, req.params.id);
      
      // Add new parts
      const createdParts = await Promise.all(
        parts.map(p => storage.addClientPart(req.user!.companyId, req.user!.id, {
          clientId: req.params.id,
          partId: p.partId,
          quantity: p.quantity
        }))
      );
      
      res.json(createdParts);
    } catch (error) {
      res.status(400).json({ error: "Invalid parts data" });
    }
  });

  app.put("/api/clients/:id/parts", isAuthenticated, async (req, res) => {
    try {
      const parts = req.body.parts as Array<{ partId: string; quantity: number }>;
      
      // Delete existing parts for this client
      await storage.deleteAllClientParts(req.user!.companyId, req.params.id);
      
      // Add new parts
      const createdParts = await Promise.all(
        parts.map(p => storage.addClientPart(req.user!.companyId, req.user!.id, {
          clientId: req.params.id,
          partId: p.partId,
          quantity: p.quantity
        }))
      );
      
      res.json(createdParts);
    } catch (error) {
      console.error("[PUT /api/clients/:id/parts] Error:", error);
      res.status(400).json({ error: "Invalid parts data" });
    }
  });

  app.delete("/api/client-parts/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteClientPart(req.user!.companyId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client part not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client part" });
    }
  });

  // Reports route
  app.get("/api/reports/parts/:month", isAuthenticated, async (req, res) => {
    try {
      const month = parseInt(req.params.month);
      if (isNaN(month) || month < 0 || month > 11) {
        return res.status(400).json({ error: "Invalid month. Must be 0-11." });
      }
      const outstandingOnly = req.query.outstanding === 'true';
      const report = await storage.getPartsReportByMonth(req.user!.companyId, month, outstandingOnly);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Schedule report - get all clients scheduled for a particular month
  app.get("/api/reports/schedule/:month", isAuthenticated, async (req, res) => {
    try {
      const month = parseInt(req.params.month);
      if (isNaN(month) || month < 0 || month > 11) {
        return res.status(400).json({ error: "Invalid month. Must be 0-11." });
      }
      
      const allClients = await storage.getAllClients(req.user!.companyId);
      
      // Filter clients that have the selected month in their selectedMonths array and are not inactive
      const scheduledClients = allClients.filter(client => 
        client.selectedMonths.includes(month) && !client.inactive
      );
      
      // Get parts, equipment and completion status for each client
      const currentYear = new Date().getFullYear();
      const completedRecords = await storage.getRecentlyCompletedMaintenance(req.user!.companyId, month, currentYear);
      
      const clientsWithParts = await Promise.all(
        scheduledClients.map(async (client) => {
          const [clientParts, clientEquipment] = await Promise.all([
            storage.getClientParts(req.user!.companyId, client.id),
            storage.getClientEquipment(req.user!.companyId, client.id)
          ]);
          
          // Check if there's a completed maintenance record for this month
          const isCompleted = completedRecords.some(record => record.clientId === client.id);
          
          return {
            ...client,
            parts: clientParts,
            equipment: clientEquipment ?? [],
            isCompleted
          };
        })
      );
      
      res.json(clientsWithParts);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate schedule report" });
    }
  });

  // Get all completed maintenance statuses (checks calendar assignments)
  app.get("/api/maintenance/statuses", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-indexed
      const currentYear = now.getFullYear();
      
      // Get all calendar assignments for the current month
      const assignments = await db.select().from(calendarAssignments).where(and(
        eq(calendarAssignments.companyId, req.user!.companyId),
        eq(calendarAssignments.year, currentYear),
        eq(calendarAssignments.month, currentMonth)
      ));
      
      const clients = await storage.getAllClients(req.user!.companyId);
      const statuses: Record<string, { completed: boolean; completedDueDate?: string }> = {};
      
      // For each client, check if there's a completed assignment in the current month
      for (const client of clients) {
        const clientAssignment = assignments.find(a => a.clientId === client.id && a.completed);
        
        if (clientAssignment) {
          statuses[client.id] = {
            completed: true,
            completedDueDate: clientAssignment.scheduledDate
          };
        } else {
          statuses[client.id] = { completed: false };
        }
      }
      
      res.json(statuses);
    } catch (error) {
      console.error("Error fetching maintenance statuses:", error);
      res.status(500).json({ error: "Failed to fetch maintenance statuses" });
    }
  });

  // Get recently completed maintenance (this month)
  app.get("/api/maintenance/recently-completed", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const records = await storage.getRecentlyCompletedMaintenance(req.user!.companyId, currentMonth, currentYear);
      
      // Fetch client details for each record and format for frontend
      const completedItems = [];
      for (const record of records) {
        const client = await storage.getClient(req.user!.companyId, record.clientId);
        if (client) {
          // Format to match MaintenanceItem interface expected by frontend
          completedItems.push({
            id: `${client.id}|${record.dueDate}`, // Composite ID for recently completed items
            companyName: client.companyName,
            location: client.location,
            selectedMonths: client.selectedMonths,
            nextDue: new Date(record.dueDate), // Use the completed dueDate
            status: "upcoming" // Status doesn't matter for completed items
          });
        }
      }
      
      res.json(completedItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recently completed maintenance" });
    }
  });

  // Get completed but unscheduled maintenance
  app.get("/api/maintenance/completed-unscheduled", isAuthenticated, async (req, res) => {
    try {
      const records = await storage.getCompletedUnscheduledMaintenance(req.user!.companyId);
      
      // Fetch client details for each record and format for frontend
      const completedItems = [];
      for (const record of records) {
        const client = await storage.getClient(req.user!.companyId, record.clientId);
        if (client) {
          completedItems.push({
            id: record.id,
            clientId: client.id,
            companyName: client.companyName,
            location: client.location,
            dueDate: record.dueDate,
            completedAt: record.completedAt
          });
        }
      }
      
      res.json(completedItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch completed unscheduled maintenance" });
    }
  });

  // Maintenance completion routes
  app.post("/api/maintenance/:clientId/toggle", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { dueDate } = req.body;  // Frontend sends the dueDate it's displaying
      
      if (!dueDate) {
        return res.status(400).json({ error: "dueDate is required" });
      }
      
      const client = await storage.getClient(req.user!.companyId, clientId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Check if there's a record for the requested dueDate
      const record = await storage.getMaintenanceRecord(req.user!.companyId, clientId, dueDate);
      
      // Check if there's a calendar assignment for this month
      const dueDateObj = new Date(dueDate);
      const year = dueDateObj.getFullYear();
      const month = dueDateObj.getMonth() + 1; // Calendar API uses 1-indexed months
      const calendarAssignment = await storage.getClientCalendarAssignment(req.user!.companyId, clientId, year, month);

      if (record && record.completedAt) {
        // This cycle is completed - uncomplete it and restore nextDue
        await storage.updateClient(req.user!.companyId, clientId, { nextDue: dueDate });
        await storage.updateMaintenanceRecord(req.user!.companyId, record.id, { completedAt: null });
        
        // Update calendar assignment to mark as incomplete
        if (calendarAssignment) {
          await storage.updateCalendarAssignment(req.user!.companyId, calendarAssignment.id, { completed: false });
        }
        
        res.json({ completed: false, record });
      } else {
        // Mark this maintenance cycle as complete and advance nextDue
        const currentDate = new Date(dueDate);
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const completedAt = new Date().toISOString();

        // Create or update maintenance record for this dueDate
        if (record) {
          await storage.updateMaintenanceRecord(req.user!.companyId, record.id, { completedAt });
        } else {
          await storage.createMaintenanceRecord(req.user!.companyId, req.user!.id, {
            clientId,
            dueDate,
            completedAt,
          });
        }

        // Calculate next due date
        const nextMonth = client.selectedMonths.find(m => m > currentMonth);
        let nextDue: Date;

        if (nextMonth === undefined) {
          nextDue = new Date(currentYear + 1, client.selectedMonths[0], 15);
        } else {
          nextDue = new Date(currentYear, nextMonth, 15);
        }

        // Update client's nextDue
        await storage.updateClient(req.user!.companyId, clientId, { nextDue: nextDue.toISOString() });
        
        // Update calendar assignment to mark as complete
        if (calendarAssignment) {
          await storage.updateCalendarAssignment(req.user!.companyId, calendarAssignment.id, { completed: true });
        }

        // Automatically create calendar assignment for the next due date
        const nextYear = nextDue.getFullYear();
        const nextMonthNum = nextDue.getMonth() + 1; // Calendar API uses 1-indexed months
        const nextDay = nextDue.getDate();
        
        // Check if assignment already exists for the next due date
        const existingNextAssignment = await storage.getClientCalendarAssignment(
          req.user!.companyId, 
          clientId, 
          nextYear, 
          nextMonthNum
        );
        
        if (!existingNextAssignment) {
          // Create new calendar assignment for next due date
          await storage.createCalendarAssignment(req.user!.companyId, req.user!.id, {
            clientId,
            year: nextYear,
            month: nextMonthNum,
            day: nextDay,
            scheduledDate: nextDue.toISOString().split('T')[0],
            autoDueDate: true,
            completed: false
          });
        }

        res.json({ completed: true, nextDue: nextDue.toISOString() });
      }
    } catch (error) {
      console.error('Toggle maintenance error:', error);
      res.status(500).json({ error: "Failed to toggle maintenance status" });
    }
  });

  // Equipment routes
  app.get("/api/equipment", isAuthenticated, async (req, res) => {
    try {
      const equipment = await storage.getAllEquipment(req.user!.companyId);
      res.json(equipment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch equipment" });
    }
  });

  app.get("/api/clients/:clientId/equipment", isAuthenticated, async (req, res) => {
    try {
      const equipment = await storage.getClientEquipment(req.user!.companyId, req.params.clientId);
      res.json(equipment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch equipment" });
    }
  });

  app.post("/api/clients/:clientId/equipment", isAuthenticated, async (req, res) => {
    try {
      const validated = insertEquipmentSchema.parse(req.body);
      const equipment = await storage.createEquipment(req.user!.companyId, req.user!.id, {
        ...validated,
        clientId: req.params.clientId
      });
      res.json(equipment);
    } catch (error) {
      res.status(400).json({ error: "Invalid equipment data" });
    }
  });

  app.put("/api/clients/:clientId/equipment", isAuthenticated, async (req, res) => {
    try {
      const equipment = req.body.equipment as Array<{ name: string; type: string; serialNumber?: string; location?: string }>;
      
      // Delete existing equipment for this client
      await storage.deleteAllClientEquipment(req.user!.companyId, req.params.clientId);
      
      // Add new equipment
      const createdEquipment = await Promise.all(
        equipment.map(e => storage.createEquipment(req.user!.companyId, req.user!.id, {
          clientId: req.params.clientId,
          name: e.name,
          type: e.type || null,
          serialNumber: e.serialNumber || null,
          location: e.location || null,
          modelNumber: null,
          notes: null
        }))
      );
      
      res.json(createdEquipment);
    } catch (error) {
      res.status(400).json({ error: "Invalid equipment data" });
    }
  });

  app.put("/api/equipment/:id", isAuthenticated, async (req, res) => {
    try {
      const validated = insertEquipmentSchema.partial().parse(req.body);
      const equipment = await storage.updateEquipment(req.user!.companyId, req.params.id, validated);
      if (!equipment) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      res.json(equipment);
    } catch (error) {
      res.status(400).json({ error: "Invalid equipment data" });
    }
  });

  app.delete("/api/equipment/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteEquipment(req.user!.companyId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete equipment" });
    }
  });

  // Admin routes - only accessible by admin users
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      // Get the actual user (not impersonated) to check platform admin status
      const actualUser = (req as any).platformAdmin || user;
      let users;
      
      // Platform admins see all users from all companies
      if (impersonationService.isPlatformAdmin(actualUser)) {
        users = await storage.getAllUsers();
      } else {
        // Company owners only see users from their own company
        users = await storage.getTechniciansByCompanyId(user.companyId);
      }
      
      // Filter to only show owners and admins (not technicians)
      const adminUsers = users.filter((u: any) => u.role === "owner" || u.role === "admin");
      
      // Don't send passwords to the client
      const sanitizedUsers = adminUsers.map(({ password, ...u }: any) => u);
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      // Get the actual user (not impersonated) to check platform admin status
      const actualUser = (req as any).platformAdmin || user;
      
      // Prevent deleting yourself (check against actual user ID, not impersonated)
      if (id === actualUser.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      const userToDelete = await storage.getUser(id);
      if (!userToDelete) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Platform admins can delete anyone except themselves
      if (!impersonationService.isPlatformAdmin(actualUser)) {
        // Company owners can only delete users from their own company
        if (userToDelete.companyId !== user.companyId) {
          return res.status(403).json({ error: "Cannot delete users from other companies" });
        }
        
        // Company owners cannot delete owner accounts
        if (userToDelete.role === "owner") {
          return res.status(403).json({ error: "Cannot delete the owner account" });
        }
      }
      
      // Check if this is the last admin in the user's company
      const companyUsers = await storage.getTechniciansByCompanyId(userToDelete.companyId);
      const adminUsers = companyUsers.filter(u => u.role === "owner" || u.role === "admin");
      if ((userToDelete.role === "admin") && adminUsers.length === 1) {
        return res.status(400).json({ error: "Cannot delete the last admin user" });
      }
      
      // Pass requesterCompanyId for non-platform-admin users
      const requesterCompanyId = impersonationService.isPlatformAdmin(actualUser) ? undefined : user.companyId;
      const deleted = await storage.deleteUser(id, requesterCompanyId);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role: newRole } = req.body;
      const user = req.user as any;
      // Get the actual user (not impersonated) to check platform admin status
      const actualUser = (req as any).platformAdmin || user;
      
      if (!newRole || !["owner", "admin", "technician"].includes(newRole)) {
        return res.status(400).json({ error: "Invalid role. Must be owner, admin, or technician." });
      }
      
      // Get the user to update
      const userToUpdate = await storage.getUser(id);
      
      if (!userToUpdate) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Platform admins can change roles for anyone, company owners only for their own company
      if (!impersonationService.isPlatformAdmin(actualUser) && userToUpdate.companyId !== user.companyId) {
        return res.status(403).json({ error: "Cannot change roles for users from other companies" });
      }
      
      // Prevent changing owner role
      if (userToUpdate.role === "owner") {
        return res.status(403).json({ error: "Cannot change owner role" });
      }
      
      // If demoting from admin, check if this is the last admin in that company
      if (newRole === "technician") {
        const companyUsers = await storage.getTechniciansByCompanyId(userToUpdate.companyId);
        const adminUsers = companyUsers.filter(u => u.role === "owner" || u.role === "admin");
        
        if ((userToUpdate.role === "admin") && adminUsers.length === 1) {
          return res.status(400).json({ error: "Cannot demote the last admin user" });
        }
      }
      
      // Pass requesterCompanyId for non-platform-admin users
      const requesterCompanyId = impersonationService.isPlatformAdmin(actualUser) ? undefined : user.companyId;
      await storage.updateUserRole(id, newRole, requesterCompanyId);
      res.json({ success: true });
    } catch (error) {
      console.error('Update admin status error:', error);
      res.status(500).json({ error: "Failed to update admin status" });
    }
  });

  app.post("/api/admin/users/:id/seed-parts", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.seedUserParts(user.companyId, id);
      const parts = await storage.getAllParts(user.companyId);
      
      res.json({ 
        success: true,
        message: "Standard parts seeded successfully",
        count: parts.length
      });
    } catch (error) {
      console.error('Seed parts error:', error);
      res.status(500).json({ error: "Failed to seed parts" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      // Verify user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update the user's password
      await storage.updateUserPassword(id, hashedPassword);
      
      res.json({ 
        success: true,
        message: "Password reset successfully"
      });
    } catch (error) {
      console.error('Admin password reset error:', error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Calendar assignment routes
  
  // Get all calendar assignments (for Jobs page) - supports pagination
  app.get("/api/calendar/all", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const limit = parseInt(req.query.limit as string) || undefined;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      
      const result = await storage.getAllCalendarAssignmentsPaginated(companyId, { limit, offset, status, search });
      const clients = await storage.getAllClients(companyId);
      
      res.json({ 
        assignments: result.assignments, 
        clients, 
        total: result.total,
        hasMore: result.hasMore
      });
    } catch (error) {
      console.error('Get all calendar assignments error:', error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/calendar", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { year, month } = req.query;
      
      if (!year || !month) {
        return res.status(400).json({ error: "Year and month are required" });
      }
      
      const yearNum = parseInt(year as string);
      const monthNum = parseInt(month as string);
      
      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ error: "Invalid year or month" });
      }
      
      const assignments = await storage.getCalendarAssignments(req.user!.companyId, yearNum, monthNum);
      const clients = await storage.getAllClients(req.user!.companyId);
      
      res.json({ assignments, clients });
    } catch (error) {
      console.error('Get calendar error:', error);
      res.status(500).json({ error: "Failed to fetch calendar data" });
    }
  });

  app.get("/api/calendar/unscheduled", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      
      // Get all unscheduled backlog across all months - this is a fixed list
      // that doesn't change based on which month is being viewed
      const backlog = await storage.getAllUnscheduledBacklog(companyId);
      
      res.json(backlog);
    } catch (error) {
      console.error('Get unscheduled clients error:', error);
      res.status(500).json({ error: "Failed to fetch unscheduled clients" });
    }
  });

  app.get("/api/calendar/overdue", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const overdueAssignments = await storage.getPastIncompleteAssignments(companyId);
      const clients = await storage.getAllClients(companyId);
      
      // Combine assignments with client data
      const overdueWithClients = overdueAssignments.map(assignment => {
        const client = clients.find(c => c.id === assignment.clientId);
        return { assignment, client };
      }).filter(item => item.client); // Filter out any with missing clients
      
      res.json(overdueWithClients);
    } catch (error) {
      console.error('Get overdue assignments error:', error);
      res.status(500).json({ error: "Failed to fetch overdue assignments" });
    }
  });

  // Get old unscheduled assignments (older than previous month) that need user action
  app.get("/api/calendar/old-unscheduled", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const oldAssignments = await storage.getOldUnscheduledAssignments(companyId);
      const clients = await storage.getAllClients(companyId);
      
      // Combine assignments with client data
      const oldWithClients = oldAssignments.map(assignment => {
        const client = clients.find(c => c.id === assignment.clientId);
        return { assignment, client };
      }).filter(item => item.client);
      
      res.json(oldWithClients);
    } catch (error) {
      console.error('Get old unscheduled assignments error:', error);
      res.status(500).json({ error: "Failed to fetch old unscheduled assignments" });
    }
  });

  app.post("/api/calendar/assign", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const assignmentData = insertCalendarAssignmentSchema.parse(req.body);
      
      // Check if this client already has an assignment for this month
      const existingAssignment = await storage.getClientCalendarAssignment(
        companyId,
        assignmentData.clientId,
        assignmentData.year,
        assignmentData.month
      );
      
      if (existingAssignment) {
        return res.status(400).json({ error: "Client already has an assignment for this month" });
      }
      
      const assignment = await storage.createCalendarAssignment(companyId, userId, assignmentData);
      
      // Update client's nextDue date
      const client = await storage.getClient(companyId, assignmentData.clientId);
      if (client) {
        await storage.updateClient(companyId, assignmentData.clientId, {
          nextDue: assignmentData.scheduledDate
        });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Create calendar assignment error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid assignment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create calendar assignment" });
    }
  });

  app.patch("/api/calendar/assign/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const body = req.body;
      
      console.log(`[PATCH /api/calendar/assign] Body received:`, JSON.stringify(body));
      
      // Handle legacy single technician ID -> convert to array
      if (body.assignedTechnicianId && !body.assignedTechnicianIds) {
        body.assignedTechnicianIds = body.assignedTechnicianId ? [body.assignedTechnicianId] : null;
      }
      
      const assignmentUpdate = updateCalendarAssignmentSchema.parse(body);
      console.log(`[PATCH /api/calendar/assign] Parsed update:`, JSON.stringify(assignmentUpdate));
      
      const assignment = await storage.updateCalendarAssignment(req.user!.companyId, id, assignmentUpdate);
      console.log(`[PATCH /api/calendar/assign] Updated assignment assignedTechnicianIds:`, assignment?.assignedTechnicianIds);
      
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      // Update client's nextDue date if scheduledDate changed
      if (assignmentUpdate.scheduledDate) {
        await storage.updateClient(req.user!.companyId, assignment.clientId, {
          nextDue: assignmentUpdate.scheduledDate
        });
      }
      
      // Handle completion status changes
      if (assignmentUpdate.completed !== undefined) {
        const dueDate = assignment.scheduledDate;
        
        if (assignmentUpdate.completed === true) {
          // Marking as complete - create/update maintenanceRecord
          const record = await storage.getMaintenanceRecord(req.user!.companyId, assignment.clientId, dueDate);
          const completedAt = new Date().toISOString();
          
          if (record) {
            await storage.updateMaintenanceRecord(req.user!.companyId, record.id, { completedAt });
          } else {
            await storage.createMaintenanceRecord(req.user!.companyId, userId, {
              clientId: assignment.clientId,
              dueDate,
              completedAt,
            });
          }
          
          // Advance nextDue to next occurrence
          const client = await storage.getClient(req.user!.companyId, assignment.clientId);
          if (client && client.selectedMonths && client.selectedMonths.length > 0) {
            const currentDate = new Date(assignment.scheduledDate);
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();
            
            // Find the next scheduled month after current
            let nextMonth = client.selectedMonths.find((m: number) => m > currentMonth);
            let nextYear = currentYear;
            
            if (nextMonth === undefined) {
              nextMonth = client.selectedMonths[0];
              nextYear = currentYear + 1;
            }
            
            const nextDueDate = new Date(nextYear, nextMonth, 15);
            await storage.updateClient(req.user!.companyId, assignment.clientId, {
              nextDue: nextDueDate.toISOString().split('T')[0]
            });
          }
        } else {
          // Marking as incomplete - remove completion from maintenanceRecord
          const record = await storage.getMaintenanceRecord(req.user!.companyId, assignment.clientId, dueDate);
          if (record) {
            await storage.updateMaintenanceRecord(req.user!.companyId, record.id, { completedAt: null });
          }
          
          // Restore client's nextDue to this assignment's date
          await storage.updateClient(req.user!.companyId, assignment.clientId, {
            nextDue: dueDate
          });
        }
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Update calendar assignment error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid assignment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update calendar assignment" });
    }
  });

  app.delete("/api/calendar/assign/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const assignment = await storage.getCalendarAssignment(req.user!.companyId, id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      const deleted = await storage.deleteCalendarAssignment(req.user!.companyId, id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      // Recalculate client's nextDue based on selectedMonths
      const client = await storage.getClient(req.user!.companyId, assignment.clientId);
      if (client && client.selectedMonths && client.selectedMonths.length > 0) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Find the next scheduled month
        let nextMonth = client.selectedMonths.find((m: number) => m > currentMonth);
        let nextYear = currentYear;
        
        if (nextMonth === undefined) {
          nextMonth = client.selectedMonths[0];
          nextYear = currentYear + 1;
        }
        
        const nextDueDate = new Date(nextYear, nextMonth, 15);
        await storage.updateClient(req.user!.companyId, assignment.clientId, {
          nextDue: nextDueDate.toISOString().split('T')[0]
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete calendar assignment error:', error);
      res.status(500).json({ error: "Failed to delete calendar assignment" });
    }
  });

  // Job notes routes
  app.get("/api/job-notes/:assignmentId", isAuthenticated, async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const notes = await storage.getJobNotes(req.user!.companyId, assignmentId);
      res.json(notes);
    } catch (error) {
      console.error('Get job notes error:', error);
      res.status(500).json({ error: "Failed to get job notes" });
    }
  });

  app.post("/api/job-notes", isAuthenticated, async (req, res) => {
    try {
      const noteData = insertJobNoteSchema.parse(req.body);
      const note = await storage.createJobNote(req.user!.companyId, req.user!.id, noteData);
      res.status(201).json(note);
    } catch (error) {
      console.error('Create job note error:', error);
      res.status(500).json({ error: "Failed to create job note" });
    }
  });

  app.patch("/api/job-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const noteData = updateJobNoteSchema.parse(req.body);
      const note = await storage.updateJobNote(req.user!.companyId, id, noteData);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error('Update job note error:', error);
      res.status(500).json({ error: "Failed to update job note" });
    }
  });

  app.delete("/api/job-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteJobNote(req.user!.companyId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete job note error:', error);
      res.status(500).json({ error: "Failed to delete job note" });
    }
  });

  // Image upload for job notes (base64 data URL)
  app.post("/api/job-notes/upload-image", isAuthenticated, async (req, res) => {
    try {
      const { imageData, assignmentId } = req.body;
      
      if (!imageData || !assignmentId) {
        return res.status(400).json({ error: "Image data and assignment ID are required" });
      }
      
      // Parse base64 data URL - handle various image formats including jpeg, jpg, png, gif, webp, heic, heif
      const matches = imageData.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!matches) {
        console.error('Image data format mismatch. Data prefix:', typeof imageData === 'string' ? imageData.substring(0, 60) : 'not a string');
        return res.status(400).json({ error: "Invalid image data format. Please try a different image." });
      }
      
      let extension = matches[1].toLowerCase();
      // Normalize extension names
      if (extension === 'jpeg') extension = 'jpg';
      
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Check file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (buffer.length > maxSize) {
        return res.status(400).json({ error: "Image too large. Maximum size is 5MB." });
      }
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'job-notes');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Generate unique filename
      const filename = `${assignmentId}-${Date.now()}-${randomBytes(4).toString('hex')}.${extension}`;
      const filepath = path.join(uploadsDir, filename);
      
      // Save file
      fs.writeFileSync(filepath, buffer);
      
      // Return URL path
      const imageUrl = `/uploads/job-notes/${filename}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error('Upload image error:', error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Customer Companies routes (QBO Parent Companies)
  app.get("/api/customer-companies", isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getCustomerCompanies(req.user!.companyId);
      res.json(companies);
    } catch (error) {
      console.error('Get customer companies error:', error);
      res.status(500).json({ error: "Failed to get customer companies" });
    }
  });

  app.get("/api/customer-companies/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const company = await storage.getCustomerCompany(req.user!.companyId, id);
      if (!company) {
        return res.status(404).json({ error: "Customer company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error('Get customer company error:', error);
      res.status(500).json({ error: "Failed to get customer company" });
    }
  });

  // Get locations (clients) under a specific parent company
  app.get("/api/customer-companies/:parentId/locations", isAuthenticated, async (req, res) => {
    try {
      const { parentId } = req.params;
      const locations = await storage.getClientsByParentCompany(req.user!.companyId, parentId);
      res.json(locations);
    } catch (error) {
      console.error('Get locations by parent company error:', error);
      res.status(500).json({ error: "Failed to get locations" });
    }
  });

  // Get jobs (calendar assignments) under a parent company with optional location filter
  // Returns jobs with location metadata for proper display in the UI
  app.get("/api/customer-companies/:parentId/jobs", isAuthenticated, async (req, res) => {
    try {
      const { parentId } = req.params;
      const { locationId } = req.query;
      const jobs = await storage.getAssignmentsByParentCompany(
        req.user!.companyId, 
        parentId, 
        typeof locationId === 'string' ? locationId : undefined
      );
      
      // Enrich jobs with location metadata
      const locations = await storage.getClientsByParentCompany(req.user!.companyId, parentId);
      const locationMap = new Map(locations.map(loc => [loc.id, loc]));
      
      const enrichedJobs = jobs.map(job => {
        const location = locationMap.get(job.clientId);
        return {
          ...job,
          locationName: location?.location || location?.companyName || undefined,
          locationCity: location?.city || undefined,
          billWithParent: location?.billWithParent ?? true
        };
      });
      
      res.json(enrichedJobs);
    } catch (error) {
      console.error('Get jobs by parent company error:', error);
      res.status(500).json({ error: "Failed to get jobs" });
    }
  });

  app.post("/api/customer-companies", isAuthenticated, async (req, res) => {
    try {
      const data = insertCustomerCompanySchema.parse(req.body);
      const company = await storage.createCustomerCompany(req.user!.companyId, data);
      res.status(201).json(company);
    } catch (error) {
      console.error('Create customer company error:', error);
      res.status(500).json({ error: "Failed to create customer company" });
    }
  });

  app.patch("/api/customer-companies/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const data = updateCustomerCompanySchema.parse(req.body);
      const company = await storage.updateCustomerCompany(req.user!.companyId, id, data);
      if (!company) {
        return res.status(404).json({ error: "Customer company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error('Update customer company error:', error);
      res.status(500).json({ error: "Failed to update customer company" });
    }
  });

  app.delete("/api/customer-companies/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCustomerCompany(req.user!.companyId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer company not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete customer company error:', error);
      res.status(500).json({ error: "Failed to delete customer company" });
    }
  });

  // Deactivate (soft delete) for QBO sync
  app.post("/api/customer-companies/:id/deactivate", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const company = await storage.deactivateCustomerCompany(req.user!.companyId, id);
      if (!company) {
        return res.status(404).json({ error: "Customer company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error('Deactivate customer company error:', error);
      res.status(500).json({ error: "Failed to deactivate customer company" });
    }
  });

  // Create client with company (for QBO sync - creates both parent Company and child Location)
  // This endpoint creates a CustomerCompany (parent) and a Client/Location (child)
  // The billWithParent flag on the location determines how invoices are routed in QBO:
  // - If true: QBO CustomerRef points to parent Company
  // - If false: QBO CustomerRef points to this Location as a Sub-Customer
  app.post("/api/clients/with-company", isAuthenticated, async (req, res) => {
    try {
      // Check subscription limits first
      const limitCheck = await subscriptionService.canAddLocation(req.user!.id);
      if (!limitCheck.allowed) {
        return res.status(403).json({ 
          error: limitCheck.reason,
          current: limitCheck.current,
          limit: limitCheck.limit,
          subscriptionLimitReached: true
        });
      }

      const { company, primaryLocation } = req.body;
      
      // Validate company data upfront
      if (!company?.name?.trim()) {
        return res.status(400).json({ error: "Company name is required" });
      }
      
      // Validate location data upfront
      if (!primaryLocation?.name?.trim()) {
        return res.status(400).json({ error: "Location name is required" });
      }
      
      // Maintenance months are optional during quick creation
      // They can be added later on the client detail page
      const isInactive = primaryLocation.inactive === true;
      const selectedMonths = primaryLocation.selectedMonths || [];
      
      // Validate parts upfront if provided
      const parts = primaryLocation.parts;
      let validatedParts: Array<{ partId: string; quantity: number }> | undefined;
      if (parts && Array.isArray(parts) && parts.length > 0) {
        const partsSchema = z.array(z.object({
          partId: z.string().uuid(),
          quantity: z.number().positive()
        }));
        try {
          validatedParts = partsSchema.parse(parts);
        } catch (parseError) {
          return res.status(400).json({ error: "Invalid parts data" });
        }
      }
      
      // Build customer company data - only include non-empty fields
      const customerCompanyInput: Record<string, any> = {
        name: company.name,
        isActive: true,
      };
      if (company.legalName) customerCompanyInput.legalName = company.legalName;
      if (company.phone) customerCompanyInput.phone = company.phone;
      if (company.email) customerCompanyInput.email = company.email;
      if (company.billingAddress?.street) customerCompanyInput.billingStreet = company.billingAddress.street;
      if (company.billingAddress?.city) customerCompanyInput.billingCity = company.billingAddress.city;
      if (company.billingAddress?.stateOrProvince) customerCompanyInput.billingProvince = company.billingAddress.stateOrProvince;
      if (company.billingAddress?.postalCode) customerCompanyInput.billingPostalCode = company.billingAddress.postalCode;
      if (company.billingAddress?.country) customerCompanyInput.billingCountry = company.billingAddress.country;
      
      // Validate with schema
      const customerCompanyData = insertCustomerCompanySchema.parse(customerCompanyInput);
      
      // Calculate next due date based on selected months
      const calculateNextDueDate = (months: number[], inactive: boolean) => {
        if (inactive || !months || months.length === 0) return new Date('9999-12-31');
        
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const currentDay = today.getDate();
        
        const sortedMonths = [...months].sort((a, b) => a - b);
        
        if (sortedMonths.includes(currentMonth) && currentDay < 15) {
          return new Date(currentYear, currentMonth, 15);
        }
        
        let nextMonth = sortedMonths.find(m => m > currentMonth);
        
        if (nextMonth === undefined) {
          nextMonth = sortedMonths[0];
          return new Date(currentYear + 1, nextMonth, 15);
        }
        
        return new Date(currentYear, nextMonth, 15);
      };
      
      const nextDue = calculateNextDueDate(selectedMonths, isInactive);
      
      // Build client data - only include non-empty fields
      const clientInput: Record<string, any> = {
        companyName: company.name,
        location: primaryLocation.name,
        selectedMonths: selectedMonths,
        inactive: isInactive,
        nextDue: nextDue.toISOString(),
        billWithParent: primaryLocation.billWithParent ?? true,
      };
      if (primaryLocation.serviceAddress?.street) clientInput.address = primaryLocation.serviceAddress.street;
      if (primaryLocation.serviceAddress?.city) clientInput.city = primaryLocation.serviceAddress.city;
      if (primaryLocation.serviceAddress?.stateOrProvince) clientInput.province = primaryLocation.serviceAddress.stateOrProvince;
      if (primaryLocation.serviceAddress?.postalCode) clientInput.postalCode = primaryLocation.serviceAddress.postalCode;
      if (primaryLocation.contactName) clientInput.contactName = primaryLocation.contactName;
      if (primaryLocation.contactEmail) clientInput.email = primaryLocation.contactEmail;
      if (primaryLocation.contactPhone) clientInput.phone = primaryLocation.contactPhone;
      if (primaryLocation.roofLadderCode) clientInput.roofLadderCode = primaryLocation.roofLadderCode;
      if (primaryLocation.notes) clientInput.notes = primaryLocation.notes;
      
      // Validate client data with schema before creating anything
      const validatedClient = insertClientSchema.parse(clientInput);
      
      // All validation passed - create both entities atomically in a transaction
      const result = await storage.createCustomerCompanyWithClient(
        req.user!.companyId,
        req.user!.id,
        customerCompanyData,
        validatedClient,
        validatedParts
      );
      
      res.status(201).json({
        customerCompany: result.customerCompany,
        client: result.client,
      });
    } catch (error) {
      console.error('Create client with company error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create client with company" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const { locationId, customerCompanyId, jobId } = req.query;
      let invoices;
      if (jobId && typeof jobId === 'string') {
        invoices = await storage.getInvoicesByJob(req.user!.companyId, jobId);
      } else if (locationId && typeof locationId === 'string') {
        invoices = await storage.getInvoicesByLocation(req.user!.companyId, locationId);
      } else if (customerCompanyId && typeof customerCompanyId === 'string') {
        invoices = await storage.getInvoicesByCustomerCompany(req.user!.companyId, customerCompanyId);
      } else {
        invoices = await storage.getInvoices(req.user!.companyId);
      }
      res.json(invoices);
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });

  // Invoice stats for dashboard (must be before :id routes)
  app.get("/api/invoices/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getInvoiceSummaryStats(req.user!.companyId);
      res.json(stats);
    } catch (error) {
      console.error('Get invoice stats error:', error);
      res.status(500).json({ error: "Failed to get invoice stats" });
    }
  });

  // Invoice with filters (for list page - must be before :id routes)
  app.get("/api/invoices/list", isAuthenticated, async (req, res) => {
    try {
      const { status, clientId, search, from, to } = req.query;
      const invoices = await storage.getInvoicesWithStats(req.user!.companyId, {
        status: status as string | undefined,
        clientId: clientId as string | undefined,
        search: search as string | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
      });
      res.json(invoices);
    } catch (error) {
      console.error('Get invoices list error:', error);
      res.status(500).json({ error: "Failed to get invoices list" });
    }
  });

  // Create invoice from job (must be before :id routes)
  app.post("/api/invoices/from-job/:jobId", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { includeLineItems = true, includeNotes = true, markJobCompleted = false } = req.body;
      
      // Check if an invoice already exists for this job
      const existingInvoices = await storage.getInvoicesByJob(req.user!.companyId, jobId);
      if (existingInvoices.length > 0) {
        return res.status(400).json({ 
          error: "An invoice already exists for this job", 
          existingInvoiceId: existingInvoices[0].id 
        });
      }
      
      // Optionally mark job as completed first
      if (markJobCompleted) {
        await storage.updateJob(req.user!.companyId, jobId, { status: "completed" });
      }
      
      const invoice = await storage.createInvoiceFromJob(req.user!.companyId, jobId, {
        includeLineItems,
        includeNotes,
      });
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error('Create invoice from job error:', error);
      res.status(500).json({ error: error.message || "Failed to create invoice from job" });
    }
  });

  // Refresh invoice line items from linked job (only for draft invoices)
  app.post("/api/invoices/:id/refresh-from-job", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(req.user!.companyId, id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      if (invoice.status !== "draft") {
        return res.status(400).json({ error: "Can only refresh draft invoices" });
      }
      if (!invoice.jobId) {
        return res.status(400).json({ error: "Invoice has no linked job" });
      }
      
      const updatedInvoice = await storage.refreshInvoiceFromJob(req.user!.companyId, id, invoice.jobId);
      res.json(updatedInvoice);
    } catch (error: any) {
      console.error('Refresh invoice from job error:', error);
      res.status(500).json({ error: error.message || "Failed to refresh invoice from job" });
    }
  });

  app.get("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(req.user!.companyId, id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error('Get invoice error:', error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.get("/api/invoices/:id/details", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const details = await storage.getInvoiceWithDetails(req.user!.companyId, id);
      if (!details) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(details);
    } catch (error) {
      console.error('Get invoice details error:', error);
      res.status(500).json({ error: "Failed to get invoice details" });
    }
  });

  app.post("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const data = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(req.user!.companyId, data);
      res.status(201).json(invoice);
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const data = updateInvoiceSchema.parse(req.body);
      const invoice = await storage.updateInvoice(req.user!.companyId, id, data);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteInvoice(req.user!.companyId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete invoice error:', error);
      res.status(500).json({ error: "Failed to delete invoice" });
    }
  });

  app.post("/api/invoices/:id/void", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.voidInvoice(req.user!.companyId, id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error('Void invoice error:', error);
      res.status(500).json({ error: "Failed to void invoice" });
    }
  });

  // Invoice send route
  app.post("/api/invoices/:id/send", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.sendInvoice(req.user!.companyId, id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error('Send invoice error:', error);
      res.status(500).json({ error: "Failed to send invoice" });
    }
  });

  // Invoice payments routes
  app.get("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const payments = await storage.getPayments(invoiceId);
      res.json(payments);
    } catch (error) {
      console.error('Get invoice payments error:', error);
      res.status(500).json({ error: "Failed to get invoice payments" });
    }
  });

  app.post("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const parseResult = insertPaymentSchema.safeParse({ ...req.body, invoiceId });
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid payment data", details: parseResult.error.flatten() });
      }
      const payment = await storage.createPayment(req.user!.companyId, invoiceId, parseResult.data);
      res.status(201).json(payment);
    } catch (error: any) {
      console.error('Create payment error:', error);
      if (error.message === "Invoice not found") {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.status(500).json({ error: error.message || "Failed to create payment" });
    }
  });

  app.delete("/api/invoices/:invoiceId/payments/:paymentId", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId, paymentId } = req.params;
      const deleted = await storage.deletePayment(req.user!.companyId, invoiceId, paymentId);
      if (!deleted) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete payment error:', error);
      if (error.message === "Invoice not found") {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.status(500).json({ error: error.message || "Failed to delete payment" });
    }
  });

  // Invoice lines routes
  app.get("/api/invoices/:invoiceId/lines", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      // Verify the invoice belongs to this company
      const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const lines = await storage.getInvoiceLines(invoiceId);
      res.json(lines);
    } catch (error) {
      console.error('Get invoice lines error:', error);
      res.status(500).json({ error: "Failed to get invoice lines" });
    }
  });

  app.post("/api/invoices/:invoiceId/lines", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      // Verify the invoice belongs to this company
      const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const data = insertInvoiceLineSchema.parse({ ...req.body, invoiceId });
      const line = await storage.createInvoiceLine(data);
      res.status(201).json(line);
    } catch (error) {
      console.error('Create invoice line error:', error);
      res.status(500).json({ error: "Failed to create invoice line" });
    }
  });

  app.patch("/api/invoices/:invoiceId/lines/:lineId", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId, lineId } = req.params;
      // Verify the invoice belongs to this company
      const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const data = updateInvoiceLineSchema.parse(req.body);
      const line = await storage.updateInvoiceLine(invoiceId, lineId, data);
      if (!line) {
        return res.status(404).json({ error: "Invoice line not found" });
      }
      res.json(line);
    } catch (error) {
      console.error('Update invoice line error:', error);
      res.status(500).json({ error: "Failed to update invoice line" });
    }
  });

  app.delete("/api/invoices/:invoiceId/lines/:lineId", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId, lineId } = req.params;
      // Verify the invoice belongs to this company
      const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const deleted = await storage.deleteInvoiceLine(invoiceId, lineId);
      if (!deleted) {
        return res.status(404).json({ error: "Invoice line not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete invoice line error:', error);
      res.status(500).json({ error: "Failed to delete invoice line" });
    }
  });

  app.put("/api/invoices/:invoiceId/lines", isAuthenticated, async (req, res) => {
    try {
      const { invoiceId } = req.params;
      // Verify the invoice belongs to this company
      const invoice = await storage.getInvoice(req.user!.companyId, invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const linesData = z.array(insertInvoiceLineSchema.omit({ invoiceId: true })).parse(req.body);
      const lines = await storage.replaceInvoiceLines(invoiceId, linesData.map(line => ({ ...line, invoiceId })));
      res.json(lines);
    } catch (error) {
      console.error('Replace invoice lines error:', error);
      res.status(500).json({ error: "Failed to replace invoice lines" });
    }
  });

  // Client notes routes
  app.get("/api/client-notes/:clientId", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;
      const notes = await storage.getClientNotes(req.user!.companyId, clientId);
      res.json(notes);
    } catch (error) {
      console.error('Get client notes error:', error);
      res.status(500).json({ error: "Failed to get client notes" });
    }
  });

  app.post("/api/client-notes", isAuthenticated, async (req, res) => {
    try {
      const noteData = insertClientNoteSchema.parse(req.body);
      const note = await storage.createClientNote(req.user!.companyId, req.user!.id, noteData);
      res.status(201).json(note);
    } catch (error) {
      console.error('Create client note error:', error);
      res.status(500).json({ error: "Failed to create client note" });
    }
  });

  app.patch("/api/client-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const noteData = updateClientNoteSchema.parse(req.body);
      const note = await storage.updateClientNote(req.user!.companyId, id, noteData);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error('Update client note error:', error);
      res.status(500).json({ error: "Failed to update client note" });
    }
  });

  app.delete("/api/client-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteClientNote(req.user!.companyId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete client note error:', error);
      res.status(500).json({ error: "Failed to delete client note" });
    }
  });

  // Company settings routes
  app.get("/api/company-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const settings = await storage.getCompanySettings(req.user!.companyId);
      
      if (!settings) {
        return res.json({ calendarStartHour: 8 });
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error('Get company settings error:', error);
      // If the column doesn't exist yet (pre-migration), return default settings
      if (error?.message?.includes('calendar_start_hour') || error?.code === '42703') {
        return res.json({ calendarStartHour: 8 });
      }
      res.status(500).json({ error: "Failed to fetch company settings" });
    }
  });

  app.post("/api/company-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const settingsData = insertCompanySettingsSchema.parse(req.body);
      
      const settings = await storage.upsertCompanySettings(req.user!.companyId, userId, settingsData);
      res.json(settings);
    } catch (error) {
      console.error('Update company settings error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update company settings" });
    }
  });

  // Route optimization routes
  app.post("/api/routes/optimize", isAuthenticated, async (req, res) => {
    try {
      const { clientIds, startingLocation } = req.body;
      
      if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ error: "clientIds array is required" });
      }

      const userId = req.user!.id;
      
      // Fetch clients
      const clients = await Promise.all(
        clientIds.map(id => storage.getClient(req.user!.companyId, id))
      );
      
      const validClients = clients.filter((c): c is NonNullable<typeof c> => c !== null);
      
      if (validClients.length === 0) {
        return res.status(400).json({ error: "No valid clients found" });
      }

      // Geocode starting location if provided
      let startCoords: [number, number] | undefined = undefined;
      if (startingLocation && typeof startingLocation === 'string' && startingLocation.trim()) {
        const coords = await routeOptimizationService.geocodeFullAddress(startingLocation.trim());
        if (!coords) {
          return res.status(400).json({ error: "Could not geocode starting location" });
        }
        startCoords = coords;
      }

      // Geocode clients
      const geocoded = await routeOptimizationService.geocodeClients(validClients);
      
      if (geocoded.length === 0) {
        return res.status(400).json({ error: "Could not geocode any client addresses" });
      }

      // Optimize route
      const optimizedRoute = await routeOptimizationService.optimizeRoute(
        geocoded,
        startCoords
      );

      if (!optimizedRoute) {
        return res.status(500).json({ error: "Failed to optimize route" });
      }

      // Reorder geocodedClients to match the optimized order
      const reorderedGeocoded = optimizedRoute.order.map(index => geocoded[index]);

      res.json({
        clients: optimizedRoute.clients,
        totalDistance: optimizedRoute.totalDistance,
        totalDuration: optimizedRoute.totalDuration,
        geocodedClients: reorderedGeocoded.map(gc => ({
          clientId: gc.client.id,
          coordinates: gc.coordinates,
          address: gc.address
        })),
        startingCoordinates: startCoords
      });
    } catch (error) {
      console.error('Route optimization error:', error);
      res.status(500).json({ error: "Failed to optimize route" });
    }
  });

  app.post("/api/routes/geocode", isAuthenticated, async (req, res) => {
    try {
      const { address, city, province, postalCode } = req.body;
      
      if (!address && !city) {
        return res.status(400).json({ error: "At least address or city is required" });
      }

      const coords = await routeOptimizationService.geocodeAddress(
        address || "",
        city || "",
        province || "",
        postalCode || ""
      );

      if (!coords) {
        return res.status(404).json({ error: "Could not geocode address" });
      }

      res.json({ coordinates: coords });
    } catch (error) {
      console.error('Geocoding error:', error);
      res.status(500).json({ error: "Failed to geocode address" });
    }
  });

  // Feedback routes
  app.post("/api/feedback", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userEmail = req.user!.email;
      const feedbackData = insertFeedbackSchema.parse(req.body);
      
      const feedback = await storage.createFeedback(req.user!.companyId, userId, userEmail, feedbackData);
      res.json(feedback);
    } catch (error) {
      console.error('Create feedback error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid feedback data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  app.get("/api/feedback", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const isAdminUser = req.user!.role === "owner" || req.user!.role === "admin";
      
      let feedbackList;
      if (isAdminUser) {
        feedbackList = await storage.getAllFeedback();
      } else {
        feedbackList = await storage.getCompanyFeedback(req.user!.companyId);
      }
      
      res.json(feedbackList);
    } catch (error) {
      console.error('Get feedback error:', error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.patch("/api/feedback/:id/status", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const feedback = await storage.updateFeedbackStatus(id, status);
      if (!feedback) {
        return res.status(404).json({ error: "Feedback not found" });
      }
      
      res.json(feedback);
    } catch (error) {
      console.error('Update feedback status error:', error);
      res.status(500).json({ error: "Failed to update feedback status" });
    }
  });

  app.patch("/api/feedback/:id/archive", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { archived } = req.body;
      
      if (typeof archived !== 'boolean') {
        return res.status(400).json({ error: "Archived must be a boolean" });
      }
      
      const feedback = await storage.archiveFeedback(id, archived);
      if (!feedback) {
        return res.status(404).json({ error: "Feedback not found" });
      }
      
      res.json(feedback);
    } catch (error) {
      console.error('Archive feedback error:', error);
      res.status(500).json({ error: "Failed to archive feedback" });
    }
  });

  app.delete("/api/feedback/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await storage.deleteFeedback(id);
      if (!deleted) {
        return res.status(404).json({ error: "Feedback not found" });
      }
      
      res.json({ message: "Feedback deleted successfully" });
    } catch (error) {
      console.error('Delete feedback error:', error);
      res.status(500).json({ error: "Failed to delete feedback" });
    }
  });

  // Stripe subscription routes
  app.post("/api/subscription/create-checkout", isAuthenticated, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe is not configured. Please contact support." });
      }

      if (!process.env.STRIPE_PRICE_ID) {
        return res.status(503).json({ error: "Stripe price ID is not configured. Please contact support." });
      }

      let user = req.user!;
      let customerId = user.stripeCustomerId;

      // Create Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await storage.updateCompanyStripeCustomer(user.companyId, customerId);
        
        // Refresh session with updated user
        const updatedUser = await storage.getUser(user.id);
        if (updatedUser) {
          // Fetch company data to merge subscription fields
          const company = await storage.getCompanyById(updatedUser.companyId);
          if (company) {
            // Merge user + company subscription data
            const authenticatedUpdatedUser: AuthenticatedUser = {
              ...updatedUser,
              trialEndsAt: company.trialEndsAt,
              subscriptionStatus: company.subscriptionStatus,
              subscriptionPlan: company.subscriptionPlan,
              stripeCustomerId: company.stripeCustomerId,
              stripeSubscriptionId: company.stripeSubscriptionId,
              billingInterval: company.billingInterval,
              currentPeriodEnd: company.currentPeriodEnd,
              cancelAtPeriodEnd: company.cancelAtPeriodEnd
            };
            req.login(authenticatedUpdatedUser, (err) => {
              if (err) console.error("Failed to refresh session:", err);
            });
            user = authenticatedUpdatedUser;
          }
        }
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        success_url: `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/?success=true`,
        cancel_url: `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/?canceled=true`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session: " + error.message });
    }
  });

  app.get("/api/subscription/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      res.json({
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        currentPeriodEnd: user.currentPeriodEnd,
        subscriptionPlan: user.subscriptionPlan,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  // Invitation validation endpoint (public - no auth required)
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }
      
      // Get company details
      const company = await storage.getCompanyById(invitation.companyId);
      
      res.json({
        valid: true,
        email: invitation.email,
        role: invitation.role,
        companyId: invitation.companyId,
        companyName: company?.name || "Unknown Company",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate invitation" });
    }
  });

  // Technician management endpoints
  app.get("/api/technicians", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const technicians = await storage.getTechniciansByCompanyId(user.companyId);
      // Filter out the owner - only return actual technicians and admins
      const filtered = technicians.filter(t => t.role !== "owner");
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technicians" });
    }
  });

  app.post("/api/technicians/invite", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { email, role = "technician" } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Generate secure random token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      // Store invitation token in database
      await storage.createInvitationToken({
        companyId: user.companyId,
        createdByUserId: user.id,
        token,
        email,
        role,
        expiresAt,
      });

      const inviteLink = `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/signup?token=${token}`;
      
      // Get company details for email
      const company = await storage.getCompanyById(user.companyId);
      const companyName = company?.name || "your team";
      
      // Attempt to send invitation email (non-blocking)
      let emailStatus = "not_sent";
      let emailErrorMessage: string | undefined;
      
      try {
        await sendInvitationEmail(email, inviteLink, companyName, role);
        emailStatus = "sent";
      } catch (emailError: any) {
        console.error("Failed to send invitation email:", emailError);
        emailErrorMessage = emailError.message;
        emailStatus = "failed";
      }
      
      // Always return the invite link regardless of email status
      res.json({
        inviteLink,
        email,
        expiresAt,
        emailStatus,
        message: emailStatus === "sent" 
          ? "Invitation email sent successfully!" 
          : "Invitation created. Email failed to send - please share this link manually.",
        ...(emailErrorMessage && { emailError: emailErrorMessage })
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate invitation: " + error.message });
    }
  });

  app.delete("/api/technicians/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Verify technician belongs to same company
      const technician = await storage.getUser(id);
      if (!technician || technician.companyId !== user.companyId) {
        return res.status(403).json({ error: "Cannot delete technician from another company" });
      }

      const success = await storage.deleteUser(id, user.companyId);
      if (success) {
        res.json({ message: "Technician deleted successfully" });
      } else {
        res.status(404).json({ error: "Technician not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete technician" });
    }
  });

  app.post("/api/technicians/:id/reset-password", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Verify technician belongs to same company
      const technician = await storage.getUser(id);
      if (!technician || technician.companyId !== user.companyId) {
        return res.status(403).json({ error: "Cannot reset password for technician from another company" });
      }

      // Generate password reset token
      const resetToken = randomBytes(32).toString("hex");
      const tokenHash = (await import("crypto")).createHash("sha256").update(resetToken).digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 1);

      await storage.createPasswordResetToken({
        userId: id,
        tokenHash,
        expiresAt,
        requestedIp: req.ip,
      });

      const resetLink = `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/reset-password?token=${resetToken}`;
      
      res.json({
        resetLink,
        email: technician.email,
        message: "Password reset link generated. Share this with the technician."
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate password reset link" });
    }
  });

  // Technician endpoints - get today's assignments (both pending and completed)
  app.get("/api/technician/today", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      
      // Get all assignments for today (both pending AND completed)
      const allAssignmentsForDay = await db.select().from(calendarAssignments).where(and(
        eq(calendarAssignments.year, year),
        eq(calendarAssignments.month, month),
        eq(calendarAssignments.day, day)
      ));
      
      const result = [];
      for (const assignment of allAssignmentsForDay) {
        let techIds = assignment.assignedTechnicianIds;
        
        // Handle array that might be a string or actual array
        if (typeof techIds === 'string') {
          try {
            techIds = JSON.parse(techIds);
          } catch (e) {
            techIds = [];
          }
        }
        
        // Ensure it's an array
        if (!Array.isArray(techIds)) {
          techIds = techIds ? [techIds] : [];
        }
        
        // Check if technician is in the array
        if (techIds.includes(userId)) {
          // Get client by companyId and clientId
          const clientResult = await db.select()
            .from(clients)
            .where(and(
              eq(clients.companyId, assignment.companyId),
              eq(clients.id, assignment.clientId)
            ))
            .limit(1);
          
          if (clientResult && clientResult.length > 0) {
            result.push({ id: assignment.id, client: clientResult[0], assignment });
          }
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching technician today assignments:", error);
      res.status(500).json({ error: "Failed to fetch today's assignments" });
    }
  });

  app.get("/api/technician/daily-parts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      
      // Get all today's assignments for this technician
      const assignments = await storage.getTechnicianTodayAssignments(userId);
      const clientIds = assignments.map(a => a.client.id);
      
      // Aggregate parts from all assigned clients
      const dailyParts: Record<string, { part: Part; quantity: number }> = {};
      
      for (const clientId of clientIds) {
        const clientParts = await storage.getClientParts(companyId, clientId);
        for (const cp of clientParts) {
          if (!dailyParts[cp.partId]) {
            dailyParts[cp.partId] = { part: cp.part, quantity: 0 };
          }
          dailyParts[cp.partId].quantity += cp.quantity;
        }
      }
      
      res.json(dailyParts);
    } catch (error) {
      console.error("Error fetching daily parts:", error);
      res.status(500).json({ error: "Failed to fetch daily parts" });
    }
  });

  // Get parts and equipment for a specific assignment (technician-safe)
  app.get("/api/technician/assignment/:assignmentId/details", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const assignmentId = req.params.assignmentId;
      
      // Get the assignment and verify technician is assigned to it
      const [assignment] = await db.select().from(calendarAssignments).where(
        eq(calendarAssignments.id, assignmentId)
      );
      
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      // Verify the technician is assigned to this PM
      let assignedIds = assignment.assignedTechnicianIds;
      
      // Parse assignedTechnicianIds
      if (typeof assignedIds === 'string') {
        try {
          assignedIds = JSON.parse(assignedIds);
        } catch (e) {
          assignedIds = [];
        }
      }
      if (!Array.isArray(assignedIds)) {
        assignedIds = assignedIds ? [assignedIds] : [];
      }
      
      // Check if technician is in assigned list
      const isAssigned = assignedIds.includes(userId);
      
      if (!isAssigned) {
        return res.status(403).json({ error: "Not authorized to view this assignment" });
      }
      
      // Fetch parts and equipment for the client
      const [parts, equipment] = await Promise.all([
        storage.getClientParts(companyId, assignment.clientId),
        storage.getClientEquipment(companyId, assignment.clientId)
      ]);
      
      res.json({ parts, equipment });
    } catch (error) {
      console.error("Error fetching assignment details:", error);
      res.status(500).json({ error: "Failed to fetch assignment details" });
    }
  });

  // Endpoint to mark calendar assignment as complete with notes
  app.patch("/api/calendar/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const assignmentId = req.params.id;
      const { completed, completionNotes } = req.body;
      
      const updateData: any = {};
      if (completed !== undefined) updateData.completed = completed;
      if (completionNotes !== undefined) updateData.completionNotes = completionNotes;
      
      // Verify assignment exists
      const assignment = await db.select().from(calendarAssignments).where(eq(calendarAssignments.id, assignmentId)).limit(1);
      if (!assignment || assignment.length === 0) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      const assignmentData = assignment[0];
      
      // For technicians: check if they're assigned to this job
      if (req.user!.role === "technician") {
        let techIds = assignmentData.assignedTechnicianIds;
        if (typeof techIds === 'string') {
          try {
            techIds = JSON.parse(techIds);
          } catch (e) {
            techIds = [];
          }
        }
        if (!Array.isArray(techIds)) {
          techIds = techIds ? [techIds] : [];
        }
        
        if (!techIds.includes(userId)) {
          return res.status(403).json({ error: "Not assigned to this job" });
        }
        
        // Update using the company ID from the assignment
        const updated = await storage.updateCalendarAssignment(assignmentData.companyId, assignmentId, updateData);
        if (!updated) {
          return res.status(500).json({ error: "Failed to update assignment" });
        }
        return res.json(updated);
      }
      
      // For admins/owners: use their own companyId
      const updated = await storage.updateCalendarAssignment(req.user!.companyId, assignmentId, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Assignment not found or not authorized" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating calendar assignment:", error);
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  // Get equipment for a client
  app.get("/api/equipment/:clientId", isAuthenticated, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const clientId = req.params.clientId;
      
      const items = await storage.getClientEquipment(companyId, clientId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ error: "Failed to fetch equipment" });
    }
  });

  // =====================
  // JOBS API ENDPOINTS
  // =====================
  
  // Get all jobs with filters
  app.get("/api/jobs", isAuthenticated, async (req, res) => {
    try {
      const { status, technicianId, locationId, startDate, endDate } = req.query;
      const filters: {
        status?: string;
        technicianId?: string;
        locationId?: string;
        startDate?: string;
        endDate?: string;
      } = {};
      
      if (status && typeof status === 'string') filters.status = status;
      if (technicianId && typeof technicianId === 'string') filters.technicianId = technicianId;
      if (locationId && typeof locationId === 'string') filters.locationId = locationId;
      if (startDate && typeof startDate === 'string') filters.startDate = startDate;
      if (endDate && typeof endDate === 'string') filters.endDate = endDate;
      
      const jobs = await storage.getJobs(req.user!.companyId, Object.keys(filters).length > 0 ? filters : undefined);
      
      // Enrich jobs with client/location info
      const enrichedJobs = await Promise.all(jobs.map(async (job) => {
        const location = await storage.getClient(req.user!.companyId, job.locationId);
        return {
          ...job,
          locationName: location?.companyName || 'Unknown',
          locationCity: location?.city || '',
          locationAddress: location?.address || '',
        };
      }));
      
      res.json(enrichedJobs);
    } catch (error) {
      console.error('Get jobs error:', error);
      res.status(500).json({ error: "Failed to get jobs" });
    }
  });

  // Get single job by ID
  app.get("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Enrich with location info
      const location = await storage.getClient(req.user!.companyId, job.locationId);
      let parentCompany = null;
      if (location?.parentCompanyId) {
        parentCompany = await storage.getCustomerCompany(req.user!.companyId, location.parentCompanyId);
      }
      
      // Get assigned technicians
      let technicians: User[] = [];
      if (job.assignedTechnicianIds && job.assignedTechnicianIds.length > 0) {
        const allTechs = await storage.getTechniciansByCompanyId(req.user!.companyId);
        technicians = allTechs.filter(t => job.assignedTechnicianIds?.includes(t.id));
      }
      
      // Get recurring series if linked
      let recurringSeries = null;
      if (job.recurringSeriesId) {
        recurringSeries = await storage.getRecurringSeries(req.user!.companyId, job.recurringSeriesId);
      }
      
      res.json({
        ...job,
        location,
        parentCompany,
        technicians,
        recurringSeries,
      });
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ error: "Failed to get job" });
    }
  });

  // Create new job
  app.post("/api/jobs", isAuthenticated, async (req, res) => {
    try {
      const data = insertJobSchema.parse(req.body);
      const job = await storage.createJob(req.user!.companyId, data);
      res.status(201).json(job);
    } catch (error) {
      console.error('Create job error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create job" });
    }
  });

  // Update job
  app.put("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const data = updateJobSchema.parse(req.body);
      const job = await storage.updateJob(req.user!.companyId, req.params.id, data);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error('Update job error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid job data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  // Update job status only
  app.patch("/api/jobs/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !jobStatusEnum.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const job = await storage.updateJobStatus(req.user!.companyId, req.params.id, status);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error('Update job status error:', error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  });

  // Delete job (soft delete)
  app.delete("/api/jobs/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteJob(req.user!.companyId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  // ================================
  // RECURRING SERIES API ENDPOINTS
  // ================================
  
  // Create recurring series with phases
  app.post("/api/recurring-series", isAuthenticated, async (req, res) => {
    try {
      const { phases, ...seriesData } = req.body;
      
      const validatedSeries = insertRecurringJobSeriesSchema.parse({
        ...seriesData,
        createdByUserId: req.user!.id,
      });
      
      const phasesSchema = z.array(insertRecurringJobPhaseSchema);
      const validatedPhases = phasesSchema.parse(phases || []);
      
      if (validatedPhases.length === 0) {
        return res.status(400).json({ error: "At least one recurrence phase is required" });
      }
      
      const series = await storage.createRecurringSeries(req.user!.companyId, validatedSeries, validatedPhases);
      
      // Get the phases we just created
      const createdPhases = await storage.getRecurringPhases(series.id);
      
      res.status(201).json({
        ...series,
        phases: createdPhases,
      });
    } catch (error) {
      console.error('Create recurring series error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid series data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create recurring series" });
    }
  });

  // Get recurring series by ID
  app.get("/api/recurring-series/:id", isAuthenticated, async (req, res) => {
    try {
      const series = await storage.getRecurringSeries(req.user!.companyId, req.params.id);
      if (!series) {
        return res.status(404).json({ error: "Recurring series not found" });
      }
      
      const phases = await storage.getRecurringPhases(series.id);
      const location = await storage.getClient(req.user!.companyId, series.locationId);
      
      res.json({
        ...series,
        phases,
        location,
      });
    } catch (error) {
      console.error('Get recurring series error:', error);
      res.status(500).json({ error: "Failed to get recurring series" });
    }
  });

  // Generate jobs from recurring series
  app.post("/api/recurring-series/:id/generate", isAuthenticated, async (req, res) => {
    try {
      const { count = 1 } = req.body;
      
      if (count < 1 || count > 24) {
        return res.status(400).json({ error: "Count must be between 1 and 24" });
      }
      
      const series = await storage.getRecurringSeries(req.user!.companyId, req.params.id);
      if (!series) {
        return res.status(404).json({ error: "Recurring series not found" });
      }
      
      const generatedJobs = await storage.generateJobsFromSeries(req.user!.companyId, req.params.id, count);
      
      res.status(201).json({
        generated: generatedJobs.length,
        jobs: generatedJobs,
      });
    } catch (error) {
      console.error('Generate jobs error:', error);
      res.status(500).json({ error: "Failed to generate jobs" });
    }
  });

  // ================================
  // LOCATION PM PLAN API ENDPOINTS
  // ================================
  
  // Get PM plan for a location
  app.get("/api/locations/:locationId/pm-plan", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const pmPlan = await storage.getLocationPMPlan(req.params.locationId);
      res.json(pmPlan || null);
    } catch (error) {
      console.error('Get PM plan error:', error);
      res.status(500).json({ error: "Failed to get PM plan" });
    }
  });

  // Create or update PM plan for a location
  app.post("/api/locations/:locationId/pm-plan", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const pmPlan = await storage.createOrUpdateLocationPMPlan(req.params.locationId, {
        ...req.body,
        locationId: req.params.locationId,
      });
      res.json(pmPlan);
    } catch (error) {
      console.error('Create/update PM plan error:', error);
      res.status(500).json({ error: "Failed to save PM plan" });
    }
  });

  // Delete PM plan for a location (soft delete)
  app.delete("/api/locations/:locationId/pm-plan", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      await storage.deleteLocationPMPlan(req.params.locationId);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete PM plan error:', error);
      res.status(500).json({ error: "Failed to delete PM plan" });
    }
  });

  // ================================
  // LOCATION PM PARTS API ENDPOINTS
  // ================================
  
  // Get PM parts for a location
  app.get("/api/locations/:locationId/pm-parts", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const pmParts = await storage.getLocationPMParts(req.params.locationId);
      res.json(pmParts);
    } catch (error) {
      console.error('Get PM parts error:', error);
      res.status(500).json({ error: "Failed to get PM parts" });
    }
  });

  // Add PM part for a location
  app.post("/api/locations/:locationId/pm-parts", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      if (!req.body.productId || !req.body.quantityPerVisit) {
        return res.status(400).json({ error: "productId and quantityPerVisit are required" });
      }
      
      const pmPart = await storage.createLocationPMPart(req.params.locationId, {
        ...req.body,
        locationId: req.params.locationId,
      });
      res.status(201).json(pmPart);
    } catch (error) {
      console.error('Create PM part error:', error);
      res.status(500).json({ error: "Failed to create PM part" });
    }
  });

  // Update PM part
  app.put("/api/locations/:locationId/pm-parts/:id", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const pmPart = await storage.updateLocationPMPart(req.params.id, req.body);
      if (!pmPart) {
        return res.status(404).json({ error: "PM part not found" });
      }
      res.json(pmPart);
    } catch (error) {
      console.error('Update PM part error:', error);
      res.status(500).json({ error: "Failed to update PM part" });
    }
  });

  // Delete PM part (soft delete)
  app.delete("/api/locations/:locationId/pm-parts/:id", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const deleted = await storage.deleteLocationPMPart(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "PM part not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete PM part error:', error);
      res.status(500).json({ error: "Failed to delete PM part" });
    }
  });

  // ================================
  // PM JOB GENERATION ENDPOINT
  // ================================
  
  // Generate PM job for a location
  app.post("/api/locations/:locationId/generate-pm-job", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const { date } = req.body;
      if (!date) {
        return res.status(400).json({ error: "date is required (YYYY-MM-DD format)" });
      }
      
      const jobDate = new Date(date);
      if (isNaN(jobDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const result = await storage.generatePMJobForLocation(
        req.user!.companyId,
        req.params.locationId,
        jobDate
      );
      
      if (!result) {
        return res.status(400).json({ 
          error: "Cannot generate PM job. Either PM is not enabled for this location or the specified month is not scheduled for PM." 
        });
      }
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Generate PM job error:', error);
      res.status(500).json({ error: "Failed to generate PM job" });
    }
  });

  // ================================
  // JOB PARTS API ENDPOINTS
  // ================================
  
  // Get job parts
  app.get("/api/jobs/:jobId/parts", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const parts = await storage.getJobParts(req.params.jobId);
      res.json(parts);
    } catch (error) {
      console.error('Get job parts error:', error);
      res.status(500).json({ error: "Failed to get job parts" });
    }
  });

  // Add job part
  app.post("/api/jobs/:jobId/parts", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (!req.body.description || !req.body.quantity) {
        return res.status(400).json({ error: "description and quantity are required" });
      }
      
      const jobPart = await storage.createJobPart(req.params.jobId, {
        ...req.body,
        jobId: req.params.jobId,
      });
      res.status(201).json(jobPart);
    } catch (error) {
      console.error('Create job part error:', error);
      res.status(500).json({ error: "Failed to create job part" });
    }
  });

  // Update job part
  app.put("/api/jobs/:jobId/parts/:id", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const jobPart = await storage.updateJobPart(req.params.id, req.body);
      if (!jobPart) {
        return res.status(404).json({ error: "Job part not found" });
      }
      res.json(jobPart);
    } catch (error) {
      console.error('Update job part error:', error);
      res.status(500).json({ error: "Failed to update job part" });
    }
  });

  // Delete job part
  app.delete("/api/jobs/:jobId/parts/:id", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const deleted = await storage.deleteJobPart(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Job part not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete job part error:', error);
      res.status(500).json({ error: "Failed to delete job part" });
    }
  });

  // ================================
  // LOCATION EQUIPMENT API ENDPOINTS
  // ================================
  
  // Get location equipment
  app.get("/api/locations/:locationId/equipment", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const equipment = await storage.getLocationEquipment(req.params.locationId);
      res.json(equipment);
    } catch (error) {
      console.error('Get location equipment error:', error);
      res.status(500).json({ error: "Failed to get location equipment" });
    }
  });

  // Create location equipment
  app.post("/api/locations/:locationId/equipment", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      if (!req.body.name) {
        return res.status(400).json({ error: "name is required" });
      }
      
      // Sanitize input - only allow specific fields to prevent tenant boundary violations
      const sanitizedData = {
        name: req.body.name,
        equipmentType: req.body.equipmentType || null,
        manufacturer: req.body.manufacturer || null,
        modelNumber: req.body.modelNumber || null,
        serialNumber: req.body.serialNumber || null,
        tagNumber: req.body.tagNumber || null,
        installDate: req.body.installDate || null,
        warrantyExpiry: req.body.warrantyExpiry || null,
        notes: req.body.notes || null,
      };
      
      const equipment = await storage.createLocationEquipment(req.params.locationId, sanitizedData);
      res.status(201).json(equipment);
    } catch (error) {
      console.error('Create location equipment error:', error);
      res.status(500).json({ error: "Failed to create location equipment" });
    }
  });

  // Update location equipment
  app.put("/api/locations/:locationId/equipment/:equipmentId", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const existingEquipment = await storage.getLocationEquipmentItem(req.params.equipmentId);
      if (!existingEquipment || existingEquipment.locationId !== req.params.locationId) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      
      // Sanitize input - only allow specific fields to prevent tenant boundary violations
      const sanitizedData: Record<string, unknown> = {};
      if (req.body.name !== undefined) sanitizedData.name = req.body.name;
      if (req.body.equipmentType !== undefined) sanitizedData.equipmentType = req.body.equipmentType;
      if (req.body.manufacturer !== undefined) sanitizedData.manufacturer = req.body.manufacturer;
      if (req.body.modelNumber !== undefined) sanitizedData.modelNumber = req.body.modelNumber;
      if (req.body.serialNumber !== undefined) sanitizedData.serialNumber = req.body.serialNumber;
      if (req.body.tagNumber !== undefined) sanitizedData.tagNumber = req.body.tagNumber;
      if (req.body.installDate !== undefined) sanitizedData.installDate = req.body.installDate;
      if (req.body.warrantyExpiry !== undefined) sanitizedData.warrantyExpiry = req.body.warrantyExpiry;
      if (req.body.notes !== undefined) sanitizedData.notes = req.body.notes;
      
      const updated = await storage.updateLocationEquipment(req.params.equipmentId, sanitizedData);
      res.json(updated);
    } catch (error) {
      console.error('Update location equipment error:', error);
      res.status(500).json({ error: "Failed to update location equipment" });
    }
  });

  // Delete location equipment (soft delete)
  app.delete("/api/locations/:locationId/equipment/:equipmentId", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const existingEquipment = await storage.getLocationEquipmentItem(req.params.equipmentId);
      if (!existingEquipment || existingEquipment.locationId !== req.params.locationId) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      
      const deleted = await storage.deleteLocationEquipment(req.params.equipmentId);
      if (!deleted) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete location equipment error:', error);
      res.status(500).json({ error: "Failed to delete location equipment" });
    }
  });

  // Get single equipment item with service history
  app.get("/api/locations/:locationId/equipment/:equipmentId", isAuthenticated, async (req, res) => {
    try {
      const location = await storage.getClient(req.user!.companyId, req.params.locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      
      const equipment = await storage.getLocationEquipmentItem(req.params.equipmentId);
      if (!equipment || equipment.locationId !== req.params.locationId) {
        return res.status(404).json({ error: "Equipment not found" });
      }
      
      const serviceHistory = await storage.getEquipmentServiceHistory(req.params.equipmentId);
      res.json({ equipment, serviceHistory });
    } catch (error) {
      console.error('Get equipment details error:', error);
      res.status(500).json({ error: "Failed to get equipment details" });
    }
  });

  // ================================
  // JOB EQUIPMENT API ENDPOINTS
  // ================================
  
  // Get job equipment
  app.get("/api/jobs/:jobId/equipment", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const equipment = await storage.getJobEquipment(req.params.jobId);
      res.json(equipment);
    } catch (error) {
      console.error('Get job equipment error:', error);
      res.status(500).json({ error: "Failed to get job equipment" });
    }
  });

  // Add equipment to job
  app.post("/api/jobs/:jobId/equipment", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (!req.body.equipmentId) {
        return res.status(400).json({ error: "equipmentId is required" });
      }
      
      // Verify equipment belongs to the same location as the job
      const equipment = await storage.getLocationEquipmentItem(req.body.equipmentId);
      if (!equipment || equipment.locationId !== job.locationId) {
        return res.status(400).json({ error: "Equipment must belong to the same location as the job" });
      }
      
      // Sanitize input - only allow specific fields to prevent tenant boundary violations
      const sanitizedData = {
        equipmentId: req.body.equipmentId,
        notes: req.body.notes || null,
      };
      
      const jobEquipment = await storage.createJobEquipment(req.params.jobId, sanitizedData);
      res.status(201).json(jobEquipment);
    } catch (error) {
      console.error('Add job equipment error:', error);
      res.status(500).json({ error: "Failed to add equipment to job" });
    }
  });

  // Update job equipment notes
  app.put("/api/jobs/:jobId/equipment/:jobEquipmentId", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Sanitize input - only allow notes field to be updated
      const sanitizedData: Record<string, unknown> = {};
      if (req.body.notes !== undefined) sanitizedData.notes = req.body.notes;
      
      const updated = await storage.updateJobEquipment(req.params.jobEquipmentId, sanitizedData);
      if (!updated) {
        return res.status(404).json({ error: "Job equipment not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error('Update job equipment error:', error);
      res.status(500).json({ error: "Failed to update job equipment" });
    }
  });

  // Remove equipment from job
  app.delete("/api/jobs/:jobId/equipment/:jobEquipmentId", isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getJob(req.user!.companyId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      const deleted = await storage.deleteJobEquipment(req.params.jobEquipmentId);
      if (!deleted) {
        return res.status(404).json({ error: "Job equipment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete job equipment error:', error);
      res.status(500).json({ error: "Failed to remove equipment from job" });
    }
  });

  // ============================================
  // Team Management Routes
  // ============================================

  // Get all team members
  app.get("/api/team", isAuthenticated, async (req, res) => {
    try {
      const members = await storage.getTeamMembers(req.user!.companyId);
      // Don't return password hashes
      const sanitized = members.map(m => ({
        ...m,
        password: undefined,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error('Get team members error:', error);
      res.status(500).json({ error: "Failed to get team members" });
    }
  });

  // Get single team member with profile, working hours, and permissions
  app.get("/api/team/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const member = await storage.getTeamMember(req.user!.companyId, userId);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      const [profile, workingHours, permissionOverrides] = await Promise.all([
        storage.getTechnicianProfile(userId),
        storage.getWorkingHours(userId),
        storage.getUserPermissionOverrides(userId),
      ]);
      
      res.json({
        ...member,
        password: undefined,
        profile,
        workingHours,
        permissionOverrides,
      });
    } catch (error) {
      console.error('Get team member error:', error);
      res.status(500).json({ error: "Failed to get team member" });
    }
  });

  // Update team member basic info
  app.patch("/api/team/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const { firstName, lastName, fullName, phone, roleId, status, useCustomSchedule } = req.body;
      
      const updated = await storage.updateTeamMember(req.user!.companyId, userId, {
        firstName,
        lastName,
        fullName,
        phone,
        roleId,
        status,
        useCustomSchedule,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      res.json({ ...updated, password: undefined });
    } catch (error) {
      console.error('Update team member error:', error);
      res.status(500).json({ error: "Failed to update team member" });
    }
  });

  // Deactivate team member
  app.post("/api/team/:userId/deactivate", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Prevent self-deactivation
      if (userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot deactivate your own account" });
      }
      
      const updated = await storage.deactivateTeamMember(req.user!.companyId, userId);
      if (!updated) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      res.json({ ...updated, password: undefined });
    } catch (error) {
      console.error('Deactivate team member error:', error);
      res.status(500).json({ error: "Failed to deactivate team member" });
    }
  });

  // Activate team member
  app.post("/api/team/:userId/activate", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const member = await storage.getTeamMember(req.user!.companyId, userId);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      const updated = await storage.updateTeamMember(req.user!.companyId, userId, {
        status: 'active'
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      res.json({ ...updated, password: undefined });
    } catch (error) {
      console.error('Activate team member error:', error);
      res.status(500).json({ error: "Failed to activate team member" });
    }
  });

  // Get role permissions
  app.get("/api/roles/:roleId/permissions", isAuthenticated, async (req, res) => {
    try {
      const { roleId } = req.params;
      
      const result = await storage.getRolePermissions(roleId);
      res.json(result);
    } catch (error) {
      console.error('Get role permissions error:', error);
      res.status(500).json({ error: "Failed to get role permissions" });
    }
  });

  // Update technician profile
  app.put("/api/team/:userId/profile", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user belongs to company
      const member = await storage.getTeamMember(req.user!.companyId, userId);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      const { laborCostPerHour, billableRatePerHour, color, phone, note } = req.body;
      
      const profile = await storage.upsertTechnicianProfile(userId, {
        laborCostPerHour,
        billableRatePerHour,
        color,
        phone,
        note,
      });
      
      res.json(profile);
    } catch (error) {
      console.error('Update technician profile error:', error);
      res.status(500).json({ error: "Failed to update technician profile" });
    }
  });

  // Set working hours
  app.put("/api/team/:userId/working-hours", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user belongs to company
      const member = await storage.getTeamMember(req.user!.companyId, userId);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      const { hours } = req.body;
      if (!Array.isArray(hours)) {
        return res.status(400).json({ error: "hours must be an array" });
      }
      
      const workingHours = await storage.setWorkingHours(userId, hours);
      res.json(workingHours);
    } catch (error) {
      console.error('Set working hours error:', error);
      res.status(500).json({ error: "Failed to set working hours" });
    }
  });

  // Set permission overrides
  app.put("/api/team/:userId/permissions", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user belongs to company
      const member = await storage.getTeamMember(req.user!.companyId, userId);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      const { overrides } = req.body;
      if (!Array.isArray(overrides)) {
        return res.status(400).json({ error: "overrides must be an array" });
      }
      
      await storage.setUserPermissionOverrides(userId, overrides);
      const updated = await storage.getUserPermissionOverrides(userId);
      res.json(updated);
    } catch (error) {
      console.error('Set permission overrides error:', error);
      res.status(500).json({ error: "Failed to set permission overrides" });
    }
  });

  // Get all roles (for dropdown in team member edit)
  app.get("/api/roles", isAuthenticated, async (req, res) => {
    try {
      const { roles } = await import("@shared/schema");
      const { db } = await import("./db");
      const allRoles = await db.select().from(roles).orderBy(roles.name);
      res.json(allRoles.map(r => ({
        ...r,
        displayName: r.name.charAt(0).toUpperCase() + r.name.slice(1).replace(/_/g, ' '),
        hierarchy: 0,
      })));
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({ error: "Failed to get roles" });
    }
  });

  // Get all permissions (for permission override UI)
  app.get("/api/permissions", isAuthenticated, async (req, res) => {
    try {
      const { permissions } = await import("@shared/schema");
      const { db } = await import("./db");
      const allPermissions = await db.select().from(permissions).orderBy(permissions.group, permissions.key);
      res.json(allPermissions.map(p => ({
        id: p.id,
        name: p.key,
        displayName: p.label,
        description: p.description,
        category: p.group,
      })));
    } catch (error) {
      console.error('Get permissions error:', error);
      res.status(500).json({ error: "Failed to get permissions" });
    }
  });

  // Get user's effective permissions (computed from role + overrides)
  app.get("/api/team/:userId/effective-permissions", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user belongs to company
      const member = await storage.getTeamMember(req.user!.companyId, userId);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }
      
      const { getUserEffectivePermissions } = await import("./permissions");
      const permissionSet = await getUserEffectivePermissions(userId);
      res.json(Array.from(permissionSet));
    } catch (error) {
      console.error('Get effective permissions error:', error);
      res.status(500).json({ error: "Failed to get effective permissions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
