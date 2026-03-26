/**
 * One-time migration: Firestore → PostgreSQL (contacts)
 *
 * Usage:
 *   npx tsx src/db/migrate-contacts-to-pg.ts
 */
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Try multiple .env paths for Windows/WSL compatibility
dotenvConfig({ path: resolve(__dirname, "../../../.env") });
dotenvConfig({ path: resolve(process.cwd(), ".env") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firestore init
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || "relay-email-ath",
  });
}
const firestore = getFirestore();

// PostgreSQL init
const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient);

async function migrate() {
  console.log("=== Firestore → PostgreSQL コンタクト移行 ===\n");

  // type カラム追加（存在しなければ）
  await sqlClient`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type TEXT`;

  // 全組織を取得
  const orgsResult = await sqlClient`SELECT id FROM organizations`;
  const orgs = Array.isArray(orgsResult) ? orgsResult : (orgsResult as any).rows || [];
  console.log(`${orgs.length} organizations found\n`);

  let totalMigrated = 0;

  for (const org of orgs as { id: string }[]) {
    const col = firestore.collection("organizations").doc(org.id).collection("contacts");
    const snapshot = await col.get();

    if (snapshot.empty) {
      console.log(`Org ${org.id}: 0 contacts — skip`);
      continue;
    }

    console.log(`Org ${org.id}: ${snapshot.docs.length} contacts`);

    const values: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const doc of snapshot.docs) {
      const d = doc.data();
      values.push(
        `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}::jsonb, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
      );
      params.push(
        doc.id,
        org.id,
        d.email,
        d.name ?? null,
        d.metadata ? JSON.stringify(d.metadata) : null,
        d.isUnsubscribed ?? false,
        d.type ?? null,
        d.createdAt,
      );
    }

    // Batch insert with ON CONFLICT DO NOTHING
    for (let i = 0; i < snapshot.docs.length; i += 200) {
      const chunk = snapshot.docs.slice(i, i + 200);
      const chunkValues: string[] = [];
      const chunkParams: unknown[] = [];
      let idx = 1;

      for (const doc of chunk) {
        const d = doc.data();
        chunkValues.push(
          `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, $${idx++}, $${idx++})`
        );
        chunkParams.push(
          doc.id, org.id, d.email, d.name ?? null,
          d.metadata ? JSON.stringify(d.metadata) : null,
          d.isUnsubscribed ?? false, d.type ?? null, d.createdAt,
        );
      }

      const query = `
        INSERT INTO contacts (id, org_id, email, name, metadata, is_unsubscribed, type, created_at)
        VALUES ${chunkValues.join(", ")}
        ON CONFLICT (org_id, email) DO NOTHING
      `;
      await sqlClient.query(query, chunkParams);
      totalMigrated += chunk.length;
    }

    console.log(`  → ${snapshot.docs.length} records processed`);
  }

  // Verify
  const countResult = await sqlClient`SELECT count(*) as count FROM contacts`;
  const count = (Array.isArray(countResult) ? countResult[0]?.count : 0);
  console.log(`\n=== Migration complete ===`);
  console.log(`PostgreSQL contacts: ${count}`);

  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
