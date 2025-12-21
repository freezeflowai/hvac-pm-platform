import type { Express } from "express";

import { attachUserContext } from "./auth/attachUserContext";
import { requireAuth } from "./auth/requireAuth";

import invitations from "./routes/invitations";
import usersAdmin from "./routes/users_admin";
import jobs from "./routes/jobs";
import invoices from "./routes/invoices";

/**
 * Route registration — FOUNDATION RULES
 * 1) Never block the SPA (/) with auth middleware
 * 2) Keep auth enforcement scoped to /api/* routes
 * 3) Mount public routes BEFORE requireAuth
 */
export function registerRoutes(app: Express) {
  // Attach user/company context only for API calls (safe for unauthenticated too)
  app.use("/api", attachUserContext);

  // ---- Public API routes ----
  app.use("/api/invitations", invitations); // includes /accept inside router

  // ---- Protected API routes (require login) ----
  app.use("/api/users", requireAuth, usersAdmin);
  app.use("/api/jobs", requireAuth, jobs);
  app.use("/api/invoices", requireAuth, invoices);

  return app;
}
