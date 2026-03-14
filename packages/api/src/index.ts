import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { initDatabase } from "./db/init.js";
import { startScheduler } from "./services/scheduler.js";
import app from "./app.js";

// Initialize database tables
initDatabase();

// Start broadcast scheduler
startScheduler();

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Relay API running on http://localhost:${info.port}`);
  }
);
