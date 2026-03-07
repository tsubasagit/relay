import { Hono } from "hono";
import { z } from "zod";
import { eq, and, or, like, sql, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { contacts, audienceContacts, audiences, users } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { fetchGoogleWorkspaceContacts } from "../services/google-contacts.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

const contactSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

// List contacts
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
  const offset = parseInt(c.req.query("offset") || "0");

  const conditions = [eq(contacts.orgId, auth.orgId)];
  if (search) {
    conditions.push(
      or(
        like(contacts.email, `%${search}%`),
        like(contacts.name, `%${search}%`)
      )!
    );
  }

  const where = and(...conditions);

  const rows = await db
    .select()
    .from(contacts)
    .where(where)
    .orderBy(desc(contacts.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(where);

  return c.json({ data: rows, total: count, limit, offset });
});

// Get single contact
app.get("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, auth.orgId)))
    .limit(1);

  if (!contact) {
    return c.json({ error: "Contact not found" }, 404);
  }

  return c.json({ data: contact });
});

// Create contact
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  // Check duplicate
  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, auth.orgId), eq(contacts.email, parsed.data.email)))
    .limit(1);

  if (existing) {
    return c.json({ error: "Contact with this email already exists" }, 409);
  }

  const id = generateId("ct");
  const now = new Date().toISOString();

  await db.insert(contacts).values({
    id,
    orgId: auth.orgId,
    email: parsed.data.email,
    name: parsed.data.name ?? null,
    metadata: parsed.data.metadata ?? null,
    isUnsubscribed: false,
    createdAt: now,
  });

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return c.json({ data: contact }, 201);
});

// Update contact
app.put("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");
  const body = await c.req.json();

  const updateSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
    metadata: z.record(z.string()).optional(),
  });

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.metadata !== undefined) updates.metadata = parsed.data.metadata;

  if (Object.keys(updates).length > 0) {
    await db.update(contacts).set(updates).where(eq(contacts.id, id));
  }

  const [updated] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return c.json({ data: updated });
});

// Delete contact
app.delete("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Contact not found" }, 404);
  }

  // Get audience memberships to update counts
  const memberships = await db
    .select({ audienceId: audienceContacts.audienceId })
    .from(audienceContacts)
    .where(eq(audienceContacts.contactId, id));

  // Delete from audience_contacts first
  await db.delete(audienceContacts).where(eq(audienceContacts.contactId, id));

  // Update audience counts
  for (const m of memberships) {
    await db
      .update(audiences)
      .set({
        contactCount: sql`${audiences.contactCount} - 1`,
      })
      .where(eq(audiences.id, m.audienceId));
  }

  // Delete the contact
  await db.delete(contacts).where(eq(contacts.id, id));

  return c.json({ message: "Contact deleted" });
});

// CSV Import
app.post("/import", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const contentType = c.req.header("content-type") || "";

  let csvText: string;

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.parseBody();
    const file = formData.file;
    if (!file || typeof file === "string") {
      return c.json({ error: "No CSV file provided" }, 400);
    }
    csvText = await (file as File).text();
  } else {
    const body = await c.req.json();
    csvText = body.csv;
    if (!csvText) {
      return c.json({ error: "No CSV data provided" }, 400);
    }
  }

  const lines = csvText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return c.json({ error: "CSV must have a header row and at least one data row" }, 400);
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"(.*)"$/, "$1"));
  const emailIdx = headers.indexOf("email");
  if (emailIdx === -1) {
    return c.json({ error: "CSV must have an 'email' column" }, 400);
  }
  const nameIdx = headers.indexOf("name");

  let imported = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"(.*)"$/, "$1"));
    const email = values[emailIdx];
    if (!email || !email.includes("@")) {
      skipped++;
      continue;
    }

    const name = nameIdx >= 0 ? values[nameIdx] || null : null;

    // Build metadata from extra columns
    const metadata: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (idx !== emailIdx && idx !== nameIdx && values[idx]) {
        metadata[h] = values[idx];
      }
    });

    // Check duplicate
    const [existing] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.orgId, auth.orgId), eq(contacts.email, email)))
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(contacts).values({
      id: generateId("ct"),
      orgId: auth.orgId,
      email,
      name,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      isUnsubscribed: false,
      createdAt: now,
    });
    imported++;
  }

  return c.json({ data: { imported, skipped, total: lines.length - 1 } });
});

// Google Workspace Directory Import
app.post("/import/google", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;

  if (!auth.user) {
    return c.json({ error: "Session auth required for Google import" }, 400);
  }

  // Get user's Google tokens
  const [user] = await db
    .select({
      id: users.id,
      googleAccessToken: users.googleAccessToken,
      googleRefreshToken: users.googleRefreshToken,
    })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .limit(1);

  if (!user?.googleRefreshToken) {
    return c.json({
      error: "Google連絡先へのアクセス権がありません。再ログインしてください。",
    }, 400);
  }

  try {
    const { contacts: googleContacts, newAccessToken } =
      await fetchGoogleWorkspaceContacts(
        user.googleAccessToken || "",
        user.googleRefreshToken
      );

    // Update stored access token if refreshed
    if (newAccessToken !== user.googleAccessToken) {
      await db
        .update(users)
        .set({ googleAccessToken: newAccessToken })
        .where(eq(users.id, user.id));
    }

    const now = new Date().toISOString();
    let imported = 0;
    let skipped = 0;

    for (const gc of googleContacts) {
      if (!gc.email) {
        skipped++;
        continue;
      }

      // Check duplicate
      const [existing] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.orgId, auth.orgId), eq(contacts.email, gc.email)))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(contacts).values({
        id: generateId("ct"),
        orgId: auth.orgId,
        email: gc.email,
        name: gc.name,
        metadata: { source: "google_workspace" },
        isUnsubscribed: false,
        createdAt: now,
      });
      imported++;
    }

    return c.json({
      data: { imported, skipped, total: googleContacts.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Google Workspace import error:", message);
    return c.json({ error: `Google連絡先の取得に失敗しました: ${message}` }, 500);
  }
});

export default app;
