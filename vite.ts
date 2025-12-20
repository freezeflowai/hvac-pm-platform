import path from 'path';
import express from 'express';
import type { Express } from 'express';

export function setupVite(app: Express, server: any) {
  // SPA fallback — ONLY for GET + non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.resolve(process.cwd(), 'index.html'));
  });
}
