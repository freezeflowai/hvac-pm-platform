import path from "path";
import fs from "fs";
import type { Express } from "express";
import express from "express";
import { createServer as createViteServer } from "vite";

const isProduction = process.env.NODE_ENV === "production";

export async function setupVite(app: Express, server: any) {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });

    app.use(vite.middlewares);

    // SPA fallback — DEV (GET only, skip /api)
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve("index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve("dist");

  if (!fs.existsSync(distPath)) {
    throw new Error("Client dist folder not found, did you run the build?");
  }

  app.use(express.static(distPath));

  // SPA fallback — PROD (GET only, skip /api)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}
