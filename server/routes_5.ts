
import type { Express } from "express";
import express from "express";

import { attachUserContext } from "./auth/attachUserContext";
import { requireAuth } from "./auth/requireAuth";

import invitations from "./routes/invitations";
import usersAdmin from "./routes/users_admin";

// existing protected routes
import jobs from "./routes/jobs";
import invoices from "./routes/invoices";

export function registerRoutes(app: Express) {
  // Ensure JSON parsing is enabled for API routes
  app.use(express.json());

  // Attach derived context (companyId etc) if auth middleware hydrates req.user
  app.use(attachUserContext);

  // Public route(s) must be mounted BEFORE requireAuth
  app.use("/api/invitations", invitations); // includes /accept inside router

  // Everything below requires auth
  app.use(requireAuth);

  // Admin/protected routes
  app.use("/api/users", usersAdmin);

  // Core app routes
  app.use("/api/jobs", jobs);
  app.use("/api/invoices", invoices);

  return app;
}
