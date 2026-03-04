import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { apiKeyAuth } from "./middleware/auth.js";
import healthRoutes from "./routes/health.js";
import templateRoutes from "./routes/templates.js";
import emailRoutes from "./routes/emails.js";
import logRoutes from "./routes/logs.js";
import keyRoutes from "./routes/keys.js";
import settingsRoutes from "./routes/settings.js";
import trackingRoutes from "./routes/tracking.js";
import unsubscribeRoutes from "./routes/unsubscribe.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3456"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Public routes (no auth)
app.route("/api/health", healthRoutes);
app.route("/api/t", trackingRoutes);
app.route("/unsubscribe", unsubscribeRoutes);

// Protected routes (API key auth)
app.use("/api/templates/*", apiKeyAuth);
app.use("/api/emails/*", apiKeyAuth);
app.use("/api/logs/*", apiKeyAuth);
app.use("/api/keys/*", apiKeyAuth);
app.use("/api/settings/*", apiKeyAuth);

app.route("/api/templates", templateRoutes);
app.route("/api/emails", emailRoutes);
app.route("/api/logs", logRoutes);
app.route("/api/keys", keyRoutes);
app.route("/api/settings", settingsRoutes);

export default app;
