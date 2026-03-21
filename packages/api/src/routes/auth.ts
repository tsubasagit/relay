import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, sessions } from "../db/schema.js";
import { generateId } from "../utils/id.js";
import { getAuthUrl, getGoogleUser } from "../services/google-auth.js";
import { autoSetup } from "../services/auto-setup.js";
import { sessionAuth } from "../middleware/session.js";
import { config } from "../config.js";

const app = new Hono();

// Redirect to Google OAuth
app.get("/google", (c) => {
  const url = getAuthUrl();
  return c.redirect(url, 302);
});

// Google OAuth callback
app.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: "Missing code parameter" }, 400);
  }

  try {
    const googleUser = await getGoogleUser(code);

    // Find or create user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleUser.googleId))
      .limit(1);

    if (!user) {
      const now = new Date().toISOString();
      const userId = generateId("usr");
      await db.insert(users).values({
        id: userId,
        googleId: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl,
        googleAccessToken: googleUser.accessToken,
        googleRefreshToken: googleUser.refreshToken,
        createdAt: now,
      });
      [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    } else {
      // Update profile info + tokens
      const tokenUpdates: Record<string, unknown> = {
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl,
      };
      if (googleUser.accessToken) tokenUpdates.googleAccessToken = googleUser.accessToken;
      if (googleUser.refreshToken) tokenUpdates.googleRefreshToken = googleUser.refreshToken;
      await db
        .update(users)
        .set(tokenUpdates)
        .where(eq(users.id, user.id));
    }

    // Create session (30 days)
    const sessionId = generateId("sess");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    // 自動セットアップ（初回ログイン時に組織・プロバイダー・送信アドレスを作成）
    try {
      await autoSetup(user.id, user.email, user.name);
    } catch (err) {
      console.error("Auto-setup error:", err);
    }

    // Set cookie and redirect to dashboard
    const cookieOpts = "Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000";
    return new Response(null, {
      status: 302,
      headers: {
        Location: config.dashboardUrl,
        "Set-Cookie": `relay_session=${sessionId}; ${cookieOpts}`,
      },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    return c.json({ error: "Authentication failed" }, 500);
  }
});

// Get current user
app.get("/me", sessionAuth, async (c) => {
  const user = c.get("user" as never);
  return c.json({ data: user });
});

// Logout
app.post("/logout", async (c) => {
  const cookieHeader = c.req.header("Cookie") || "";
  const match = cookieHeader.match(/relay_session=([^;]+)/);
  if (match) {
    await db.delete(sessions).where(eq(sessions.id, match[1]));
  }

  return new Response(JSON.stringify({ message: "Logged out" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "relay_session=; Path=/; HttpOnly; Max-Age=0",
    },
  });
});

export default app;
