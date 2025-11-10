import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertClientSchema, insertPartSchema, insertClientPartSchema, insertUserSchema } from "@shared/schema";
import { STANDARD_FILTERS, STANDARD_BELTS } from "./seed-data";
import { passport } from "./auth";

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

async function seedStandardParts() {
  try {
    const allSeedParts = [...STANDARD_FILTERS, ...STANDARD_BELTS];
    let created = 0;
    let skipped = 0;
    
    for (const partData of allSeedParts) {
      const existingPart = await storage.findDuplicatePart(partData);
      
      if (!existingPart) {
        await storage.createPart(partData);
        created++;
      } else {
        skipped++;
      }
    }
    
    console.log(`✓ Parts inventory seeded: ${created} created, ${skipped} already existed (${allSeedParts.length} total)`);
  } catch (error) {
    console.error('✗ Failed to seed parts inventory:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Automatically seed standard parts inventory on server startup
  await seedStandardParts();
  
  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, password } = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashedPassword });
      
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to regenerate session" });
        }
        req.login(user, (err) => {
          if (err) {
            return res.status(500).json({ error: "Failed to login after signup" });
          }
          res.json({ id: user.id, username: user.username });
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
          res.json({ id: user.id, username: user.username });
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
      res.json({ id: req.user.id, username: req.user.username });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Client routes
  app.get("/api/clients", isAuthenticated, async (_req, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const validated = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validated);
      res.json(client);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.put("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const validated = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, validated);
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
      await storage.deleteAllClientParts(req.params.id);
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Part routes
  app.get("/api/parts", isAuthenticated, async (_req, res) => {
    try {
      const parts = await storage.getAllParts();
      res.json(parts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parts" });
    }
  });

  app.post("/api/parts", isAuthenticated, async (req, res) => {
    try {
      const validated = insertPartSchema.parse(req.body);
      
      // Check for duplicate part
      const existingPart = await storage.findDuplicatePart(validated);
      
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
      
      const part = await storage.createPart(validated);
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
        const existingPart = await storage.findDuplicatePart(partData);
        
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
          const part = await storage.createPart(partData);
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
      const part = await storage.updatePart(req.params.id, validated);
      if (!part) {
        return res.status(404).json({ error: "Part not found" });
      }
      res.json(part);
    } catch (error) {
      res.status(400).json({ error: "Invalid part data" });
    }
  });

  app.post("/api/parts/seed", isAuthenticated, async (_req, res) => {
    try {
      const allSeedParts = [...STANDARD_FILTERS, ...STANDARD_BELTS];
      const createdParts = [];
      const skippedParts = [];
      
      for (const partData of allSeedParts) {
        const existingPart = await storage.findDuplicatePart(partData);
        
        if (!existingPart) {
          const part = await storage.createPart(partData);
          createdParts.push(part);
        } else {
          skippedParts.push(partData);
        }
      }
      
      res.json({ 
        message: "Seed data processed",
        created: createdParts.length,
        skipped: skippedParts.length,
        total: allSeedParts.length
      });
    } catch (error) {
      console.error('Seed error:', error);
      res.status(500).json({ error: "Failed to seed parts data" });
    }
  });

  app.delete("/api/parts/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deletePart(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Part not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete part" });
    }
  });

  // Client-Part routes
  app.get("/api/clients/:id/parts", isAuthenticated, async (req, res) => {
    try {
      const clientParts = await storage.getClientParts(req.params.id);
      res.json(clientParts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client parts" });
    }
  });

  app.post("/api/clients/:id/parts", isAuthenticated, async (req, res) => {
    try {
      const parts = req.body.parts as Array<{ partId: string; quantity: number }>;
      
      // Delete existing parts for this client
      await storage.deleteAllClientParts(req.params.id);
      
      // Add new parts
      const createdParts = await Promise.all(
        parts.map(p => storage.addClientPart({
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
      const deleted = await storage.deleteClientPart(req.params.id);
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
      const report = await storage.getPartsReportByMonth(month);
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
      
      const allClients = await storage.getAllClients();
      
      // Filter clients that have the selected month in their selectedMonths array and are not inactive
      const scheduledClients = allClients.filter(client => 
        client.selectedMonths.includes(month) && !client.inactive
      );
      
      res.json(scheduledClients);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate schedule report" });
    }
  });

  // Get all completed maintenance statuses
  app.get("/api/maintenance/statuses", isAuthenticated, async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      const statuses: Record<string, { completed: boolean; completedDueDate?: string }> = {};
      
      for (const client of clients) {
        // Check for the most recent completed maintenance
        const latestCompleted = await storage.getLatestCompletedMaintenanceRecord(client.id);
        
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
      
      const records = await storage.getRecentlyCompletedMaintenance(currentMonth, currentYear);
      
      // Fetch client details for each record and format for frontend
      const completedItems = [];
      for (const record of records) {
        const client = await storage.getClient(record.clientId);
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

  // Maintenance completion routes
  app.post("/api/maintenance/:clientId/toggle", isAuthenticated, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { dueDate } = req.body;  // Frontend sends the dueDate it's displaying
      
      if (!dueDate) {
        return res.status(400).json({ error: "dueDate is required" });
      }
      
      const client = await storage.getClient(clientId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Check if there's a record for the requested dueDate
      const record = await storage.getMaintenanceRecord(clientId, dueDate);

      if (record && record.completedAt) {
        // This cycle is completed - uncomplete it and restore nextDue
        await storage.updateClient(clientId, { nextDue: dueDate });
        await storage.updateMaintenanceRecord(record.id, { completedAt: null });
        res.json({ completed: false, record });
      } else {
        // Mark this maintenance cycle as complete and advance nextDue
        const currentDate = new Date(dueDate);
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const completedAt = new Date().toISOString();

        // Create or update maintenance record for this dueDate
        if (record) {
          await storage.updateMaintenanceRecord(record.id, { completedAt });
        } else {
          await storage.createMaintenanceRecord({
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
        await storage.updateClient(clientId, { nextDue: nextDue.toISOString() });

        res.json({ completed: true, nextDue: nextDue.toISOString() });
      }
    } catch (error) {
      console.error('Toggle maintenance error:', error);
      res.status(500).json({ error: "Failed to toggle maintenance status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
