import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
} from "../services/contacts-firestore.js";
import { audienceContacts, audiences } from "../db/schema.js";
import { sql } from "drizzle-orm";
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

  const result = await listContacts(auth.orgId, { search, limit, offset });
  return c.json({ data: result.data, total: result.total, limit, offset });
});

// Get single contact
app.get("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const contact = await getContact(auth.orgId, id);
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

  try {
    const contact = await createContact(auth.orgId, {
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      metadata: parsed.data.metadata ?? null,
    });
    return c.json({ data: contact }, 201);
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE") {
      return c.json({ error: "Contact with this email already exists" }, 409);
    }
    throw err;
  }
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

  const updated = await updateContact(auth.orgId, id, parsed.data);
  if (!updated) {
    return c.json({ error: "Contact not found" }, 404);
  }
  return c.json({ data: updated });
});

// Delete contact
app.delete("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const deleted = await deleteContact(auth.orgId, id);
  if (!deleted) {
    return c.json({ error: "Contact not found" }, 404);
  }

  // Clean up audience_contacts in PostgreSQL
  const memberships = await db
    .select({ audienceId: audienceContacts.audienceId })
    .from(audienceContacts)
    .where(eq(audienceContacts.contactId, id));

  await db.delete(audienceContacts).where(eq(audienceContacts.contactId, id));

  for (const m of memberships) {
    await db
      .update(audiences)
      .set({ contactCount: sql`MAX(${audiences.contactCount} - 1, 0)` })
      .where(eq(audiences.id, m.audienceId));
  }

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

  const items: { email: string; name: string | null; metadata: Record<string, string> | null }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"(.*)"$/, "$1"));
    const email = values[emailIdx];
    const name = nameIdx >= 0 ? values[nameIdx] || null : null;

    const metadata: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (idx !== emailIdx && idx !== nameIdx && values[idx]) {
        metadata[h] = values[idx];
      }
    });

    items.push({
      email,
      name,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  }

  const result = await importContacts(auth.orgId, items);
  return c.json({ data: { ...result, total: lines.length - 1 } });
});

// Google Workspace Directory Import
app.post("/import/google", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;

  if (!auth.user) {
    return c.json({ error: "Session auth required for Google import" }, 400);
  }

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

    if (newAccessToken !== user.googleAccessToken) {
      await db
        .update(users)
        .set({ googleAccessToken: newAccessToken })
        .where(eq(users.id, user.id));
    }

    const items = googleContacts
      .filter((gc) => gc.email)
      .map((gc) => ({
        email: gc.email!,
        name: gc.name || null,
        metadata: { source: "google_workspace" } as Record<string, string>,
      }));

    const result = await importContacts(auth.orgId, items);
    return c.json({
      data: { ...result, total: googleContacts.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Google Workspace import error:", message);
    return c.json({ error: `Google連絡先の取得に失敗しました: ${message}` }, 500);
  }
});

export default app;
