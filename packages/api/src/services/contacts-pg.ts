import { eq, and, or, ilike, sql, desc, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { contacts, audiences, audienceContacts } from "../db/schema.js";
import { generateId } from "../utils/id.js";

export type ContactType = "individual" | "corporate";

export interface Contact {
  id: string;
  orgId: string;
  email: string;
  name: string | null;
  metadata: Record<string, string> | null;
  isUnsubscribed: boolean;
  type: ContactType | null;
  createdAt: string;
}

function toContact(row: typeof contacts.$inferSelect): Contact {
  return {
    id: row.id,
    orgId: row.orgId,
    email: row.email,
    name: row.name ?? null,
    metadata: row.metadata ?? null,
    isUnsubscribed: row.isUnsubscribed,
    type: (row.type as ContactType | null) ?? null,
    createdAt: row.createdAt,
  };
}

export async function listContacts(
  orgId: string,
  opts: { search?: string; limit: number; cursor?: string; type?: ContactType | "none" }
): Promise<{ data: Contact[]; total: number; nextCursor: string | null }> {
  const conditions: ReturnType<typeof eq>[] = [eq(contacts.orgId, orgId)];

  // Type filter
  if (opts.type === "none") {
    conditions.push(sql`${contacts.type} IS NULL` as any);
  } else if (opts.type) {
    conditions.push(eq(contacts.type, opts.type));
  }

  // Search filter
  if (opts.search) {
    const pattern = `%${opts.search}%`;
    conditions.push(
      or(
        ilike(contacts.email, pattern),
        ilike(contacts.name, pattern)
      )! as any
    );
  }

  const whereClause = and(...conditions)!;

  // Total count (unfiltered for the org, matching current behavior)
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(contacts)
    .where(eq(contacts.orgId, orgId));

  // Cursor-based pagination
  let cursorCondition: ReturnType<typeof and> | undefined;
  if (opts.cursor) {
    const [cursorRow] = await db
      .select({ createdAt: contacts.createdAt, id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, opts.cursor))
      .limit(1);

    if (cursorRow) {
      cursorCondition = or(
        sql`${contacts.createdAt} < ${cursorRow.createdAt}`,
        and(
          eq(contacts.createdAt, cursorRow.createdAt),
          sql`${contacts.id} < ${cursorRow.id}`
        )
      )! as any;
    }
  }

  const finalWhere = cursorCondition
    ? and(whereClause, cursorCondition)!
    : whereClause;

  const rows = await db
    .select()
    .from(contacts)
    .where(finalWhere)
    .orderBy(desc(contacts.createdAt), desc(contacts.id))
    .limit(opts.limit + 1);

  const hasMore = rows.length > opts.limit;
  const data = hasMore ? rows.slice(0, opts.limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return {
    data: data.map(toContact),
    total: Number(total),
    nextCursor,
  };
}

export async function getContact(orgId: string, contactId: string): Promise<Contact | null> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)))
    .limit(1);
  return row ? toContact(row) : null;
}

export async function createContact(
  orgId: string,
  data: { email: string; name?: string | null; metadata?: Record<string, string> | null; type?: ContactType | null }
): Promise<Contact> {
  const id = generateId("ct");
  const now = new Date().toISOString();

  try {
    await db.insert(contacts).values({
      id,
      orgId,
      email: data.email,
      name: data.name ?? null,
      metadata: data.metadata ?? null,
      isUnsubscribed: false,
      type: data.type ?? null,
      createdAt: now,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("contacts_org_email_idx")) {
      throw new Error("DUPLICATE");
    }
    throw err;
  }

  return (await getContact(orgId, id))!;
}

export async function updateContact(
  orgId: string,
  contactId: string,
  data: { email?: string; name?: string; metadata?: Record<string, string>; type?: ContactType | null }
): Promise<Contact | null> {
  const existing = await getContact(orgId, contactId);
  if (!existing) return null;

  const updates: Record<string, unknown> = {};
  if (data.email !== undefined) updates.email = data.email;
  if (data.name !== undefined) updates.name = data.name;
  if (data.metadata !== undefined) updates.metadata = data.metadata;
  if (data.type !== undefined) updates.type = data.type;

  if (Object.keys(updates).length > 0) {
    await db.update(contacts).set(updates).where(eq(contacts.id, contactId));
  }

  return (await getContact(orgId, contactId))!;
}

export async function deleteContact(orgId: string, contactId: string): Promise<boolean> {
  const existing = await getContact(orgId, contactId);
  if (!existing) return false;
  await db.delete(contacts).where(eq(contacts.id, contactId));
  return true;
}

export async function getContactsByIds(orgId: string, contactIds: string[]): Promise<Contact[]> {
  if (contactIds.length === 0) return [];

  const results: Contact[] = [];

  for (let i = 0; i < contactIds.length; i += 1000) {
    const chunk = contactIds.slice(i, i + 1000);
    const rows = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), inArray(contacts.id, chunk)));
    results.push(...rows.map(toContact));
  }

  return results;
}

export async function importContacts(
  orgId: string,
  items: { email: string; name: string | null; metadata: Record<string, string> | null; type?: ContactType | null; lists?: string[] }[]
): Promise<{ imported: number; skipped: number; listsCreated: number; listsAssigned: number }> {
  const now = new Date().toISOString();

  // Get existing emails for dedup counting
  const existingRows = await db
    .select({ id: contacts.id, email: contacts.email })
    .from(contacts)
    .where(eq(contacts.orgId, orgId));
  const existingEmailMap = new Map(existingRows.map((r) => [r.email.toLowerCase(), r.id]));

  let imported = 0;
  let skipped = 0;
  const batch: (typeof contacts.$inferInsert)[] = [];
  // email -> contactId mapping for list assignment
  const emailToId = new Map<string, string>();

  for (const item of items) {
    if (!item.email || !item.email.includes("@")) {
      skipped++;
      continue;
    }

    const emailLower = item.email.toLowerCase();
    const existingId = existingEmailMap.get(emailLower);

    if (existingId) {
      // Already exists - still track for list assignment
      emailToId.set(emailLower, existingId);
      skipped++;
      continue;
    }

    const id = generateId("ct");
    batch.push({
      id,
      orgId,
      email: item.email,
      name: item.name,
      metadata: item.metadata,
      isUnsubscribed: false,
      type: item.type ?? null,
      createdAt: now,
    });

    existingEmailMap.set(emailLower, id);
    emailToId.set(emailLower, id);
    imported++;
  }

  // Bulk insert in chunks
  for (let i = 0; i < batch.length; i += 500) {
    const chunk = batch.slice(i, i + 500);
    if (chunk.length > 0) {
      await db.insert(contacts).values(chunk).onConflictDoNothing();
    }
  }

  // Process list assignments
  let listsCreated = 0;
  let listsAssigned = 0;

  // Collect all unique list names
  const listNameSet = new Set<string>();
  for (const item of items) {
    if (item.lists) {
      for (const name of item.lists) {
        if (name.trim()) listNameSet.add(name.trim());
      }
    }
  }

  if (listNameSet.size > 0) {
    // Get existing audiences
    const existingAudiences = await db
      .select({ id: audiences.id, name: audiences.name })
      .from(audiences)
      .where(eq(audiences.orgId, orgId));
    const audienceNameMap = new Map(existingAudiences.map((a) => [a.name, a.id]));

    // Create missing audiences
    for (const name of listNameSet) {
      if (!audienceNameMap.has(name)) {
        const audId = generateId("aud");
        await db.insert(audiences).values({
          id: audId,
          orgId,
          name,
          description: null,
          contactCount: 0,
          createdAt: now,
        });
        audienceNameMap.set(name, audId);
        listsCreated++;
      }
    }

    // Build audience -> contactIds mapping
    const audienceContactsMap = new Map<string, Set<string>>();
    for (const item of items) {
      if (!item.lists || !item.email) continue;
      const contactId = emailToId.get(item.email.toLowerCase());
      if (!contactId) continue;

      for (const listName of item.lists) {
        const trimmed = listName.trim();
        if (!trimmed) continue;
        const audId = audienceNameMap.get(trimmed);
        if (!audId) continue;

        if (!audienceContactsMap.has(audId)) {
          audienceContactsMap.set(audId, new Set());
        }
        audienceContactsMap.get(audId)!.add(contactId);
      }
    }

    // Get existing audience_contacts to avoid duplicates
    for (const [audId, contactIdSet] of audienceContactsMap) {
      const existingAC = await db
        .select({ contactId: audienceContacts.contactId })
        .from(audienceContacts)
        .where(eq(audienceContacts.audienceId, audId));
      const existingSet = new Set(existingAC.map((r) => r.contactId));

      const newEntries = [...contactIdSet]
        .filter((cId) => !existingSet.has(cId))
        .map((cId) => ({ audienceId: audId, contactId: cId, addedAt: now }));

      if (newEntries.length > 0) {
        for (let i = 0; i < newEntries.length; i += 500) {
          const chunk = newEntries.slice(i, i + 500);
          await db.insert(audienceContacts).values(chunk).onConflictDoNothing();
        }
        listsAssigned += newEntries.length;

        // Update contact count
        await db
          .update(audiences)
          .set({ contactCount: sql`${audiences.contactCount} + ${newEntries.length}` })
          .where(eq(audiences.id, audId));
      }
    }
  }

  return { imported, skipped, listsCreated, listsAssigned };
}

export async function markContactsUnsubscribedByEmail(orgId: string, email: string): Promise<number> {
  await db
    .update(contacts)
    .set({ isUnsubscribed: true })
    .where(and(eq(contacts.orgId, orgId), eq(contacts.email, email)));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.email, email), eq(contacts.isUnsubscribed, true)));

  return Number(count);
}
