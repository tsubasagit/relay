import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./client.js";

async function runMigrations() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations complete.");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
