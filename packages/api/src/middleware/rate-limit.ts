import type { Context, Next } from "hono";

interface RateLimitEntry {
  timestamps: number[];
}

const ipStore = new Map<string, RateLimitEntry>();
const keyStore = new Map<string, RateLimitEntry>();

// Plan-based limits (requests per minute)
const planLimits: Record<string, number> = {
  free: 60,
  pro: 100,
  enterprise: 500,
};

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipStore) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
    if (entry.timestamps.length === 0) ipStore.delete(key);
  }
  for (const [key, entry] of keyStore) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
    if (entry.timestamps.length === 0) keyStore.delete(key);
  }
}, 60_000);

function slidingWindowCheck(
  store: Map<string, RateLimitEntry>,
  key: string,
  windowMs: number,
  max: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0];
    const resetMs = oldest + windowMs - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: max - entry.timestamps.length, resetMs: windowMs };
}

function setRateLimitHeaders(c: Context, max: number, remaining: number, resetMs: number) {
  c.header("X-RateLimit-Limit", String(max));
  c.header("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  c.header("X-RateLimit-Reset", String(Math.ceil(resetMs / 1000)));
}

/**
 * Rate limit by IP address — for public endpoints.
 */
export function rateLimitByIp(windowMs: number = 60_000, max: number = 60) {
  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    const result = slidingWindowCheck(ipStore, ip, windowMs, max);
    setRateLimitHeaders(c, max, result.remaining, result.resetMs);

    if (!result.allowed) {
      c.header("Retry-After", String(Math.ceil(result.resetMs / 1000)));
      return c.json(
        { error: "Too many requests", retryAfter: Math.ceil(result.resetMs / 1000) },
        429
      );
    }

    await next();
  };
}

// Dashboard (session) gets a higher limit since page navigations generate many parallel requests
const SESSION_LIMIT = 300;
const sessionStore = new Map<string, RateLimitEntry>();

// Cleanup session store alongside other stores
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessionStore) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
    if (entry.timestamps.length === 0) sessionStore.delete(key);
  }
}, 60_000);

/**
 * Rate limit by API key or session — for protected endpoints.
 * Uses org plan to determine the limit for API keys.
 * Dashboard (session) users get a generous fixed limit.
 * Session and API key use separate stores so they don't interfere.
 */
export function rateLimitByKey(windowMs: number = 60_000, defaultMax: number = 60) {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth" as never) as { orgId: string; plan?: string; authType?: string } | undefined;
    const key = auth?.orgId || "anonymous";
    const isSession = auth?.authType === "session";
    const plan = auth?.plan || "free";
    const max = isSession ? SESSION_LIMIT : (planLimits[plan] || defaultMax);
    const store = isSession ? sessionStore : keyStore;

    const result = slidingWindowCheck(store, key, windowMs, max);
    setRateLimitHeaders(c, max, result.remaining, result.resetMs);

    if (!result.allowed) {
      c.header("Retry-After", String(Math.ceil(result.resetMs / 1000)));
      return c.json(
        { error: "Too many requests", retryAfter: Math.ceil(result.resetMs / 1000) },
        429
      );
    }

    await next();
  };
}
