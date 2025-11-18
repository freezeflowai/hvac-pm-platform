import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { insertClientSchema, insertPartSchema, insertClientPartSchema, insertUserSchema, insertEquipmentSchema, insertCompanySettingsSchema, insertCalendarAssignmentSchema, updateCalendarAssignmentSchema, type Client } from "@shared/schema";
import { passport, isAdmin, requireAdmin } from "./auth";
import { z } from "zod";
import Stripe from "stripe";

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
      const { email, password } = req.body;
      insertUserSchema.parse({ email, password });
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      // Check if this will be the first user
      const allUsers = await storage.getAllUsers();
      const isFirstUser = allUsers.length === 0;
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, password: hashedPassword });
      
      // Set trial period (configurable via TRIAL_DAYS env var, defaults to 30 days)
      const trialDays = parseInt(process.env.TRIAL_DAYS || "30", 10);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
      await storage.updateUserTrialDate(user.id, trialEndsAt);
      user.trialEndsAt = trialEndsAt;
      
      // SECURITY: Only the first user is automatically made an admin
      // Additional admins must be promoted by existing admins
      if (isFirstUser) {
        await storage.updateUserAdminStatus(user.id, true);
        user.isAdmin = true;
        // Seed standard parts for the first admin user
        await storage.seedUserParts(user.id);
      }
      
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to regenerate session" });
        }
        req.login(user, (err) => {
          if (err) {
            return res.status(500).json({ error: "Failed to login after signup" });
          }
          res.json({ id: user.id, email: user.email, isAdmin: user.isAdmin });
        });
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid signup data" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to regenerate session" });
        }
        req.login(user, (err) => {
          if (err) {
            return res.status(500).json({ error: "Failed to login" });
          }
          res.json({ id: user.id, email: user.email, isAdmin: user.isAdmin });
        });
      });
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
      res.json({ id: req.user.id, email: req.user.email, isAdmin: req.user.isAdmin });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Diagnostic endpoint to check production environment
  app.get("/api/diagnostic", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const userCount = allUsers.length;
      const adminUsers = allUsers.filter(u => u.isAdmin);
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
        currentUser: req.user ? { id: req.user.id, email: req.user.email, isAdmin: req.user.isAdmin } : null,
        sessionCookieSettings: {
          secure: isProduction,
          sameSite: "lax"
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Diagnostic failed", message: String(error) });
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

  // Client routes
  app.get("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const clients = await storage.getAllClients(req.user!.id);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", isAuthenticated, async (req, res) => {
    try {
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
        client = await storage.createClientWithParts(req.user!.id, validated, validatedParts);
      } else {
        // No parts, use regular client creation
        client = await storage.createClient(req.user!.id, validated);
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

      let imported = 0;
      const errors: string[] = [];

      for (const clientData of clients) {
        try {
          const validated = insertClientSchema.parse(clientData);
          await storage.createClient(req.user!.id, validated);
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
          const client = await storage.createClient(req.user!.id, validated);
          imported++;
          
          // Import parts if present
          if (parts && Array.isArray(parts) && parts.length > 0) {
            for (const partData of parts) {
              try {
                // Create part as "other" type with the name from backup
                const part = await storage.createPart(req.user!.id, {
                  type: 'other',
                  name: partData.name,
                  filterType: null,
                  beltType: null,
                  size: null,
                  description: null,
                });
                
                // Link part to client
                await storage.addClientPart(req.user!.id, {
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
                await storage.createEquipment(req.user!.id, {
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
      const client = await storage.getClient(req.user!.id, req.params.id);
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
      const userId = req.user!.id;
      const clientId = req.params.id;
      console.log(`[Report] Fetching report for userId: ${userId}, clientId: ${clientId}`);
      
      const report = await storage.getClientReport(userId, clientId);
      if (!report) {
        console.log(`[Report] Client not found - userId: ${userId}, clientId: ${clientId}`);
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
      const client = await storage.updateClient(req.user!.id, req.params.id, validated);
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
      await storage.deleteAllClientParts(req.user!.id, req.params.id);
      const deleted = await storage.deleteClient(req.user!.id, req.params.id);
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
      
      const result = await storage.deleteClients(req.user!.id, ids);
      
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
      const parts = await storage.getAllParts(req.user!.id);
      res.json(parts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parts" });
    }
  });

  app.post("/api/parts", isAuthenticated, async (req, res) => {
    try {
      const validated = insertPartSchema.parse(req.body);
      
      // Check for duplicate part
      const existingPart = await storage.findDuplicatePart(req.user!.id, validated);
      
      if (existingPart) {
        let errorMessage = "A part with these details already exists";
        if (validated.type === 'filter') {
          errorMessage = `A filter with type "${validated.filterType}" and size "${validated.size}" already exists`;
        } else if (validated.type === 'belt') {
          errorMessage = `A belt with type "${validated.beltType}" and size "${validated.size}" already exists`;
        } else if (validated.type === 'other') {
          errorMessage = `A part named "${validated.name}" already exists`;
        }
        
        return res.status(409).json({ error: errorMessage });
      }
      
      const part = await storage.createPart(req.user!.id, validated);
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
        const existingPart = await storage.findDuplicatePart(req.user!.id, partData);
        
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
          const part = await storage.createPart(req.user!.id, partData);
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
      const part = await storage.updatePart(req.user!.id, req.params.id, validated);
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
      await storage.seedUserParts(req.user!.id);
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
      const deleted = await storage.deletePart(req.user!.id, req.params.id);
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
      
      const result = await storage.deleteParts(req.user!.id, ids);
      
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

  // Client-Part routes
  app.get("/api/client-parts/bulk", isAuthenticated, async (req, res) => {
    try {
      const bulkParts = await storage.getAllClientPartsBulk(req.user!.id);
      res.json(bulkParts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bulk client parts" });
    }
  });

  app.get("/api/clients/:id/parts", isAuthenticated, async (req, res) => {
    try {
      const clientParts = await storage.getClientParts(req.user!.id, req.params.id);
      res.json(clientParts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client parts" });
    }
  });

  app.post("/api/clients/:id/parts", isAuthenticated, async (req, res) => {
    try {
      const parts = req.body.parts as Array<{ partId: string; quantity: number }>;
      
      // Delete existing parts for this client
      await storage.deleteAllClientParts(req.user!.id, req.params.id);
      
      // Add new parts
      const createdParts = await Promise.all(
        parts.map(p => storage.addClientPart(req.user!.id, {
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
      await storage.deleteAllClientParts(req.user!.id, req.params.id);
      
      // Add new parts
      const createdParts = await Promise.all(
        parts.map(p => storage.addClientPart(req.user!.id, {
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

  app.delete("/api/client-parts/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteClientPart(req.user!.id, req.params.id);
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
      const report = await storage.getPartsReportByMonth(req.user!.id, month, outstandingOnly);
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
      
      const allClients = await storage.getAllClients(req.user!.id);
      
      // Filter clients that have the selected month in their selectedMonths array and are not inactive
      const scheduledClients = allClients.filter(client => 
        client.selectedMonths.includes(month) && !client.inactive
      );
      
      // Get parts and completion status for each client
      const currentYear = new Date().getFullYear();
      const completedRecords = await storage.getRecentlyCompletedMaintenance(req.user!.id, month, currentYear);
      
      const clientsWithParts = await Promise.all(
        scheduledClients.map(async (client) => {
          const clientParts = await storage.getClientParts(req.user!.id, client.id);
          
          // Check if there's a completed maintenance record for this month
          const isCompleted = completedRecords.some(record => record.clientId === client.id);
          
          return {
            ...client,
            parts: clientParts,
            isCompleted
          };
        })
      );
      
      res.json(clientsWithParts);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate schedule report" });
    }
  });

  // Get all completed maintenance statuses
  app.get("/api/maintenance/statuses", isAuthenticated, async (req, res) => {
    try {
      const clients = await storage.getAllClients(req.user!.id);
      const statuses: Record<string, { completed: boolean; completedDueDate?: string }> = {};
      
      for (const client of clients) {
        // Check for the most recent completed maintenance
        const latestCompleted = await storage.getLatestCompletedMaintenanceRecord(req.user!.id, client.id);
        
        if (latestCompleted && latestCompleted.completedAt) {
          statuses[client.id] = {
            completed: true,
            completedDueDate: latestCompleted.dueDate
          };
        } else {
          statuses[client.id] = { completed: false };
        }
      }
      
      res.json(statuses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch maintenance statuses" });
    }
  });

  // Get recently completed maintenance (this month)
  app.get("/api/maintenance/recently-completed", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const records = await storage.getRecentlyCompletedMaintenance(req.user!.id, currentMonth, currentYear);
      
      // Fetch client details for each record and format for frontend
      const completedItems = [];
      for (const record of records) {
        const client = await storage.getClient(req.user!.id, record.clientId);
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
      const records = await storage.getCompletedUnscheduledMaintenance(req.user!.id);
      
      // Fetch client details for each record and format for frontend
      const completedItems = [];
      for (const record of records) {
        const client = await storage.getClient(req.user!.id, record.clientId);
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
      
      const client = await storage.getClient(req.user!.id, clientId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Check if there's a record for the requested dueDate
      const record = await storage.getMaintenanceRecord(req.user!.id, clientId, dueDate);
      
      // Check if there's a calendar assignment for this month
      const dueDateObj = new Date(dueDate);
      const year = dueDateObj.getFullYear();
      const month = dueDateObj.getMonth() + 1; // Calendar API uses 1-indexed months
      const calendarAssignment = await storage.getClientCalendarAssignment(req.user!.id, clientId, year, month);

      if (record && record.completedAt) {
        // This cycle is completed - uncomplete it and restore nextDue
        await storage.updateClient(req.user!.id, clientId, { nextDue: dueDate });
        await storage.updateMaintenanceRecord(req.user!.id, record.id, { completedAt: null });
        
        // Update calendar assignment to mark as incomplete
        if (calendarAssignment) {
          await storage.updateCalendarAssignment(req.user!.id, calendarAssignment.id, { completed: false });
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
          await storage.updateMaintenanceRecord(req.user!.id, record.id, { completedAt });
        } else {
          await storage.createMaintenanceRecord(req.user!.id, {
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
        await storage.updateClient(req.user!.id, clientId, { nextDue: nextDue.toISOString() });
        
        // Update calendar assignment to mark as complete
        if (calendarAssignment) {
          await storage.updateCalendarAssignment(req.user!.id, calendarAssignment.id, { completed: true });
        }

        // Automatically create calendar assignment for the next due date
        const nextYear = nextDue.getFullYear();
        const nextMonthNum = nextDue.getMonth() + 1; // Calendar API uses 1-indexed months
        const nextDay = nextDue.getDate();
        
        // Check if assignment already exists for the next due date
        const existingNextAssignment = await storage.getClientCalendarAssignment(
          req.user!.id, 
          clientId, 
          nextYear, 
          nextMonthNum
        );
        
        if (!existingNextAssignment) {
          // Create new calendar assignment for next due date
          await storage.createCalendarAssignment(req.user!.id, {
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
      const equipment = await storage.getAllEquipment(req.user!.id);
      res.json(equipment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch equipment" });
    }
  });

  app.get("/api/clients/:clientId/equipment", isAuthenticated, async (req, res) => {
    try {
      const equipment = await storage.getClientEquipment(req.user!.id, req.params.clientId);
      res.json(equipment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch equipment" });
    }
  });

  app.post("/api/clients/:clientId/equipment", isAuthenticated, async (req, res) => {
    try {
      const validated = insertEquipmentSchema.parse(req.body);
      const equipment = await storage.createEquipment(req.user!.id, {
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
      await storage.deleteAllClientEquipment(req.user!.id, req.params.clientId);
      
      // Add new equipment
      const createdEquipment = await Promise.all(
        equipment.map(e => storage.createEquipment(req.user!.id, {
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
      const equipment = await storage.updateEquipment(req.user!.id, req.params.id, validated);
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
      const deleted = await storage.deleteEquipment(req.user!.id, req.params.id);
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
      const users = await storage.getAllUsers();
      // Don't send passwords to the client
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === req.user!.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      // Check if this is the last admin
      const users = await storage.getAllUsers();
      const adminUsers = users.filter(u => u.isAdmin);
      const userToDelete = users.find(u => u.id === id);
      
      if (userToDelete?.isAdmin && adminUsers.length === 1) {
        return res.status(400).json({ error: "Cannot delete the last admin user" });
      }
      
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.patch("/api/admin/users/:id/admin", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isAdmin: newAdminStatus } = req.body;
      
      if (typeof newAdminStatus !== 'boolean') {
        return res.status(400).json({ error: "Invalid admin status" });
      }
      
      // If demoting from admin, check if this is the last admin
      if (!newAdminStatus) {
        const users = await storage.getAllUsers();
        const adminUsers = users.filter(u => u.isAdmin);
        const userToUpdate = users.find(u => u.id === id);
        
        if (userToUpdate?.isAdmin && adminUsers.length === 1) {
          return res.status(400).json({ error: "Cannot demote the last admin user" });
        }
      }
      
      await storage.updateUserAdminStatus(id, newAdminStatus);
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
      
      await storage.seedUserParts(id);
      const parts = await storage.getAllParts(id);
      
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
      
      const assignments = await storage.getCalendarAssignments(userId, yearNum, monthNum);
      const clients = await storage.getAllClients(userId);
      
      res.json({ assignments, clients });
    } catch (error) {
      console.error('Get calendar error:', error);
      res.status(500).json({ error: "Failed to fetch calendar data" });
    }
  });

  app.get("/api/calendar/unscheduled", isAuthenticated, async (req, res) => {
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
      
      const unscheduledClients = await storage.getUnscheduledClients(userId, yearNum, monthNum);
      res.json(unscheduledClients);
    } catch (error) {
      console.error('Get unscheduled clients error:', error);
      res.status(500).json({ error: "Failed to fetch unscheduled clients" });
    }
  });

  app.post("/api/calendar/assign", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const assignmentData = insertCalendarAssignmentSchema.parse(req.body);
      
      // Check if this client already has an assignment for this month
      const existingAssignment = await storage.getClientCalendarAssignment(
        userId,
        assignmentData.clientId,
        assignmentData.year,
        assignmentData.month
      );
      
      if (existingAssignment) {
        return res.status(400).json({ error: "Client already has an assignment for this month" });
      }
      
      const assignment = await storage.createCalendarAssignment(userId, assignmentData);
      
      // Update client's nextDue date
      const client = await storage.getClient(userId, assignmentData.clientId);
      if (client) {
        await storage.updateClient(userId, assignmentData.clientId, {
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
      const assignmentUpdate = updateCalendarAssignmentSchema.parse(req.body);
      
      const assignment = await storage.updateCalendarAssignment(userId, id, assignmentUpdate);
      
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      // Update client's nextDue date if scheduledDate changed
      if (assignmentUpdate.scheduledDate) {
        await storage.updateClient(userId, assignment.clientId, {
          nextDue: assignmentUpdate.scheduledDate
        });
      }
      
      // Handle completion status changes
      if (assignmentUpdate.completed !== undefined) {
        const dueDate = assignment.scheduledDate;
        
        if (assignmentUpdate.completed === true) {
          // Marking as complete - create/update maintenanceRecord
          const record = await storage.getMaintenanceRecord(userId, assignment.clientId, dueDate);
          const completedAt = new Date().toISOString();
          
          if (record) {
            await storage.updateMaintenanceRecord(userId, record.id, { completedAt });
          } else {
            await storage.createMaintenanceRecord(userId, {
              clientId: assignment.clientId,
              dueDate,
              completedAt,
            });
          }
          
          // Advance nextDue to next occurrence
          const client = await storage.getClient(userId, assignment.clientId);
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
            await storage.updateClient(userId, assignment.clientId, {
              nextDue: nextDueDate.toISOString().split('T')[0]
            });
          }
        } else {
          // Marking as incomplete - remove completion from maintenanceRecord
          const record = await storage.getMaintenanceRecord(userId, assignment.clientId, dueDate);
          if (record) {
            await storage.updateMaintenanceRecord(userId, record.id, { completedAt: null });
          }
          
          // Restore client's nextDue to this assignment's date
          await storage.updateClient(userId, assignment.clientId, {
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
      
      const assignment = await storage.getCalendarAssignment(userId, id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      const deleted = await storage.deleteCalendarAssignment(userId, id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      // Recalculate client's nextDue based on selectedMonths
      const client = await storage.getClient(userId, assignment.clientId);
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
        await storage.updateClient(userId, assignment.clientId, {
          nextDue: nextDueDate.toISOString().split('T')[0]
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete calendar assignment error:', error);
      res.status(500).json({ error: "Failed to delete calendar assignment" });
    }
  });

  // Company settings routes
  app.get("/api/company-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const settings = await storage.getCompanySettings(userId);
      
      if (!settings) {
        return res.json(null);
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Get company settings error:', error);
      res.status(500).json({ error: "Failed to fetch company settings" });
    }
  });

  app.post("/api/company-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const settingsData = insertCompanySettingsSchema.parse(req.body);
      
      const settings = await storage.upsertCompanySettings(userId, settingsData);
      res.json(settings);
    } catch (error) {
      console.error('Update company settings error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update company settings" });
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
        await storage.updateUserStripeCustomer(user.id, customerId);
        
        // Refresh session with updated user
        const updatedUser = await storage.getUser(user.id);
        if (updatedUser) {
          req.login(updatedUser, (err) => {
            if (err) console.error("Failed to refresh session:", err);
          });
          user = updatedUser;
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

  const httpServer = createServer(app);
  return httpServer;
}
