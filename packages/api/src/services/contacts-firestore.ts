import { firestore } from "../db/firestore.js";
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
    type: d.type ?? null,
    createdAt: d.createdAt,
  };
}

export async function listContacts(
  orgId: string,
  opts: { search?: string; limit: number; cursor?: string; type?: ContactType | "none" }
): Promise<{ data: Contact[]; total: number; nextCursor: string | null }> {
  const col = contactsCol(orgId);

  // type フィルタ（メモリフィルタ方式）
  const typeFilter = (doc: FirebaseFirestore.QueryDocumentSnapshot): boolean => {
    if (!opts.type) return true;
    const data = doc.data();
    if (opts.type === "none") return !data.type;
    return data.type === opts.type;
  };

  if (opts.search) {
    // 検索: emailプレフィックス検索 → Firestoreネイティブクエリで高速化
    // 部分一致が必要な場合のみメモリフィルタにフォールバック
    const searchLower = opts.search.toLowerCase();
    const endStr = searchLower.slice(0, -1) + String.fromCharCode(searchLower.charCodeAt(searchLower.length - 1) + 1);

    // emailプレフィックス検索をFirestoreネイティブで試行
    let query = col
      .where("email", ">=", searchLower)
      .where("email", "<", endStr);

    const prefixSnap = await query.limit(opts.limit + 1).get();

    // プレフィックス検索でヒットしなければ、名前でも検索（限定的なメモリフィルタ）
    if (prefixSnap.empty) {
      // 名前検索: emailSearchでヒットしない場合のみ全件走査
      // ただし件数を制限してパフォーマンス悪化を防ぐ
      const MAX_SCAN = 2000;
      let baseQuery = col.orderBy("createdAt", "desc").limit(MAX_SCAN);
      if (opts.cursor) {
        const cursorDoc = await col.doc(opts.cursor).get();
        if (cursorDoc.exists) {
          baseQuery = col.orderBy("createdAt", "desc").startAfter(cursorDoc).limit(MAX_SCAN);
        }
      }
      const scanSnap = await baseQuery.get();
      const filtered = scanSnap.docs.filter((d) => {
        if (!typeFilter(d)) return false;
        const data = d.data();
        return (
          (data.email && data.email.toLowerCase().includes(searchLower)) ||
          (data.name && data.name.toLowerCase().includes(searchLower))
        );
      });

      const countSnap = await col.count().get();
      const docs = filtered.slice(0, opts.limit);
      const nextCursor = docs.length === opts.limit && scanSnap.docs.length === MAX_SCAN
        ? scanSnap.docs[scanSnap.docs.length - 1].id
        : null;

      return {
        data: docs.map((d) => toContact(orgId, d)),
        total: countSnap.data().count,
        nextCursor,
      };
    }

    // プレフィックス検索成功（typeフィルタ適用）
    const prefixFiltered = opts.type ? prefixSnap.docs.filter(typeFilter) : prefixSnap.docs;
    const hasMore = prefixFiltered.length > opts.limit;
    const docs = hasMore ? prefixFiltered.slice(0, opts.limit) : prefixFiltered;
    const countSnap = await col.count().get();

    return {
      data: docs.map((d) => toContact(orgId, d)),
      total: countSnap.data().count,
      nextCursor: hasMore ? docs[docs.length - 1].id : null,
    };
  }

  // 通常一覧: カーソルベースページネーション
  const [countSnap, dataSnap] = await Promise.all([
    col.count().get(),
    (async () => {
      let query = col.orderBy("createdAt", "desc");
      if (opts.cursor) {
        const cursorDoc = await col.doc(opts.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }
      return query.limit(opts.limit + 1).get();
    })(),
  ]);

  const total = countSnap.data().count;

  // typeフィルタ適用
  if (opts.type) {
    const allDocs = dataSnap.docs.filter(typeFilter);
    const hasMore = allDocs.length > opts.limit;
    const docs = hasMore ? allDocs.slice(0, opts.limit) : allDocs;
    const nextCursor = hasMore ? docs[docs.length - 1].id : null;
    return {
      data: docs.map((d) => toContact(orgId, d)),
      total,
      nextCursor,
    };
  }

  const hasMore = dataSnap.docs.length > opts.limit;
  const docs = hasMore ? dataSnap.docs.slice(0, opts.limit) : dataSnap.docs;
  const nextCursor = hasMore ? docs[docs.length - 1].id : null;

  return {
    data: docs.map((d) => toContact(orgId, d)),
    total,
    nextCursor,
  };
}

export async function getContact(orgId: string, contactId: string): Promise<Contact | null> {
  const doc = await contactsCol(orgId).doc(contactId).get();
  if (!doc.exists) return null;
  return toContact(orgId, doc);
}

export async function createContact(
  orgId: string,
  data: { email: string; name?: string | null; metadata?: Record<string, string> | null; type?: ContactType | null }
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
      type: data.type ?? null,
      createdAt: new Date().toISOString(),
    });
  });

  return (await getContact(orgId, id))!;
}

export async function updateContact(
  orgId: string,
  contactId: string,
  data: { email?: string; name?: string; metadata?: Record<string, string>; type?: ContactType | null }
): Promise<Contact | null> {
  const ref = contactsCol(orgId).doc(contactId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const updates: Record<string, unknown> = {};
  if (data.email !== undefined) updates.email = data.email;
  if (data.name !== undefined) updates.name = data.name;
  if (data.metadata !== undefined) updates.metadata = data.metadata;
  if (data.type !== undefined) updates.type = data.type;

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
  items: { email: string; name: string | null; metadata: Record<string, string> | null; type?: ContactType | null }[]
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
      type: item.type ?? null,
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

/** 配信停止リンク等で、Firestore上のコンタクトも isUnsubscribed を同期する */
export async function markContactsUnsubscribedByEmail(orgId: string, email: string): Promise<number> {
  const col = contactsCol(orgId);
  const snap = await col.where("email", "==", email).get();
  if (snap.empty) return 0;

  const batch = firestore.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { isUnsubscribed: true });
  }
  await batch.commit();
  return snap.docs.length;
}
