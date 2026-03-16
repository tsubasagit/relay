import "dotenv/config";
import { db } from "./client.js";
import { apiKeys, organizations, orgMembers, users } from "./schema.js";
import { generateId, generateApiKey } from "../utils/id.js";
import { initDatabase } from "./init.js";

async function seed() {
  await initDatabase();

  // Check if any orgs exist
  const existingOrgs = await db.select().from(organizations);
  if (existingOrgs.length > 0) {
    console.log("Data already exists. Skipping seed.");
    process.exit(0);
  }

  const now = new Date().toISOString();

  // Create a default org
  const orgId = generateId("org");
  await db.insert(organizations).values({
    id: orgId,
    name: "AppTalentHub",
    slug: "apptalenthub",
    plan: "free",
    createdAt: now,
  });

  // Create a seed user
  const userId = generateId("usr");
  await db.insert(users).values({
    id: userId,
    googleId: "seed-user",
    email: "admin@apptalenthub.co.jp",
    name: "Admin",
    avatarUrl: null,
    createdAt: now,
  });

  // Add user as admin of org
  await db.insert(orgMembers).values({
    id: generateId("mem"),
    orgId,
    userId,
    role: "admin",
    joinedAt: now,
  });

  // Create initial API key
  const { key, hash, prefix } = generateApiKey();
  await db.insert(apiKeys).values({
    id: generateId("key"),
    orgId,
    name: "初期キー",
    keyHash: hash,
    keyPrefix: prefix,
    scopes: ["send", "templates", "logs", "keys"],
    isActive: true,
    createdBy: userId,
    createdAt: now,
  });

  console.log("=".repeat(60));
  console.log("Seed completed!");
  console.log("");
  console.log(`  Organization: AppTalentHub (${orgId})`);
  console.log(`  API Key: ${key}`);
  console.log("");
  console.log("このAPIキーは一度だけ表示されます。安全に保存してください。");
  console.log("=".repeat(60));
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
