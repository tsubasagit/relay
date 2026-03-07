import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { sendingAddresses, domains } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

const createAddressSchema = z.object({
  address: z.string().email(),
  displayName: z.string().optional(),
});

// List sending addresses
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;

  const rows = await db
    .select({
      id: sendingAddresses.id,
      address: sendingAddresses.address,
      displayName: sendingAddresses.displayName,
      domainId: sendingAddresses.domainId,
      domain: domains.domain,
      domainStatus: domains.status,
      createdAt: sendingAddresses.createdAt,
    })
    .from(sendingAddresses)
    .innerJoin(domains, eq(sendingAddresses.domainId, domains.id))
    .where(eq(sendingAddresses.orgId, auth.orgId));

  return c.json({ data: rows });
});

// Create sending address
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();
  const parsed = createAddressSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  // Extract domain from email
  const emailDomain = parsed.data.address.split("@")[1].toLowerCase();

  // Find matching verified domain
  const [domain] = await db
    .select()
    .from(domains)
    .where(
      and(
        eq(domains.orgId, auth.orgId),
        eq(domains.domain, emailDomain),
        eq(domains.status, "verified")
      )
    )
    .limit(1);

  if (!domain) {
    return c.json({
      error: `Domain ${emailDomain} is not verified. Register and verify the domain first.`,
    }, 400);
  }

  // Check uniqueness
  const [existing] = await db
    .select()
    .from(sendingAddresses)
    .where(
      and(eq(sendingAddresses.orgId, auth.orgId), eq(sendingAddresses.address, parsed.data.address))
    )
    .limit(1);

  if (existing) {
    return c.json({ error: "Address already registered" }, 409);
  }

  const now = new Date().toISOString();
  const id = generateId("addr");

  await db.insert(sendingAddresses).values({
    id,
    orgId: auth.orgId,
    domainId: domain.id,
    address: parsed.data.address,
    displayName: parsed.data.displayName ?? null,
    createdAt: now,
  });

  return c.json({
    data: {
      id,
      address: parsed.data.address,
      displayName: parsed.data.displayName ?? null,
      domainId: domain.id,
      domain: domain.domain,
      domainStatus: domain.status,
      createdAt: now,
    },
  }, 201);
});

// Update sending address
app.put("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(sendingAddresses)
    .where(and(eq(sendingAddresses.id, id), eq(sendingAddresses.orgId, auth.orgId)))
    .limit(1);

  if (!existing) return c.json({ error: "Address not found" }, 404);

  const body = await c.req.json();
  const parsed = z.object({ displayName: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  await db
    .update(sendingAddresses)
    .set({ displayName: parsed.data.displayName })
    .where(eq(sendingAddresses.id, id));

  return c.json({ message: "Updated" });
});

// Delete sending address
app.delete("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(sendingAddresses)
    .where(and(eq(sendingAddresses.id, id), eq(sendingAddresses.orgId, auth.orgId)))
    .limit(1);

  if (!existing) return c.json({ error: "Address not found" }, 404);

  await db.delete(sendingAddresses).where(eq(sendingAddresses.id, id));
  return c.json({ message: "Deleted" });
});

export default app;
