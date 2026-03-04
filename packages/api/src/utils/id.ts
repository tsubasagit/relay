import { randomBytes, createHash } from "crypto";

export function generateId(prefix: string): string {
  const rand = randomBytes(12).toString("base64url");
  return `${prefix}_${rand}`;
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("base64url");
  const key = `tm_live_${raw}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
