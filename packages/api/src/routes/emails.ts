import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { templates, emailLogs, sendingAddresses } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { sendMail } from "../services/mailer.js";
import { renderTemplate } from "../services/template.js";
import { buildUnsubscribeData } from "../services/unsubscribe-helper.js";
import { dispatchWebhookEvent } from "../services/webhook-dispatcher.js";
import { buildEmailPayload } from "../services/webhook-events.js";
import { config } from "../config.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

const sendEmailSchema = z.object({
  to: z.string().email(),
  templateId: z.string().optional(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  variables: z.record(z.string()).optional(),
  from: z.string().optional(),
});

// Send single email
app.post("/send", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();
  const parsed = sendEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { to, templateId, variables, from } = parsed.data;
  let subject = parsed.data.subject || "";
  let html = parsed.data.html || "";
  let text = parsed.data.text;

  // Resolve template if provided
  let emailHeaders: Record<string, string> | undefined;
  if (templateId) {
    const [tmpl] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, templateId), eq(templates.orgId, auth.orgId)))
      .limit(1);

    if (!tmpl) {
      return c.json({ error: "Template not found" }, 404);
    }
    if (!tmpl.isActive) {
      return c.json({ error: "Template is inactive" }, 400);
    }

    subject = renderTemplate(tmpl.subject, variables || {});
    html = renderTemplate(tmpl.bodyHtml, variables || {});
    if (tmpl.bodyText) {
      text = renderTemplate(tmpl.bodyText, variables || {});
    }

    // Add unsubscribe headers/footer for marketing emails
    if (tmpl.category === "marketing") {
      const unsub = buildUnsubscribeData(config.baseUrl, auth.orgId, to);
      html += unsub.htmlFooter;
      if (text) text += unsub.textFooter;
      emailHeaders = unsub.headers;
    }
  }

  if (!subject || !html) {
    return c.json(
      { error: "Either templateId or both subject and html are required" },
      400
    );
  }

  // Resolve from address
  let fromAddress = from || "";
  if (!fromAddress) {
    // Use first sending address from org
    const [addr] = await db
      .select({
        address: sendingAddresses.address,
        displayName: sendingAddresses.displayName,
      })
      .from(sendingAddresses)
      .where(eq(sendingAddresses.orgId, auth.orgId))
      .limit(1);

    if (addr) {
      fromAddress = addr.displayName
        ? `${addr.displayName} <${addr.address}>`
        : addr.address;
    } else {
      fromAddress = "noreply@relay.email";
    }
  }

  const now = new Date().toISOString();
  const logId = generateId("log");

  // Create log entry
  await db.insert(emailLogs).values({
    id: logId,
    orgId: auth.orgId,
    templateId: templateId ?? null,
    contactId: null,
    audienceId: null,
    fromAddress,
    toAddress: to,
    subject,
    status: "queued",
    createdAt: now,
  });

  // Send email
  try {
    await sendMail(auth.orgId, { from: fromAddress, to, subject, html, text, headers: emailHeaders });

    await db
      .update(emailLogs)
      .set({ status: "sent", sentAt: new Date().toISOString() })
      .where(eq(emailLogs.id, logId));

    dispatchWebhookEvent(
      auth.orgId,
      "email.sent",
      buildEmailPayload("email.sent", auth.orgId, {
        logId,
        to,
        from: fromAddress,
        subject,
        templateId: templateId || undefined,
      })
    );

    return c.json({
      data: { id: logId, status: "sent", to, subject },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(emailLogs)
      .set({ status: "failed", errorMessage: message })
      .where(eq(emailLogs.id, logId));

    dispatchWebhookEvent(
      auth.orgId,
      "email.failed",
      buildEmailPayload("email.failed", auth.orgId, {
        logId,
        to,
        from: fromAddress,
        subject,
        templateId: templateId || undefined,
      })
    );

    return c.json({ error: "Failed to send email", details: message }, 500);
  }
});

export default app;
