import express from "express";
import session from "express-session";
import passport from "passport";
import http from "http";
import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes.ts";
import "./auth";

const app = express();

// ---- CRITICAL: body parsing MUST come before auth routes ----
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);

// Register API routes AFTER middleware
registerRoutes(app);

if (process.env.NODE_ENV === "development") {
  setupVite(app, server);
} else {
  serveStatic(app);
}

const port = Number(process.env.PORT) || 5000;
server.listen(port, "0.0.0.0", () => {
  log(`Server running on port ${port}`);
});
