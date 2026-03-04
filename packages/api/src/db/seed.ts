import "dotenv/config";
import { db, sqlite } from "./client.js";
import { apiKeys } from "./schema.js";
import { generateId, generateApiKey } from "../utils/id.js";
import { initDatabase } from "./init.js";

initDatabase();

// Check if any keys exist
const existing = db.select().from(apiKeys).all();
if (existing.length > 0) {
  console.log("API keys already exist. Skipping seed.");
  process.exit(0);
}

// Create initial API key
const { key, hash, prefix } = generateApiKey();
const row = {
  id: generateId("key"),
  name: "初期キー",
  keyHash: hash,
  keyPrefix: prefix,
  scopes: ["send", "templates", "logs", "keys"],
  isActive: true,
  createdAt: new Date().toISOString(),
};

db.insert(apiKeys).values(row).run();

console.log("=".repeat(60));
console.log("初期APIキーを作成しました");
console.log("このキーは一度だけ表示されます。安全に保存してください。");
console.log("");
console.log(`  API Key: ${key}`);
console.log("");
console.log("Dashboardの設定画面にこのキーを入力してください。");
console.log("=".repeat(60));

sqlite.close();
