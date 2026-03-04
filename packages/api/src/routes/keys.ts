import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiKeys } from "../db/schema.js";
import { generateId, generateApiKey } from "../utils/id.js";

const app = new Hono();

const createKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default(["send", "templates", "logs"]),
});

// List keys (no hash exposed)
app.get("/", async (c) => {
  const rows = await db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    scopes: apiKeys.scopes,
    isActive: apiKeys.isActive,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys);

  return c.json({ data: rows });
});

// Create key — returns full key only once
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { key, hash, prefix } = generateApiKey();
  const row = {
    id: generateId("key"),
    name: parsed.data.name,
    keyHash: hash,
    keyPrefix: prefix,
    scopes: parsed.data.scopes,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await db.insert(apiKeys).values(row);

  return c.json({
    data: {
      id: row.id,
      name: row.name,
      key,
      keyPrefix: prefix,
      scopes: row.scopes,
      createdAt: row.createdAt,
    },
    message: "Save this API key — it won't be shown again.",
  }, 201);
});

// Revoke key
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(eq(apiKeys.id, id));

  return c.json({ message: "API key revoked" });
});

export default app;
