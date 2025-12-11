import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertCalendarAssignmentSchema, updateCalendarAssignmentSchema } from "@shared/schema";

const router = Router();

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

router.get("/all", isAuthenticated, async (req, res) => {
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

router.get("/", isAuthenticated, async (req, res) => {
  try {
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

router.get("/unscheduled", isAuthenticated, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const backlog = await storage.getAllUnscheduledBacklog(companyId);
    res.json(backlog);
  } catch (error) {
    console.error('Get unscheduled clients error:', error);
    res.status(500).json({ error: "Failed to fetch unscheduled clients" });
  }
});

router.get("/overdue", isAuthenticated, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const overdueAssignments = await storage.getPastIncompleteAssignments(companyId);
    const clients = await storage.getAllClients(companyId);
    
    const overdueWithClients = overdueAssignments.map(assignment => {
      const client = clients.find(c => c.id === assignment.clientId);
      return { assignment, client };
    }).filter(item => item.client);
    
    res.json(overdueWithClients);
  } catch (error) {
    console.error('Get overdue assignments error:', error);
    res.status(500).json({ error: "Failed to fetch overdue assignments" });
  }
});

router.get("/old-unscheduled", isAuthenticated, async (req, res) => {
  try {
    const companyId = req.user!.companyId;
    const oldAssignments = await storage.getOldUnscheduledAssignments(companyId);
    const clients = await storage.getAllClients(companyId);
    
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

router.post("/assign", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const companyId = req.user!.companyId;
    const assignmentData = insertCalendarAssignmentSchema.parse(req.body);
    
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

router.patch("/assign/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const body = req.body;
    
    if (body.assignedTechnicianId && !body.assignedTechnicianIds) {
      body.assignedTechnicianIds = body.assignedTechnicianId ? [body.assignedTechnicianId] : null;
    }
    
    const assignmentUpdate = updateCalendarAssignmentSchema.parse(body);
    
    const assignment = await storage.updateCalendarAssignment(req.user!.companyId, id, assignmentUpdate);
    
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    
    if (assignmentUpdate.scheduledDate) {
      await storage.updateClient(req.user!.companyId, assignment.clientId, {
        nextDue: assignmentUpdate.scheduledDate
      });
    }
    
    if (assignmentUpdate.completed !== undefined) {
      const dueDate = assignment.scheduledDate;
      
      if (assignmentUpdate.completed === true) {
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
        
        const client = await storage.getClient(req.user!.companyId, assignment.clientId);
        if (client && client.selectedMonths && client.selectedMonths.length > 0) {
          const currentDate = new Date(assignment.scheduledDate);
          const currentMonth = currentDate.getMonth();
          const currentYear = currentDate.getFullYear();
          
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
        const record = await storage.getMaintenanceRecord(req.user!.companyId, assignment.clientId, dueDate);
        if (record) {
          await storage.updateMaintenanceRecord(req.user!.companyId, record.id, { completedAt: null });
        }
        
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

router.delete("/assign/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    const assignment = await storage.getCalendarAssignment(req.user!.companyId, id);
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    
    const deleted = await storage.deleteCalendarAssignment(req.user!.companyId, id);
    
    if (!deleted) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    
    const client = await storage.getClient(req.user!.companyId, assignment.clientId);
    if (client && client.selectedMonths && client.selectedMonths.length > 0) {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
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

router.patch("/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    
    if (body.assignedTechnicianId && !body.assignedTechnicianIds) {
      body.assignedTechnicianIds = body.assignedTechnicianId ? [body.assignedTechnicianId] : null;
    }
    
    const assignmentUpdate = updateCalendarAssignmentSchema.parse(body);
    const assignment = await storage.updateCalendarAssignment(req.user!.companyId, id, assignmentUpdate);
    
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    
    res.json(assignment);
  } catch (error) {
    console.error("Error updating calendar assignment:", error);
    res.status(500).json({ error: "Failed to update assignment" });
  }
});

export default router;
