import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiKeys } from "../db/schema.js";
import { hashApiKey } from "../utils/id.js";

export const apiKeyAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const key = authHeader.slice(7);
  if (!key.startsWith("tm_live_")) {
    return c.json({ error: "Invalid API key format" }, 401);
  }

  const keyHash = hashApiKey(key);
  const [found] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!found || !found.isActive) {
    return c.json({ error: "Invalid or inactive API key" }, 401);
  }

  c.set("apiKey" as never, found);
  await next();
});
