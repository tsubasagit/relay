import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { organizations, orgMembers, orgInvitations, users } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { sessionAuth, type SessionUser } from "../middleware/session.js";
import { randomBytes } from "crypto";

const app = new Hono();

// All org routes require session auth
app.use("*", sessionAuth);

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

// List user's organizations
app.get("/", async (c) => {
  const user = c.get("user" as never) as SessionUser;

  const memberships = await db
    .select({
      org: organizations,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, user.id));

  return c.json({
    data: memberships.map((m) => ({
      ...m.org,
      role: m.role,
    })),
  });
});

// Create organization
app.post("/", async (c) => {
  const user = c.get("user" as never) as SessionUser;
  const body = await c.req.json();
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  // Check slug uniqueness
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, parsed.data.slug))
    .limit(1);

  if (existing) {
    return c.json({ error: "Slug already taken" }, 409);
  }

  const now = new Date().toISOString();
  const orgId = generateId("org");

  await db.insert(organizations).values({
    id: orgId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    plan: "free",
    createdAt: now,
  });

  // Creator becomes admin
  await db.insert(orgMembers).values({
    id: generateId("mem"),
    orgId,
    userId: user.id,
    role: "admin",
    joinedAt: now,
  });

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return c.json({ data: { ...org, role: "admin" } }, 201);
});

// Get org details
app.get("/:id", async (c) => {
  const user = c.get("user" as never) as SessionUser;
  const orgId = c.req.param("id");

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)))
    .limit(1);

  if (!membership) {
    return c.json({ error: "Not a member" }, 403);
  }

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return c.json({ error: "Organization not found" }, 404);

  return c.json({ data: { ...org, role: membership.role } });
});

// Update org
app.put("/:id", async (c) => {
  const user = c.get("user" as never) as SessionUser;
  const orgId = c.req.param("id");

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)))
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }

  const body = await c.req.json();
  const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  await db.update(organizations).set({ name: parsed.data.name }).where(eq(organizations.id, orgId));
  const [updated] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return c.json({ data: updated });
});

// List members
app.get("/:id/members", async (c) => {
  const user = c.get("user" as never) as SessionUser;
  const orgId = c.req.param("id");

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)))
    .limit(1);

  if (!membership) {
    return c.json({ error: "Not a member" }, 403);
  }

  const members = await db
    .select({
      id: orgMembers.id,
      role: orgMembers.role,
      joinedAt: orgMembers.joinedAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));

  return c.json({ data: members });
});

// Invite member
app.post("/:id/invite", async (c) => {
  const user = c.get("user" as never) as SessionUser;
  const orgId = c.req.param("id");

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)))
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }

  const body = await c.req.json();
  const parsed = z
    .object({
      email: z.string().email(),
      role: z.enum(["admin", "member"]).default("member"),
    })
    .safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await db.insert(orgInvitations).values({
    id: generateId("inv"),
    orgId,
    email: parsed.data.email,
    role: parsed.data.role,
    token,
    invitedBy: user.id,
    expiresAt,
    createdAt: now,
  });

  return c.json({ data: { token, email: parsed.data.email, expiresAt } }, 201);
});

// Remove member
app.delete("/:id/members/:memberId", async (c) => {
  const user = c.get("user" as never) as SessionUser;
  const orgId = c.req.param("id");
  const memberId = c.req.param("memberId");

  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)))
    .limit(1);

  if (!membership || membership.role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }

  await db.delete(orgMembers).where(eq(orgMembers.id, memberId));
  return c.json({ message: "Member removed" });
});

export default app;
