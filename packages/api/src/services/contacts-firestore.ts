import { firestore } from "../db/firestore.js";
import { generateId } from "../utils/id.js";

export interface Contact {
  id: string;
  orgId: string;
  email: string;
  name: string | null;
  metadata: Record<string, string> | null;
  isUnsubscribed: boolean;
  createdAt: string;
}

function contactsCol(orgId: string) {
  return firestore.collection("organizations").doc(orgId).collection("contacts");
}

function toContact(orgId: string, doc: FirebaseFirestore.DocumentSnapshot): Contact {
  const d = doc.data()!;
  return {
    id: doc.id,
    orgId,
    email: d.email,
    name: d.name ?? null,
    metadata: d.metadata ?? null,
    isUnsubscribed: d.isUnsubscribed ?? false,
    createdAt: d.createdAt,
  };
}

export async function listContacts(
  orgId: string,
  opts: { search?: string; limit: number; offset: number }
): Promise<{ data: Contact[]; total: number }> {
  const col = contactsCol(orgId);

  // Count total (with or without search)
  let total: number;
  let docs: FirebaseFirestore.QueryDocumentSnapshot[];

  if (opts.search) {
    // Fetch all and filter in-memory (acceptable for small-to-medium datasets)
    const allSnap = await col.orderBy("createdAt", "desc").get();
    const searchLower = opts.search.toLowerCase();
    const filtered = allSnap.docs.filter((d) => {
      const data = d.data();
      return (
        (data.email && data.email.toLowerCase().includes(searchLower)) ||
        (data.name && data.name.toLowerCase().includes(searchLower))
      );
    });
    total = filtered.length;
    docs = filtered.slice(opts.offset, opts.offset + opts.limit);
  } else {
    const countSnap = await col.count().get();
    total = countSnap.data().count;
    // Fetch offset + limit, then skip offset
    const snap = await col
      .orderBy("createdAt", "desc")
      .limit(opts.offset + opts.limit)
      .get();
    docs = snap.docs.slice(opts.offset);
  }

  return {
    data: docs.map((d) => toContact(orgId, d)),
    total,
  };
}

export async function getContact(orgId: string, contactId: string): Promise<Contact | null> {
  const doc = await contactsCol(orgId).doc(contactId).get();
  if (!doc.exists) return null;
  return toContact(orgId, doc);
}

export async function createContact(
  orgId: string,
  data: { email: string; name?: string | null; metadata?: Record<string, string> | null }
): Promise<Contact> {
  const col = contactsCol(orgId);
  const id = generateId("ct");

  // Check duplicate in transaction
  await firestore.runTransaction(async (tx) => {
    const existing = await tx.get(col.where("email", "==", data.email).limit(1));
    if (!existing.empty) {
      throw new Error("DUPLICATE");
    }
    tx.set(col.doc(id), {
      email: data.email,
      name: data.name ?? null,
      metadata: data.metadata ?? null,
      isUnsubscribed: false,
      createdAt: new Date().toISOString(),
    });
  });

  return (await getContact(orgId, id))!;
}

export async function updateContact(
  orgId: string,
  contactId: string,
  data: { email?: string; name?: string; metadata?: Record<string, string> }
): Promise<Contact | null> {
  const ref = contactsCol(orgId).doc(contactId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const updates: Record<string, unknown> = {};
  if (data.email !== undefined) updates.email = data.email;
  if (data.name !== undefined) updates.name = data.name;
  if (data.metadata !== undefined) updates.metadata = data.metadata;

  if (Object.keys(updates).length > 0) {
    await ref.update(updates);
  }

  return (await getContact(orgId, contactId))!;
}

export async function deleteContact(orgId: string, contactId: string): Promise<boolean> {
  const ref = contactsCol(orgId).doc(contactId);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}

export async function getContactsByIds(orgId: string, contactIds: string[]): Promise<Contact[]> {
  if (contactIds.length === 0) return [];

  const col = contactsCol(orgId);
  const results: Contact[] = [];

  // Firestore getAll supports up to ~10000 refs
  const refs = contactIds.map((id) => col.doc(id));
  const chunks: FirebaseFirestore.DocumentReference[][] = [];
  for (let i = 0; i < refs.length; i += 100) {
    chunks.push(refs.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const docs = await firestore.getAll(...chunk);
    for (const doc of docs) {
      if (doc.exists) {
        results.push(toContact(orgId, doc));
      }
    }
  }

  return results;
}

export async function importContacts(
  orgId: string,
  items: { email: string; name: string | null; metadata: Record<string, string> | null }[]
): Promise<{ imported: number; skipped: number }> {
  const col = contactsCol(orgId);
  const now = new Date().toISOString();

  // Get existing emails for dedup
  const existingSnap = await col.select("email").get();
  const existingEmails = new Set(existingSnap.docs.map((d) => d.data().email.toLowerCase()));

  let imported = 0;
  let skipped = 0;

  // Batch write (max 500 per batch)
  let batch = firestore.batch();
  let batchCount = 0;

  for (const item of items) {
    if (!item.email || !item.email.includes("@")) {
      skipped++;
      continue;
    }

    if (existingEmails.has(item.email.toLowerCase())) {
      skipped++;
      continue;
    }

    const id = generateId("ct");
    batch.set(col.doc(id), {
      email: item.email,
      name: item.name,
      metadata: item.metadata,
      isUnsubscribed: false,
      createdAt: now,
    });

    existingEmails.add(item.email.toLowerCase());
    imported++;
    batchCount++;

    if (batchCount >= 450) {
      await batch.commit();
      batch = firestore.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return { imported, skipped };
}
