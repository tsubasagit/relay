import { Hono } from "hono";
import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { audiences, audienceContacts, broadcasts } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { getContact, getContactsByIds } from "../services/contacts-pg.js";
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

// Add contacts to audience（`/:id` 単体より先に登録）
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

  const debugId = `aud_add_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
  let skippedNotFound = 0;
  let skippedDuplicate = 0;

  try {
    for (const contactId of parsed.data.contactIds) {
      const contact = await getContact(auth.orgId, contactId);
      if (!contact) {
        skippedNotFound++;
        continue;
      }

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

      if (existing) {
        skippedDuplicate++;
        continue;
      }

      await db.insert(audienceContacts).values({
        audienceId: id,
        contactId,
        addedAt: now,
      });
      added++;
    }
  } catch (err) {
    console.error("[AUDIENCES:addContacts]", {
      debugId,
      orgId: auth.orgId,
      audienceId: id,
      requested: parsed.data.contactIds.length,
      added,
      skippedNotFound,
      skippedDuplicate,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "オーディエンスへの追加に失敗しました", debugId }, 500);
  }

  const totalRequested = parsed.data.contactIds.length;
  if (added === 0 && totalRequested > 0 && skippedNotFound === totalRequested) {
    return c.json(
      { error: "指定したコンタクトがこの組織に見つかりません" },
      400
    );
  }

  // Update contact count
  await db
    .update(audiences)
    .set({ contactCount: sql`${audiences.contactCount} + ${added}` })
    .where(eq(audiences.id, id));

  const [updated] = await db.select().from(audiences).where(eq(audiences.id, id)).limit(1);
  console.info("[AUDIENCES:addContacts]", {
    debugId,
    orgId: auth.orgId,
    audienceId: id,
    requested: parsed.data.contactIds.length,
    added,
    skippedNotFound,
    skippedDuplicate,
  });
  return c.json({
    data: updated,
    added,
    skippedNotFound,
    skippedDuplicate,
  });
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
    .set({ contactCount: sql`GREATEST(${audiences.contactCount} - 1, 0)` })
    .where(eq(audiences.id, id));

  return c.json({ message: "Contact removed from audience" });
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

  const acRows = await db
    .select({ contactId: audienceContacts.contactId, addedAt: audienceContacts.addedAt })
    .from(audienceContacts)
    .where(eq(audienceContacts.audienceId, id))
    .orderBy(desc(audienceContacts.addedAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(audienceContacts)
    .where(eq(audienceContacts.audienceId, id));

  const contactIds = acRows.map((r) => r.contactId);
  const contactsData = await getContactsByIds(auth.orgId, contactIds);
  const contactMap = new Map(contactsData.map((ct) => [ct.id, ct]));

  const members = acRows
    .map((r) => {
      const ct = contactMap.get(r.contactId);
      if (!ct) return null;
      return {
        id: ct.id,
        email: ct.email,
        name: ct.name,
        isUnsubscribed: ct.isUnsubscribed,
        createdAt: ct.createdAt,
        addedAt: r.addedAt,
      };
    })
    .filter(Boolean);

  return c.json({ data: { ...audience, contacts: members }, total: count, limit, offset });
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
  const debugId = `aud_del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const [existing] = await db
    .select()
    .from(audiences)
    .where(and(eq(audiences.id, id), eq(audiences.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Audience not found" }, 404);
  }

  try {
    await db.delete(audienceContacts).where(eq(audienceContacts.audienceId, id));
    await db.delete(broadcasts).where(and(eq(broadcasts.audienceId, id), eq(broadcasts.orgId, auth.orgId)));
    await db.delete(audiences).where(eq(audiences.id, id));
  } catch (err) {
    console.error("[AUDIENCES:delete]", {
      debugId,
      orgId: auth.orgId,
      audienceId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "オーディエンスの削除に失敗しました", debugId }, 500);
  }

  console.info("[AUDIENCES:delete]", { debugId, orgId: auth.orgId, audienceId: id });
  return c.json({ message: "Audience deleted" });
});

export default app;
