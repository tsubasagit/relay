import { createMiddleware } from "hono/factory";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiKeys, orgMembers, organizations, sessions, users } from "../db/schema.js";
import { hashApiKey } from "../utils/id.js";
import type { SessionUser } from "./session.js";

export interface AuthContext {
  user?: SessionUser;
  orgId: string;
  plan: string;
  authType: "session" | "apikey";
}

/**
 * Combined auth: accepts either session cookie + X-Org-Id header,
 * or API key bearer token (which carries orgId automatically).
 */
export const combinedAuth = createMiddleware(async (c, next) => {
  // Try API key first
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer rl_live_")) {
    const key = authHeader.slice(7);
    const keyHash = hashApiKey(key);
    const [found] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!found || !found.isActive) {
      return c.json({ error: "Invalid or inactive API key" }, 401);
    }

    const [org] = await db
      .select({ plan: organizations.plan })
      .from(organizations)
      .where(eq(organizations.id, found.orgId))
      .limit(1);

    const ctx: AuthContext = {
      orgId: found.orgId,
      plan: org?.plan || "free",
      authType: "apikey",
    };
    c.set("auth" as never, ctx);
    c.set("apiKey" as never, found);
    await next();
    return;
  }

  // Try session cookie
  const cookieHeader = c.req.header("Cookie") || "";
  const match = cookieHeader.match(/relay_session=([^;]+)/);
  if (!match) {
    return c.json({ error: "Missing authentication" }, 401);
  }

  const sessionId = match[1];
  const now = new Date().toISOString();

  const [session] = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) {
    return c.json({ error: "Session expired" }, 401);
  }

  // Require X-Org-Id header for session-based auth
  const orgId = c.req.header("X-Org-Id");
  if (!orgId) {
    return c.json({ error: "X-Org-Id header required" }, 400);
  }

  // Verify user is member of the org
  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, session.userId)))
    .limit(1);

  if (!membership) {
    return c.json({ error: "Not a member of this organization" }, 403);
  }

  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const user: SessionUser = {
    id: session.userId,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatarUrl,
  };

  const ctx: AuthContext = {
    user,
    orgId,
    plan: org?.plan || "free",
    authType: "session",
  };
  c.set("auth" as never, ctx);
  c.set("membership" as never, membership);
  await next();
});
