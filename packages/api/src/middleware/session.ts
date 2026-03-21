import { createMiddleware } from "hono/factory";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export const sessionAuth = createMiddleware(async (c, next) => {
  const cookieHeader = c.req.header("Cookie") || "";
  const match = cookieHeader.match(/relay_session=([^;]+)/);
  if (!match) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const sessionId = match[1];
  const now = new Date().toISOString();

  const [session] = await db
    .select({
      sessionId: sessions.id,
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

  const user: SessionUser = {
    id: session.userId,
    email: session.email,
    name: session.name,
    avatarUrl: session.avatarUrl,
  };

  c.set("user" as never, user);
  await next();
});
