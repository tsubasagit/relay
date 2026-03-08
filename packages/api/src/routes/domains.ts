import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { promises as dns } from "dns";
import { db } from "../db/client.js";
import { domains } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { randomBytes } from "crypto";
import type { AuthContext } from "../middleware/combined-auth.js";

const app = new Hono();

const createDomainSchema = z.object({
  domain: z.string().min(1).regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/),
});

// List domains
app.get("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;

  const rows = await db
    .select()
    .from(domains)
    .where(eq(domains.orgId, auth.orgId));

  return c.json({ data: rows });
});

// Register domain
app.post("/", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const body = await c.req.json();
  const parsed = createDomainSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const domainName = parsed.data.domain.toLowerCase();

  // Check if already registered
  const [existing] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.orgId, auth.orgId), eq(domains.domain, domainName)))
    .limit(1);

  if (existing) {
    return c.json({ error: "Domain already registered" }, 409);
  }

  const verificationToken = `relay-verify-${randomBytes(16).toString("hex")}`;
  const now = new Date().toISOString();

  await db.insert(domains).values({
    id: generateId("dom"),
    orgId: auth.orgId,
    domain: domainName,
    status: "pending",
    verificationToken,
    createdAt: now,
  });

  const [created] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.orgId, auth.orgId), eq(domains.domain, domainName)))
    .limit(1);

  return c.json({
    data: created,
    dnsInstructions: {
      type: "TXT",
      name: `_relay.${domainName}`,
      value: verificationToken,
      description: `Add a TXT record for _relay.${domainName} with the value above to verify ownership.`,
    },
  }, 201);
});

// Verify domain (check DNS TXT record)
app.post("/:id/verify", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.orgId, auth.orgId)))
    .limit(1);

  if (!domain) return c.json({ error: "Domain not found" }, 404);

  if (domain.status === "verified") {
    return c.json({ data: domain, message: "Already verified" });
  }

  try {
    const records = await dns.resolveTxt(`_relay.${domain.domain}`);
    const flatRecords = records.map((r) => r.join(""));
    const verified = flatRecords.includes(domain.verificationToken);

    if (verified) {
      await db
        .update(domains)
        .set({ status: "verified" })
        .where(eq(domains.id, id));

      const [updated] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
      return c.json({ data: updated, message: "Domain verified" });
    }

    return c.json({
      error: "Verification failed",
      details: `TXT record _relay.${domain.domain} not found or doesn't match.`,
      expected: domain.verificationToken,
    }, 400);
  } catch (err) {
    return c.json({
      error: "DNS lookup failed",
      details: `Could not resolve _relay.${domain.domain}. Please check your DNS settings.`,
    }, 400);
  }
});

// Delete domain
app.delete("/:id", async (c) => {
  const auth = c.get("auth" as never) as AuthContext;
  const id = c.req.param("id");

  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.orgId, auth.orgId)))
    .limit(1);

  if (!domain) return c.json({ error: "Domain not found" }, 404);

  await db.delete(domains).where(eq(domains.id, id));
  return c.json({ message: "Domain deleted" });
});

export default app;
