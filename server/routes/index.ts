import type { Express } from "express";
import jobsRouter from "./jobs";
import invoicesRouter from "./invoices";
import teamRouter from "./team";
import calendarRouter from "./calendar";

export function registerModularRoutes(app: Express): void {
  app.use("/api/jobs", jobsRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/team", teamRouter);
  app.use("/api/calendar", calendarRouter);
}
