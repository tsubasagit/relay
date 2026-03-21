/**
 * 一回限りの移行スクリプト: PostgreSQL → Firestore にコンタクトを移行
 *
 * 使い方:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json npx tsx src/db/migrate-contacts-to-firestore.ts
 *
 * Cloud Run 上で実行する場合は Application Default Credentials が自動的に使われる。
 */
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../../.env") });

import { db } from "./client.js";
import { contacts } from "./schema.js";
import { firestore } from "./firestore.js";

async function migrate() {
  console.log("=== PostgreSQL → Firestore コンタクト移行 ===");

  // 全コンタクトを取得
  const allContacts = await db.select().from(contacts);
  console.log(`PostgreSQL に ${allContacts.length} 件のコンタクトがあります`);

  if (allContacts.length === 0) {
    console.log("移行するデータがありません");
    process.exit(0);
  }

  // orgId ごとにグループ化
  const byOrg = new Map<string, typeof allContacts>();
  for (const ct of allContacts) {
    const list = byOrg.get(ct.orgId) || [];
    list.push(ct);
    byOrg.set(ct.orgId, list);
  }

  let totalMigrated = 0;

  for (const [orgId, orgContacts] of byOrg) {
    console.log(`\n組織 ${orgId}: ${orgContacts.length} 件`);
    const col = firestore.collection("organizations").doc(orgId).collection("contacts");

    // バッチ書き込み (450件ずつ)
    let batch = firestore.batch();
    let batchCount = 0;

    for (const ct of orgContacts) {
      batch.set(col.doc(ct.id), {
        email: ct.email,
        name: ct.name ?? null,
        metadata: ct.metadata ?? null,
        isUnsubscribed: ct.isUnsubscribed ?? false,
        createdAt: ct.createdAt,
      });

      batchCount++;
      totalMigrated++;

      if (batchCount >= 450) {
        await batch.commit();
        console.log(`  ${totalMigrated} 件書き込み済み`);
        batch = firestore.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  }

  // 検証
  let totalInFirestore = 0;
  for (const [orgId] of byOrg) {
    const col = firestore.collection("organizations").doc(orgId).collection("contacts");
    const countSnap = await col.count().get();
    totalInFirestore += countSnap.data().count;
  }

  console.log(`\n=== 移行完了 ===`);
  console.log(`PostgreSQL: ${allContacts.length} 件`);
  console.log(`Firestore:  ${totalInFirestore} 件`);

  if (totalInFirestore >= allContacts.length) {
    console.log("✓ 件数一致 — 移行成功");
  } else {
    console.log("⚠ 件数不一致 — 確認してください");
  }

  process.exit(0);
}

migrate().catch((err) => {
  console.error("移行エラー:", err);
  process.exit(1);
});
