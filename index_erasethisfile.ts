import express from "express";
import { registerRoutes } from "./routes";

const app = express();
registerRoutes(app);

const PORT = Number(process.env.PORT) || 5000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`[express] serving on port ${PORT}`);
});

server.on("error", (err: any) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`[express] port ${PORT} already in use. Stop other running instances, then restart.`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
