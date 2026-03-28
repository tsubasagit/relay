import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  templates,
  sendingAddresses,
  domains,
  broadcasts,
  emailQuota,
} from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { renderTemplate } from "../services/template.js";
import { processBroadcast } from "../services/broadcast-processor.js";
import { getContactsByIds } from "../services/contacts-pg.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

// Helper: resolve sending address
async function resolveSendingAddress(orgId: string, fromAddressId?: string) {
  const selectFields = {
    id: sendingAddresses.id,
    address: sendingAddresses.address,
    displayName: sendingAddresses.displayName,
    replyTo: sendingAddresses.replyTo,
    domainId: sendingAddresses.domainId,
    domainStatus: domains.status,
  } as const;

  if (fromAddressId) {
    const [found] = await db
      .select(selectFields)
      .from(sendingAddresses)
      .leftJoin(domains, eq(sendingAddresses.domainId, domains.id))
      .where(and(eq(sendingAddresses.id, fromAddressId), eq(sendingAddresses.orgId, orgId)))
      .limit(1);
    return found || null;
  }

  const [found] = await db
    .select(selectFields)
    .from(sendingAddresses)
    .leftJoin(domains, eq(sendingAddresses.domainId, domains.id))
    .where(eq(sendingAddresses.orgId, orgId))
    .limit(1);
  return found || null;
}

// POST /api/compose/send
// action: "send" (default) | "draft" | "schedule"
app.post("/send", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();

  const schema = z.object({
    contactIds: z.array(z.string()).min(1, "宛先を1件以上選択してください"),
    fromAddressId: z.string().optional(),
    templateId: z.string().optional(),
    subject: z.string().optional(),
    bodyHtml: z.string().optional(),
    variables: z.record(z.string()).optional(),
    action: z.enum(["send", "draft", "schedule"]).default("send"),
    scheduledAt: z.string().optional(),
  }).refine(
    (d) => d.action === "draft" || d.templateId || (d.subject && d.bodyHtml),
    { message: "テンプレートIDか、件名と本文を指定してください" }
  ).refine(
    (d) => d.action !== "schedule" || d.scheduledAt,
    { message: "送信予約には日時を指定してください" }
  );

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { contactIds, fromAddressId, templateId, subject, bodyHtml, variables, action, scheduledAt } = parsed.data;

  // Resolve template (existing or create inline)
  let tmpl: { id: string; subject: string; bodyHtml: string; bodyText: string | null; category: string };

  if (templateId) {
    const [found] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.orgId, auth.orgId)))
      .limit(1);
    if (!found) {
      return c.json({ error: "テンプレートが見つかりません" }, 404);
    }
    tmpl = { id: found.id, subject: found.subject, bodyHtml: found.bodyHtml, bodyText: found.bodyText, category: found.category };
  } else {
    const tmplSubject = subject || "(件名なし)";
    const tmplBody = bodyHtml || "";
    const tmplId = generateId("tmpl");
    const now = new Date().toISOString();
    await db.insert(templates).values({
      id: tmplId,
      orgId: auth.orgId,
      name: `メール作成 ${new Date().toLocaleDateString("ja-JP")}`,
      subject: tmplSubject,
      bodyHtml: tmplBody,
      bodyText: null,
      variables: [],
      category: "marketing",
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });
    tmpl = { id: tmplId, subject: tmplSubject, bodyHtml: tmplBody, bodyText: null, category: "marketing" };
  }

  // Resolve sending address
  const addr = await resolveSendingAddress(auth.orgId, fromAddressId);
  if (!addr) {
    return c.json({ error: fromAddressId ? "送信アドレスが見つかりません" : "送信アドレスが設定されていません" }, fromAddressId ? 404 : 400);
  }

  if (addr.domainId && addr.domainStatus !== "verified") {
    return c.json({ error: "ドメインが検証されていません" }, 400);
  }

  // Validate contacts
  const validContactsFull = await getContactsByIds(auth.orgId, contactIds);
  const validContactIds = validContactsFull.map((ct) => ct.id);

  if (validContactIds.length === 0) {
    return c.json({ error: "有効なコンタクトが見つかりません" }, 400);
  }

  // Quota check (only for immediate send)
  if (action === "send") {
    const today = new Date().toISOString().slice(0, 10);
    const [quota] = await db
      .select({ sentCount: emailQuota.sentCount })
      .from(emailQuota)
      .where(and(eq(emailQuota.orgId, auth.orgId), eq(emailQuota.date, today)))
      .limit(1);
    const currentSent = quota?.sentCount ?? 0;
    const dailyLimit = auth.plan === "free" ? 500 : 10000;
    if (currentSent + validContactIds.length > dailyLimit) {
      return c.json({
        error: `本日の送信上限（${dailyLimit}通）を超えます。残り: ${dailyLimit - currentSent}通`,
      }, 429);
    }
  }

  const fromAddr = addr.displayName
    ? `${addr.displayName} <${addr.address}>`
    : addr.address;
  const replyTo = addr.replyTo || undefined;

  const renderedSubject = renderTemplate(tmpl.subject, variables || {});
  const now = new Date().toISOString();

  // Determine status
  let status: "draft" | "scheduled" | "sending";
  if (action === "draft") {
    status = "draft";
  } else if (action === "schedule") {
    status = "scheduled";
  } else {
    status = "sending";
  }

  // Create broadcast (no audience creation)
  const broadcastId = generateId("bcast");
  await db.insert(broadcasts).values({
    id: broadcastId,
    orgId: auth.orgId,
    audienceId: null,
    templateId: tmpl.id,
    fromAddressId: addr.id,
    fromAddress: fromAddr,
    subject: renderedSubject,
    variables: variables || null,
    contactIds: validContactIds,
    scheduledAt: scheduledAt || null,
    status,
    totalCount: validContactIds.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: now,
  });

  // If sending immediately, process now
  if (action === "send") {
    try {
      await processBroadcast(
        auth.orgId,
        broadcastId,
        null,
        {
          id: tmpl.id,
          subject: tmpl.subject,
          bodyHtml: tmpl.bodyHtml,
          bodyText: tmpl.bodyText,
          category: tmpl.category,
        },
        fromAddr,
        variables || {},
        replyTo,
        validContactIds
      );
    } catch (err) {
      console.error(`Compose broadcast ${broadcastId} failed:`, err);
    }

    const [result] = await db
      .select({
        status: broadcasts.status,
        sentCount: broadcasts.sentCount,
        failedCount: broadcasts.failedCount,
      })
      .from(broadcasts)
      .where(eq(broadcasts.id, broadcastId))
      .limit(1);

    return c.json({
      data: {
        id: broadcastId,
        status: result?.status || "sending",
        totalCount: validContactIds.length,
        sentCount: result?.sentCount || 0,
        failedCount: result?.failedCount || 0,
        subject: renderedSubject,
      },
    }, 201);
  }

  // For draft/schedule, return immediately
  return c.json({
    data: {
      id: broadcastId,
      status,
      totalCount: validContactIds.length,
      subject: renderedSubject,
      scheduledAt: scheduledAt || null,
    },
  }, 201);
});

// GET /api/compose/:id — get draft/scheduled broadcast for editing
app.get("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [broadcast] = await db
    .select({
      id: broadcasts.id,
      contactIds: broadcasts.contactIds,
      fromAddressId: broadcasts.fromAddressId,
      templateId: broadcasts.templateId,
      subject: broadcasts.subject,
      variables: broadcasts.variables,
      scheduledAt: broadcasts.scheduledAt,
      status: broadcasts.status,
      templateSubject: templates.subject,
      templateBodyHtml: templates.bodyHtml,
    })
    .from(broadcasts)
    .leftJoin(templates, eq(broadcasts.templateId, templates.id))
    .where(and(eq(broadcasts.id, id), eq(broadcasts.orgId, auth.orgId)))
    .limit(1);

  if (!broadcast) {
    return c.json({ error: "下書きが見つかりません" }, 404);
  }

  if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
    return c.json({ error: "編集可能なのは下書きと予約済みのみです" }, 400);
  }

  return c.json({
    data: {
      id: broadcast.id,
      contactIds: (broadcast.contactIds as string[]) || [],
      fromAddressId: broadcast.fromAddressId,
      templateId: broadcast.templateId,
      subject: broadcast.templateSubject || broadcast.subject,
      bodyHtml: broadcast.templateBodyHtml || "",
      variables: broadcast.variables || {},
      scheduledAt: broadcast.scheduledAt,
      status: broadcast.status,
    },
  });
});

// PUT /api/compose/:id — update draft
app.put("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    contactIds: z.array(z.string()).min(1).optional(),
    fromAddressId: z.string().optional(),
    subject: z.string().optional(),
    bodyHtml: z.string().optional(),
    variables: z.record(z.string()).optional(),
    action: z.enum(["draft", "schedule"]).default("draft"),
    scheduledAt: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [existing] = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "下書きが見つかりません" }, 404);
  }

  if (existing.status !== "draft" && existing.status !== "scheduled") {
    return c.json({ error: "編集可能なのは下書きと予約済みのみです" }, 400);
  }

  const data = parsed.data;

  // Update template content if subject/bodyHtml changed
  if (data.subject || data.bodyHtml) {
    const now = new Date().toISOString();
    const updateFields: Record<string, unknown> = { updatedAt: now };
    if (data.subject) updateFields.subject = data.subject;
    if (data.bodyHtml) updateFields.bodyHtml = data.bodyHtml;
    await db.update(templates).set(updateFields).where(eq(templates.id, existing.templateId));
  }

  // Build broadcast update
  const updateData: Record<string, unknown> = {};

  if (data.contactIds) {
    const validContactsFull = await getContactsByIds(auth.orgId, data.contactIds);
    updateData.contactIds = validContactsFull.map((ct) => ct.id);
    updateData.totalCount = validContactsFull.length;
  }

  if (data.fromAddressId) {
    const addr = await resolveSendingAddress(auth.orgId, data.fromAddressId);
    if (!addr) return c.json({ error: "送信アドレスが見つかりません" }, 404);
    updateData.fromAddressId = addr.id;
    updateData.fromAddress = addr.displayName
      ? `${addr.displayName} <${addr.address}>`
      : addr.address;
  }

  if (data.subject) {
    const vars = data.variables || (existing.variables as Record<string, string>) || {};
    updateData.subject = renderTemplate(data.subject, vars);
  }

  if (data.variables !== undefined) updateData.variables = data.variables;

  if (data.action === "schedule" && data.scheduledAt) {
    updateData.status = "scheduled";
    updateData.scheduledAt = data.scheduledAt;
  } else if (data.action === "draft") {
    updateData.status = "draft";
    updateData.scheduledAt = null;
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(broadcasts).set(updateData).where(eq(broadcasts.id, id));
  }

  return c.json({
    data: { id, status: (updateData.status as string) || existing.status },
  });
});

// POST /api/compose/:id/send — send a draft
app.post("/:id/send", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.orgId, auth.orgId)))
    .limit(1);

  if (!broadcast) {
    return c.json({ error: "下書きが見つかりません" }, 404);
  }

  if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
    return c.json({ error: "送信可能なのは下書きと予約済みのみです" }, 400);
  }

  const cIds = (broadcast.contactIds as string[]) || [];
  if (cIds.length === 0) {
    return c.json({ error: "宛先が設定されていません" }, 400);
  }

  // Get template
  const [tmpl] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, broadcast.templateId))
    .limit(1);

  if (!tmpl) {
    return c.json({ error: "テンプレートが見つかりません" }, 404);
  }

  // Quota check
  const today = new Date().toISOString().slice(0, 10);
  const [quota] = await db
    .select({ sentCount: emailQuota.sentCount })
    .from(emailQuota)
    .where(and(eq(emailQuota.orgId, auth.orgId), eq(emailQuota.date, today)))
    .limit(1);
  const currentSent = quota?.sentCount ?? 0;
  const dailyLimit = auth.plan === "free" ? 500 : 10000;
  if (currentSent + cIds.length > dailyLimit) {
    return c.json({
      error: `本日の送信上限（${dailyLimit}通）を超えます。残り: ${dailyLimit - currentSent}通`,
    }, 429);
  }

  // Update status to sending
  await db
    .update(broadcasts)
    .set({ status: "sending" })
    .where(eq(broadcasts.id, id));

  try {
    await processBroadcast(
      auth.orgId,
      id,
      null,
      {
        id: tmpl.id,
        subject: tmpl.subject,
        bodyHtml: tmpl.bodyHtml,
        bodyText: tmpl.bodyText,
        category: tmpl.category,
      },
      broadcast.fromAddress,
      (broadcast.variables as Record<string, string>) || {},
      undefined,
      cIds
    );
  } catch (err) {
    console.error(`Compose send draft ${id} failed:`, err);
  }

  const [result] = await db
    .select({
      status: broadcasts.status,
      sentCount: broadcasts.sentCount,
      failedCount: broadcasts.failedCount,
    })
    .from(broadcasts)
    .where(eq(broadcasts.id, id))
    .limit(1);

  return c.json({
    data: {
      id,
      status: result?.status || "sending",
      totalCount: cIds.length,
      sentCount: result?.sentCount || 0,
      failedCount: result?.failedCount || 0,
      subject: broadcast.subject,
    },
  });
});

export default app;
