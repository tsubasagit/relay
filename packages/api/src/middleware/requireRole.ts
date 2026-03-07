import { createMiddleware } from "hono/factory";
import type { AuthContext } from "./combined-auth.js";

export function requireRole(role: "admin" | "member") {
  return createMiddleware(async (c, next) => {
    const auth = c.get("auth" as never) as AuthContext;

    // API key auth always has full access
    if (auth.authType === "apikey") {
      await next();
      return;
    }

    if (role === "member") {
      await next();
      return;
    }

    // Check admin role
    const membership = c.get("membership" as never) as { role: string } | undefined;
    if (membership?.role !== "admin") {
      return c.json({ error: "Admin access required" }, 403);
    }

    await next();
  });
}
