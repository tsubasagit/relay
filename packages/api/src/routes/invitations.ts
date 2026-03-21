import { Hono } from "hono";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { orgInvitations, orgMembers, organizations } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { sessionAuth, type SessionUser } from "../middleware/session.js";

const app = new Hono();

// Accept invitation (requires session)
app.post("/:token", sessionAuth, async (c) => {
  const user = c.get("user" as never) as SessionUser;
  const token = c.req.param("token");
  const now = new Date().toISOString();

  const [invitation] = await db
    .select()
    .from(orgInvitations)
    .where(and(eq(orgInvitations.token, token), gt(orgInvitations.expiresAt, now)))
    .limit(1);

  if (!invitation) {
    return c.json({ error: "Invalid or expired invitation" }, 404);
  }

  // Check if user email matches invitation
  if (invitation.email !== user.email) {
    return c.json({ error: "Invitation is for a different email address" }, 403);
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, invitation.orgId), eq(orgMembers.userId, user.id)))
    .limit(1);

  if (existing) {
    // Delete invitation and return
    await db.delete(orgInvitations).where(eq(orgInvitations.id, invitation.id));
    return c.json({ message: "Already a member", orgId: invitation.orgId });
  }

  // Add as member
  await db.insert(orgMembers).values({
    id: generateId("mem"),
    orgId: invitation.orgId,
    userId: user.id,
    role: invitation.role,
    joinedAt: now,
  });

  // Delete invitation
  await db.delete(orgInvitations).where(eq(orgInvitations.id, invitation.id));

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, invitation.orgId))
    .limit(1);

  return c.json({ message: "Joined organization", data: org });
});

// Get invitation info (public, shows org name)
app.get("/:token", async (c) => {
  const token = c.req.param("token");
  const now = new Date().toISOString();

  const [invitation] = await db
    .select({
      email: orgInvitations.email,
      role: orgInvitations.role,
      expiresAt: orgInvitations.expiresAt,
      orgName: organizations.name,
    })
    .from(orgInvitations)
    .innerJoin(organizations, eq(orgInvitations.orgId, organizations.id))
    .where(and(eq(orgInvitations.token, token), gt(orgInvitations.expiresAt, now)))
    .limit(1);

  if (!invitation) {
    return c.json({ error: "Invalid or expired invitation" }, 404);
  }

  return c.json({ data: invitation });
});

export default app;
