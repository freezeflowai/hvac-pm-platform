import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

/**
 * Simple server-side logger used across the app.
 * (server/index.ts expects this export)
 */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Vite dev middleware (development only).
 * IMPORTANT: SPA fallback is GET-only and must never intercept /api/* routes.
 */
export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      ...(viteConfig.server ?? {}),
      middlewareMode: true,
      hmr: { server },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  // SPA fallback — DEV (GET only, skip /api)
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api")) return next();

    try {
      const url = req.originalUrl;
      const clientIndex = path.resolve(import.meta.dirname, "..", "client", "index.html");

      let template = fs.readFileSync(clientIndex, "utf-8");
      template = await vite.transformIndexHtml(url, template);

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}

/**
 * Static file serving for production build.
 * Vite config builds client assets to: dist/public
 * In production, server runs from dist/index.js, so import.meta.dirname === dist
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}. Did you run \`npm run build\`?`,
    );
  }

  app.use(express.static(distPath));

  // SPA fallback — PROD (GET only, skip /api)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
