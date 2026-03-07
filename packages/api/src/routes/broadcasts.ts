import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
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
  unsubscribes,
} from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { sendMail } from "../services/mailer.js";
import { renderTemplate } from "../services/template.js";
import { config } from "../config.js";
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

// Create & start broadcast
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();

  const schema = z.object({
    audienceId: z.string(),
    templateId: z.string(),
    fromAddressId: z.string(),
    variables: z.record(z.string()).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { audienceId, templateId, fromAddressId, variables } = parsed.data;

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
      domainStatus: domains.status,
    })
    .from(sendingAddresses)
    .innerJoin(domains, eq(sendingAddresses.domainId, domains.id))
    .where(and(eq(sendingAddresses.id, fromAddressId), eq(sendingAddresses.orgId, auth.orgId)))
    .limit(1);

  if (!addr) {
    return c.json({ error: "Sending address not found" }, 404);
  }

  if (addr.domainStatus !== "verified") {
    return c.json({ error: "Domain is not verified" }, 400);
  }

  const fromAddress = addr.displayName
    ? `${addr.displayName} <${addr.address}>`
    : addr.address;

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

  await db.insert(broadcasts).values({
    id: broadcastId,
    orgId: auth.orgId,
    audienceId,
    templateId,
    fromAddressId,
    fromAddress,
    subject: renderedSubject,
    variables: variables || null,
    status: "sending",
    totalCount: contactCount,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: now,
  });

  // Return immediately, process in background
  const responseData = {
    id: broadcastId,
    status: "sending",
    totalCount: contactCount,
    subject: renderedSubject,
  };

  // Background send process
  processBroadcast(auth.orgId, broadcastId, audienceId, tmpl, fromAddress, variables || {}).catch(
    (err) => {
      console.error(`Broadcast ${broadcastId} failed:`, err);
    }
  );

  return c.json({ data: responseData }, 201);
});

async function processBroadcast(
  orgId: string,
  broadcastId: string,
  audienceId: string,
  tmpl: {
    id: string;
    subject: string;
    bodyHtml: string;
    bodyText: string | null;
  },
  fromAddress: string,
  variables: Record<string, string>
) {
  try {
    // Get all contacts in audience
    const members = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        name: contacts.name,
        isUnsubscribed: contacts.isUnsubscribed,
      })
      .from(audienceContacts)
      .innerJoin(contacts, eq(audienceContacts.contactId, contacts.id))
      .where(eq(audienceContacts.audienceId, audienceId));

    // Get unsubscribed emails for this org
    const unsubs = await db
      .select({ email: unsubscribes.email })
      .from(unsubscribes)
      .where(eq(unsubscribes.orgId, orgId));

    const unsubSet = new Set(unsubs.map((u) => u.email.toLowerCase()));

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const member of members) {
      // Check unsubscribe status
      if (member.isUnsubscribed || unsubSet.has(member.email.toLowerCase())) {
        skippedCount++;
        await db
          .update(broadcasts)
          .set({ skippedCount })
          .where(eq(broadcasts.id, broadcastId));
        continue;
      }

      // Merge variables with contact info
      const mergedVars = {
        ...variables,
        email: member.email,
        name: member.name || "",
      };

      const subject = renderTemplate(tmpl.subject, mergedVars);
      const unsubToken = Buffer.from(`${orgId}:${member.email}`).toString("base64url");
      const unsubLink = `${config.baseUrl}/unsubscribe/${unsubToken}`;

      // Append unsubscribe link to HTML
      let html = renderTemplate(tmpl.bodyHtml, mergedVars);
      html += `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
        <a href="${unsubLink}" style="color:#9ca3af;">配信停止はこちら</a>
      </p>`;

      let text: string | undefined;
      if (tmpl.bodyText) {
        text = renderTemplate(tmpl.bodyText, mergedVars);
        text += `\n\n---\n配信停止: ${unsubLink}`;
      }

      const logId = generateId("log");
      const now = new Date().toISOString();

      // Create log entry
      await db.insert(emailLogs).values({
        id: logId,
        orgId,
        templateId: tmpl.id,
        broadcastId,
        contactId: member.id,
        audienceId,
        fromAddress,
        toAddress: member.email,
        subject,
        status: "queued",
        createdAt: now,
      });

      try {
        await sendMail(orgId, { from: fromAddress, to: member.email, subject, html, text });

        await db
          .update(emailLogs)
          .set({ status: "sent", sentAt: new Date().toISOString() })
          .where(eq(emailLogs.id, logId));

        sentCount++;
      } catch {
        await db
          .update(emailLogs)
          .set({ status: "failed" })
          .where(eq(emailLogs.id, logId));

        failedCount++;
      }

      // Update broadcast progress
      await db
        .update(broadcasts)
        .set({ sentCount, failedCount, skippedCount })
        .where(eq(broadcasts.id, broadcastId));

      // Rate limiting: 50ms between sends
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Mark completed
    await db
      .update(broadcasts)
      .set({
        status: "completed",
        sentCount,
        failedCount,
        skippedCount,
        completedAt: new Date().toISOString(),
      })
      .where(eq(broadcasts.id, broadcastId));
  } catch (err) {
    console.error(`Broadcast ${broadcastId} error:`, err);
    await db
      .update(broadcasts)
      .set({ status: "failed", completedAt: new Date().toISOString() })
      .where(eq(broadcasts.id, broadcastId));
  }
}

export default app;
