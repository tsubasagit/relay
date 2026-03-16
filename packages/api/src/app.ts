import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { combinedAuth } from "./middleware/combined-auth.js";
import { rateLimitByIp, rateLimitByKey } from "./middleware/rate-limit.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import orgRoutes from "./routes/orgs.js";
import invitationRoutes from "./routes/invitations.js";
import templateRoutes from "./routes/templates.js";
import emailRoutes from "./routes/emails.js";
import logRoutes from "./routes/logs.js";
import keyRoutes from "./routes/keys.js";
import providerRoutes from "./routes/providers.js";
import domainRoutes from "./routes/domains.js";
import sendingAddressRoutes from "./routes/sending-addresses.js";
import trackingRoutes from "./routes/tracking.js";
import unsubscribeRoutes from "./routes/unsubscribe.js";
import contactRoutes from "./routes/contacts.js";
import audienceRoutes from "./routes/audiences.js";
import broadcastRoutes from "./routes/broadcasts.js";
import webhookRoutes from "./routes/webhooks.js";
import composeRoutes from "./routes/compose.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3456",
      "https://relay-email-ath.web.app",
      "https://relay-email-ath.firebaseapp.com",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Org-Id"],
    credentials: true,
  })
);

// ─── Rate limiting (public endpoints) ───
app.use("/auth/*", rateLimitByIp(60_000, 30));
app.use("/unsubscribe/*", rateLimitByIp(60_000, 30));

// ─── Public routes (no auth) ───
app.route("/api/health", healthRoutes);
app.route("/api/t", trackingRoutes);
app.route("/unsubscribe", unsubscribeRoutes);

// ─── Auth routes (partially public) ───
app.route("/auth", authRoutes);

// ─── Session-only routes (no org context needed) ───
app.route("/api/orgs", orgRoutes);
app.route("/api/invitations", invitationRoutes);

// ─── Protected routes (combined auth: session+orgId or API key) ───
app.use("/api/templates/*", combinedAuth, rateLimitByKey());
app.use("/api/emails/*", combinedAuth, rateLimitByKey());
app.use("/api/logs/*", combinedAuth, rateLimitByKey());
app.use("/api/keys/*", combinedAuth, rateLimitByKey());
app.use("/api/providers/*", combinedAuth, rateLimitByKey());
app.use("/api/domains/*", combinedAuth, rateLimitByKey());
app.use("/api/sending-addresses/*", combinedAuth, rateLimitByKey());
app.use("/api/contacts/*", combinedAuth, rateLimitByKey());
app.use("/api/audiences/*", combinedAuth, rateLimitByKey());
app.use("/api/broadcasts/*", combinedAuth, rateLimitByKey());
app.use("/api/webhooks/*", combinedAuth, rateLimitByKey());
app.use("/api/compose/*", combinedAuth, rateLimitByKey());

app.route("/api/templates", templateRoutes);
app.route("/api/emails", emailRoutes);
app.route("/api/logs", logRoutes);
app.route("/api/keys", keyRoutes);
app.route("/api/providers", providerRoutes);
app.route("/api/domains", domainRoutes);
app.route("/api/sending-addresses", sendingAddressRoutes);
app.route("/api/contacts", contactRoutes);
app.route("/api/audiences", audienceRoutes);
app.route("/api/broadcasts", broadcastRoutes);
app.route("/api/webhooks", webhookRoutes);
app.route("/api/compose", composeRoutes);

export default app;
