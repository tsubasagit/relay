import { Hono } from "hono";
import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { audiences, audienceContacts, contacts } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

// List audiences
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;

  const rows = await db
    .select()
    .from(audiences)
    .where(eq(audiences.orgId, auth.orgId))
    .orderBy(desc(audiences.createdAt));

  return c.json({ data: rows });
});

// Get audience detail with contacts
app.get("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
  const offset = parseInt(c.req.query("offset") || "0");

  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.orgId, auth.orgId)))
    .limit(1);

  if (!audience) {
    return c.json({ error: "Audience not found" }, 404);
  }

  const members = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      isUnsubscribed: contacts.isUnsubscribed,
      createdAt: contacts.createdAt,
      addedAt: audienceContacts.addedAt,
    })
    .from(audienceContacts)
    .innerJoin(contacts, eq(audienceContacts.contactId, contacts.id))
    .where(eq(audienceContacts.audienceId, id))
    .orderBy(desc(audienceContacts.addedAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(audienceContacts)
    .where(eq(audienceContacts.audienceId, id));

  return c.json({ data: { ...audience, contacts: members }, total: count, limit, offset });
});

// Create audience
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();

  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const id = generateId("aud");
  const now = new Date().toISOString();

  await db.insert(audiences).values({
    id,
    orgId: auth.orgId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    contactCount: 0,
    createdAt: now,
  });

  const [audience] = await db.select().from(audiences).where(eq(audiences.id, id)).limit(1);
  return c.json({ data: audience }, 201);
});

// Update audience
app.put("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [existing] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Audience not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;

  if (Object.keys(updates).length > 0) {
    await db.update(audiences).set(updates).where(eq(audiences.id, id));
  }

  const [updated] = await db.select().from(audiences).where(eq(audiences.id, id)).limit(1);
  return c.json({ data: updated });
});

// Delete audience
app.delete("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Audience not found" }, 404);
  }

  await db.delete(audienceContacts).where(eq(audienceContacts.audienceId, id));
  await db.delete(audiences).where(eq(audiences.id, id));

  return c.json({ message: "Audience deleted" });
});

// Add contacts to audience
app.post("/:id/contacts", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const body = await c.req.json();

  const schema = z.object({
    contactIds: z.array(z.string()).min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.orgId, auth.orgId)))
    .limit(1);

  if (!audience) {
    return c.json({ error: "Audience not found" }, 404);
  }

  const now = new Date().toISOString();
  let added = 0;

  for (const contactId of parsed.data.contactIds) {
    // Verify contact belongs to org
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.orgId, auth.orgId)))
      .limit(1);

    if (!contact) continue;

    // Check if already in audience
    const [existing] = await db
      .select({ audienceId: audienceContacts.audienceId })
      .from(audienceContacts)
      .where(
        and(
          eq(audienceContacts.audienceId, id),
          eq(audienceContacts.contactId, contactId)
        )
      )
      .limit(1);

    if (existing) continue;

    await db.insert(audienceContacts).values({
      audienceId: id,
      contactId,
      addedAt: now,
    });
    added++;
  }

  // Update contact count
  await db
    .update(audiences)
    .set({ contactCount: sql`${audiences.contactCount} + ${added}` })
    .where(eq(audiences.id, id));

  const [updated] = await db.select().from(audiences).where(eq(audiences.id, id)).limit(1);
  return c.json({ data: updated, added });
});

// Remove contact from audience
app.delete("/:id/contacts/:contactId", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const contactId = c.req.param("contactId");

  const [audience] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.orgId, auth.orgId)))
    .limit(1);

  if (!audience) {
    return c.json({ error: "Audience not found" }, 404);
  }

  const [membership] = await db
    .select()
    .from(audienceContacts)
    .where(
      and(
        eq(audienceContacts.audienceId, id),
        eq(audienceContacts.contactId, contactId)
      )
    )
    .limit(1);

  if (!membership) {
    return c.json({ error: "Contact not in this audience" }, 404);
  }

  await db
    .delete(audienceContacts)
    .where(
      and(
        eq(audienceContacts.audienceId, id),
        eq(audienceContacts.contactId, contactId)
      )
    );

  await db
    .update(audiences)
    .set({ contactCount: sql`MAX(${audiences.contactCount} - 1, 0)` })
    .where(eq(audiences.id, id));

  return c.json({ message: "Contact removed from audience" });
});

export default app;
