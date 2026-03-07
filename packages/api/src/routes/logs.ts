import { Hono } from "hono";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { emailLogs } from "../db/schema.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

// List logs with optional filters
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const status = c.req.query("status");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const broadcastId = c.req.query("broadcastId");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
  const offset = parseInt(c.req.query("offset") || "0");

  const conditions = [eq(emailLogs.orgId, auth.orgId)];
  if (status) {
    conditions.push(eq(emailLogs.status, status as "queued" | "sent" | "bounced" | "failed"));
  }
  if (from) {
    conditions.push(gte(emailLogs.createdAt, from));
  }
  if (to) {
    conditions.push(lte(emailLogs.createdAt, to));
  }
  if (broadcastId) {
    conditions.push(eq(emailLogs.broadcastId, broadcastId));
  }

  const where = and(...conditions);

  const rows = await db
    .select()
    .from(emailLogs)
    .where(where)
    .orderBy(desc(emailLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLogs)
    .where(where);

  return c.json({ data: rows, total: count, limit, offset });
});

// Stats
app.get("/stats", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const orgFilter = eq(emailLogs.orgId, auth.orgId);

  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLogs)
    .where(orgFilter);

  const [sent] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLogs)
    .where(and(orgFilter, eq(emailLogs.status, "sent")));

  const [failed] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLogs)
    .where(and(orgFilter, eq(emailLogs.status, "failed")));

  const [opened] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLogs)
    .where(and(orgFilter, sql`${emailLogs.openedAt} IS NOT NULL`));

  const [clicked] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailLogs)
    .where(and(orgFilter, sql`${emailLogs.clickedAt} IS NOT NULL`));

  const sentCount = sent.count || 0;
  return c.json({
    data: {
      total: total.count,
      sent: sentCount,
      failed: failed.count,
      opened: opened.count,
      clicked: clicked.count,
      openRate: sentCount > 0 ? (opened.count / sentCount) * 100 : 0,
      clickRate: sentCount > 0 ? (clicked.count / sentCount) * 100 : 0,
    },
  });
});

export default app;
