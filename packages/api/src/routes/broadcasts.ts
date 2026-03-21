import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  broadcasts,
  audiences,
  audienceContacts,
  contacts,
  templates,
  sendingAddresses,
  domains,
  emailLogs,
} from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { renderTemplate } from "../services/template.js";
import { processBroadcast } from "../services/broadcast-processor.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

// List broadcasts
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
  const offset = parseInt(c.req.query("offset") || "0");

  const rows = await db
    .select({
      id: broadcasts.id,
      audienceId: broadcasts.audienceId,
      templateId: broadcasts.templateId,
      fromAddress: broadcasts.fromAddress,
      subject: broadcasts.subject,
      scheduledAt: broadcasts.scheduledAt,
      status: broadcasts.status,
      totalCount: broadcasts.totalCount,
      sentCount: broadcasts.sentCount,
      failedCount: broadcasts.failedCount,
      skippedCount: broadcasts.skippedCount,
      createdAt: broadcasts.createdAt,
      completedAt: broadcasts.completedAt,
      audienceName: audiences.name,
    })
    .from(broadcasts)
    .leftJoin(audiences, eq(broadcasts.audienceId, audiences.id))
    .where(eq(broadcasts.orgId, auth.orgId))
    .orderBy(desc(broadcasts.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(broadcasts)
    .where(eq(broadcasts.orgId, auth.orgId));

  return c.json({ data: rows, total: count, limit, offset });
});

// Get broadcast detail
app.get("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [broadcast] = await db
    .select({
      id: broadcasts.id,
      orgId: broadcasts.orgId,
      audienceId: broadcasts.audienceId,
      templateId: broadcasts.templateId,
      fromAddressId: broadcasts.fromAddressId,
      fromAddress: broadcasts.fromAddress,
      subject: broadcasts.subject,
      variables: broadcasts.variables,
      scheduledAt: broadcasts.scheduledAt,
      status: broadcasts.status,
      totalCount: broadcasts.totalCount,
      sentCount: broadcasts.sentCount,
      failedCount: broadcasts.failedCount,
      skippedCount: broadcasts.skippedCount,
      createdAt: broadcasts.createdAt,
      completedAt: broadcasts.completedAt,
      audienceName: audiences.name,
      templateName: templates.name,
    })
    .from(broadcasts)
    .leftJoin(audiences, eq(broadcasts.audienceId, audiences.id))
    .leftJoin(templates, eq(broadcasts.templateId, templates.id))
    .where(and(eq(broadcasts.id, id), eq(broadcasts.orgId, auth.orgId)))
    .limit(1);

  if (!broadcast) {
    return c.json({ error: "Broadcast not found" }, 404);
  }

  // Get logs for this broadcast
  const logLimit = Math.min(parseInt(c.req.query("logLimit") || "50"), 200);
  const logOffset = parseInt(c.req.query("logOffset") || "0");

  const logRows = await db
    .select()
    .from(emailLogs)
    .where(and(eq(emailLogs.broadcastId, id), eq(emailLogs.orgId, auth.orgId)))
    .orderBy(desc(emailLogs.createdAt))
    .limit(logLimit)
    .offset(logOffset);

  return c.json({ data: { ...broadcast, logs: logRows } });
});

// Create & start (or schedule) broadcast
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();

  const schema = z.object({
    audienceId: z.string(),
    templateId: z.string(),
    fromAddressId: z.string(),
    variables: z.record(z.string()).optional(),
    scheduledAt: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { audienceId, templateId, fromAddressId, variables, scheduledAt } = parsed.data;

  // Validate audience
  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, audienceId), eq(audiences.orgId, auth.orgId)))
    .limit(1);

  if (!audience) {
    return c.json({ error: "Audience not found" }, 404);
  }

  // Validate template
  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, auth.orgId)))
    .limit(1);

  if (!tmpl) {
    return c.json({ error: "Template not found" }, 404);
  }

  // Validate sending address
  const [addr] = await db
    .select({
      id: sendingAddresses.id,
      address: sendingAddresses.address,
      displayName: sendingAddresses.displayName,
      replyTo: sendingAddresses.replyTo,
      domainId: sendingAddresses.domainId,
      domainStatus: domains.status,
    })
    .from(sendingAddresses)
    .leftJoin(domains, eq(sendingAddresses.domainId, domains.id))
    .where(and(eq(sendingAddresses.id, fromAddressId), eq(sendingAddresses.orgId, auth.orgId)))
    .limit(1);

  if (!addr) {
    return c.json({ error: "Sending address not found" }, 404);
  }

  // Gmail OAuth addresses (no domain) are always valid; others require verified domain
  if (addr.domainId && addr.domainStatus !== "verified") {
    return c.json({ error: "Domain is not verified" }, 400);
  }

  const fromAddress = addr.displayName
    ? `${addr.displayName} <${addr.address}>`
    : addr.address;
  const replyTo = addr.replyTo || undefined;

  // Render subject with variables
  const renderedSubject = renderTemplate(tmpl.subject, variables || {});

  // Create broadcast record
  const broadcastId = generateId("bcast");
  const now = new Date().toISOString();

  // Count contacts in audience
  const [{ contactCount }] = await db
    .select({ contactCount: sql<number>`count(*)` })
    .from(audienceContacts)
    .where(eq(audienceContacts.audienceId, audienceId));

  const isScheduled = !!scheduledAt && new Date(scheduledAt) > new Date();
  const status = isScheduled ? "scheduled" : "sending";

  await db.insert(broadcasts).values({
    id: broadcastId,
    orgId: auth.orgId,
    audienceId,
    templateId,
    fromAddressId,
    fromAddress,
    subject: renderedSubject,
    variables: variables || null,
    scheduledAt: scheduledAt || null,
    status,
    totalCount: contactCount,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: now,
  });

  // Return immediately
  const responseData = {
    id: broadcastId,
    status,
    scheduledAt: scheduledAt || null,
    totalCount: contactCount,
    subject: renderedSubject,
  };

  // If not scheduled, start processing immediately
  if (!isScheduled) {
    processBroadcast(
      auth.orgId,
      broadcastId,
      audienceId,
      {
        id: tmpl.id,
        subject: tmpl.subject,
        bodyHtml: tmpl.bodyHtml,
        bodyText: tmpl.bodyText,
        category: tmpl.category,
      },
      fromAddress,
      variables || {},
      replyTo
    ).catch((err) => {
      console.error(`Broadcast ${broadcastId} failed:`, err);
    });
  }

  return c.json({ data: responseData }, 201);
});

// Quick send to selected contacts (creates temp audience automatically)
app.post("/quick-send", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();

  const schema = z.object({
    contactIds: z.array(z.string()).min(1),
    templateId: z.string(),
    fromAddressId: z.string(),
    variables: z.record(z.string()).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { contactIds, templateId, fromAddressId, variables } = parsed.data;

  // Validate template
  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, auth.orgId)))
    .limit(1);

  if (!tmpl) {
    return c.json({ error: "Template not found" }, 404);
  }

  // Validate sending address
  const [addr] = await db
    .select({
      id: sendingAddresses.id,
      address: sendingAddresses.address,
      displayName: sendingAddresses.displayName,
      replyTo: sendingAddresses.replyTo,
      domainId: sendingAddresses.domainId,
      domainStatus: domains.status,
    })
    .from(sendingAddresses)
    .leftJoin(domains, eq(sendingAddresses.domainId, domains.id))
    .where(and(eq(sendingAddresses.id, fromAddressId), eq(sendingAddresses.orgId, auth.orgId)))
    .limit(1);

  if (!addr) {
    return c.json({ error: "Sending address not found" }, 404);
  }

  if (addr.domainId && addr.domainStatus !== "verified") {
    return c.json({ error: "Domain is not verified" }, 400);
  }

  const quickReplyTo = addr.replyTo || undefined;

  // Validate contacts exist and belong to org
  const validContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.orgId, auth.orgId), inArray(contacts.id, contactIds)));

  if (validContacts.length === 0) {
    return c.json({ error: "No valid contacts found" }, 400);
  }

  const fromAddr = addr.displayName
    ? `${addr.displayName} <${addr.address}>`
    : addr.address;

  const renderedSubject = renderTemplate(tmpl.subject, variables || {});
  const now = new Date();
  const nowStr = now.toISOString();

  // Create temporary audience
  const audienceId = generateId("aud");
  const audienceName = `クイック送信 ${now.toLocaleDateString("ja-JP")} ${now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;

  await db.insert(audiences).values({
    id: audienceId,
    orgId: auth.orgId,
    name: audienceName,
    description: `コンタクトリストから${validContacts.length}件を選択して送信`,
    contactCount: validContacts.length,
    createdAt: nowStr,
  });

  // Add contacts to audience
  await db.insert(audienceContacts).values(
    validContacts.map((c) => ({
      audienceId,
      contactId: c.id,
      addedAt: nowStr,
    }))
  );

  // Create broadcast record
  const broadcastId = generateId("bcast");

  await db.insert(broadcasts).values({
    id: broadcastId,
    orgId: auth.orgId,
    audienceId,
    templateId,
    fromAddressId,
    fromAddress: fromAddr,
    subject: renderedSubject,
    variables: variables || null,
    status: "sending",
    totalCount: validContacts.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: nowStr,
  });

  // Start processing
  processBroadcast(
    auth.orgId,
    broadcastId,
    audienceId,
    {
      id: tmpl.id,
      subject: tmpl.subject,
      bodyHtml: tmpl.bodyHtml,
      bodyText: tmpl.bodyText,
      category: tmpl.category,
    },
    fromAddr,
    variables || {},
    quickReplyTo
  ).catch((err) => {
    console.error(`Quick send broadcast ${broadcastId} failed:`, err);
  });

  return c.json({
    data: {
      id: broadcastId,
      status: "sending",
      totalCount: validContacts.length,
      subject: renderedSubject,
    },
  }, 201);
});

// Cancel scheduled broadcast
app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.orgId, auth.orgId)))
    .limit(1);

  if (!broadcast) {
    return c.json({ error: "Broadcast not found" }, 404);
  }

  if (broadcast.status !== "scheduled") {
    return c.json({ error: "Only scheduled broadcasts can be cancelled" }, 400);
  }

  await db
    .update(broadcasts)
    .set({ status: "draft", scheduledAt: null })
    .where(eq(broadcasts.id, id));

  return c.json({ message: "Broadcast cancelled" });
});

export default app;
