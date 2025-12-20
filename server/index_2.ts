import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { passport } from "./auth";
import pgSession from "connect-pg-simple";
import pg from "pg";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

const PgStore = pgSession(session);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret:
      process.env.SESSION_SECRET ||
      "hvac-scheduler-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const payload = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${payload.substring(0, 80)}${payload.length > 80 ? "…" : ""}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Central error handler for API responses
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // IMPORTANT: Use Replit-provided PORT when available to avoid port collisions.
  const port = Number(process.env.PORT) || 5000;
  const host = "0.0.0.0";

  server.on("error", (e: any) => {
    if (e?.code === "EADDRINUSE") {
      log(`port ${port} already in use. Stop the other running instance and restart.`);
      process.exit(1);
    }
    log(String(e));
    process.exit(1);
  });

  server.listen({ port, host }, () => {
    log(`serving on port ${port}`);
  });
})();
