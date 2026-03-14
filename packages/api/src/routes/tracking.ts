import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { emailLogs } from "../db/schema.js";
import { dispatchWebhookEvent } from "../services/webhook-dispatcher.js";
import { buildEmailPayload } from "../services/webhook-events.js";

const app = new Hono();

// 1x1 transparent GIF pixel
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Open tracking pixel
app.get("/open/:logId", async (c) => {
  const logId = c.req.param("logId");

  const [log] = await db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.id, logId))
    .limit(1);

  if (log && !log.openedAt) {
    await db
      .update(emailLogs)
      .set({ openedAt: new Date().toISOString() })
      .where(eq(emailLogs.id, logId));

    dispatchWebhookEvent(
      log.orgId,
      "email.opened",
      buildEmailPayload("email.opened", log.orgId, {
        logId,
        to: log.toAddress,
        from: log.fromAddress,
        subject: log.subject,
        templateId: log.templateId || undefined,
        broadcastId: log.broadcastId || undefined,
      })
    );
  }

  return new Response(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
});

// Click tracking
app.get("/click/:logId", async (c) => {
  const logId = c.req.param("logId");
  const url = c.req.query("url");

  if (!url) {
    return c.json({ error: "Missing url parameter" }, 400);
  }

  const [log] = await db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.id, logId))
    .limit(1);

  if (log && !log.clickedAt) {
    await db
      .update(emailLogs)
      .set({ clickedAt: new Date().toISOString(), clickedUrl: url })
      .where(eq(emailLogs.id, logId));

    dispatchWebhookEvent(
      log.orgId,
      "email.clicked",
      buildEmailPayload("email.clicked", log.orgId, {
        logId,
        to: log.toAddress,
        from: log.fromAddress,
        subject: log.subject,
        clickedUrl: url,
        templateId: log.templateId || undefined,
        broadcastId: log.broadcastId || undefined,
      })
    );
  }

  return c.redirect(url, 302);
});

export default app;
