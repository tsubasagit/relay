import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { emailProviders } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { encrypt, decrypt } from "../utils/crypto.js";
import { createProvider } from "../services/providers/factory.js";
import type { AuthContext } from "../middleware/combined-auth.js";
import type { ProviderType } from "../services/providers/types.js";

const app = new Hono();

const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(1),
  secure: z.boolean().optional(),
});

const sendgridConfigSchema = z.object({
  apiKey: z.string().min(1),
});

const sesConfigSchema = z.object({
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  region: z.string().min(1),
});

const createProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["smtp", "sendgrid", "ses"]),
  config: z.record(z.unknown()),
  isDefault: z.boolean().default(false),
});

function validateProviderConfig(type: string, config: Record<string, unknown>) {
  switch (type) {
    case "smtp":
      return smtpConfigSchema.safeParse(config);
    case "sendgrid":
      return sendgridConfigSchema.safeParse(config);
    case "ses":
      return sesConfigSchema.safeParse(config);
    default:
      return { success: false, error: { flatten: () => ({ fieldErrors: {}, formErrors: ["Unknown provider type"] }) } } as const;
  }
}

function maskConfig(type: string, config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config };
  if (type === "smtp" && typeof masked.password === "string") {
    masked.password = "••••••••";
  }
  if (type === "sendgrid" && typeof masked.apiKey === "string") {
    masked.apiKey = masked.apiKey.slice(0, 8) + "••••••••";
  }
  if (type === "ses" && typeof masked.secretAccessKey === "string") {
    masked.secretAccessKey = "••••••••";
  }
  return masked;
}

// List providers
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;

  const rows = await db
    .select()
    .from(emailProviders)
    .where(eq(emailProviders.orgId, auth.orgId));

  const data = rows.map((row) => {
    const decrypted = JSON.parse(decrypt(row.config));
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      config: maskConfig(row.type, decrypted),
      isDefault: row.isDefault,
      createdAt: row.createdAt,
    };
  });

  return c.json({ data });
});

// Create provider
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();
  const parsed = createProviderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const configValidation = validateProviderConfig(parsed.data.type, parsed.data.config);
  if (!configValidation.success) {
    return c.json({ error: "Invalid provider config", details: configValidation.error.flatten() }, 400);
  }

  const encryptedConfig = encrypt(JSON.stringify(parsed.data.config));

  // If this is the default, unset other defaults
  if (parsed.data.isDefault) {
    await db
      .update(emailProviders)
      .set({ isDefault: false })
      .where(eq(emailProviders.orgId, auth.orgId));
  }

  const now = new Date().toISOString();
  const id = generateId("prov");

  await db.insert(emailProviders).values({
    id,
    orgId: auth.orgId,
    name: parsed.data.name,
    type: parsed.data.type,
    config: encryptedConfig,
    isDefault: parsed.data.isDefault,
    createdAt: now,
  });

  return c.json({
    data: {
      id,
      name: parsed.data.name,
      type: parsed.data.type,
      config: maskConfig(parsed.data.type, parsed.data.config),
      isDefault: parsed.data.isDefault,
      createdAt: now,
    },
  }, 201);
});

// Update provider
app.put("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(emailProviders)
    .where(and(eq(emailProviders.id, id), eq(emailProviders.orgId, auth.orgId)))
    .limit(1);

  if (!existing) return c.json({ error: "Provider not found" }, 404);

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};

  if (body.name) updates.name = body.name;

  if (body.config) {
    // Merge with existing config (allow partial updates)
    const existingConfig = JSON.parse(decrypt(existing.config));
    const mergedConfig = { ...existingConfig, ...body.config };

    // Re-validate merged config
    const configValidation = validateProviderConfig(existing.type, mergedConfig);
    if (!configValidation.success) {
      return c.json({ error: "Invalid provider config", details: configValidation.error.flatten() }, 400);
    }
    updates.config = encrypt(JSON.stringify(mergedConfig));
  }

  if (body.isDefault !== undefined) {
    if (body.isDefault) {
      await db
        .update(emailProviders)
        .set({ isDefault: false })
        .where(eq(emailProviders.orgId, auth.orgId));
    }
    updates.isDefault = body.isDefault;
  }

  await db.update(emailProviders).set(updates).where(eq(emailProviders.id, id));

  const [updated] = await db
    .select()
    .from(emailProviders)
    .where(eq(emailProviders.id, id))
    .limit(1);

  const decryptedConfig = JSON.parse(decrypt(updated.config));
  return c.json({
    data: {
      id: updated.id,
      name: updated.name,
      type: updated.type,
      config: maskConfig(updated.type, decryptedConfig),
      isDefault: updated.isDefault,
      createdAt: updated.createdAt,
    },
  });
});

// Delete provider
app.delete("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(emailProviders)
    .where(and(eq(emailProviders.id, id), eq(emailProviders.orgId, auth.orgId)))
    .limit(1);

  if (!existing) return c.json({ error: "Provider not found" }, 404);

  await db.delete(emailProviders).where(eq(emailProviders.id, id));
  return c.json({ message: "Provider deleted" });
});

// Test provider connection
app.post("/:id/test", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [record] = await db
    .select()
    .from(emailProviders)
    .where(and(eq(emailProviders.id, id), eq(emailProviders.orgId, auth.orgId)))
    .limit(1);

  if (!record) return c.json({ error: "Provider not found" }, 404);

  const decryptedConfig = decrypt(record.config);
  const provider = createProvider(record.type as ProviderType, decryptedConfig);
  const result = await provider.verify();

  if (result.success) {
    return c.json({ message: "Connection successful" });
  }
  return c.json({ error: "Connection failed", details: result.error }, 400);
});

export default app;
