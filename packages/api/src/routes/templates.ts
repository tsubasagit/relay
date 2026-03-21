import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { templates } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { extractVariables, renderTemplate } from "../services/template.js";
import { sendMail } from "../services/mailer.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

const createTemplateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  category: z.enum(["transactional", "marketing"]).default("transactional"),
});

const updateTemplateSchema = createTemplateSchema.partial();

// List templates
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.orgId, auth.orgId))
    .orderBy(templates.createdAt);
  return c.json({ data: rows });
});

// Get template by ID
app.get("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const [row] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, c.req.param("id")), eq(templates.orgId, auth.orgId)))
    .limit(1);

  if (!row) return c.json({ error: "Template not found" }, 404);
  return c.json({ data: row });
});

// Create template
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const now = new Date().toISOString();
  const vars = extractVariables(parsed.data.bodyHtml);
  const row = {
    id: generateId("tmpl"),
    orgId: auth.orgId,
    ...parsed.data,
    bodyText: parsed.data.bodyText ?? null,
    variables: vars,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(templates).values(row);
  return c.json({ data: row }, 201);
});

// Update template
app.put("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.orgId, auth.orgId)))
    .limit(1);

  if (!existing) return c.json({ error: "Template not found" }, 404);

  const body = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const updates: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };

  if (parsed.data.bodyHtml) {
    updates.variables = extractVariables(parsed.data.bodyHtml);
  }

  await db.update(templates).set(updates).where(eq(templates.id, id));

  const [updated] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);

  return c.json({ data: updated });
});

// Test send template
app.post("/:id/test", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = z
    .object({
      to: z.string().email(),
      variables: z.record(z.string()).optional(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.orgId, auth.orgId)))
    .limit(1);

  if (!tmpl) return c.json({ error: "Template not found" }, 404);

  const subject = `[TEST] ${renderTemplate(tmpl.subject, parsed.data.variables || {})}`;
  const html = renderTemplate(tmpl.bodyHtml, parsed.data.variables || {});
  const text = tmpl.bodyText
    ? renderTemplate(tmpl.bodyText, parsed.data.variables || {})
    : undefined;

  try {
    await sendMail(auth.orgId, {
      from: `Relay <noreply@relay.email>`,
      to: parsed.data.to,
      subject,
      html,
      text,
    });
    return c.json({ message: "Test email sent", to: parsed.data.to, subject });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: "Failed to send test email", details: message }, 500);
  }
});

// Delete template
app.delete("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.orgId, auth.orgId)))
    .limit(1);

  if (!existing) return c.json({ error: "Template not found" }, 404);

  await db.delete(templates).where(eq(templates.id, id));
  return c.json({ message: "Deleted" });
});

export default app;
