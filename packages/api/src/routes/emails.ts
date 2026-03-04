import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { templates, emailLogs } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { sendMail } from "../services/mailer.js";
import { renderTemplate } from "../services/template.js";
import { getSmtpConfig } from "../services/settings.js";

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
  if (templateId) {
    const [tmpl] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
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
  }

  if (!subject || !html) {
    return c.json(
      { error: "Either templateId or both subject and html are required" },
      400
    );
  }

  const now = new Date().toISOString();
  const logId = generateId("log");
  const smtpCfg = getSmtpConfig();
  const fromAddress = from || `${smtpCfg.fromName} <${smtpCfg.fromAddress}>`;

  // Create log entry
  await db.insert(emailLogs).values({
    id: logId,
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
    await sendMail({ to, subject, html, text, from: fromAddress });

    await db
      .update(emailLogs)
      .set({ status: "sent", sentAt: new Date().toISOString() })
      .where(eq(emailLogs.id, logId));

    return c.json({
      data: { id: logId, status: "sent", to, subject },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(emailLogs)
      .set({ status: "failed" })
      .where(eq(emailLogs.id, logId));

    return c.json({ error: "Failed to send email", details: message }, 500);
  }
});

export default app;
