import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import jobsRouter from "./jobs";
import invoicesRouter from "./invoices";
import teamRouter from "./team";
import calendarRouter from "./calendar";

/**
 * Modular route registration (domain routers)
 */
export function registerModularRoutes(app: Express): void {
  app.use("/api/jobs", jobsRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/team", teamRouter);
  app.use("/api/calendar", calendarRouter);
}

/**
 * Compatibility registerRoutes()
 *
 * Your server/index.ts imports: `import { registerRoutes } from "./routes";`
 * Depending on module resolution/build output, that import can resolve to
 * `server/routes/index.ts` (this file) instead of `server/routes.ts`.
 *
 * If that happens, auth endpoints like POST /api/auth/login won't exist and
 * you will get: "Cannot POST /api/auth/login".
 *
 * This function ensures auth routes exist even when the modular index is used.
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Domain routers
  registerModularRoutes(app);

  // --- Auth routes (session + passport-local) ---
  // NOTE: The LocalStrategy is configured in server/auth.ts, which is imported by server/index.ts.
  // We only need to use passport.authenticate here.

  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return res.status(500).json({ error: "Internal server error" });
      if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials" });

      req.session.regenerate((regenErr) => {
        if (regenErr) return res.status(500).json({ error: "Failed to regenerate session" });

        req.login(user, (loginErr) => {
          if (loginErr) return res.status(500).json({ error: "Failed to login" });

          // Return only the public fields the frontend expects
          return res.json({
            id: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            isAdmin: user.role === "admin",
          });
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: any, res: Response) => {
    req.logout((err: any) => {
      if (err) return res.status(500).json({ error: "Failed to logout" });

      req.session.destroy((destroyErr: any) => {
        if (destroyErr) return res.status(500).json({ error: "Failed to destroy session" });

        res.clearCookie("connect.sid");
        return res.json({ success: true });
      });
    });
  });

  app.get("/api/auth/user", (req: any, res: Response) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = req.user;
    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      isAdmin: user.role === "admin",
    });
  });

  // Create & return HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
