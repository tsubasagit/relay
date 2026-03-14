import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "../db/client.js";
import { webhooks, webhookLogs } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { WEBHOOK_EVENTS } from "../services/webhook-events.js";
import { dispatchWebhookEvent } from "../services/webhook-dispatcher.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

function generateSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

// List webhooks
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;

  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      isActive: webhooks.isActive,
      createdAt: webhooks.createdAt,
    })
    .from(webhooks)
    .where(eq(webhooks.orgId, auth.orgId))
    .orderBy(desc(webhooks.createdAt));

  return c.json({ data: rows });
});

// Get webhook detail
app.get("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [hook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, auth.orgId)))
    .limit(1);

  if (!hook) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  return c.json({ data: hook });
});

// Create webhook
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();

  const schema = z.object({
    url: z.string().url(),
    events: z.array(z.string()).min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const id = generateId("wh");
  const secret = generateSecret();

  await db.insert(webhooks).values({
    id,
    orgId: auth.orgId,
    url: parsed.data.url,
    secret,
    events: parsed.data.events,
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  return c.json({
    data: {
      id,
      url: parsed.data.url,
      secret,
      events: parsed.data.events,
      isActive: true,
    },
    message: "Webhook created. Save the secret — it won't be shown again.",
  }, 201);
});

// Update webhook
app.put("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  const schema = z.object({
    url: z.string().url().optional(),
    events: z.array(z.string()).min(1).optional(),
    isActive: z.boolean().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  await db
    .update(webhooks)
    .set(parsed.data)
    .where(eq(webhooks.id, id));

  return c.json({ data: { id, ...parsed.data } });
});

// Delete webhook
app.delete("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  // Delete logs first
  await db.delete(webhookLogs).where(eq(webhookLogs.webhookId, id));
  await db.delete(webhooks).where(eq(webhooks.id, id));

  return c.json({ message: "Webhook deleted" });
});

// Get webhook logs
app.get("/:id/logs", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
  const offset = parseInt(c.req.query("offset") || "0");

  // Verify ownership
  const [hook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, auth.orgId)))
    .limit(1);

  if (!hook) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  const rows = await db
    .select()
    .from(webhookLogs)
    .where(eq(webhookLogs.webhookId, id))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(webhookLogs)
    .where(eq(webhookLogs.webhookId, id));

  return c.json({ data: rows, total: count, limit, offset });
});

// Test webhook (sends a test event)
app.post("/:id/test", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [hook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, auth.orgId)))
    .limit(1);

  if (!hook) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  // Send a test event
  await dispatchWebhookEvent(auth.orgId, "email.sent", {
    event: "email.sent",
    timestamp: new Date().toISOString(),
    orgId: auth.orgId,
    data: {
      logId: "test_" + Date.now(),
      to: "test@example.com",
      from: "noreply@example.com",
      subject: "Test webhook event",
    },
  });

  return c.json({ message: "Test event sent" });
});

// Rotate webhook secret
app.post("/:id/rotate-secret", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  const newSecret = generateSecret();

  await db
    .update(webhooks)
    .set({ secret: newSecret })
    .where(eq(webhooks.id, id));

  return c.json({
    data: { secret: newSecret },
    message: "Secret rotated. Save the new secret — it won't be shown again.",
  });
});

// Available events list
app.get("/meta/events", (c) => {
  return c.json({ data: WEBHOOK_EVENTS });
});

export default app;
