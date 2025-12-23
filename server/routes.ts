import type { Express } from "express";
import express from "express";

import { attachUserContext } from "./auth/attachUserContext";
import { requireAuth } from "./auth/requireAuth";

import invitations from "./routes/invitations";
import usersAdmin from "./routes/users_admin";

import clients from "./routes/clients";
import calendar from "./routes/calendar";
import team from "./routes/team";
import technicians from "./routes/technicians";
import jobTemplates from "./routes/jobTemplates";

import jobs from "./routes/jobs";
import invoices from "./routes/invoices";

/**
 * Central API route registry.
 * IMPORTANT:
 *  - Mount /api/invitations BEFORE requireAuth so /accept stays public.
 *  - Everything else is protected.
 */
export function registerRoutes(app: Express) {
  // Ensure JSON parsing is enabled for API routes
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // If you attach req.user/company context, keep it early
  app.use(attachUserContext);

  // Public routes
  app.use("/api/invitations", invitations);

  // Everything below requires auth
  app.use(requireAuth);

  // Admin / user management
  app.use("/api/users", usersAdmin);

  // Core domain routes
  app.use("/api/clients", clients);
  app.use("/api/calendar", calendar);
  app.use("/api/team", team);
  app.use("/api/technicians", technicians);
  app.use("/api/job-templates", jobTemplates);

  app.use("/api/jobs", jobs);
  app.use("/api/invoices", invoices);

  return app;
}
