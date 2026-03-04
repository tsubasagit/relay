import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { initDatabase } from "./db/init.js";
import app from "./app.js";

// Initialize database tables
initDatabase();

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`TalentMail API running on http://localhost:${info.port}`);
  }
);
