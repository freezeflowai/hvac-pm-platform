import type { Express } from "express";

import jobsRouter from "./jobs";
import invoicesRouter from "./invoices";
import teamRouter from "./team";
import calendarRouter from "./calendar";
import clientsRouter from "./clients";
import techniciansRouter from "./technicians";
import jobTemplatesRouter from "./jobTemplates";

/**
 * Back-compat helper some builds import.
 * NOTE: This does NOT apply auth; that's handled by the app's main server entry.
 */
export function registerModularRoutes(app: Express): void {
  app.use("/api/jobs", jobsRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/team", teamRouter);
  app.use("/api/calendar", calendarRouter);
  app.use("/api/clients", clientsRouter);
  app.use("/api/technicians", techniciansRouter);
  app.use("/api/job-templates", jobTemplatesRouter);
}
